import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Song, PlayerState } from '@/types/music';
import { MusicService } from '@/services/musicService';

// Create the context
const PlayerContext = createContext<{
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
} | null>(null);

export function GlobalPlayerProvider({ children }: { children: React.ReactNode }) {
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

  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSegmentRef = useRef<number>(0);
  const currentVideoIdRef = useRef<string | null>(null);
  const totalSegmentsRef = useRef<number>(4); // Assume 4 segments total
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const totalDurationRef = useRef<number>(105); // Default 105 seconds
  const segmentStartTimeRef = useRef<number>(0);
  const audioBufferRef = useRef<HTMLAudioElement[]>([]); // Buffer for seamless transitions
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const simultaneousAudioRefs = useRef<HTMLAudioElement[]>([]); // All 4 segments playing simultaneously
  const isSimultaneousModeRef = useRef<boolean>(false); // Track if we're in simultaneous mode
  const [pendingSong, setPendingSong] = useState<Song | null>(null); // Track song being loaded

  // Initialize audio element and event listeners
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = playerState.volume;
    
    const audio = audioRef.current;
    
    const handleLoadedMetadata = () => {
      console.log('Audio metadata loaded, duration:', audio.duration);
      
      // Always show total duration, not segment duration
      if (currentSegmentRef.current === 0) {
        fetchTotalDuration();
      }
      
      setPlayerState(prev => ({
        ...prev,
        duration: totalDurationRef.current // Always use full song duration
      }));
    };

    const handleTimeUpdate = () => {
      if (isSimultaneousModeRef.current) {
        // In simultaneous mode, progress is based on the first segment (reference audio)
        const totalProgress = audio.currentTime;
        
        setPlayerState(prev => ({
          ...prev,
          progress: totalProgress
        }));
      } else {
        // For combined segments or single stream, use direct currentTime
        setPlayerState(prev => ({
          ...prev,
          progress: audio.currentTime
        }));
      }
    };

    const handlePlay = () => {
      console.log('Audio play event fired (but not necessarily streaming yet)');
      // DO NOT set isPlaying here - this fires too early
    };

    const handlePlaying = () => {
      console.log('Audio is actually playing now');
      setPlayerState(prev => ({
        ...prev,
        isPlaying: true
      }));
    };

    const handlePause = () => {
      console.log('Audio paused');
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false
      }));
    };

    const handleEnded = () => {
      console.log(`Audio ended`);
      
      // In simultaneous mode, the song is complete when the main audio (first segment) ends
      if (isSimultaneousModeRef.current) {
        console.log('Song completed - simultaneous playback finished');
        
        // Stop all simultaneous segments
        simultaneousAudioRefs.current.forEach(audio => {
          audio.pause();
          audio.src = '';
        });
        simultaneousAudioRefs.current = [];
        isSimultaneousModeRef.current = false;
        
        setPlayerState(prev => {
          const newState = {
            ...prev,
            isPlaying: false,
            progress: 0
          };
          
          if (prev.repeatMode === 'one') {
            // Replay the same song
            setTimeout(() => playSong(prev.currentSong!), 100);
          } else if (prev.queue.length > 0 && prev.currentIndex < prev.queue.length - 1) {
            // Play next song
            setTimeout(() => nextSong(), 100);
          } else if (prev.repeatMode === 'all' && prev.queue.length > 0) {
            // Loop back to first song
            const firstSong = prev.queue[0];
            setTimeout(() => playSong(firstSong), 100);
          }
          
          return newState;
        });
        return;
      }
      
      // Legacy sequential mode handling
      console.log(`Segment ${currentSegmentRef.current} ended`);
      
      // Try instant seamless transition first if next segment is preloaded
      if (nextAudioRef.current && nextAudioRef.current.readyState >= 3 && currentSegmentRef.current < totalSegmentsRef.current - 1) {
        console.log('Using preloaded segment for INSTANT transition');
        performInstantTransition();
        return;
      }
      
      // Check if we can continue with next segment (fallback loading)
      if (currentVideoIdRef.current && currentSegmentRef.current < totalSegmentsRef.current - 1) {
        console.log(`Loading next segment: ${currentSegmentRef.current + 1}`);
        playNextSegment();
        return;
      }
      
      console.log('Song completed - all segments played');
      setPlayerState(prev => {
        const newState = {
          ...prev,
          isPlaying: false
        };
        
        // Reset segment tracking
        currentSegmentRef.current = 0;
        currentVideoIdRef.current = null;
        
        // Use timeout to access updated state values
        setTimeout(() => {
          if (newState.repeatMode === 'one' && newState.currentSong) {
            // Repeat current song
            playSong(newState.currentSong);
          } else {
            // Play next song in queue
            nextSong();
          }
        }, 100);
        
        return newState;
      });
    };

    const handleError = (e: Event) => {
      const audioEl = e.target as HTMLAudioElement;
      const error = audioEl.error;
      console.error('Audio error occurred:', {
        code: error?.code,
        message: error?.message,
        src: audioEl.src,
        networkState: audioEl.networkState,
        readyState: audioEl.readyState
      });
      setIsLoading(false);
      setLoadingError('Failed to load audio');
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };

    const handleCanPlay = () => {
      console.log('Audio can play');
      // Don't interfere with loading state during song switching
      // The playSong function manages this state properly
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
    };
  }, []);

  // Helper function to extract video ID from URL
  const extractVideoId = (url: string): string | null => {
    try {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      return urlParams.get('v');
    } catch {
      return null;
    }
  };

  // Fetch total song duration from backend
  const fetchTotalDuration = async () => {
    if (!currentVideoIdRef.current) return;
    
    try {
      const response = await fetch(`/api/status?v=${currentVideoIdRef.current}`);
      const data = await response.json();
      if (data.totalDuration) {
        totalDurationRef.current = data.totalDuration;
        console.log('Total song duration:', data.totalDuration);
        
        // Update UI immediately with correct duration
        setPlayerState(prev => ({
          ...prev,
          duration: data.totalDuration
        }));
      }
    } catch (error) {
      console.log('Could not fetch total duration:', error);
      // Fallback: estimate based on segments (15s + 3*30s = 105s)
      totalDurationRef.current = 105;
      setPlayerState(prev => ({
        ...prev,
        duration: 105
      }));
    }
  };

  // Preload next segment for seamless transition
  const preloadNextSegment = async () => {
    if (!currentVideoIdRef.current || nextAudioRef.current) return;
    
    const nextSegmentNum = currentSegmentRef.current + 1;
    if (nextSegmentNum >= totalSegmentsRef.current) return;
    
    const nextSegmentUrl = `${window.location.protocol}//${window.location.host}/api/stream?v=${currentVideoIdRef.current}&segment=${nextSegmentNum}`;
    
    console.log(`Preloading segment ${nextSegmentNum} for seamless transition`);
    
    try {
      nextAudioRef.current = new Audio();
      nextAudioRef.current.src = nextSegmentUrl;
      nextAudioRef.current.preload = 'auto';
      nextAudioRef.current.volume = audioRef.current?.volume || 0.5;
      
      // Force immediate loading
      nextAudioRef.current.load();
      
      nextAudioRef.current.addEventListener('canplaythrough', () => {
        console.log(`Segment ${nextSegmentNum} fully buffered and ready`);
      });
      
      nextAudioRef.current.addEventListener('loadeddata', () => {
        console.log(`Segment ${nextSegmentNum} data loaded`);
      });
      
    } catch (error) {
      console.log(`Failed to preload segment ${nextSegmentNum}:`, error);
      nextAudioRef.current = null;
    }
  };

  // Play all 4 segments simultaneously without any delay
  const playAllSegmentsSimultaneously = async () => {
    if (!currentVideoIdRef.current) return;
    
    try {
      console.log('Starting SIMULTANEOUS playback of all 4 segments with ZERO delay');
      
      // Clear any existing simultaneous audio elements
      simultaneousAudioRefs.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      simultaneousAudioRefs.current = [];
      
      // Create audio elements for all 4 segments and start them ALL at exactly the same time
      const segmentPromises = [];
      
      for (let i = 0; i < totalSegmentsRef.current; i++) {
        const segmentUrl = `${window.location.protocol}//${window.location.host}/api/stream?v=${currentVideoIdRef.current}&segment=${i}`;
        const audio = new Audio();
        audio.src = segmentUrl;
        audio.preload = 'auto';
        audio.volume = playerState.volume;
        
        // Add to array immediately
        simultaneousAudioRefs.current.push(audio);
        
        // Start playing ALL segments at exactly the same time - ZERO delay
        const segmentPromise = audio.play().then(() => {
          console.log(`Segment ${i} started playing immediately with zero delay`);
        }).catch(error => {
          console.error(`Failed to play segment ${i}:`, error);
        });
        
        segmentPromises.push(segmentPromise);
      }
      
      // Set the main audio reference to the first segment for UI controls
      audioRef.current = simultaneousAudioRefs.current[0];
      isSimultaneousModeRef.current = true;
      
      // Wait for all segments to start - they all start at the EXACT same time
      await Promise.all(segmentPromises);
      console.log('All 4 segments started playing simultaneously with ZERO delay between them');
      
    } catch (error) {
      console.error('Simultaneous playback failed:', error);
      // Fallback to sequential playback
      isSimultaneousModeRef.current = false;
      performInstantTransition();
    }
  };

  // Perform instant transition with 0ms gap (legacy sequential mode)
  const performInstantTransition = async () => {
    if (!nextAudioRef.current || !audioRef.current) return;
    
    try {
      console.log('Performing INSTANT 0ms transition');
      
      const currentAudio = audioRef.current;
      const nextAudio = nextAudioRef.current;
      const originalVolume = currentAudio.volume;
      
      // Ensure next audio is properly prepared
      nextAudio.currentTime = 0;
      nextAudio.volume = originalVolume; // Maintain volume level
      
      // Start next segment IMMEDIATELY before stopping current
      await nextAudio.play();
      
      // Instantly stop current and switch - NO FADE
      currentAudio.pause();
      audioRef.current = nextAudio;
      nextAudioRef.current = null;
      
      // Update segment tracking
      currentSegmentRef.current += 1;
      if (currentSegmentRef.current === 1) {
        segmentStartTimeRef.current = 15;
      } else {
        segmentStartTimeRef.current += 30;
      }
      
      console.log(`INSTANT transition to segment ${currentSegmentRef.current} complete - 0ms gap`);
      
      // Start preloading next segment immediately
      preloadNextSegment();
      
    } catch (error) {
      console.error('Instant transition failed:', error);
      // Fallback to direct loading
      playNextSegment();
    }
  };

  // Function to play next segment seamlessly
  const playNextSegment = async () => {
    if (!audioRef.current || !currentVideoIdRef.current) return;
    
    currentSegmentRef.current += 1;
    
    // Update segment start time for progress calculation
    if (currentSegmentRef.current === 1) {
      segmentStartTimeRef.current = 15; // First segment is 15s
    } else {
      segmentStartTimeRef.current += 30; // Subsequent segments are 30s each
    }
    
    console.log(`Switching to segment ${currentSegmentRef.current}`);
    
    try {
      const nextSegmentUrl = `${window.location.protocol}//${window.location.host}/api/stream?v=${currentVideoIdRef.current}&segment=${currentSegmentRef.current}`;
      
      // Check if segment is available
      const checkResponse = await fetch(nextSegmentUrl, { method: 'HEAD' });
      if (!checkResponse.ok) {
        console.log(`Segment ${currentSegmentRef.current} not available, song completed`);
        nextSong();
        return;
      }
      
      // Load next segment directly - browsers handle this efficiently
      audioRef.current.src = nextSegmentUrl;
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      console.log(`Playing segment ${currentSegmentRef.current}`);
      
      // Start preloading the next segment
      preloadNextSegment();
      
    } catch (error) {
      console.error('Failed to play next segment:', error);
      tryDirectBackend();
    }
  };

  // Fallback to external backend for continuous playback
  const tryDirectBackend = async () => {
    if (!audioRef.current || !currentVideoIdRef.current) return;
    
    console.log('Segment failed, trying external backend for continuous playback');
    try {
      const directUrl = `https://functions-offers-audit-insertion.trycloudflare.com/stream?v=${currentVideoIdRef.current}`;
      audioRef.current.src = directUrl;
      await audioRef.current.play();
      console.log('Continuing with external backend');
    } catch (error) {
      console.error('External backend also failed:', error);
      nextSong();
    }
  };

  const playSong = useCallback(async (song: Song) => {
    // Prevent multiple clicks while loading
    if (isLoading) {
      console.log('Already loading a song, ignoring request');
      return;
    }

    // If the same song is already playing, don't restart it
    if (playerState.currentSong?.id === song.id && playerState.isPlaying) {
      console.log('Song is already playing, ignoring request');
      return;
    }

    try {
      console.log('Starting to play song:', song.title, 'by', song.artist);
      
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Set loading state but keep current song playing
      setIsLoading(true);
      setLoadingError(null);
      setPendingSong(song);

      // Get stream URL using new music service
      console.log('Getting stream URL for:', song.title);
      const streamUrl = await MusicService.getStreamUrl(song);
      
      if (audioRef.current && streamUrl) {
        const audio = audioRef.current;
        
        console.log('Setting up direct audio playback for:', song.title);
        
        try {
          // Simple direct audio playback - no segments, no complex processing
          audio.src = streamUrl;
          audio.preload = 'metadata';
          
          // Reset all complex segment tracking
          currentVideoIdRef.current = null;
          currentSegmentRef.current = 0;
          segmentStartTimeRef.current = 0;
          isSimultaneousModeRef.current = false;
          
          // Clear any simultaneous audio references
          simultaneousAudioRefs.current.forEach(audio => {
            audio.pause();
            audio.src = '';
          });
          simultaneousAudioRefs.current = [];
          
          // Update song info immediately
          setPlayerState(prev => ({
            ...prev,
            currentSong: song,
            isPlaying: false,
            progress: 0,
            duration: 0
          }));
          
          // Try to play directly
          await audio.play();
          
          console.log('Song playing directly from music service');
          setIsLoading(false);
          setPendingSong(null);
          setLoadingError(null);
          
        } catch (error) {
          console.error('Failed to play song directly:', error);
          setIsLoading(false);
          setPendingSong(null);
          setLoadingError('Unable to play this song - please try another');
        }
        
      } else {
        console.error('No audio element or stream URL');
        setIsLoading(false);
        setLoadingError('No stream URL found');
        setPendingSong(null);
      }
      
    } catch (error) {
      console.error('Error in playSong:', error);
      setIsLoading(false);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load song');
      setPendingSong(null);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    }
  }, [isLoading]);

  const togglePlayPause = useCallback(() => {
    // Disable during loading to prevent issues
    if (isLoading) {
      console.log('Cannot toggle play/pause - song is loading');
      return;
    }
    
    if (audioRef.current && playerState.currentSong && !pendingSong) {
      if (playerState.isPlaying) {
        console.log('Pausing audio');
        
        if (isSimultaneousModeRef.current) {
          // Pause all simultaneous segments
          simultaneousAudioRefs.current.forEach(audio => {
            audio.pause();
          });
        } else {
          // Pause single audio element
          audioRef.current.pause();
        }
        
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      } else {
        console.log('Resuming audio');
        
        if (isSimultaneousModeRef.current) {
          // Resume all simultaneous segments
          const playPromises = simultaneousAudioRefs.current.map(audio => audio.play());
          Promise.all(playPromises).then(() => {
            setPlayerState(prev => ({ ...prev, isPlaying: true }));
          }).catch(error => {
            console.error('Failed to resume simultaneous audio:', error);
            setPlayerState(prev => ({ ...prev, isPlaying: false }));
          });
        } else {
          // Resume single audio element
          audioRef.current.play().then(() => {
            setPlayerState(prev => ({ ...prev, isPlaying: true }));
          }).catch(error => {
            console.error('Failed to resume audio:', error);
            setPlayerState(prev => ({ ...prev, isPlaying: false }));
          });
        }
      }
    }
  }, [playerState.isPlaying, playerState.currentSong, isLoading, pendingSong]);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      if (isSimultaneousModeRef.current) {
        // Set volume for all simultaneous segments
        simultaneousAudioRefs.current.forEach(audio => {
          audio.volume = volume;
        });
      } else {
        // Set volume for single audio element
        audioRef.current.volume = volume;
      }
      
      setPlayerState(prev => ({
        ...prev,
        volume
      }));
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      if (isSimultaneousModeRef.current) {
        // Seek all simultaneous segments to the same time
        simultaneousAudioRefs.current.forEach(audio => {
          audio.currentTime = time;
        });
      } else {
        // Seek single audio stream
        audioRef.current.currentTime = time;
      }
      
      setPlayerState(prev => ({
        ...prev,
        progress: time
      }));
    }
  }, []);

  const formatTime = useCallback((time: number) => {
    if (!time || isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Queue management functions
  const nextSong = useCallback(() => {
    if (playerState.queue.length > 0) {
      let nextIndex: number;
      
      if (playerState.isShuffled) {
        // Generate random index excluding current index
        const availableIndices = playerState.queue
          .map((_, index) => index)
          .filter(index => index !== playerState.currentIndex);
        
        if (availableIndices.length > 0) {
          nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        } else {
          nextIndex = 0; // Fallback to first song
        }
      } else if (playerState.currentIndex < playerState.queue.length - 1) {
        nextIndex = playerState.currentIndex + 1;
      } else if (playerState.repeatMode === 'all') {
        nextIndex = 0; // Loop back to first song
      } else {
        console.log('No next song available');
        return;
      }
      
      const nextSong = playerState.queue[nextIndex];
      
      setPlayerState(prev => ({
        ...prev,
        currentIndex: nextIndex
      }));
      
      playSong(nextSong);
    } else {
      console.log('No next song available');
    }
  }, [playerState.queue, playerState.currentIndex, playerState.repeatMode, playerState.isShuffled, playSong]);

  const previousSong = useCallback(() => {
    if (playerState.queue.length > 0 && playerState.currentIndex > 0) {
      const prevIndex = playerState.currentIndex - 1;
      const prevSong = playerState.queue[prevIndex];
      
      setPlayerState(prev => ({
        ...prev,
        currentIndex: prevIndex
      }));
      
      playSong(prevSong);
    } else if (playerState.repeatMode === 'all' && playerState.queue.length > 0) {
      // Loop to last song if repeat all is enabled
      const lastIndex = playerState.queue.length - 1;
      const lastSong = playerState.queue[lastIndex];
      
      setPlayerState(prev => ({
        ...prev,
        currentIndex: lastIndex
      }));
      
      playSong(lastSong);
    } else {
      console.log('No previous song available');
    }
  }, [playerState.queue, playerState.currentIndex, playerState.repeatMode, playSong]);

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

  const addToQueue = useCallback((song: Song) => {
    setPlayerState(prev => ({
      ...prev,
      queue: [...prev.queue, song]
    }));
  }, []);

  const clearQueue = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      queue: [],
      currentIndex: 0
    }));
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setPlayerState(prev => {
      const newQueue = [...prev.queue];
      newQueue.splice(index, 1);
      
      let newCurrentIndex = prev.currentIndex;
      if (index < prev.currentIndex) {
        newCurrentIndex = prev.currentIndex - 1;
      } else if (index === prev.currentIndex && newQueue.length > 0) {
        // If removing current song, keep same index (moves to next song)
        newCurrentIndex = Math.min(prev.currentIndex, newQueue.length - 1);
      }
      
      return {
        ...prev,
        queue: newQueue,
        currentIndex: newCurrentIndex
      };
    });
  }, []);

  const playQueue = useCallback((songs: Song[], startIndex: number = 0) => {
    setPlayerState(prev => ({
      ...prev,
      queue: songs,
      currentIndex: startIndex
    }));
    
    if (songs.length > startIndex) {
      playSong(songs[startIndex]);
    }
  }, [playSong]);

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
    clearQueue,
    removeFromQueue,
    playQueue
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function useGlobalPlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('useGlobalPlayer must be used within a GlobalPlayerProvider');
  }
  return context;
}