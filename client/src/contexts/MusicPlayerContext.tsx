import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlayerState } from '@/types/music';

// Create the context
const MusicPlayerContext = createContext<{
  playerState: PlayerState;
  isLoading: boolean;
  loadingError: string | null;
  pendingSong: Song | null;
  playSong: (song: Song) => Promise<void>;
  playSongWithPlaylist: (song: Song, playlist?: Song[], addToQueue?: boolean) => Promise<void>;
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

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
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

  // Initialize audio player
  useEffect(() => {
    const initializePlayer = async () => {
      try {
        isInitialized.current = true;
        console.log('Music player context initialized');
      } catch (error) {
        console.error('Failed to initialize music player:', error);
        setLoadingError('Failed to initialize player');
      }
    };

    initializePlayer();

    // Cleanup
    return () => {
      stopTimeTracking();
      
      // Clean up any audio element
      const audioElement = document.getElementById('direct-audio-player');
      if (audioElement) {
        audioElement.remove();
      }
    };
  }, []);

  // Time tracking for progress updates
  const startTimeTracking = useCallback(() => {
    stopTimeTracking();
    
    timeUpdateIntervalRef.current = setInterval(() => {
      const audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
      if (audioElement && !audioElement.paused) {
        setPlayerState(prev => ({
          ...prev,
          progress: audioElement.currentTime,
          duration: audioElement.duration > 0 ? audioElement.duration : prev.duration
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

  // Play song function with optional playlist context
  const playSong = useCallback(async (song: Song, playlist?: Song[], addToQueue = true) => {
    if (isLoading) {
      console.log('Already loading a song, ignoring request');
      return;
    }

    // Add to queue if needed
    if (addToQueue) {
      setPlayerState(prev => {
        // If a playlist is provided, use it as the new queue
        if (playlist && playlist.length > 0) {
          const songIndex = playlist.findIndex(s => s.id === song.id);
          const currentIndex = songIndex !== -1 ? songIndex : 0;
          console.log('Setting up queue with', playlist.length, 'songs, starting at index', currentIndex);
          return {
            ...prev,
            queue: playlist,
            currentIndex: currentIndex
          };
        } else {
          // Single song behavior - add to existing queue
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
      if (song.audioUrl) {
        console.log('Using direct streaming from Complete Music API:', song.audioUrl);
        
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
              console.log('Audio can play, attempting to start playback');
              audioElement.play().then(() => {
                console.log('Audio playback started successfully');
                resolve(undefined);
              }).catch((error) => {
                console.error('Audio play() failed:', error);
                reject(error);
              });
            };
            audioElement.onerror = (error) => {
              console.error('Audio element error:', error);
              reject(error);
            };
            audioElement.onloadstart = () => console.log('Audio load started');
            audioElement.onloadeddata = () => console.log('Audio data loaded');
            setTimeout(() => {
              console.warn('Audio loading timeout after 10 seconds');
              reject(new Error('Direct audio timeout'));
            }, 10000);
          });

          console.log('Successfully started direct streaming:', song.title);
          return;
          
        } catch (directStreamError) {
          console.warn('Direct streaming failed:', directStreamError);
          // Clear the broken audio element
          const audioElement = document.getElementById('direct-audio-player');
          if (audioElement) {
            audioElement.remove();
          }
          setIsLoading(false);
          setLoadingError('Audio playback failed');
          setPendingSong(null);
        }
      } else {
        setIsLoading(false);
        setLoadingError('No audio source available for this song');
        setPendingSong(null);
      }

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
  }, [isLoading, playerState.volume, startTimeTracking, stopTimeTracking]);

  // Overloaded playSong function for backwards compatibility
  const playSongCompat = useCallback(async (song: Song) => {
    return playSong(song, undefined, true);
  }, [playSong]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!playerState.currentSong || isLoading) {
      console.log('No song loaded or loading, cannot toggle play/pause');
      return;
    }

    // Check if using direct audio element
    const audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
    if (audioElement && playerState.currentSong) {
      if (audioElement.paused) {
        audioElement.play();
      } else {
        audioElement.pause();
      }
    }
  }, [playerState.currentSong, isLoading]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    setPlayerState(prev => ({ ...prev, volume }));
    
    // Set volume for direct audio element
    const audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
    if (audioElement && playerState.currentSong) {
      audioElement.volume = volume / 100;
      console.log('Set audio volume to:', volume / 100);
    }
  }, [playerState.currentSong]);

  // Seek to position
  const seekTo = useCallback((time: number) => {
    // Seek in direct audio element
    const audioElement = document.getElementById('direct-audio-player') as HTMLAudioElement;
    if (audioElement && playerState.currentSong) {
      audioElement.currentTime = time;
      setPlayerState(prev => ({ ...prev, progress: time }));
    }
  }, [playerState.currentSong]);

  // Next song
  const nextSong = useCallback(() => {
    console.log('Next song called - Queue length:', playerState.queue.length, 'Current index:', playerState.currentIndex, 'Loading:', isLoading);
    
    if (isLoading || playerState.queue.length === 0) {
      console.log('Cannot go to next song - no queue or loading');
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
        console.log('End of queue reached');
        return; // End of queue
      }
    }

    // Handle shuffle
    if (playerState.isShuffled && playerState.repeatMode !== 'one') {
      nextIndex = Math.floor(Math.random() * playerState.queue.length);
    }

    const nextSong = playerState.queue[nextIndex];
    if (nextSong) {
      console.log('Playing next song:', nextSong.title, 'at index:', nextIndex);
      setPlayerState(prev => ({ ...prev, currentIndex: nextIndex }));
      playSong(nextSong, [], false); // Don't add to queue again
    }
  }, [isLoading, playerState, playSong]);

  // Previous song
  const previousSong = useCallback(() => {
    console.log('Previous song called - Queue length:', playerState.queue.length, 'Current index:', playerState.currentIndex, 'Loading:', isLoading);
    
    if (isLoading || playerState.queue.length === 0) {
      console.log('Cannot go to previous song - no queue or loading');
      return;
    }

    let prevIndex = playerState.currentIndex - 1;

    if (prevIndex < 0) {
      if (playerState.repeatMode === 'all') {
        prevIndex = playerState.queue.length - 1;
      } else {
        console.log('Beginning of queue reached');
        return;
      }
    }

    const prevSong = playerState.queue[prevIndex];
    if (prevSong) {
      console.log('Playing previous song:', prevSong.title, 'at index:', prevIndex);
      setPlayerState(prev => ({ ...prev, currentIndex: prevIndex }));
      playSong(prevSong, [], false); // Don't add to queue again
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
    playSong: playSongCompat,
    playSongWithPlaylist: playSong,
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
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
}