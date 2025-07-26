import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

// Configuration for the segmented streaming system
export const STREAMING_CONFIG = {
  BACKEND_URL: 'https://functions-offers-audit-insertion.trycloudflare.com',
  CACHE_DIR: './audio_cache',
  SEGMENT_DURATION: {
    FIRST_SEGMENT: 15, // First segment: 15 seconds for instant playback
    OTHER_SEGMENTS: 30  // Other segments: 30 seconds each
  },
  MAX_CONCURRENT_DOWNLOADS: 3,
  POLLING_INTERVAL: 2000, // Check for new segments every 2 seconds
  MAX_RETRIES: 3,
  REQUEST_TIMEOUT: 10000 // 10 second timeout per request
};

// Interface for segment status
export interface SegmentStatus {
  videoId: string;
  ready: number[];
  downloading: number[];
  failed: number[];
  totalSegments?: number;
}

// Interface for download progress
export interface DownloadProgress {
  videoId: string;
  completedSegments: number[];
  downloadingSegments: number[];
  failedSegments: number[];
  isComplete: boolean;
}

// Utility class for managing segmented audio downloads
export class SegmentedAudioManager {
  private downloadingVideos = new Map<string, Set<number>>(); // Track downloading segments
  private completedSegments = new Map<string, Set<number>>(); // Track completed segments
  private abortControllers = new Map<string, AbortController>(); // For canceling downloads

  constructor() {
    this.ensureCacheDirectory();
  }

  /**
   * Ensure the cache directory exists
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(STREAMING_CONFIG.CACHE_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  /**
   * Get the status of available segments for a video
   */
  async getSegmentStatus(videoId: string): Promise<SegmentStatus | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), STREAMING_CONFIG.REQUEST_TIMEOUT);

      const response = await fetch(`${STREAMING_CONFIG.BACKEND_URL}/status?v=${videoId}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SegmentedAudioManager/1.0)'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        videoId,
        ready: data.ready || [],
        downloading: this.downloadingVideos.get(videoId) ? Array.from(this.downloadingVideos.get(videoId)!) : [],
        failed: [],
        totalSegments: data.totalSegments
      };

    } catch (error) {
      console.error(`Failed to get segment status for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Download a specific segment
   */
  async downloadSegment(videoId: string, segmentNumber: number): Promise<boolean> {
    const segmentPath = this.getSegmentPath(videoId, segmentNumber);
    
    // Check if segment already exists
    try {
      await fs.access(segmentPath);
      console.log(`Segment ${segmentNumber} for ${videoId} already exists`);
      this.markSegmentCompleted(videoId, segmentNumber);
      return true;
    } catch {
      // Segment doesn't exist, proceed with download
    }

    // Mark as downloading
    this.markSegmentDownloading(videoId, segmentNumber);

    let retries = 0;
    while (retries < STREAMING_CONFIG.MAX_RETRIES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), STREAMING_CONFIG.REQUEST_TIMEOUT);

        const response = await fetch(`${STREAMING_CONFIG.BACKEND_URL}/stream?v=${videoId}&segment=${segmentNumber}`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SegmentedAudioManager/1.0)'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }

        // Ensure video directory exists
        await fs.mkdir(path.dirname(segmentPath), { recursive: true });

        // Stream the response directly to file
        const fileStream = createWriteStream(segmentPath);
        
        if (response.body) {
          await pipeline(Readable.fromWeb(response.body as any), fileStream);
        } else {
          throw new Error('No response body received');
        }

        console.log(`Successfully downloaded segment ${segmentNumber} for ${videoId}`);
        this.markSegmentCompleted(videoId, segmentNumber);
        return true;

      } catch (error) {
        retries++;
        console.error(`Download attempt ${retries} failed for segment ${segmentNumber} of ${videoId}:`, error);
        
        if (retries >= STREAMING_CONFIG.MAX_RETRIES) {
          this.markSegmentFailed(videoId, segmentNumber);
          return false;
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
      }
    }

    return false;
  }

  /**
   * Download all available segments for a video
   */
  async downloadAllSegments(videoId: string, onProgress?: (progress: DownloadProgress) => void): Promise<DownloadProgress> {
    console.log(`Starting segmented download for video: ${videoId}`);
    
    const abortController = new AbortController();
    this.abortControllers.set(videoId, abortController);

    const progress: DownloadProgress = {
      videoId,
      completedSegments: [],
      downloadingSegments: [],
      failedSegments: [],
      isComplete: false
    };

    try {
      // Download first segment immediately (priority for instant playback)
      const firstSegmentSuccess = await this.downloadSegment(videoId, 0);
      if (firstSegmentSuccess) {
        progress.completedSegments.push(0);
      } else {
        progress.failedSegments.push(0);
      }

      if (onProgress) onProgress({ ...progress });

      // Start continuous monitoring and downloading
      const downloadPromise = this.continuousSegmentDownload(videoId, progress, onProgress);
      
      return await downloadPromise;

    } catch (error) {
      console.error(`Download process failed for ${videoId}:`, error);
      progress.isComplete = true;
      return progress;
    } finally {
      this.abortControllers.delete(videoId);
    }
  }

  /**
   * Continuously check for and download new segments
   */
  private async continuousSegmentDownload(
    videoId: string, 
    progress: DownloadProgress,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<DownloadProgress> {
    
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;

    while (!progress.isComplete && consecutiveFailures < maxConsecutiveFailures) {
      try {
        // Check if download was aborted
        const abortController = this.abortControllers.get(videoId);
        if (abortController?.signal.aborted) {
          break;
        }

        // Get current status
        const status = await this.getSegmentStatus(videoId);
        if (!status) {
          consecutiveFailures++;
          await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.POLLING_INTERVAL));
          continue;
        }

        consecutiveFailures = 0; // Reset on successful status check

        // Find new segments to download
        const newSegments = status.ready.filter(segmentNum => 
          !progress.completedSegments.includes(segmentNum) &&
          !progress.downloadingSegments.includes(segmentNum) &&
          !progress.failedSegments.includes(segmentNum)
        );

        // Limit concurrent downloads
        const currentDownloading = this.downloadingVideos.get(videoId)?.size || 0;
        const availableSlots = STREAMING_CONFIG.MAX_CONCURRENT_DOWNLOADS - currentDownloading;
        const segmentsToDownload = newSegments.slice(0, availableSlots);

        // Start downloading new segments
        const downloadPromises = segmentsToDownload.map(async (segmentNum) => {
          progress.downloadingSegments.push(segmentNum);
          if (onProgress) onProgress({ ...progress });

          const success = await this.downloadSegment(videoId, segmentNum);
          
          // Update progress
          progress.downloadingSegments = progress.downloadingSegments.filter(s => s !== segmentNum);
          
          if (success) {
            progress.completedSegments.push(segmentNum);
            progress.completedSegments.sort((a, b) => a - b); // Keep sorted
          } else {
            progress.failedSegments.push(segmentNum);
          }

          if (onProgress) onProgress({ ...progress });
        });

        await Promise.all(downloadPromises);

        // Check if we're done (no more segments available and none downloading)
        if (newSegments.length === 0 && (this.downloadingVideos.get(videoId)?.size || 0) === 0) {
          // Check if this looks like the end (no new segments for a while)
          // or if we have a reasonable number of segments already
          if (status.totalSegments !== undefined) {
            progress.isComplete = progress.completedSegments.length >= status.totalSegments;
          } else {
            // Heuristic: if we haven't seen new segments for a while, consider complete
            progress.isComplete = newSegments.length === 0 && consecutiveFailures === 0;
          }
        }

        // Wait before next check
        if (!progress.isComplete) {
          await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.POLLING_INTERVAL));
        }

      } catch (error) {
        consecutiveFailures++;
        console.error(`Error in continuous download for ${videoId}:`, error);
        await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.POLLING_INTERVAL));
      }
    }

    progress.isComplete = true;
    return progress;
  }

  /**
   * Get the file path for a segment
   */
  private getSegmentPath(videoId: string, segmentNumber: number): string {
    return path.join(STREAMING_CONFIG.CACHE_DIR, videoId, `segment_${segmentNumber}.m4a`);
  }

  /**
   * Get the directory path for a video's segments
   */
  getVideoDirectory(videoId: string): string {
    return path.join(STREAMING_CONFIG.CACHE_DIR, videoId);
  }

  /**
   * Mark segment as downloading
   */
  private markSegmentDownloading(videoId: string, segmentNumber: number): void {
    if (!this.downloadingVideos.has(videoId)) {
      this.downloadingVideos.set(videoId, new Set());
    }
    this.downloadingVideos.get(videoId)!.add(segmentNumber);
  }

  /**
   * Mark segment as completed
   */
  private markSegmentCompleted(videoId: string, segmentNumber: number): void {
    // Remove from downloading
    this.downloadingVideos.get(videoId)?.delete(segmentNumber);
    
    // Add to completed
    if (!this.completedSegments.has(videoId)) {
      this.completedSegments.set(videoId, new Set());
    }
    this.completedSegments.get(videoId)!.add(segmentNumber);
  }

  /**
   * Mark segment as failed
   */
  private markSegmentFailed(videoId: string, segmentNumber: number): void {
    this.downloadingVideos.get(videoId)?.delete(segmentNumber);
  }

  /**
   * Cancel all downloads for a video
   */
  cancelDownloads(videoId: string): void {
    const abortController = this.abortControllers.get(videoId);
    if (abortController) {
      abortController.abort();
    }
    this.downloadingVideos.delete(videoId);
  }

  /**
   * Check if a specific segment exists locally
   */
  async hasSegment(videoId: string, segmentNumber: number): Promise<boolean> {
    try {
      const segmentPath = this.getSegmentPath(videoId, segmentNumber);
      await fs.access(segmentPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all locally available segments for a video
   */
  async getLocalSegments(videoId: string): Promise<number[]> {
    try {
      const videoDir = this.getVideoDirectory(videoId);
      const files = await fs.readdir(videoDir);
      
      const segments = files
        .filter(file => file.startsWith('segment_') && file.endsWith('.m4a'))
        .map(file => {
          const match = file.match(/segment_(\d+)\.m4a/);
          return match ? parseInt(match[1]) : -1;
        })
        .filter(num => num >= 0)
        .sort((a, b) => a - b);

      return segments;
    } catch (error) {
      return [];
    }
  }

  /**
   * Clean up old cached segments (optional, for storage management)
   */
  async cleanupOldCache(maxAgeHours: number = 24): Promise<void> {
    try {
      const cacheContents = await fs.readdir(STREAMING_CONFIG.CACHE_DIR);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);

      for (const videoId of cacheContents) {
        const videoDir = path.join(STREAMING_CONFIG.CACHE_DIR, videoId);
        
        try {
          const stats = await fs.stat(videoDir);
          if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
            await fs.rm(videoDir, { recursive: true, force: true });
            console.log(`Cleaned up old cache for video: ${videoId}`);
          }
        } catch (error) {
          // Skip files that can't be accessed
        }
      }
    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }
}

// Create a singleton instance for the application
export const segmentedAudioManager = new SegmentedAudioManager();

// Convenience functions for easy integration

/**
 * Quick function to get the first segment (for instant playback)
 */
export async function getFirstSegmentQuickly(videoId: string): Promise<string | null> {
  try {
    // Check if first segment already exists locally
    const hasLocal = await segmentedAudioManager.hasSegment(videoId, 0);
    if (hasLocal) {
      return segmentedAudioManager.getVideoDirectory(videoId) + '/segment_0.m4a';
    }

    // Download first segment immediately
    const success = await segmentedAudioManager.downloadSegment(videoId, 0);
    if (success) {
      return segmentedAudioManager.getVideoDirectory(videoId) + '/segment_0.m4a';
    }

    return null;
  } catch (error) {
    console.error('Failed to get first segment quickly:', error);
    return null;
  }
}

/**
 * Start background downloading for a video (fire and forget)
 */
export async function startBackgroundDownload(videoId: string): Promise<void> {
  // Don't await this - let it run in background
  segmentedAudioManager.downloadAllSegments(videoId, (progress) => {
    console.log(`Download progress for ${videoId}: ${progress.completedSegments.length} segments completed`);
  }).catch(error => {
    console.error(`Background download failed for ${videoId}:`, error);
  });
}