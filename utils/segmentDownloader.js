#!/usr/bin/env node
/**
 * Segmented Audio Downloader for YouTube Videos (Node.js Version)
 * ===============================================================
 * 
 * This utility downloads audio segments from a segmented streaming backend
 * and optionally combines them into a single file using ffmpeg.
 * 
 * Usage:
 *     node segmentDownloader.js <video_id> [options]
 * 
 * Features:
 * - Downloads segments progressively (first 15s, then 30s chunks)
 * - Monitors backend /status endpoint for segment availability  
 * - Robust error handling with retries
 * - Optional ffmpeg concatenation
 * - Progress tracking and logging
 * 
 * Requirements:
 *     npm install axios cli-progress commander
 *     # Optional: ffmpeg for concatenation
 */

const fs = require('fs').promises;
const path = require('path');
const { pipeline } = require('stream').promises;
const { createWriteStream } = require('fs');
const { spawn } = require('child_process');
const axios = require('axios');
const { Command } = require('commander');

// Optional progress bar
let ProgressBar;
try {
  const cliProgress = require('cli-progress');
  ProgressBar = cliProgress.SingleBar;
} catch (e) {
  console.log('Install cli-progress for progress bars: npm install cli-progress');
}

// Configuration
const config = {
  BACKEND_URL: 'https://functions-offers-audit-insertion.trycloudflare.com',
  DOWNLOAD_DIR: './downloads',
  MAX_CONCURRENT: 3,
  POLLING_INTERVAL: 2000, // milliseconds
  MAX_RETRIES: 3,
  REQUEST_TIMEOUT: 30000,
  USER_AGENT: 'Mozilla/5.0 (compatible; SegmentDownloader/1.0)'
};

// Logging utility
class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const fullMessage = `${timestamp} - ${level.toUpperCase()} - ${message}`;
    
    if (level === 'error' || level === 'warn' || level === 'info' || this.verbose) {
      console.log(fullMessage, ...args);
    }
  }

  info(message, ...args) { this.log('info', message, ...args); }
  debug(message, ...args) { this.log('debug', message, ...args); }
  warn(message, ...args) { this.log('warn', message, ...args); }
  error(message, ...args) { this.log('error', message, ...args); }
}

const logger = new Logger();

/**
 * Main class for handling segmented audio downloads
 */
class SegmentDownloader {
  constructor(videoId, backendUrl = config.BACKEND_URL) {
    this.videoId = videoId;
    this.backendUrl = backendUrl;
    this.downloadDir = path.join(config.DOWNLOAD_DIR, videoId);
    
    // Track download state
    this.downloadedSegments = new Set();
    this.failedSegments = new Set();
    
    // Configure axios
    this.client = axios.create({
      timeout: config.REQUEST_TIMEOUT,
      headers: { 'User-Agent': config.USER_AGENT }
    });

    logger.info(`Initialized downloader for video: ${videoId}`);
    logger.info(`Backend URL: ${this.backendUrl}`);
    logger.info(`Download directory: ${this.downloadDir}`);
  }

  /**
   * Initialize download directory
   */
  async init() {
    try {
      await fs.mkdir(this.downloadDir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create download directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check which segments are available on the backend
   * @returns {Promise<Object>} Status object with ready segments
   */
  async getSegmentStatus() {
    try {
      const url = `${this.backendUrl}/status?v=${this.videoId}`;
      const response = await this.client.get(url);
      
      logger.debug(`Status response:`, response.data);
      
      return {
        ready: response.data.ready || [],
        total: response.data.totalSegments
      };
      
    } catch (error) {
      logger.error(`Failed to get segment status: ${error.message}`);
      return { ready: [], total: null };
    }
  }

  /**
   * Download a specific segment
   * @param {number} segmentNum - Segment number to download
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<boolean>} True if successful
   */
  async downloadSegment(segmentNum, retryCount = 0) {
    const segmentFile = path.join(this.downloadDir, `segment_${segmentNum}.m4a`);
    
    // Skip if already exists and is valid
    try {
      const stats = await fs.stat(segmentFile);
      if (stats.size > 0) {
        logger.info(`Segment ${segmentNum} already exists, skipping`);
        this.downloadedSegments.add(segmentNum);
        return true;
      }
    } catch (error) {
      // File doesn't exist, continue with download
    }

    try {
      const url = `${this.backendUrl}/stream?v=${this.videoId}&segment=${segmentNum}`;
      logger.info(`Downloading segment ${segmentNum} from ${url}`);
      
      const response = await this.client.get(url, { 
        responseType: 'stream',
        timeout: config.REQUEST_TIMEOUT 
      });
      
      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!['audio', 'video', 'octet-stream'].some(ct => contentType.includes(ct))) {
        logger.warn(`Unexpected content type for segment ${segmentNum}: ${contentType}`);
      }

      // Setup progress bar if available
      let progressBar;
      const contentLength = parseInt(response.headers['content-length'] || '0');
      if (ProgressBar && contentLength > 0) {
        progressBar = new ProgressBar({
          format: `Segment ${segmentNum} |{bar}| {percentage}% | {value}/{total} bytes`,
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true
        });
        progressBar.start(contentLength, 0);
      }

      // Download with progress tracking
      const writer = createWriteStream(segmentFile);
      let downloadedBytes = 0;

      response.data.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (progressBar) {
          progressBar.update(downloadedBytes);
        }
      });

      // Use pipeline for proper error handling
      await pipeline(response.data, writer);

      if (progressBar) {
        progressBar.stop();
      }

      // Verify download
      const stats = await fs.stat(segmentFile);
      if (stats.size === 0) {
        await fs.unlink(segmentFile);
        throw new Error(`Downloaded segment ${segmentNum} is empty`);
      }

      logger.info(`Successfully downloaded segment ${segmentNum} (${stats.size} bytes)`);
      this.downloadedSegments.add(segmentNum);
      return true;

    } catch (error) {
      logger.error(`Error downloading segment ${segmentNum}: ${error.message}`);
      
      // Handle retries
      if (retryCount < config.MAX_RETRIES) {
        const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
        logger.info(`Retrying segment ${segmentNum} in ${waitTime/1000} seconds (attempt ${retryCount + 1}/${config.MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.downloadSegment(segmentNum, retryCount + 1);
      } else {
        logger.error(`Failed to download segment ${segmentNum} after ${config.MAX_RETRIES} attempts`);
        this.failedSegments.add(segmentNum);
        return false;
      }
    }
  }

  /**
   * Download all currently available segments
   * @param {number?} maxSegments - Maximum number of segments to download
   * @returns {Promise<number[]>} Array of successfully downloaded segment numbers
   */
  async downloadAvailableSegments(maxSegments = null) {
    const status = await this.getSegmentStatus();
    const availableSegments = status.ready;

    if (availableSegments.length === 0) {
      logger.warn('No segments available for download');
      return [];
    }

    // Filter out already downloaded/failed segments
    let toDownload = availableSegments.filter(seg => 
      !this.downloadedSegments.has(seg) && !this.failedSegments.has(seg)
    );

    if (maxSegments) {
      toDownload = toDownload.slice(0, maxSegments);
    }

    if (toDownload.length === 0) {
      logger.info('All available segments already downloaded');
      return Array.from(this.downloadedSegments).sort((a, b) => a - b);
    }

    logger.info(`Downloading ${toDownload.length} segments: [${toDownload.join(', ')}]`);

    // Download segments with concurrency limit
    const successfulDownloads = [];
    const downloadPromises = [];
    
    for (let i = 0; i < toDownload.length; i += config.MAX_CONCURRENT) {
      const batch = toDownload.slice(i, i + config.MAX_CONCURRENT);
      
      const batchPromises = batch.map(async (segmentNum) => {
        const success = await this.downloadSegment(segmentNum);
        if (success) {
          successfulDownloads.push(segmentNum);
        }
        return success;
      });

      await Promise.all(batchPromises);
    }

    return successfulDownloads.sort((a, b) => a - b);
  }

  /**
   * Continuously monitor for new segments and download them
   * @param {number} maxWaitTime - Maximum time to wait in milliseconds
   * @returns {Promise<number[]>} Array of all downloaded segment numbers
   */
  async monitorAndDownload(maxWaitTime = 300000) {
    logger.info(`Starting continuous monitoring (max wait: ${maxWaitTime/1000}s)`);
    
    const startTime = Date.now();
    let lastSegmentCount = 0;
    let noNewSegmentsCount = 0;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Download currently available segments
        const downloaded = await this.downloadAvailableSegments();

        if (downloaded.length > lastSegmentCount) {
          lastSegmentCount = downloaded.length;
          noNewSegmentsCount = 0;
          logger.info(`Downloaded ${downloaded.length} segments so far`);
        } else {
          noNewSegmentsCount++;
        }

        // Check if we should continue monitoring
        const status = await this.getSegmentStatus();
        if (status.total && this.downloadedSegments.size >= status.total) {
          logger.info('All segments downloaded according to backend');
          break;
        }

        // Stop if no new segments for too long
        if (noNewSegmentsCount >= 10) { // 20 seconds without new segments
          logger.info('No new segments detected for extended period, stopping monitor');
          break;
        }

        // Wait before next check
        logger.debug(`Waiting ${config.POLLING_INTERVAL/1000}s before next check...`);
        await new Promise(resolve => setTimeout(resolve, config.POLLING_INTERVAL));

      } catch (error) {
        logger.error(`Error during monitoring: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, config.POLLING_INTERVAL));
      }
    }

    logger.info(`Monitoring completed. Downloaded ${this.downloadedSegments.size} segments`);
    return Array.from(this.downloadedSegments).sort((a, b) => a - b);
  }

  /**
   * Combine downloaded segments into a single audio file
   * @param {string} outputFile - Path to output file
   * @param {boolean} useFFmpeg - Whether to use ffmpeg
   * @returns {Promise<boolean>} True if successful
   */
  async combineSegments(outputFile, useFFmpeg = true) {
    if (this.downloadedSegments.size === 0) {
      logger.error('No segments downloaded to combine');
      return false;
    }

    const segmentFiles = [];
    for (const segNum of Array.from(this.downloadedSegments).sort((a, b) => a - b)) {
      const segmentFile = path.join(this.downloadDir, `segment_${segNum}.m4a`);
      try {
        await fs.access(segmentFile);
        segmentFiles.push(segmentFile);
      } catch (error) {
        logger.warn(`Segment file not found: ${segmentFile}`);
      }
    }

    if (segmentFiles.length === 0) {
      logger.error('No segment files found for combination');
      return false;
    }

    logger.info(`Combining ${segmentFiles.length} segments into ${outputFile}`);

    if (useFFmpeg && await this._hasFFmpeg()) {
      return this._combineWithFFmpeg(segmentFiles, outputFile);
    } else {
      return this._combineSimple(segmentFiles, outputFile);
    }
  }

  /**
   * Check if ffmpeg is available
   */
  async _hasFFmpeg() {
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('ffmpeg', ['-version']);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error('ffmpeg not found'));
        });
        child.on('error', reject);
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Combine segments using ffmpeg
   */
  async _combineWithFFmpeg(segmentFiles, outputFile) {
    try {
      // Create file list for ffmpeg
      const listFile = path.join(this.downloadDir, 'segments_list.txt');
      const listContent = segmentFiles
        .map(file => `file '${path.resolve(file)}'`)
        .join('\n');
      
      await fs.writeFile(listFile, listContent);

      // Run ffmpeg
      const args = [
        '-y', '-f', 'concat', '-safe', '0',
        '-i', listFile, '-c', 'copy', outputFile
      ];

      logger.info(`Running ffmpeg: ffmpeg ${args.join(' ')}`);

      await new Promise((resolve, reject) => {
        const child = spawn('ffmpeg', args);
        
        let stderr = '';
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        child.on('error', reject);
      });

      // Clean up
      await fs.unlink(listFile);

      logger.info(`Successfully combined segments with ffmpeg: ${outputFile}`);
      return true;

    } catch (error) {
      logger.error(`FFmpeg combination failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Simple binary concatenation (may not work for all formats)
   */
  async _combineSimple(segmentFiles, outputFile) {
    try {
      const outputHandle = await fs.open(outputFile, 'w');

      for (const segmentFile of segmentFiles) {
        const data = await fs.readFile(segmentFile);
        await outputHandle.write(data);
      }

      await outputHandle.close();

      logger.info(`Successfully combined segments (simple): ${outputFile}`);
      return true;

    } catch (error) {
      logger.error(`Simple combination failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get download statistics
   */
  getDownloadStats() {
    return {
      videoId: this.videoId,
      downloadedSegments: this.downloadedSegments.size,
      failedSegments: this.failedSegments.size,
      downloadedList: Array.from(this.downloadedSegments).sort((a, b) => a - b),
      failedList: Array.from(this.failedSegments).sort((a, b) => a - b),
      downloadDirectory: this.downloadDir
    };
  }
}

/**
 * Main CLI function
 */
async function main() {
  const program = new Command();
  
  program
    .name('segment-downloader')
    .description('Download segmented audio from YouTube video')
    .version('1.0.0')
    .argument('<video-id>', 'YouTube video ID (11 characters)')
    .option('--backend-url <url>', 'Backend server URL', config.BACKEND_URL)
    .option('--download-dir <dir>', 'Download directory', config.DOWNLOAD_DIR)
    .option('--max-wait <seconds>', 'Max wait time in seconds', '300')
    .option('--no-monitor', 'Download available segments only, no monitoring')
    .option('--combine <file>', 'Combine segments into output file')
    .option('--no-ffmpeg', 'Use simple concatenation instead of ffmpeg')
    .option('--concurrent <num>', 'Max concurrent downloads', config.MAX_CONCURRENT.toString())
    .option('--verbose', 'Verbose logging')
    .parse();

  const options = program.opts();
  const videoId = program.args[0];

  // Configure logging
  if (options.verbose) {
    logger.verbose = true;
  }

  // Validate video ID
  if (!videoId || videoId.length !== 11) {
    logger.error('Invalid video ID. Must be 11 characters (YouTube video ID)');
    process.exit(1);
  }

  // Update configuration
  config.BACKEND_URL = options.backendUrl;
  config.DOWNLOAD_DIR = options.downloadDir;
  config.MAX_CONCURRENT = parseInt(options.concurrent);

  try {
    // Create and initialize downloader
    const downloader = new SegmentDownloader(videoId, options.backendUrl);
    await downloader.init();

    let downloaded;
    if (options.noMonitor) {
      // Download available segments only
      logger.info('Downloading currently available segments...');
      downloaded = await downloader.downloadAvailableSegments();
    } else {
      // Monitor and download continuously
      logger.info('Starting continuous monitoring and download...');
      const maxWaitMs = parseInt(options.maxWait) * 1000;
      downloaded = await downloader.monitorAndDownload(maxWaitMs);
    }

    // Show statistics
    const stats = downloader.getDownloadStats();
    logger.info(`Download complete:`, stats);

    // Combine segments if requested
    if (options.combine && downloaded.length > 0) {
      const success = await downloader.combineSegments(options.combine, !options.noFfmpeg);
      if (success) {
        logger.info(`Audio combined successfully: ${options.combine}`);
      } else {
        logger.error('Failed to combine segments');
        process.exit(1);
      }
    }

    if (downloaded.length === 0) {
      logger.warn('No segments were downloaded');
      process.exit(1);
    }

  } catch (error) {
    logger.error(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('Download interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('Download terminated');
  process.exit(1);
});

// Export for use as module
module.exports = { SegmentDownloader, Logger, config };

// Run as CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

/*
Example usage:

# Basic download with monitoring
node segmentDownloader.js dQw4w9WgXcQ --verbose

# Download and combine with ffmpeg
node segmentDownloader.js dQw4w9WgXcQ --combine output.m4a --verbose

# Download available segments only (no monitoring)
node segmentDownloader.js dQw4w9WgXcQ --no-monitor --concurrent 5

# Custom backend URL and download directory  
node segmentDownloader.js dQw4w9WgXcQ --backend-url https://custom-backend.com --download-dir ./music

# Simple concatenation without ffmpeg
node segmentDownloader.js dQw4w9WgXcQ --combine output.m4a --no-ffmpeg
*/