# Segmented Audio Download Utilities

This directory contains utilities for downloading segmented audio streams from YouTube videos using your segmented streaming backend.

## Overview

These utilities work with your segmented streaming backend that provides:
- **Instant Playback**: First 15 seconds available immediately
- **Progressive Loading**: Remaining audio in 30-second chunks
- **Status Monitoring**: Real-time segment availability tracking
- **Error Recovery**: Robust retry and fallback mechanisms

## Backend Endpoints

Your backend should provide:
- `GET /stream?v=VIDEO_ID&segment=N` - Download specific segment
- `GET /status?v=VIDEO_ID` - Get segment availability status

## Available Tools

### 1. Python Version (`segmentDownloader.py`)

**Features:**
- Comprehensive segment downloading with progress tracking
- Concurrent downloads with configurable limits
- Continuous monitoring for new segments
- FFmpeg integration for combining segments
- Detailed logging and error handling

**Requirements:**
```bash
pip install requests tqdm
# Optional: ffmpeg for audio combination
```

**Usage Examples:**
```bash
# Basic download with monitoring
python segmentDownloader.py dQw4w9WgXcQ --verbose

# Download and combine with ffmpeg
python segmentDownloader.py dQw4w9WgXcQ --combine output.m4a --verbose

# Download available segments only (no monitoring)
python segmentDownloader.py dQw4w9WgXcQ --no-monitor --concurrent 5

# Custom backend and settings
python segmentDownloader.py dQw4w9WgXcQ \
    --backend-url https://your-backend.com \
    --download-dir ./music \
    --max-wait 600
```

### 2. Node.js Version (`segmentDownloader.js`)

**Features:**
- Same functionality as Python version
- Native Node.js streaming for efficiency
- Command-line interface with Commander.js
- Optional progress bars with cli-progress
- Module export for integration

**Requirements:**
```bash
npm install axios cli-progress commander
# Optional: ffmpeg for audio combination
```

**Usage Examples:**
```bash
# Basic download with monitoring
node segmentDownloader.js dQw4w9WgXcQ --verbose

# Download and combine with ffmpeg
node segmentDownloader.js dQw4w9WgXcQ --combine output.m4a --verbose

# Download available segments only (no monitoring)  
node segmentDownloader.js dQw4w9WgXcQ --no-monitor --concurrent 5

# Custom backend and settings
node segmentDownloader.js dQw4w9WgXcQ \
    --backend-url https://your-backend.com \
    --download-dir ./music \
    --max-wait 600
```

### 3. Integration with Your Music App

Your main application now includes integrated segmented streaming:

**New API Endpoints:**
- `GET /api/segments/status/:videoId` - Get segment status
- `POST /api/segments/preload` - Start background downloads
- `GET /api/segments/:videoId/:segmentNum` - Download specific segment
- `GET /api/segments/cache/:videoId?` - Cache information
- `DELETE /api/segments/cache` - Clean old cache

**Streaming Strategy:**
1. **Local Cache First**: Serve immediately if segments exist locally
2. **New Backend**: Try segmented streaming from your new backend
3. **Fallback**: Use old backend for compatibility

## Configuration

### Python Configuration
```python
config = Config()
config.BACKEND_URL = "https://functions-offers-audit-insertion.trycloudflare.com"
config.DOWNLOAD_DIR = "./downloads"
config.MAX_CONCURRENT = 3
config.POLLING_INTERVAL = 2.0  # seconds
config.MAX_RETRIES = 3
```

### Node.js Configuration  
```javascript
const config = {
  BACKEND_URL: 'https://functions-offers-audit-insertion.trycloudflare.com',
  DOWNLOAD_DIR: './downloads',
  MAX_CONCURRENT: 3,
  POLLING_INTERVAL: 2000, // milliseconds
  MAX_RETRIES: 3
};
```

## How Segmented Streaming Works

### 1. **Instant Start (15 seconds)**
- First segment downloads in ~2 seconds
- Music starts playing immediately
- User experiences no waiting time

### 2. **Background Loading (30-second chunks)**
- Remaining segments download in parallel
- Seamless playback continues
- No interruption to user experience

### 3. **Progressive Enhancement**
- Downloaded segments cached locally
- Future plays are instant
- Efficient bandwidth usage

### 4. **Intelligent Fallback**
- If segmented backend fails, falls back to full download
- Multiple retry strategies
- Comprehensive error recovery

## Error Handling

Both utilities include robust error handling:

- **Network Failures**: Automatic retries with exponential backoff
- **Missing Segments**: Graceful handling and continued downloads
- **Backend Issues**: Fallback to alternative methods
- **Disk Errors**: Proper cleanup and error reporting
- **Timeout Handling**: Configurable timeouts for different scenarios

## FFmpeg Integration

Optional FFmpeg support for combining segments:

**Installation:**
- **Windows**: Download from https://ffmpeg.org/download.html
- **macOS**: `brew install ffmpeg`
- **Linux**: `apt install ffmpeg` or equivalent

**Benefits:**
- Proper audio concatenation without glitches
- Maintains audio quality and metadata
- Handles different audio formats seamlessly

## Performance Optimization

### Recommended Settings
- **Max Concurrent**: 3-5 downloads (avoid overwhelming backend)
- **Polling Interval**: 2-3 seconds (balance responsiveness vs. load)
- **Cache Management**: Clean up old segments periodically
- **First Segment Priority**: Always download segment 0 first

### Resource Management
- Local caching reduces bandwidth usage
- Background downloads don't block user interaction
- Automatic cleanup prevents disk space issues
- Concurrent limits prevent server overload

## Integration Examples

### Basic Integration
```javascript
const { SegmentDownloader } = require('./segmentDownloader');

const downloader = new SegmentDownloader('dQw4w9WgXcQ');
await downloader.init();
const segments = await downloader.monitorAndDownload();
await downloader.combineSegments('output.m4a');
```

### Advanced Integration
```python
from segmentDownloader import SegmentDownloader

downloader = SegmentDownloader('dQw4w9WgXcQ')
progress = await downloader.download_all_segments(
    on_progress=lambda p: print(f"Progress: {p.completed_segments}")
)
```

This segmented streaming system transforms your music app from "wait 5-15 seconds per song" to "songs play instantly" while maintaining high audio quality and efficient resource usage.