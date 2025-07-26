import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlayerState } from '@/types/music';
import { youtubePlayerService, YouTubePlayerService } from '@/services/youtubePlayerService';

// Create the context
const YouTubePlayerContext = createContext<{
  playerState: PlayerState;
  isLoading: boolean;
  loadingError: string | null;
  pendingSong: Song | null;
  playSong: (song: Song) => Promise<void>;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  nextSong: () => void;
  previousSong: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  formatTime: (time: number) => string;
  addToQueue: (song: Song) => void;
  clearQueue: () => void;
} | null>(null);

export function YouTubePlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    volume: 70,
    progress: 0,
    duration: 0,
    queue: [],
    currentIndex: 0,
    isShuffled: false,
    repeatMode: 'none'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [pendingSong, setPendingSong] = useState<Song | null>(null);
  
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef(false);

  // Initialize YouTube player
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        // Create hidden player container
        const playerContainer = document.createElement('div');
        playerContainer.id = 'youtube-player-container';
        playerContainer.style.position = 'absolute';
        playerContainer.style.top = '-9999px';
        playerContainer.style.left = '-9999px';
        playerContainer.style.width = '1px';
        playerContainer.style.height = '1px';
        playerContainer.style.overflow = 'hidden';
        document.body.appendChild(playerContainer);

        // Set up event listeners
        youtubePlayerService.onStateChange((state: number) => {
          console.log('YouTube player state changed:', state);
          
          switch (state) {
            case YouTubePlayerService.STATES.PLAYING:
              setPlayerState(prev => ({ ...prev, isPlaying: true }));
              setIsLoading(false);
              setLoadingError(null);
              setPendingSong(null);
              startTimeTracking();
              break;
              
            case YouTubePlayerService.STATES.PAUSED:
              setPlayerState(prev => ({ ...prev, isPlaying: false }));
              stopTimeTracking();
              break;
              
            case YouTubePlayerService.STATES.ENDED:
              setPlayerState(prev => ({ ...prev, isPlaying: false }));
              stopTimeTracking();
              nextSong();
              break;
              
            case YouTubePlayerService.STATES.BUFFERING:
              // Keep current playing state but show loading if no song is loaded
              if (!playerState.currentSong) {
                setIsLoading(true);
              }
              break;
              
            case YouTubePlayerService.STATES.CUED:
              setPlayerState(prev => ({ 
                ...prev, 
                duration: youtubePlayerService.getDuration() 
              }));
              break;
          }
        });

        youtubePlayerService.onError((error) => {
          console.error('YouTube player error:', error);
          setIsLoading(false);
          setLoadingError('Playback error occurred');
          setPendingSong(null);
          
          // Try next song if available
          setTimeout(() => {
            nextSong();
          }, 2000);
        });

        isInitialized.current = true;
        console.log('YouTube player context initialized');
      } catch (error) {
        console.error('Failed to initialize YouTube player:', error);
        setLoadingError('Failed to initialize player');
      }
    };

    initializePlayer();

    // Cleanup
    return () => {
      stopTimeTracking();
      youtubePlayerService.destroy();
      
      const container = document.getElementById('youtube-player-container');
      if (container) {
        container.remove();
      }
    };
  }, []);

  // Time tracking for progress updates
  const startTimeTracking = useCallback(() => {
    stopTimeTracking();
    
    timeUpdateIntervalRef.current = setInterval(() => {
      if (youtubePlayerService.isPlaying()) {
        const currentTime = youtubePlayerService.getCurrentTime();
        const duration = youtubePlayerService.getDuration();
        
        setPlayerState(prev => ({
          ...prev,
          progress: currentTime,
          duration: duration > 0 ? duration : prev.duration
        }));
      }
    }, 1000);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }
  }, []);

  // Play song function  
  const playSong = useCallback(async (song: Song, shouldAddToQueue = true) => {
    if (isLoading) {
      console.log('Already loading a song, ignoring request');
      return;
    }

    // If the same song is already playing, don't restart it
    if (playerState.currentSong?.id === song.id && playerState.isPlaying) {
      console.log('Song is already playing, ignoring request');
      return;
    }

    // Add song to queue if not already present and shouldAddToQueue is true
    if (shouldAddToQueue) {
      setPlayerState(prev => {
        const isAlreadyInQueue = prev.queue.some(s => s.id === song.id);
        if (!isAlreadyInQueue) {
          const newQueue = [...prev.queue, song];
          const newIndex = newQueue.length - 1;
          return {
            ...prev,
            queue: newQueue,
            currentIndex: newIndex
          };
        } else {
          const currentIndex = prev.queue.findIndex(s => s.id === song.id);
          return {
            ...prev,
            currentIndex: currentIndex
          };
        }
      });
    }

    try {
      console.log('Starting to play song:', song.title, 'by', song.artist);
      
      setIsLoading(true);
      setLoadingError(null);
      setPendingSong(song);

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Set timeout for loading
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setLoadingError('Loading timed out');
        setPendingSong(null);
      }, 30000); // 30 second timeout

      // Check if song has direct streaming URL from Complete Music API (JioSaavn)
      if (song.audioUrl && song.originalId) {
        console.log('Using direct streaming from Complete Music API:', song.audioUrl);
        
        // For direct streaming, use HTML5 audio element instead of YouTube
        try {
          // Create or get existing audio element with proper event handlers
          let audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
          if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.id = 'direct-audio-player';
            audioElement.style.display = 'none';
            document.body.appendChild(audioElement);
          }

          // Clear any existing event listeners
          audioElement.onplay = null;
          audioElement.onpause = null;
          audioElement.onended = null;
          audioElement.ontimeupdate = null;
          audioElement.onloadedmetadata = null;
          audioElement.onerror = null;

          // Set up proper event handlers for sync with UI
          audioElement.onplay = () => {
            setPlayerState(prev => ({ ...prev, isPlaying: true }));
            setIsLoading(false);
            setPendingSong(null);
            startTimeTracking();
          };

          audioElement.onpause = () => {
            setPlayerState(prev => ({ ...prev, isPlaying: false }));
            stopTimeTracking();
          };

          audioElement.onended = () => {
            setPlayerState(prev => ({ ...prev, isPlaying: false, progress: 0 }));
            stopTimeTracking();
            nextSong();
          };

          audioElement.ontimeupdate = () => {
            setPlayerState(prev => ({
              ...prev,
              progress: audioElement.currentTime,
              duration: audioElement.duration || prev.duration
            }));
          };

          audioElement.onloadedmetadata = () => {
            setPlayerState(prev => ({
              ...prev,
              duration: audioElement.duration || song.duration
            }));
          };

          audioElement.onerror = () => {
            console.error('Direct audio playback error');
            setIsLoading(false);
            setLoadingError('Audio playback failed');
            setPendingSong(null);
          };

          // Set audio source and load
          audioElement.src = song.audioUrl;
          audioElement.volume = playerState.volume / 100; // Use current player volume
          audioElement.load();
          
          // Update current song immediately
          setPlayerState(prev => ({
            ...prev,
            currentSong: song,
            progress: 0
          }));

          // Wait for audio to be ready and play
          await new Promise((resolve, reject) => {
            audioElement.oncanplay = () => {
              audioElement.play().then(resolve).catch(reject);
            };
            audioElement.onerror = reject;
            setTimeout(() => reject(new Error('Direct audio timeout')), 10000);
          });

          console.log('Successfully started direct streaming:', song.title);
          return; // Exit early, don't use YouTube
          
        } catch (directStreamError) {
          console.warn('Direct streaming failed, falling back to YouTube:', directStreamError);
          // Clear the broken audio element
          const audioElement = document.getElementById('direct-audio-player');
          if (audioElement) {
            audioElement.remove();
          }
        }
      }

      // Fallback: Search for YouTube video ID
      const videoId = await youtubePlayerService.searchVideoId(song.title, song.artist);
      
      if (!videoId) {
        throw new Error(`No audio source found for "${song.title}" by ${song.artist}`);
      }

      console.log('Using YouTube fallback, video ID:', videoId);

      // Initialize player if needed, then load video
      if (!isInitialized.current) {
        await youtubePlayerService.initializePlayer('youtube-player-container');
        isInitialized.current = true;
      }
      
      // Load the video
      await youtubePlayerService.loadVideo(videoId, song);

      // Update current song
      setPlayerState(prev => ({
        ...prev,
        currentSong: song,
        progress: 0
      }));

      // Set volume
      youtubePlayerService.setVolume(playerState.volume);

      // Start playing
      youtubePlayerService.play();

      console.log('Successfully started playing:', song.title);

    } catch (error) {
      console.error('Error playing song:', error);
      setIsLoading(false);
      setLoadingError(error instanceof Error ? error.message : 'Failed to play song');
      setPendingSong(null);
    } finally {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
  }, [isLoading, playerState.currentSong, playerState.isPlaying, playerState.volume]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!playerState.currentSong || isLoading) {
      console.log('No song loaded or loading, cannot toggle play/pause');
      return;
    }

    // Check if using direct audio element
    const audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
    if (audioElement && playerState.currentSong.originalId) {
      if (audioElement.paused) {
        audioElement.play();
      } else {
        audioElement.pause();
      }
    } else {
      // Use YouTube player
      if (youtubePlayerService.isPlaying()) {
        youtubePlayerService.pause();
      } else {
        youtubePlayerService.play();
      }
    }
  }, [playerState.currentSong, isLoading]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    setPlayerState(prev => ({ ...prev, volume }));
    
    // Set volume for direct audio element if using JioSaavn
    const audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
    if (audioElement && playerState.currentSong?.originalId) {
      audioElement.volume = volume / 100;
      console.log('Set direct audio volume to:', volume / 100);
    } else {
      // Set volume for YouTube player
      youtubePlayerService.setVolume(volume);
      console.log('Set YouTube volume to:', volume);
    }
  }, [playerState.currentSong]);

  // Seek to position
  const seekTo = useCallback((time: number) => {
    // Seek in direct audio element if using JioSaavn
    const audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
    if (audioElement && playerState.currentSong?.originalId) {
      audioElement.currentTime = time;
      setPlayerState(prev => ({ ...prev, progress: time }));
    } else {
      // Seek in YouTube player
      youtubePlayerService.seekTo(time);
      setPlayerState(prev => ({ ...prev, progress: time }));
    }
  }, [playerState.currentSong]);

  // Next song
  const nextSong = useCallback(() => {
    if (isLoading || playerState.queue.length === 0) {
      return;
    }

    let nextIndex = playerState.currentIndex + 1;

    // Handle repeat mode
    if (playerState.repeatMode === 'one') {
      nextIndex = playerState.currentIndex;
    } else if (nextIndex >= playerState.queue.length) {
      if (playerState.repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return; // End of queue
      }
    }

    // Handle shuffle
    if (playerState.isShuffled && playerState.repeatMode !== 'one') {
      nextIndex = Math.floor(Math.random() * playerState.queue.length);
    }

    const nextSong = playerState.queue[nextIndex];
    if (nextSong) {
      setPlayerState(prev => ({ ...prev, currentIndex: nextIndex }));
      playSong(nextSong, false); // Don't add to queue again
    }
  }, [isLoading, playerState, playSong]);

  // Previous song
  const previousSong = useCallback(() => {
    if (isLoading || playerState.queue.length === 0) {
      return;
    }

    let prevIndex = playerState.currentIndex - 1;

    if (prevIndex < 0) {
      if (playerState.repeatMode === 'all') {
        prevIndex = playerState.queue.length - 1;
      } else {
        return;
      }
    }

    const prevSong = playerState.queue[prevIndex];
    if (prevSong) {
      setPlayerState(prev => ({ ...prev, currentIndex: prevIndex }));
      playSong(prevSong, false); // Don't add to queue again
    }
  }, [isLoading, playerState, playSong]);

  // Toggle shuffle
  const toggleShuffle = useCallback(() => {
    setPlayerState(prev => ({ ...prev, isShuffled: !prev.isShuffled }));
  }, []);

  // Toggle repeat
  const toggleRepeat = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      repeatMode: prev.repeatMode === 'none' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'none'
    }));
  }, []);

  // Format time helper
  const formatTime = useCallback((time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Add song to queue
  const addToQueue = useCallback((song: Song) => {
    setPlayerState(prev => ({
      ...prev,
      queue: [...prev.queue, song]
    }));
  }, []);

  // Clear queue
  const clearQueue = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      queue: [],
      currentIndex: 0
    }));
  }, []);

  const value = {
    playerState,
    isLoading,
    loadingError,
    pendingSong,
    playSong,
    togglePlayPause,
    setVolume,
    seekTo,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    formatTime,
    addToQueue,
    clearQueue
  };

  return (
    <YouTubePlayerContext.Provider value={value}>
      {children}
    </YouTubePlayerContext.Provider>
  );
}

export function useYouTubePlayer() {
  const context = useContext(YouTubePlayerContext);
  if (!context) {
    throw new Error('useYouTubePlayer must be used within a YouTubePlayerProvider');
  }
  return context;
}