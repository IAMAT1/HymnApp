import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { Song, PlayerState } from '@/types/music';
import { MusicAPI } from '@/services/api';
import { useAudioPreloader } from '@/hooks/useAudioPreloader';

interface PlayerContextType {
  playerState: PlayerState;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  nextSong: () => void;
  previousSong: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  formatTime: (seconds: number) => string;
  isLoading: boolean;
  loadingError: string | null;
  playSong: (song: Song) => Promise<void>;
  addToQueue: (songs: Song[]) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
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
  
  // Audio preloader for performance optimization
  const { preloadSong, getPreloadedAudio } = useAudioPreloader();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Store recently played songs for recommendations
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);

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
      console.log('PlayerContext handlePlay - DISABLED (using usePlayer hook instead)');
      // Disabled - usePlayer hook handles play state now
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
      setPlayerState(prev => {
        const newState = {
          ...prev,
          isPlaying: false
        };
        
        // Handle auto-play based on repeat mode
        setTimeout(() => {
          console.log('Processing end-of-song action, repeatMode:', prev.repeatMode);
          
          if (prev.repeatMode === 'one' && prev.currentSong) {
            // Restart current song
            console.log('Repeating current song:', prev.currentSong.title);
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().then(() => {
                console.log('Successfully restarted song');
              }).catch(error => {
                console.error('Error restarting song:', error);
              });
            }
          } else if (prev.repeatMode === 'all' || prev.repeatMode === 'none') {
            // Auto-play next song (recommendation system)
            handleAutoPlayNext(prev);
          }
        }, 500);
        
        return newState;
      });
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

  // Auto-play next song function
  const handleAutoPlayNext = useCallback(async (state: PlayerState) => {
    console.log('handleAutoPlayNext called for:', state.currentSong?.title);
    
    if (state.currentSong) {
      try {
        const { MusicAPI } = await import('@/services/api');
        const recommendations = await MusicAPI.searchSongs(`${state.currentSong.artist} music`);
        
        if (recommendations.length > 0) {
          const filteredSongs = recommendations.filter(song => song.id !== state.currentSong?.id);
          if (filteredSongs.length > 0) {
            const randomSong = filteredSongs[Math.floor(Math.random() * filteredSongs.length)];
            console.log('Auto-playing recommended song:', randomSong.title, 'by', randomSong.artist);
            setTimeout(() => {
              playSong(randomSong);
            }, 100);
          }
        }
      } catch (error) {
        console.error('Error getting auto-play recommendations:', error);
      }
    }
  }, []);

  // Performance optimization: Load audio element with caching
  const loadAudioWithCaching = useCallback(async (song: Song): Promise<string | null> => {
    try {
      console.log('loadAudioWithCaching called for:', song.title, 'by', song.artist);
      
      // Check if we have a preloaded audio element
      const preloadedAudio = getPreloadedAudio(song);
      if (preloadedAudio && preloadedAudio.src) {
        console.log('Using preloaded audio for:', song.title);
        return preloadedAudio.src;
      }
      
      // Search for video ID with caching
      const videoId = await MusicAPI.searchYouTubeVideoId(song.title, song.artist);
      if (!videoId) {
        throw new Error(`No video ID found for ${song.title} by ${song.artist}`);
      }
      
      // Build stream URL
      const streamUrl = `/api/stream?v=${videoId}`;
      console.log('Generated stream URL:', streamUrl);
      
      return streamUrl;
    } catch (error) {
      console.error('Error in loadAudioWithCaching:', error);
      throw error;
    }
  }, [getPreloadedAudio]);

  const playSong = useCallback(async (song: Song) => {
    if (isLoading) {
      console.log('Song already loading, ignoring request');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingError(null);
      
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Reduced timeout for faster user feedback
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false);
        setLoadingError('Song loading timed out');
        console.error('Song loading timed out');
      }, 10000); // Reduced from 30s to 10s

      console.log('Setting current song in player state:', song.title, 'by', song.artist);
      
      // Add to recently played
      setRecentlyPlayed(prev => {
        const filtered = prev.filter(s => s.id !== song.id);
        return [song, ...filtered].slice(0, 20); // Keep last 20 songs
      });
      
      setPlayerState(prev => {
        const newState = {
          ...prev,
          currentSong: song,
          isPlaying: false
        };
        console.log('Updated player state:', newState);
        return newState;
      });
      
      const streamUrl = await MusicAPI.getStreamUrl(song);
      
      if (audioRef.current && streamUrl) {
        console.log('PlayerContext.tsx playSong function should NOT be used - using usePlayer hook instead');
        throw new Error('PlayerContext playSong is deprecated - use usePlayer hook');
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
          setLoadingError('Failed to play audio');
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
      const audio = audioRef.current;
      const duration = audio.duration;
      
      console.log('Seeking to:', time, 'duration:', duration);
      
      // If seeking to near the end (within 1 second), handle replay
      if (duration && time >= duration - 1) {
        console.log('Seeking to end - implementing replay functionality');
        audio.currentTime = 0;
        audio.play().then(() => {
          console.log('Song restarted successfully from seek');
        }).catch(error => {
          console.error('Failed to restart song from seek:', error);
        });
      } else {
        audio.currentTime = time;
      }
      
      setPlayerState(prev => ({
        ...prev,
        progress: time
      }));
    }
  }, []);

  const nextSong = useCallback(async () => {
    console.log('nextSong called - implementing recommendations');
    
    // Simple recommendation: get similar songs from the current artist
    if (playerState.currentSong) {
      try {
        const { MusicAPI } = await import('@/services/api');
        const recommendations = await MusicAPI.searchSongs(`${playerState.currentSong.artist} music`);
        
        if (recommendations.length > 0) {
          // Filter out current song and get a random recommendation
          const filteredSongs = recommendations.filter(song => song.id !== playerState.currentSong?.id);
          if (filteredSongs.length > 0) {
            const randomSong = filteredSongs[Math.floor(Math.random() * filteredSongs.length)];
            console.log('Playing recommended song:', randomSong.title, 'by', randomSong.artist);
            await playSong(randomSong);
          }
        }
      } catch (error) {
        console.error('Error getting recommendations:', error);
      }
    }
  }, [playerState.currentSong, playSong]);

  const previousSong = useCallback(async () => {
    console.log('previousSong called - going to recently played');
    
    // If we have recently played songs, go back to them
    if (recentlyPlayed.length > 1) {
      const previousSong = recentlyPlayed[1]; // [0] is current, [1] is previous
      await playSong(previousSong);
    } else {
      // No previous song, restart current song
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
    }
  }, [recentlyPlayed, playSong]);

  const addToQueue = useCallback((songs: Song[]) => {
    setPlayerState(prev => ({
      ...prev,
      queue: [...prev.queue, ...songs]
    }));
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
    if (isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const value: PlayerContextType = {
    playerState,
    togglePlayPause,
    setVolume,
    seekTo,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    formatTime,
    isLoading,
    loadingError,
    playSong,
    addToQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}