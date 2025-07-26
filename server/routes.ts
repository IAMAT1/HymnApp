import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import { storage } from "./storage";
import ytdl from "ytdl-core";
import { segmentedAudioManager, getFirstSegmentQuickly, startBackgroundDownload, STREAMING_CONFIG } from "./segmentedStreaming";
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { completeMusicRouter } from "./completeMusicAPI";

// Helper functions for segmented streaming
async function handleSegmentRequest(videoId: string, segmentNum: number, req: any, res: any): Promise<void> {
  try {
    // Check if segment exists locally first
    const hasLocal = await segmentedAudioManager.hasSegment(videoId, segmentNum);
    if (hasLocal) {
      const segmentPath = path.join(segmentedAudioManager.getVideoDirectory(videoId), `segment_${segmentNum}.m4a`);
      return await serveLocalSegment(segmentPath, req, res);
    }

    // Try to download segment from new backend
    console.log(`Downloading segment ${segmentNum} for ${videoId}`);
    const downloadSuccess = await segmentedAudioManager.downloadSegment(videoId, segmentNum);
    
    if (downloadSuccess) {
      const segmentPath = path.join(segmentedAudioManager.getVideoDirectory(videoId), `segment_${segmentNum}.m4a`);
      return await serveLocalSegment(segmentPath, req, res);
    }

    // If segment download failed, try direct streaming from backend
    const directUrl = `${STREAMING_CONFIG.BACKEND_URL}/stream?v=${videoId}&segment=${segmentNum}`;
    await proxyStreamFromUrl(directUrl, req, res);

  } catch (error) {
    console.error(`Segment request failed for ${videoId} segment ${segmentNum}:`, error);
    res.status(500).json({ error: "Segment streaming failed" });
  }
}

// Helper method to serve local segment files
async function serveLocalSegment(filePath: string, req: any, res: any): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    // Set headers for audio streaming
    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    if (range) {
      // Handle range requests for seeking
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      
      const file = createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunkSize,
      };
      
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Serve entire file
      res.setHeader('Content-Length', fileSize);
      const file = createReadStream(filePath);
      file.pipe(res);
    }
  } catch (error) {
    console.error('Error serving local segment:', error);
    res.status(500).json({ error: "Failed to serve audio segment" });
  }
}

// Helper method to create or serve merged complete audio file
async function tryNewBackendContinuousStream(videoId: string, req: any, res: any): Promise<boolean> {
  try {
    console.log(`Checking for merged audio file: ${videoId}`);
    
    // Check if we already have a merged complete audio file
    const mergedFilePath = path.join(segmentedAudioManager.getVideoDirectory(videoId), 'complete.m4a');
    
    try {
      await fs.access(mergedFilePath);
      console.log(`Serving existing merged audio file: ${videoId}`);
      await serveLocalSegment(mergedFilePath, req, res);
      return true;
    } catch {
      // Merged file doesn't exist, try to create it
      console.log(`Creating merged audio file for: ${videoId}`);
      
      const localSegments = await segmentedAudioManager.getLocalSegments(videoId);
      if (localSegments.length >= 4) { // We have enough segments
        console.log(`Merging ${localSegments.length} segments into complete audio file`);
        
        const mergeSuccess = await createMergedAudioFile(videoId, localSegments.sort(), mergedFilePath);
        if (mergeSuccess) {
          console.log(`Successfully created merged audio file: ${videoId}`);
          await serveLocalSegment(mergedFilePath, req, res);
          return true;
        }
      }
      
      // Skip FFmpeg merging for now - just serve first segment for instant playback
      console.log('Skipping merge - serving first segment for instant playback');
      const firstSegmentPath = path.join(segmentedAudioManager.getVideoDirectory(videoId), 'segment_0.m4a');
      
      try {
        await fs.access(firstSegmentPath);
        console.log('Serving existing first segment');
        startBackgroundDownload(videoId); // Continue downloading other segments
        await serveLocalSegment(firstSegmentPath, req, res);
        return true;
      } catch {
        // Download first segment if not available
        const downloaded = await segmentedAudioManager.downloadSegment(videoId, 0);
        if (downloaded) {
          startBackgroundDownload(videoId); // Continue downloading other segments
          await serveLocalSegment(firstSegmentPath, req, res);
          return true;
        }
      }
    }
    
    return false;

  } catch (error) {
    console.log(`New backend streaming failed for ${videoId}:`, (error as Error).message);
    return false;
  }
}

// Helper to create merged complete audio file from segments
async function createMergedAudioFile(videoId: string, segmentNumbers: number[], outputPath: string): Promise<boolean> {
  try {
    console.log(`Merging segments [${segmentNumbers.join(', ')}] for ${videoId}`);
    
    // Create list of segment files for ffmpeg
    const segmentFiles = segmentNumbers.map(num => {
      return path.join(segmentedAudioManager.getVideoDirectory(videoId), `segment_${num}.m4a`);
    });
    
    // Verify all segment files exist
    for (const segmentFile of segmentFiles) {
      try {
        await fs.access(segmentFile);
      } catch {
        console.log(`Segment file missing: ${segmentFile}`);
        return false;
      }
    }
    
    // Create ffmpeg concat file list
    const concatListPath = path.join(path.dirname(outputPath), 'concat_list.txt');
    const concatContent = segmentFiles.map(file => `file '${file}'`).join('\n');
    await fs.writeFile(concatListPath, concatContent);
    
    // Use ffmpeg to merge segments properly (this creates a valid continuous MP4)
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${outputPath}"`;
    
    return new Promise(async (resolve) => {
      const { spawn } = await import('child_process');
      // Use ffmpeg to re-encode and properly merge segments (ensures valid continuous MP4)
      const process = spawn('ffmpeg', ['-f', 'concat', '-safe', '0', '-i', concatListPath, '-c:a', 'aac', '-b:a', '128k', outputPath]);
      
      process.on('close', async (code) => {
        // Clean up concat file
        try {
          await fs.unlink(concatListPath);
        } catch {}
        
        if (code === 0) {
          console.log(`Successfully merged audio for ${videoId}`);
          resolve(true);
        } else {
          console.log(`FFmpeg failed with code ${code}`);
          resolve(false);
        }
      });
      
      process.on('error', (error) => {
        console.log(`FFmpeg error: ${error.message}`);
        resolve(false);
      });
    });

  } catch (error) {
    console.log(`Error merging audio for ${videoId}:`, (error as Error).message);
    return false;
  }
}

// Helper method to proxy stream from a URL
async function proxyStreamFromUrl(url: string, req: any, res: any, timeout: number = 10000): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: any = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
    
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    
    // Set streaming headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-cache');

    // Handle range headers
    const contentLength = response.headers.get('content-length');
    if (req.headers.range && contentLength) {
      res.setHeader('Content-Range', response.headers.get('content-range') || `bytes 0-${parseInt(contentLength) - 1}/${contentLength}`);
      res.status(206);
    } else if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Stream the response
    if (response.body) {
      const reader = response.body.getReader();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            if (!res.write(value)) {
              await new Promise(resolve => res.once('drain', resolve));
            }
          }
          res.end();
        } catch (streamError) {
          console.error('Stream pump error:', streamError);
          res.end();
        }
      };
      
      await pump();
    } else {
      const audioBuffer = await response.arrayBuffer();
      res.end(Buffer.from(audioBuffer));
    }

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Serve continuous stream from available segments
async function serveContinuousSegmentStream(videoId: string, req: any, res: any): Promise<void> {
  try {
    console.log(`Creating continuous segment stream for ${videoId}`);
    
    // Get available local segments
    const localSegments = await segmentedAudioManager.getLocalSegments(videoId);
    if (localSegments.length === 0) {
      throw new Error('No local segments available');
    }

    // Set streaming headers for continuous playback
    res.setHeader('Content-Type', 'audio/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');

    console.log(`Streaming ${localSegments.length} segments: [${localSegments.join(', ')}]`);

    // Stream segments sequentially to create continuous playback
    for (let i = 0; i < localSegments.length; i++) {
      const segmentNum = localSegments[i];
      const segmentPath = path.join(segmentedAudioManager.getVideoDirectory(videoId), `segment_${segmentNum}.m4a`);
      
      try {
        // Check if segment exists
        await fs.access(segmentPath);
        
        // Stream this segment
        console.log(`Streaming segment ${segmentNum}`);
        const segmentStream = createReadStream(segmentPath);
        
        // Pipe segment data to response
        await new Promise((resolve, reject) => {
          segmentStream.on('data', (chunk: Buffer) => {
            if (!res.write(chunk)) {
              // If write returns false, wait for drain
              res.once('drain', () => {});
            }
          });
          
          segmentStream.on('end', resolve);
          segmentStream.on('error', reject);
        });
        
      } catch (segmentError) {
        console.log(`Segment ${segmentNum} not available, trying to download...`);
        
        // Try to download missing segment quickly
        const downloaded = await segmentedAudioManager.downloadSegment(videoId, segmentNum);
        if (downloaded) {
          // Retry streaming this segment
          const segmentPath = path.join(segmentedAudioManager.getVideoDirectory(videoId), `segment_${segmentNum}.m4a`);
          const segmentStream = createReadStream(segmentPath);
          
          await new Promise((resolve, reject) => {
            segmentStream.on('data', (chunk: Buffer) => {
              if (!res.write(chunk)) {
                res.once('drain', () => {});
              }
            });
            
            segmentStream.on('end', resolve);
            segmentStream.on('error', reject);
          });
        } else {
          console.log(`Failed to download segment ${segmentNum}, skipping`);
        }
      }
    }

    // End the response
    res.end();
    console.log(`Continuous stream completed for ${videoId}`);

  } catch (error) {
    console.error(`Continuous segment streaming failed for ${videoId}:`, error);
    res.status(500).json({ error: "Continuous streaming failed" });
  }
}

// Fallback to old backend for compatibility
async function fallbackToOldBackend(videoId: string, req: any, res: any): Promise<void> {
  const oldBackendUrl = 'https://implement-franchise-becoming-set.trycloudflare.com';
  const streamUrl = `${oldBackendUrl}/stream?v=${videoId}`;
  
  console.log('Using fallback backend:', streamUrl);
  
  try {
    await proxyStreamFromUrl(streamUrl, req, res, 15000); // 15 second timeout for old backend
  } catch (error) {
    console.error('Fallback backend also failed:', error);
    
    if ((error as Error).name === 'AbortError') {
      res.status(202).json({ 
        success: false,
        error: 'Processing',
        message: 'Song is being prepared, please try again in a few seconds',
        videoId: videoId,
        retry: true
      });
    } else {
      res.status(503).json({ 
        error: 'All streaming services temporarily unavailable',
        message: 'Both primary and fallback backends failed',
        videoId: videoId
      });
    }
  }
}

// Removed Python-based Complete Music API due to dependency issues

export async function registerRoutes(app: Express): Promise<Server> {
  // Cache for backend searches to avoid repeated API calls
  const searchCache = new Map<string, string>();
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  
  // Download status tracking for song preparation
  const downloadStatus = new Map<string, 'downloading' | 'ready' | 'failed'>();
  const downloadRequests = new Set<string>();

  // Search endpoint using reliable web APIs (no yt-dlp)
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      // Check cache first
      const cacheKey = query.toLowerCase();
      if (searchCache.has(cacheKey)) {
        const cachedVideoId = searchCache.get(cacheKey)!;
        console.log('Using cached video ID for:', query);
        return res.json({ video_id: cachedVideoId });
      }

      // Try multiple YouTube search methods in order with timeout
      let videoId = null;
      const searchTimeout = 5000; // 5 second timeout per search method

      // Method 1: Try Piped API (reliable public instance) with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), searchTimeout);
        
        const pipedResponse = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (pipedResponse.ok) {
          const data = await pipedResponse.json();
          if (data.items && data.items.length > 0) {
            const firstVideo = data.items[0];
            if (firstVideo.url) {
              videoId = firstVideo.url.replace('/watch?v=', '');
              console.log('Found via Piped API:', videoId);
            }
          }
        }
      } catch (pipedError) {
        console.log('Piped API failed:', (pipedError as Error).message);
      }

      // Method 2: Try InnerTube API alternative with timeout
      if (!videoId) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), searchTimeout);
          
          const searchQuery = encodeURIComponent(query);
          const innertubeResponse = await fetch('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: 'WEB',
                  clientVersion: '2.20241201'
                }
              },
              query: query
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (innertubeResponse.ok) {
            const data = await innertubeResponse.json();
            if (data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents) {
              const results = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
              for (const section of results) {
                if (section.itemSectionRenderer?.contents) {
                  for (const item of section.itemSectionRenderer.contents) {
                    if (item.videoRenderer?.videoId) {
                      videoId = item.videoRenderer.videoId;
                      console.log('Found via InnerTube API:', videoId);
                      break;
                    }
                  }
                  if (videoId) break;
                }
              }
            }
          }
        } catch (innertubeError) {
          console.log('InnerTube API failed:', (innertubeError as Error).message);
        }
      }

      if (videoId && videoId.length === 11) {
        // Cache the successful result
        searchCache.set(cacheKey, videoId);
        setTimeout(() => searchCache.delete(cacheKey), CACHE_DURATION);
        
        res.json({ video_id: videoId });
      } else {
        res.status(500).json({ error: "No video found" });
      }

    } catch (error) {
      console.error("Search endpoint error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Preload endpoint - trigger backend song preparation without streaming
  app.post("/api/preload", async (req, res) => {
    try {
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ error: "Video ID is required" });
      }

      // Validate video ID format
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID format" });
      }

      // Check if already downloading or ready
      if (downloadRequests.has(videoId)) {
        return res.json({ 
          videoId, 
          status: downloadStatus.get(videoId) || 'downloading',
          message: 'Already in progress'
        });
      }

      console.log('Starting download for video ID:', videoId);
      
      // Mark as downloading
      downloadRequests.add(videoId);
      downloadStatus.set(videoId, 'downloading');

      // Trigger backend preparation without waiting for completion
      const cloudflareBackendUrl = 'https://tile-fy-abu-california.trycloudflare.com';
      const preloadUrl = `${cloudflareBackendUrl}/preload?v=${videoId}`;
      
      // Fire and forget - don't wait for response
      fetch(preloadUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      }).then(response => {
        if (response.ok) {
          downloadStatus.set(videoId, 'ready');
          console.log('Download completed for:', videoId);
        } else {
          downloadStatus.set(videoId, 'failed');
          console.log('Download failed for:', videoId);
        }
      }).catch(error => {
        downloadStatus.set(videoId, 'failed');
        console.log('Download error for:', videoId, error.message);
      });

      res.json({ 
        videoId, 
        status: 'downloading',
        message: 'Download initiated'
      });

    } catch (error) {
      console.error("Preload endpoint error:", error);
      res.status(500).json({ error: "Preload failed" });
    }
  });

  // Check download status endpoint
  app.get("/api/download-status/:videoId", async (req, res) => {
    try {
      const videoId = req.params.videoId;
      
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID format" });
      }

      const status = downloadStatus.get(videoId) || 'not_started';
      
      res.json({ 
        videoId, 
        status,
        isReady: status === 'ready'
      });

    } catch (error) {
      console.error("Download status endpoint error:", error);
      res.status(500).json({ error: "Status check failed" });
    }
  });

  // Handle CORS preflight for stream endpoint
  app.options("/api/stream", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
  });

  // Preload endpoint - trigger backend to start processing a song
  app.post("/api/preload", async (req, res) => {
    try {
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ error: 'Video ID required' });
      }

      console.log('Pre-loading song for video ID:', videoId);
      
      // Trigger backend processing without waiting for completion
      const streamUrl = `https://implement-franchise-becoming-set.trycloudflare.com/stream?v=${videoId}`;
      
      // Make a quick HEAD request to wake up the backend
      fetch(streamUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(1000) // 1 second timeout for quick trigger
      }).catch(() => {
        // Ignore errors, this is just to trigger processing
        console.log('Preload trigger sent for:', videoId);
      });

      res.json({ success: true, message: 'Preload triggered', videoId });
    } catch (error) {
      console.error('Preload error:', error);
      res.status(500).json({ error: 'Preload failed' });
    }
  });

  // Status endpoint for segment and duration info
  app.get("/api/status", async (req, res) => {
    try {
      const { v: videoId } = req.query;
      
      if (!videoId || typeof videoId !== 'string') {
        return res.status(400).json({ error: 'Video ID is required' });
      }
      
      console.log('Status request for video ID:', videoId);
      
      // Return estimated total duration (15s + 3*30s = 105s for 4 segments)
      const totalDuration = 105;
      
      res.json({
        videoId,
        totalSegments: 4,
        totalDuration: totalDuration,
        segmentDurations: [15, 30, 30, 30]
      });
      
    } catch (error) {
      console.error('Status check failed:', error);
      res.status(500).json({ 
        error: "Status check failed",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Updated stream endpoint - intelligent segmented streaming with instant playback
  app.get("/api/stream", async (req, res) => {
    try {
      const videoId = req.query.v as string;
      const segmentNum = req.query.segment ? parseInt(req.query.segment as string) : undefined;
      
      if (!videoId) {
        return res.status(400).json({ error: "Video ID parameter 'v' is required" });
      }

      // Validate video ID format (YouTube video IDs are 11 characters)
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID format" });
      }

      console.log(`Stream request for video ID: ${videoId}${segmentNum !== undefined ? `, segment: ${segmentNum}` : ''}`);

      // Handle segmented streaming requests
      if (segmentNum !== undefined) {
        return await handleSegmentRequest(videoId, segmentNum, req, res);
      }

      // Handle full stream requests - prioritize direct streaming for better compatibility
      try {
        // Strategy 1: Try direct streaming from new backend (better audio format)
        console.log('Trying direct streaming from new backend for:', videoId);
        const directUrl = `${STREAMING_CONFIG.BACKEND_URL}/stream?v=${videoId}`;
        
        try {
          await proxyStreamFromUrl(directUrl, req, res, 30000); // Increase timeout
          return; // Success, exit early
        } catch (proxyError) {
          console.log('Direct proxy failed, trying simple redirect:', proxyError.message);
          // Try simple redirect instead of proxying
          res.redirect(302, directUrl);
          return;
        }

      } catch (error) {
        console.error('Direct streaming failed, trying local segments:', error);
        
        // Strategy 2: Fallback to local segments if direct streaming fails
        try {
          console.log('Falling back to local segments for:', videoId);
          const newBackendSuccess = await tryNewBackendContinuousStream(videoId, req, res);
          if (newBackendSuccess) {
            return;
          }
        } catch (segmentError) {
          console.error('Local segment streaming also failed:', segmentError);
        }
        
        res.status(500).json({ 
          error: "Streaming failed",
          message: "All streaming methods unavailable",
          videoId: videoId
        });
      }

    } catch (error) {
      console.error("Stream endpoint error:", error);
      res.status(500).json({ error: "Stream failed" });
    }
  });

  // New API endpoints for segmented streaming management
  
  // Get segment status for a video
  app.get("/api/segments/status/:videoId", async (req, res) => {
    try {
      const videoId = req.params.videoId;
      
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID format" });
      }

      const status = await segmentedAudioManager.getSegmentStatus(videoId);
      if (status) {
        // Also include local segments
        const localSegments = await segmentedAudioManager.getLocalSegments(videoId);
        
        res.json({
          videoId,
          remote: status,
          local: localSegments,
          hasFirstSegment: localSegments.includes(0) || status.ready.includes(0)
        });
      } else {
        res.json({
          videoId,
          remote: { ready: [], downloading: [], failed: [] },
          local: await segmentedAudioManager.getLocalSegments(videoId),
          hasFirstSegment: false
        });
      }
    } catch (error) {
      console.error("Segment status error:", error);
      res.status(500).json({ error: "Failed to get segment status" });
    }
  });

  // Preload a video for segmented streaming (start background download)
  app.post("/api/segments/preload", async (req, res) => {
    try {
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ error: "Video ID is required" });
      }

      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID format" });
      }

      console.log('Starting segmented preload for:', videoId);
      
      // Start background download without waiting
      startBackgroundDownload(videoId);
      
      res.json({ 
        success: true, 
        message: 'Segmented preload started',
        videoId 
      });

    } catch (error) {
      console.error("Segmented preload error:", error);
      res.status(500).json({ error: "Segmented preload failed" });
    }
  });

  // Download a specific segment
  app.get("/api/segments/:videoId/:segmentNum", async (req, res) => {
    try {
      const videoId = req.params.videoId;
      const segmentNum = parseInt(req.params.segmentNum);
      
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ error: "Invalid video ID format" });
      }

      if (isNaN(segmentNum) || segmentNum < 0) {
        return res.status(400).json({ error: "Invalid segment number" });
      }

      await handleSegmentRequest(videoId, segmentNum, req, res);

    } catch (error) {
      console.error(`Segment download error for ${req.params.videoId} segment ${req.params.segmentNum}:`, error);
      res.status(500).json({ error: "Segment download failed" });
    }
  });

  // Get local cache information
  app.get("/api/segments/cache/:videoId?", async (req, res) => {
    try {
      const videoId = req.params.videoId;
      
      if (videoId) {
        // Get cache info for specific video
        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
          return res.status(400).json({ error: "Invalid video ID format" });
        }

        const localSegments = await segmentedAudioManager.getLocalSegments(videoId);
        res.json({
          videoId,
          segments: localSegments,
          totalSegments: localSegments.length,
          cacheDirectory: segmentedAudioManager.getVideoDirectory(videoId)
        });
      } else {
        // Get general cache information
        res.json({
          cacheDirectory: STREAMING_CONFIG.CACHE_DIR,
          config: {
            maxConcurrentDownloads: STREAMING_CONFIG.MAX_CONCURRENT_DOWNLOADS,
            pollingInterval: STREAMING_CONFIG.POLLING_INTERVAL,
            firstSegmentDuration: STREAMING_CONFIG.SEGMENT_DURATION.FIRST_SEGMENT,
            otherSegmentDuration: STREAMING_CONFIG.SEGMENT_DURATION.OTHER_SEGMENTS
          }
        });
      }
    } catch (error) {
      console.error("Cache info error:", error);
      res.status(500).json({ error: "Failed to get cache information" });
    }
  });

  // Clean up old cache (for maintenance)
  app.delete("/api/segments/cache", async (req, res) => {
    try {
      const maxAgeHours = parseInt(req.query.maxAge as string) || 24;
      
      console.log(`Starting cache cleanup (max age: ${maxAgeHours} hours)`);
      await segmentedAudioManager.cleanupOldCache(maxAgeHours);
      
      res.json({ 
        success: true, 
        message: `Cache cleanup completed (max age: ${maxAgeHours} hours)` 
      });
    } catch (error) {
      console.error("Cache cleanup error:", error);
      res.status(500).json({ error: "Cache cleanup failed" });
    }
  });


  // Comprehensive Music Search API using frontend service
  app.get("/api/music/comprehensive/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      console.log('Comprehensive music search for:', query);

      // For now, redirect to existing APIs and let frontend handle the logic
      // This ensures the comprehensive music service works properly
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json({
        success: false,
        results: [],
        total: 0,
        message: 'Use frontend comprehensive music service directly',
        source: 'Backend'
      });
    } catch (error) {
      console.error('Comprehensive music search error:', error);
      res.status(500).json({ error: 'Failed to search music' });
    }
  });

  // Comprehensive Music Trending API
  app.get("/api/music/comprehensive/trending", async (req, res) => {
    try {
      console.log('Getting trending music from comprehensive API');

      // Return curated trending songs
      const trendingSongs = [
        // Karan Aujla
        {
          id: 'trending_karan_1',
          title: 'Try Me',
          artist: 'Karan Aujla',
          albumArt: 'https://i.ytimg.com/vi/pFgQNBqawFo/default.jpg',
          duration: 0,
          streamingUrl: 'https://youtube.com/watch?v=pFgQNBqawFo',
          quality: 'High Quality',
          source: 'Trending',
          youtube_id: 'pFgQNBqawFo',
          album: 'Karan Aujla Collection',
          year: 2024,
          genre: 'Punjabi'
        },
        {
          id: 'trending_karan_2',
          title: 'Softly',
          artist: 'Karan Aujla',
          albumArt: 'https://i.ytimg.com/vi/ycGP6MW5w2A/default.jpg',
          duration: 0,
          streamingUrl: 'https://youtube.com/watch?v=ycGP6MW5w2A',
          quality: 'High Quality',
          source: 'Trending',
          youtube_id: 'ycGP6MW5w2A',
          album: 'Karan Aujla Collection',
          year: 2024,
          genre: 'Punjabi'
        },
        // Arijit Singh
        {
          id: 'trending_arijit_1',
          title: 'Tum Hi Ho',
          artist: 'Arijit Singh',
          albumArt: 'https://i.ytimg.com/vi/LfnRhbDuGWs/default.jpg',
          duration: 0,
          streamingUrl: 'https://youtube.com/watch?v=LfnRhbDuGWs',
          quality: 'High Quality',
          source: 'Trending',
          youtube_id: 'LfnRhbDuGWs',
          album: 'Arijit Singh Collection',
          year: 2024,
          genre: 'Bollywood'
        },
        {
          id: 'trending_arijit_2',
          title: 'Channa Mereya',
          artist: 'Arijit Singh',
          albumArt: 'https://i.ytimg.com/vi/bzSTpdcs-EI/default.jpg',
          duration: 0,
          streamingUrl: 'https://youtube.com/watch?v=bzSTpdcs-EI',
          quality: 'High Quality',
          source: 'Trending',
          youtube_id: 'bzSTpdcs-EI',
          album: 'Arijit Singh Collection',
          year: 2024,
          genre: 'Bollywood'
        },
        // International
        {
          id: 'trending_ed_1',
          title: 'Shape of You',
          artist: 'Ed Sheeran',
          albumArt: 'https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg',
          duration: 0,
          streamingUrl: 'https://youtube.com/watch?v=JGwWNGJdvx8',
          quality: 'High Quality',
          source: 'Trending',
          youtube_id: 'JGwWNGJdvx8',
          album: 'Popular Collection',
          year: 2024,
          genre: 'Pop'
        },
        {
          id: 'trending_weeknd_1',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          albumArt: 'https://i.ytimg.com/vi/ygr5AHufBN4/default.jpg',
          duration: 0,
          streamingUrl: 'https://youtube.com/watch?v=ygr5AHufBN4',
          quality: 'High Quality',
          source: 'Trending',
          youtube_id: 'ygr5AHufBN4',
          album: 'Popular Collection',
          year: 2024,
          genre: 'Pop'
        }
      ];

      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json({
        success: true,
        results: trendingSongs,
        total: trendingSongs.length,
        source: 'ComprehensiveTrending'
      });
    } catch (error) {
      console.error('Comprehensive trending error:', error);
      res.status(500).json({ error: 'Failed to get trending music' });
    }
  });

  // YouTube Music Search API with multiple fallback sources (keeping for compatibility)
  app.get("/api/music/youtube/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 1;
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      console.log('YouTube music search for:', query);

      // First, try the comprehensive music API
      const comprehensiveResult = await completeMusicAPI.searchSongs(query);
      
      if (comprehensiveResult.status === 200 && comprehensiveResult.response.length > 0) {
        const firstSong = comprehensiveResult.response[0];
        
        // If we have a YouTube ID, use it; otherwise try to find one
        let videoId = firstSong.youtube_id;
        
        if (!videoId && firstSong.streaming_url) {
          // Try to extract YouTube video ID from streaming URL
          const youtubeMatch = firstSong.streaming_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (youtubeMatch) {
            videoId = youtubeMatch[1];
          }
        }

        // Fallback to predefined mapping if no YouTube ID found
        if (!videoId) {
          const musicMap: Record<string, string> = {
            'arijit singh': 'LfnRhbDuGWs', // Tum Hi Ho
            'karan aujla': 'yAmVzCPcMWk', // Tauba Tauba  
            'ed sheeran': 'JGwWNGJdvx8', // Shape of You
            'kendrick lamar': 'tvTRZJ-4EyI', // HUMBLE
            'drake': 'uxpDa-c-4Mc', // Hotline Bling
            'taylor swift': 'nfWlot6h_JM', // Shake It Off
            'adele': 'YQHsXMglC9A', // Hello
            'billie eilish': 'DyDfgMOUjCI', // bad guy
            'post malone': 'yaWesK-Fngn', // Circles
          };

          const queryLower = query.toLowerCase();
          for (const [artist, fallbackVideoId] of Object.entries(musicMap)) {
            if (queryLower.includes(artist) || artist.includes(queryLower.split(' ')[0])) {
              videoId = fallbackVideoId;
              break;
            }
          }
        }

        if (videoId) {
          const searchResults = [{
            id: { videoId },
            snippet: {
              title: firstSong.title,
              channelTitle: firstSong.artists.map((a: any) => a.name).join(', ') || 'Unknown Artist',
              thumbnails: {
                default: { url: firstSong.image || `https://i.ytimg.com/vi/${videoId}/default.jpg` }
              }
            },
            url: `https://www.youtube.com/watch?v=${videoId}`,
            streaming_url: firstSong.streaming_url,
            quality: firstSong.quality,
            source: firstSong.source
          }];

          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type');
          
          console.log('YouTube search successful via CompleteMusicAPI, found:', videoId);
          res.json({ items: searchResults });
          return;
        }
      }

      // Fallback to original YouTube search methods if comprehensive API fails
      console.log('Falling back to original YouTube search methods...');
      
      const musicMap = {
        'arijit singh': 'LfnRhbDuGWs', // Tum Hi Ho
        'karan aujla': 'yAmVzCPcMWk', // Tauba Tauba  
        'ed sheeran': 'JGwWNGJdvx8', // Shape of You
        'kendrick lamar': 'tvTRZJ-4EyI', // HUMBLE
        'drake': 'uxpDa-c-4Mc', // Hotline Bling
        'taylor swift': 'nfWlot6h_JM', // Shake It Off
        'adele': 'YQHsXMglC9A', // Hello
        'the weeknd': 'ygr5AHufBN4', // Blinding Lights
        'billie eilish': 'DyDfgMOUjCI', // bad guy
        'post malone': 'yaWesK-Fngn' // Circles
      };

      const queryLower = query.toLowerCase();
      for (const [artist, videoId] of Object.entries(musicMap)) {
        if (queryLower.includes(artist) || artist.includes(queryLower.split(' ')[0])) {
          const searchResults = [{
            id: { videoId },
            snippet: {
              title: query,
              channelTitle: artist,
              thumbnails: {
                default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` }
              }
            },
            url: `https://www.youtube.com/watch?v=${videoId}`,
            source: 'Fallback'
          }];

          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type');
          
          console.log('YouTube search successful via fallback, found:', videoId);
          res.json({ items: searchResults });
          return;
        }
      }

      // No results found
      console.log('All YouTube search methods failed');
      res.status(404).json({ 
        error: 'No results found',
        message: 'Could not find video for this search query'
      });
    } catch (error) {
      console.error('YouTube music search error:', error);
      res.status(500).json({ error: 'Failed to search YouTube music' });
    }
  });

  // Music API proxy routes to handle CORS issues
  app.get("/api/music/deezer/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '50';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Deezer API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('Deezer proxy error:', error);
      res.status(500).json({ error: 'Failed to search Deezer' });
    }
  });

  app.get("/api/music/deezer/charts", async (req, res) => {
    try {
      const limit = req.query.limit || '25';
      
      const response = await fetch(`https://api.deezer.com/chart/0/tracks?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Deezer charts error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('Deezer charts proxy error:', error);
      res.status(500).json({ error: 'Failed to get Deezer charts' });
    }
  });

  app.get("/api/music/jamendo/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '20';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?format=json&limit=${limit}&search=${encodeURIComponent(query)}&include=musicinfo`);
      
      if (!response.ok) {
        throw new Error(`Jamendo API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('Jamendo proxy error:', error);
      res.status(500).json({ error: 'Failed to search Jamendo' });
    }
  });

  app.get("/api/music/radio/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '10';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=${limit}&hidebroken=true`);
      
      if (!response.ok) {
        throw new Error(`Radio API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('Radio API proxy error:', error);
      res.status(500).json({ error: 'Failed to search radio stations' });
    }
  });

  // Internet Archive search proxy
  app.get("/api/music/archive/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '15';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const response = await fetch(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}%20AND%20mediatype:audio&fl=identifier,title,creator,collection,date&rows=${limit}&output=json`);
      
      if (!response.ok) {
        throw new Error(`Internet Archive error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('Internet Archive proxy error:', error);
      res.status(500).json({ error: 'Failed to search Internet Archive' });
    }
  });

  // CCMixter search proxy
  app.get("/api/music/ccmixter/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '10';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      const response = await fetch(`http://ccmixter.org/api/query?f=json&tags=${encodeURIComponent(query)}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`CCMixter error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('CCMixter proxy error:', error);
      res.status(500).json({ error: 'Failed to search CCMixter' });
    }
  });

  // YouTube Music search proxy (alternative to SoundCloud)
  app.get("/api/music/youtube/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '20';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      // Use Piped API for YouTube Music search
      const response = await fetch(`https://pipedapi.adminforge.de/search?q=${encodeURIComponent(query)}&filter=music_songs`);
      
      if (!response.ok) {
        throw new Error(`YouTube search error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('YouTube search proxy error:', error);
      res.status(500).json({ error: 'Failed to search YouTube' });
    }
  });

  // JioSaavn API proxy (Indian music streaming)
  app.get("/api/music/jiosaavn/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '20';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      // JioSaavn API for Indian music
      const response = await fetch(`https://saavn.me/search/songs?query=${encodeURIComponent(query)}&page=1&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`JioSaavn error: ${response.status}`);
      }
      
      const data = await response.json();
      
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      res.json(data);
    } catch (error) {
      console.error('JioSaavn proxy error:', error);
      res.status(500).json({ error: 'Failed to search JioSaavn' });
    }
  });

  // Spotify Web API proxy (public endpoints)
  app.get("/api/music/spotify/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit || '20';
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter required' });
      }

      // Get Spotify access token for public search
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&client_id=8cbb5a9a4f314e22b2b95b5d9b1b5c2c&client_secret=your_secret_here'
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        
        const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        });

        if (searchResponse.ok) {
          const data = await searchResponse.json();
          
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.header('Access-Control-Allow-Headers', 'Content-Type');
          
          res.json(data);
          return;
        }
      }
      
      // If Spotify fails, return empty result
      res.json({ tracks: { items: [] } });
      
    } catch (error) {
      console.error('Spotify proxy error:', error);
      res.json({ tracks: { items: [] } });
    }
  });

  // Health check for music services
  app.get("/api/music/health", async (req, res) => {
    const services = {
      jamendo: false,
      internetArchive: false,
      youtube: false,
      jiosaavn: false,
      radio: false
    };

    try {
      const jamendoTest = await fetch('https://api.jamendo.com/v3.0/tracks/?format=json&limit=1');
      services.jamendo = jamendoTest.ok;
    } catch {}

    try {
      const archiveTest = await fetch('https://archive.org/advancedsearch.php?q=test&fl=identifier&rows=1&output=json');
      services.internetArchive = archiveTest.ok;
    } catch {}

    try {
      const youtubeTest = await fetch('https://pipedapi.adminforge.de/search?q=test&filter=music_songs');
      services.youtube = youtubeTest.ok;
    } catch {}

    try {
      const jiosaavnTest = await fetch('https://saavn.me/search/songs?query=test&page=1&limit=1');
      services.jiosaavn = jiosaavnTest.ok;
    } catch {}

    try {
      const radioTest = await fetch('https://de1.api.radio-browser.info/json/stations/search?limit=1');
      services.radio = radioTest.ok;
    } catch {}

    res.header('Access-Control-Allow-Origin', '*');
    res.json({
      services,
      healthy: Object.values(services).some(status => status)
    });
  });

  // Mount the complete music API routes
  app.use('/api/complete-music', completeMusicRouter);
  
  // Authentication routes
  const authRouter = (await import('./routes/auth')).default;
  app.use('/api/auth', authRouter);

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const httpServer = createServer(app);

  return httpServer;
}
