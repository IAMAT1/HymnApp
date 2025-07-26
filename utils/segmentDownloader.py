#!/usr/bin/env python3
"""
Segmented Audio Downloader for YouTube Videos
==============================================

This utility downloads audio segments from a segmented streaming backend
and optionally combines them into a single file using ffmpeg.

Usage:
    python segmentDownloader.py <video_id> [options]

Features:
- Downloads segments progressively (first 15s, then 30s chunks)
- Monitors backend /status endpoint for segment availability
- Robust error handling with retries
- Optional ffmpeg concatenation
- Progress tracking and logging

Requirements:
    pip install requests tqdm
    # Optional: ffmpeg for concatenation
"""

import os
import sys
import time
import json
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Optional, Set
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    print("Install tqdm for progress bars: pip install tqdm")

# Configuration
@dataclass
class Config:
    BACKEND_URL: str = "https://functions-offers-audit-insertion.trycloudflare.com"
    DOWNLOAD_DIR: str = "./downloads"
    MAX_CONCURRENT: int = 3
    POLLING_INTERVAL: float = 2.0  # seconds
    MAX_RETRIES: int = 3
    REQUEST_TIMEOUT: int = 30
    USER_AGENT: str = "Mozilla/5.0 (compatible; SegmentDownloader/1.0)"

# Global config instance
config = Config()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('segment_downloader.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class SegmentDownloadError(Exception):
    """Custom exception for segment download errors"""
    pass

class SegmentDownloader:
    """Main class for handling segmented audio downloads"""
    
    def __init__(self, video_id: str, backend_url: str = None):
        self.video_id = video_id
        self.backend_url = backend_url or config.BACKEND_URL
        self.download_dir = Path(config.DOWNLOAD_DIR) / video_id
        self.download_dir.mkdir(parents=True, exist_ok=True)
        
        # Track download state
        self.downloaded_segments: Set[int] = set()
        self.failed_segments: Set[int] = set()
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': config.USER_AGENT})
        
        logger.info(f"Initialized downloader for video: {video_id}")
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Download directory: {self.download_dir}")

    def get_segment_status(self) -> Dict:
        """
        Check which segments are available on the backend
        
        Returns:
            Dict with 'ready' list of available segment numbers
        """
        try:
            url = f"{self.backend_url}/status?v={self.video_id}"
            response = self.session.get(url, timeout=config.REQUEST_TIMEOUT)
            response.raise_for_status()
            
            data = response.json()
            logger.debug(f"Status response: {data}")
            
            return {
                'ready': data.get('ready', []),
                'total': data.get('totalSegments')
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get segment status: {e}")
            return {'ready': [], 'total': None}
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in status response: {e}")
            return {'ready': [], 'total': None}

    def download_segment(self, segment_num: int, retry_count: int = 0) -> bool:
        """
        Download a specific segment
        
        Args:
            segment_num: Segment number to download
            retry_count: Current retry attempt
            
        Returns:
            True if download successful, False otherwise
        """
        segment_file = self.download_dir / f"segment_{segment_num}.m4a"
        
        # Skip if already exists and is valid
        if segment_file.exists() and segment_file.stat().st_size > 0:
            logger.info(f"Segment {segment_num} already exists, skipping")
            self.downloaded_segments.add(segment_num)
            return True
        
        try:
            url = f"{self.backend_url}/stream?v={self.video_id}&segment={segment_num}"
            logger.info(f"Downloading segment {segment_num} from {url}")
            
            response = self.session.get(url, timeout=config.REQUEST_TIMEOUT, stream=True)
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '')
            if not any(ct in content_type for ct in ['audio', 'video', 'octet-stream']):
                logger.warning(f"Unexpected content type for segment {segment_num}: {content_type}")
            
            # Download with progress
            total_size = int(response.headers.get('content-length', 0))
            
            with open(segment_file, 'wb') as f:
                if HAS_TQDM and total_size > 0:
                    with tqdm(total=total_size, unit='B', unit_scale=True, 
                             desc=f"Segment {segment_num}") as pbar:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                                pbar.update(len(chunk))
                else:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
            
            # Verify download
            if segment_file.stat().st_size == 0:
                segment_file.unlink()
                raise SegmentDownloadError(f"Downloaded segment {segment_num} is empty")
            
            logger.info(f"Successfully downloaded segment {segment_num} ({segment_file.stat().st_size} bytes)")
            self.downloaded_segments.add(segment_num)
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error downloading segment {segment_num}: {e}")
        except Exception as e:
            logger.error(f"Unexpected error downloading segment {segment_num}: {e}")
        
        # Handle retries
        if retry_count < config.MAX_RETRIES:
            wait_time = 2 ** retry_count  # Exponential backoff
            logger.info(f"Retrying segment {segment_num} in {wait_time} seconds (attempt {retry_count + 1}/{config.MAX_RETRIES})")
            time.sleep(wait_time)
            return self.download_segment(segment_num, retry_count + 1)
        else:
            logger.error(f"Failed to download segment {segment_num} after {config.MAX_RETRIES} attempts")
            self.failed_segments.add(segment_num)
            return False

    def download_available_segments(self, max_segments: Optional[int] = None) -> List[int]:
        """
        Download all currently available segments
        
        Args:
            max_segments: Maximum number of segments to download (None for unlimited)
            
        Returns:
            List of successfully downloaded segment numbers
        """
        status = self.get_segment_status()
        available_segments = status['ready']
        
        if not available_segments:
            logger.warning("No segments available for download")
            return []
        
        # Filter out already downloaded segments
        to_download = [seg for seg in available_segments 
                      if seg not in self.downloaded_segments and seg not in self.failed_segments]
        
        if max_segments:
            to_download = to_download[:max_segments]
        
        if not to_download:
            logger.info("All available segments already downloaded")
            return list(self.downloaded_segments)
        
        logger.info(f"Downloading {len(to_download)} segments: {to_download}")
        
        # Download segments concurrently
        successful_downloads = []
        with ThreadPoolExecutor(max_workers=config.MAX_CONCURRENT) as executor:
            future_to_segment = {executor.submit(self.download_segment, seg): seg 
                               for seg in to_download}
            
            for future in as_completed(future_to_segment):
                segment_num = future_to_segment[future]
                try:
                    success = future.result()
                    if success:
                        successful_downloads.append(segment_num)
                except Exception as e:
                    logger.error(f"Thread error for segment {segment_num}: {e}")
        
        return sorted(successful_downloads)

    def monitor_and_download(self, max_wait_time: int = 300) -> List[int]:
        """
        Continuously monitor for new segments and download them
        
        Args:
            max_wait_time: Maximum time to wait in seconds
            
        Returns:
            List of all downloaded segment numbers
        """
        logger.info(f"Starting continuous monitoring (max wait: {max_wait_time}s)")
        start_time = time.time()
        last_segment_count = 0
        no_new_segments_count = 0
        
        while time.time() - start_time < max_wait_time:
            try:
                # Download currently available segments
                downloaded = self.download_available_segments()
                
                if len(downloaded) > last_segment_count:
                    last_segment_count = len(downloaded)
                    no_new_segments_count = 0
                    logger.info(f"Downloaded {len(downloaded)} segments so far")
                else:
                    no_new_segments_count += 1
                
                # Check if we should continue monitoring
                status = self.get_segment_status()
                if status.get('total') and len(self.downloaded_segments) >= status['total']:
                    logger.info("All segments downloaded according to backend")
                    break
                
                # Stop if no new segments for too long
                if no_new_segments_count >= 10:  # 20 seconds without new segments
                    logger.info("No new segments detected for extended period, stopping monitor")
                    break
                
                # Wait before next check
                logger.debug(f"Waiting {config.POLLING_INTERVAL}s before next check...")
                time.sleep(config.POLLING_INTERVAL)
                
            except KeyboardInterrupt:
                logger.info("Monitoring interrupted by user")
                break
            except Exception as e:
                logger.error(f"Error during monitoring: {e}")
                time.sleep(config.POLLING_INTERVAL)
        
        logger.info(f"Monitoring completed. Downloaded {len(self.downloaded_segments)} segments")
        return sorted(self.downloaded_segments)

    def combine_segments(self, output_file: str, use_ffmpeg: bool = True) -> bool:
        """
        Combine downloaded segments into a single audio file
        
        Args:
            output_file: Path to output file
            use_ffmpeg: Whether to use ffmpeg (True) or simple concatenation (False)
            
        Returns:
            True if combination successful
        """
        if not self.downloaded_segments:
            logger.error("No segments downloaded to combine")
            return False
        
        segment_files = []
        for seg_num in sorted(self.downloaded_segments):
            segment_file = self.download_dir / f"segment_{seg_num}.m4a"
            if segment_file.exists():
                segment_files.append(segment_file)
        
        if not segment_files:
            logger.error("No segment files found for combination")
            return False
        
        logger.info(f"Combining {len(segment_files)} segments into {output_file}")
        
        if use_ffmpeg and self._has_ffmpeg():
            return self._combine_with_ffmpeg(segment_files, output_file)
        else:
            return self._combine_simple(segment_files, output_file)

    def _has_ffmpeg(self) -> bool:
        """Check if ffmpeg is available"""
        try:
            import subprocess
            subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def _combine_with_ffmpeg(self, segment_files: List[Path], output_file: str) -> bool:
        """Combine segments using ffmpeg"""
        try:
            import subprocess
            
            # Create file list for ffmpeg
            list_file = self.download_dir / "segments_list.txt"
            with open(list_file, 'w') as f:
                for segment_file in segment_files:
                    f.write(f"file '{segment_file.absolute()}'\n")
            
            # Run ffmpeg
            cmd = [
                'ffmpeg', '-y', '-f', 'concat', '-safe', '0',
                '-i', str(list_file), '-c', 'copy', output_file
            ]
            
            logger.info(f"Running ffmpeg: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            # Clean up
            list_file.unlink()
            
            logger.info(f"Successfully combined segments with ffmpeg: {output_file}")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg failed: {e.stderr}")
            return False
        except Exception as e:
            logger.error(f"Error running ffmpeg: {e}")
            return False

    def _combine_simple(self, segment_files: List[Path], output_file: str) -> bool:
        """Simple binary concatenation (may not work for all formats)"""
        try:
            with open(output_file, 'wb') as outfile:
                for segment_file in segment_files:
                    with open(segment_file, 'rb') as infile:
                        outfile.write(infile.read())
            
            logger.info(f"Successfully combined segments (simple): {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"Simple combination failed: {e}")
            return False

    def get_download_stats(self) -> Dict:
        """Get download statistics"""
        return {
            'video_id': self.video_id,
            'downloaded_segments': len(self.downloaded_segments),
            'failed_segments': len(self.failed_segments),
            'downloaded_list': sorted(self.downloaded_segments),
            'failed_list': sorted(self.failed_segments),
            'download_directory': str(self.download_dir)
        }

def main():
    """Main entry point for command line usage"""
    parser = argparse.ArgumentParser(description='Download segmented audio from YouTube video')
    parser.add_argument('video_id', help='YouTube video ID (11 characters)')
    parser.add_argument('--backend-url', default=config.BACKEND_URL, help='Backend server URL')
    parser.add_argument('--download-dir', default=config.DOWNLOAD_DIR, help='Download directory')
    parser.add_argument('--max-wait', type=int, default=300, help='Max wait time in seconds')
    parser.add_argument('--no-monitor', action='store_true', help='Download available segments only, no monitoring')
    parser.add_argument('--combine', help='Combine segments into output file')
    parser.add_argument('--no-ffmpeg', action='store_true', help='Use simple concatenation instead of ffmpeg')
    parser.add_argument('--concurrent', type=int, default=config.MAX_CONCURRENT, help='Max concurrent downloads')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')
    
    args = parser.parse_args()
    
    # Configure logging
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Validate video ID
    if not args.video_id or len(args.video_id) != 11:
        logger.error("Invalid video ID. Must be 11 characters (YouTube video ID)")
        sys.exit(1)
    
    # Update configuration
    config.BACKEND_URL = args.backend_url
    config.DOWNLOAD_DIR = args.download_dir
    config.MAX_CONCURRENT = args.concurrent
    
    try:
        # Create downloader
        downloader = SegmentDownloader(args.video_id, args.backend_url)
        
        if args.no_monitor:
            # Download available segments only
            logger.info("Downloading currently available segments...")
            downloaded = downloader.download_available_segments()
        else:
            # Monitor and download continuously
            logger.info("Starting continuous monitoring and download...")
            downloaded = downloader.monitor_and_download(args.max_wait)
        
        # Show statistics
        stats = downloader.get_download_stats()
        logger.info(f"Download complete: {stats}")
        
        # Combine segments if requested
        if args.combine and downloaded:
            success = downloader.combine_segments(args.combine, not args.no_ffmpeg)
            if success:
                logger.info(f"Audio combined successfully: {args.combine}")
            else:
                logger.error("Failed to combine segments")
                sys.exit(1)
        
        if not downloaded:
            logger.warning("No segments were downloaded")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Download interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

# Example usage:
# python segmentDownloader.py dQw4w9WgXcQ --combine output.m4a --verbose
# python segmentDownloader.py dQw4w9WgXcQ --no-monitor --max-concurrent 5