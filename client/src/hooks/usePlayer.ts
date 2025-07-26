import { useState, useCallback, useRef, useEffect } from 'react';
import { Song, PlayerState } from '@/types/music';
import { MusicAPI } from '@/services/api';

export function usePlayer() {
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    volume: 0.7,
    progress: 0,
    duration: 0,
    queue: [],
    currentIndex: 0,
    isShuffled: false,
    repeatMode: 'none'
  });

  // Add loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = playerState.volume;
    
    const audio = audioRef.current;
    
    const handleLoadedMetadata = () => {
      console.log('Audio metadata loaded, duration:', audio.duration);
      setPlayerState(prev => ({
        ...prev,
        duration: audio.duration
      }));
    };

    const handleTimeUpdate = () => {
      setPlayerState(prev => ({
        ...prev,
        progress: audio.currentTime
      }));
    };

    const handlePlay = () => {
      console.log('Audio play event fired (but not necessarily streaming yet)');
      // DO NOT set isPlaying here - this fires too early
      // Let the manual 'playing' event handler set isPlaying only when actually streaming
    };

    const handlePause = () => {
      console.log('Audio paused');
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false
      }));
    };

    const handleEnded = () => {
      console.log('Audio ended');
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false
      }));
      // nextSong(); // Comment out for now to prevent recursive calls
    };

    const handleError = () => {
      console.error('Audio error occurred');
      setIsLoading(false);
      setLoadingError('Failed to load audio');
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };

    const handleCanPlay = () => {
      console.log('Audio can play');
      setIsLoading(false);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
    };
  }, []);

  const playSong = useCallback(async (song: Song) => {
    // Prevent multiple concurrent loading attempts
    if (isLoading) {
      console.log('Song already loading, ignoring request');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingError(null);
      
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Set timeout for loading (30 seconds max)
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setLoadingError('Song loading timed out');
        console.error('Song loading timed out');
      }, 30000);

      console.log('Setting current song in player state:', song.title, 'by', song.artist);
      
      // Set loading state first - don't show playing until we confirm backend is ready
      setIsLoading(true);
      setLoadingError(null);
      
      setPlayerState(prev => {
        const newState = {
          ...prev,
          currentSong: song,
          isPlaying: false, // Keep as false until audio actually starts playing
          progress: 0 // Reset progress for new song
        };
        console.log('Updated player state:', newState);
        return newState;
      });
      
      // Get stream URL 
      console.log('Getting stream URL for:', song.title);
      const streamUrl = await MusicAPI.getStreamUrlOptimized(song);
      
      if (audioRef.current && streamUrl) {
        const audio = audioRef.current;
        console.log('Configuring audio element for:', streamUrl);
        
        // Setup audio element with proper event handlers
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto';
        
        // Add comprehensive error handling
        const audioErrorHandler = (e) => {
          console.error('Audio element error:', e, audio.error);
          console.error('Error code:', audio.error?.code, 'Error message:', audio.error?.message);
        };
        
        // Add event listeners to track actual audio status
        const audioPlayingHandler = () => {
          console.log('Audio is now ACTUALLY playing (streaming confirmed)');
          setPlayerState(prev => {
            const newState = { ...prev, isPlaying: true };
            console.log('Setting isPlaying to true, new state:', newState);
            return newState;
          });
          setIsLoading(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }
        };
        
        const audioCanPlayHandler = () => {
          console.log('Audio is ready to play - enough data loaded');
          setIsLoading(false);
        };
        
        audio.addEventListener('error', audioErrorHandler, { once: true });
        audio.addEventListener('playing', audioPlayingHandler, { once: true });
        audio.addEventListener('canplay', audioCanPlayHandler, { once: true });
        
        // Always check if it's our backend stream first
        if (streamUrl.includes('/api/stream')) {
          console.log('Backend stream URL detected, checking for timeout response');
          
          // Make a quick request to see if backend timed out
          try {
            const response = await fetch(streamUrl);
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
              // Backend returned JSON (timeout), parse it
              const jsonResponse = await response.json();
              console.log('Backend timeout response:', jsonResponse);
              
              if (jsonResponse.directStream && jsonResponse.streamUrl) {
                console.log('Using direct Cloudflare URL from timeout response:', jsonResponse.streamUrl);
                audio.src = jsonResponse.streamUrl;
              } else {
                console.error('Invalid timeout response, using original URL');
                audio.src = streamUrl;
              }
            } else if (contentType && (contentType.includes('audio') || contentType.includes('video'))) {
              // Backend returned audio directly
              console.log('Backend streaming audio directly');
              audio.src = streamUrl;
            } else {
              console.log('Unknown content type, using URL as-is');
              audio.src = streamUrl;
            }
          } catch (fetchError) {
            console.error('Error checking backend response:', fetchError);
            audio.src = streamUrl;
          }
        } else {
          console.log('Direct external URL');
          audio.src = streamUrl;
        }
        
        // Load and attempt to play
        audio.load();
        
        try {
          await audio.play();
          console.log('Audio play initiated - waiting for playing event');
          // Don't set playing state here - wait for the 'playing' event
        } catch (playError) {
          console.error('Failed to start audio playback:', playError);
          audio.removeEventListener('error', audioErrorHandler);
          audio.removeEventListener('playing', audioPlayingHandler);
          audio.removeEventListener('canplay', audioCanPlayHandler);
          throw playError;
        }
      } else {
        console.error('No audio element or stream URL');
        setIsLoading(false);
        setLoadingError('No stream URL found');
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
      }
    } catch (error) {
      console.error('Error playing song:', error);
      setIsLoading(false);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load song');
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      // Reset playing state on error
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false
      }));
    }
  }, [isLoading]);

  const togglePlayPause = useCallback(() => {
    if (audioRef.current && playerState.currentSong) {
      if (playerState.isPlaying) {
        console.log('Pausing audio');
        audioRef.current.pause();
      } else {
        console.log('Playing audio');
        audioRef.current.play().catch(error => {
          console.error('Failed to play audio:', error);
        });
      }
    }
  }, [playerState.isPlaying, playerState.currentSong]);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      setPlayerState(prev => ({
        ...prev,
        volume
      }));
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState(prev => ({
        ...prev,
        progress: time
      }));
    }
  }, []);

  const nextSong = useCallback(() => {
    const { queue, currentIndex, repeatMode } = playerState;
    
    if (queue.length === 0) return;
    
    let nextIndex = currentIndex + 1;
    
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return;
      }
    }
    
    setPlayerState(prev => ({
      ...prev,
      currentIndex: nextIndex
    }));
    
    // Preload next songs in the queue
    const upcomingSongs = queue.slice(nextIndex + 1, nextIndex + 3);
    if (upcomingSongs.length > 0) {
      console.log('Preloading upcoming songs:', upcomingSongs.map(s => s.title));
      MusicAPI.preloadQueue(upcomingSongs);
    }
    
    playSong(queue[nextIndex]);
  }, [playerState, playSong]);

  const previousSong = useCallback(() => {
    const { queue, currentIndex } = playerState;
    
    if (queue.length === 0) return;
    
    let prevIndex = currentIndex - 1;
    
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    
    setPlayerState(prev => ({
      ...prev,
      currentIndex: prevIndex
    }));
    
    // Preload next songs from the new position
    const upcomingSongs = queue.slice(prevIndex + 1, prevIndex + 3);
    if (upcomingSongs.length > 0) {
      console.log('Preloading upcoming songs from previous:', upcomingSongs.map(s => s.title));
      MusicAPI.preloadQueue(upcomingSongs);
    }
    
    playSong(queue[prevIndex]);
  }, [playerState, playSong]);

  const addToQueue = useCallback((songs: Song[]) => {
    setPlayerState(prev => {
      const newQueue = [...prev.queue, ...songs];
      
      // Preload next 2 songs in queue for instant playback
      const nextSongs = newQueue.slice(prev.currentIndex + 1, prev.currentIndex + 3);
      if (nextSongs.length > 0) {
        console.log('Preloading next songs in queue:', nextSongs.map(s => s.title));
        MusicAPI.preloadQueue(nextSongs);
      }
      
      return {
        ...prev,
        queue: newQueue
      };
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      isShuffled: !prev.isShuffled
    }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      repeatMode: prev.repeatMode === 'none' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'none'
    }));
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    playerState,
    playSong,
    togglePlayPause,
    setVolume,
    seekTo,
    nextSong,
    previousSong,
    addToQueue,
    toggleShuffle,
    toggleRepeat,
    formatTime,
    isLoading,
    loadingError
  };
}
