import { useCallback, useRef } from 'react';
import { Song } from '@/types/music';
import { buildStreamUrl } from '@/config/api';

// Audio preloader for better performance
export const useAudioPreloader = () => {
  const preloadCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const MAX_PRELOAD_CACHE = 5;

  const preloadSong = useCallback(async (song: Song) => {
    if (!song) return;

    const cacheKey = `${song.id}-${song.title}-${song.artist}`;
    
    // Don't preload if already cached
    if (preloadCacheRef.current.has(cacheKey)) {
      console.log('Song already preloaded:', song.title);
      return;
    }

    try {
      console.log('Preloading audio for:', song.title, 'by', song.artist);
      
      // Create new audio element for preloading
      const audio = new Audio();
      audio.preload = 'metadata'; // Only load metadata, not full audio
      
      // Set up the stream URL
      const streamUrl = buildStreamUrl(song);
      if (streamUrl) {
        audio.src = streamUrl;
        
        // Add to cache when metadata is loaded
        audio.addEventListener('loadedmetadata', () => {
          console.log('Preloaded metadata for:', song.title);
          
          // Manage cache size
          if (preloadCacheRef.current.size >= MAX_PRELOAD_CACHE) {
            const firstKey = preloadCacheRef.current.keys().next().value;
            const oldAudio = preloadCacheRef.current.get(firstKey);
            if (oldAudio) {
              oldAudio.src = '';
              preloadCacheRef.current.delete(firstKey);
            }
          }
          
          preloadCacheRef.current.set(cacheKey, audio);
        });

        audio.addEventListener('error', () => {
          console.warn('Failed to preload:', song.title);
        });
      }
    } catch (error) {
      console.warn('Error preloading song:', error);
    }
  }, []);

  const getPreloadedAudio = useCallback((song: Song): HTMLAudioElement | null => {
    if (!song) return null;
    
    const cacheKey = `${song.id}-${song.title}-${song.artist}`;
    return preloadCacheRef.current.get(cacheKey) || null;
  }, []);

  const clearPreloadCache = useCallback(() => {
    preloadCacheRef.current.forEach(audio => {
      audio.src = '';
    });
    preloadCacheRef.current.clear();
  }, []);

  return {
    preloadSong,
    getPreloadedAudio,
    clearPreloadCache
  };
};