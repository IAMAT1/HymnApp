import { Song } from '@/types/music';

interface YouTubePlayerConfig {
  videoId: string;
  height: string;
  width: string;
  playerVars: {
    autoplay: number;
    controls: number;
    disablekb: number;
    fs: number;
    modestbranding: number;
    rel: number;
    showinfo: number;
    iv_load_policy: number;
    start?: number;
  };
  events: {
    onReady: (event: any) => void;
    onStateChange: (event: any) => void;
    onError: (event: any) => void;
  };
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export class YouTubePlayerService {
  private player: any = null;
  private isAPIReady = false;
  private readyCallbacks: (() => void)[] = [];
  private stateChangeCallbacks: ((state: number) => void)[] = [];
  private errorCallbacks: ((error: any) => void)[] = [];
  private timeUpdateInterval: NodeJS.Timeout | null = null;
  private currentSong: Song | null = null;

  // YouTube Player States
  static readonly STATES = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5
  };

  constructor() {
    this.loadYouTubeAPI();
  }

  private async loadYouTubeAPI(): Promise<void> {
    return new Promise((resolve) => {
      // Check if API is already loaded
      if (window.YT && window.YT.Player) {
        this.isAPIReady = true;
        this.triggerReadyCallbacks();
        resolve();
        return;
      }

      // Load the YouTube API script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      // Set up the global callback
      window.onYouTubeIframeAPIReady = () => {
        this.isAPIReady = true;
        this.triggerReadyCallbacks();
        resolve();
      };
    });
  }

  private triggerReadyCallbacks(): void {
    this.readyCallbacks.forEach(callback => callback());
    this.readyCallbacks = [];
  }

  public onReady(callback: () => void): void {
    if (this.isAPIReady) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  public onStateChange(callback: (state: number) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  public onError(callback: (error: any) => void): void {
    this.errorCallbacks.push(callback);
  }

  public async initializePlayer(containerId: string, videoId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.onReady(() => {
        try {
          const config: YouTubePlayerConfig = {
            videoId: videoId || 'jNQXAC9IVRw', // Default video
            height: '1',  // Minimal height (can't be 0)
            width: '1',   // Minimal width (can't be 0)
            playerVars: {
              autoplay: 0,
              controls: 0,        // Hide all controls
              disablekb: 1,       // Disable keyboard controls
              fs: 0,              // Disable fullscreen
              modestbranding: 1,  // Hide YouTube logo
              rel: 0,             // Don't show related videos
              showinfo: 0,        // Hide video info
              iv_load_policy: 3   // Hide annotations
            },
            events: {
              onReady: (event) => {
                console.log('YouTube player ready');
                this.startTimeTracking();
                resolve();
              },
              onStateChange: (event) => {
                console.log('YouTube player state changed:', event.data);
                this.stateChangeCallbacks.forEach(callback => callback(event.data));
              },
              onError: (event) => {
                console.error('YouTube player error:', event.data);
                this.errorCallbacks.forEach(callback => callback(event));
                
                // Only reject on critical initialization errors
                if (!this.player) {
                  reject(new Error(`YouTube player initialization error: ${event.data}`));
                }
              }
            }
          };

          this.player = new window.YT.Player(containerId, config);
        } catch (error) {
          console.error('Failed to initialize YouTube player:', error);
          reject(error);
        }
      });
    });
  }

  public async loadVideo(videoId: string, song?: Song): Promise<void> {
    if (!this.player) {
      throw new Error('Player not initialized');
    }

    this.currentSong = song || null;
    console.log('Loading YouTube video:', videoId, 'for song:', song?.title);
    
    return new Promise((resolve, reject) => {
      const onStateChange = (state: number) => {
        if (state === YouTubePlayerService.STATES.CUED) {
          console.log('Video loaded successfully:', videoId);
          resolve();
        } else if (state === YouTubePlayerService.STATES.ENDED) {
          console.log('Video ended');
        }
      };

      const onError = (error: any) => {
        console.error('Failed to load video:', videoId, error);
        reject(new Error(`Failed to load video: ${error.data}`));
      };

      // Add temporary listeners
      this.onStateChange(onStateChange);
      this.onError(onError);

      try {
        this.player.loadVideoById(videoId);
      } catch (error) {
        reject(error);
      }
    });
  }

  public play(): void {
    if (this.player && this.player.playVideo) {
      console.log('Playing YouTube video');
      this.player.playVideo();
    }
  }

  public pause(): void {
    if (this.player && this.player.pauseVideo) {
      console.log('Pausing YouTube video');
      this.player.pauseVideo();
    }
  }

  public stop(): void {
    if (this.player && this.player.stopVideo) {
      console.log('Stopping YouTube video');
      this.player.stopVideo();
    }
  }

  public seekTo(seconds: number): void {
    if (this.player && this.player.seekTo) {
      console.log('Seeking to:', seconds, 'seconds');
      this.player.seekTo(seconds, true);
    }
  }

  public setVolume(volume: number): void {
    if (this.player && this.player.setVolume) {
      const youtubeVolume = Math.round(volume * 100);
      console.log('Setting YouTube volume to:', youtubeVolume);
      this.player.setVolume(youtubeVolume);
    }
  }

  public getVolume(): number {
    if (this.player && this.player.getVolume) {
      return this.player.getVolume() / 100;
    }
    return 0.7; // Default volume
  }

  public getCurrentTime(): number {
    if (this.player && this.player.getCurrentTime) {
      return this.player.getCurrentTime();
    }
    return 0;
  }

  public getDuration(): number {
    if (this.player && this.player.getDuration) {
      return this.player.getDuration();
    }
    return 0;
  }

  public getPlayerState(): number {
    if (this.player && this.player.getPlayerState) {
      return this.player.getPlayerState();
    }
    return YouTubePlayerService.STATES.UNSTARTED;
  }

  public isPlaying(): boolean {
    return this.getPlayerState() === YouTubePlayerService.STATES.PLAYING;
  }

  public isPaused(): boolean {
    return this.getPlayerState() === YouTubePlayerService.STATES.PAUSED;
  }

  public isBuffering(): boolean {
    return this.getPlayerState() === YouTubePlayerService.STATES.BUFFERING;
  }

  private startTimeTracking(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }

    this.timeUpdateInterval = setInterval(() => {
      if (this.isPlaying()) {
        // Trigger time update callbacks if needed
        const currentTime = this.getCurrentTime();
        const duration = this.getDuration();
        
        // You can add custom time update callbacks here
        // console.log('Time update:', currentTime, '/', duration);
      }
    }, 1000);
  }

  public destroy(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }

    if (this.player && this.player.destroy) {
      this.player.destroy();
      this.player = null;
    }

    this.stateChangeCallbacks = [];
    this.errorCallbacks = [];
    this.currentSong = null;
  }

  // Search for YouTube video ID based on song info
  public async searchVideoId(title: string, artist: string): Promise<string | null> {
    try {
      const query = `${title} ${artist}`.trim();
      console.log('Searching YouTube for:', query);
      
      // Use the backend endpoint for YouTube search with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`/api/music/youtube/search?q=${encodeURIComponent(query)}&limit=1`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`YouTube search failed with status: ${response.status}`);
        
        // Fallback to predefined video IDs for popular artists
        const fallbackMap: Record<string, string> = {
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
        
        const artistLower = artist.toLowerCase();
        for (const [name, videoId] of Object.entries(fallbackMap)) {
          if (artistLower.includes(name) || name.includes(artistLower)) {
            console.log('Using fallback video ID for:', artist);
            return videoId;
          }
        }
        
        throw new Error(`YouTube search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const videoId = data.items[0].id?.videoId || data.items[0].url?.split('v=')[1]?.split('&')[0];
        console.log('Found YouTube video ID:', videoId);
        return videoId;
      }
      
      throw new Error('No YouTube video found');
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('YouTube search timed out');
      } else {
        console.error('YouTube search error:', error);
      }
      return null;
    }
  }

  // Get current song info
  public getCurrentSong(): Song | null {
    return this.currentSong;
  }
}

// Create a singleton instance
export const youtubePlayerService = new YouTubePlayerService();