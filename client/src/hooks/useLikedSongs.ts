import { useState, useCallback, useEffect } from 'react';
import { Song } from '@/types/music';

export function useLikedSongs() {
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [likedSongIds, setLikedSongIds] = useState<Set<number>>(new Set());

  // Load liked songs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('likedSongs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLikedSongs(parsed);
        setLikedSongIds(new Set(parsed.map((song: Song) => song.id)));
      } catch (error) {
        console.error('Error parsing liked songs from localStorage:', error);
      }
    }
  }, []);

  // Save to localStorage whenever liked songs change
  useEffect(() => {
    localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
  }, [likedSongs]);

  const toggleLikedSong = useCallback((song: Song) => {
    setLikedSongs(prev => {
      const isLiked = prev.some(s => s.id === song.id);
      
      if (isLiked) {
        // Remove from liked songs
        const filtered = prev.filter(s => s.id !== song.id);
        setLikedSongIds(new Set(filtered.map(s => s.id)));
        return filtered;
      } else {
        // Add to liked songs
        const updated = [...prev, song];
        setLikedSongIds(new Set(updated.map(s => s.id)));
        return updated;
      }
    });
  }, []);

  const isLiked = useCallback((songId: number) => {
    return likedSongIds.has(songId);
  }, [likedSongIds]);

  const clearLikedSongs = useCallback(() => {
    setLikedSongs([]);
    setLikedSongIds(new Set());
  }, []);

  return {
    likedSongs,
    toggleLikedSong,
    isLiked,
    clearLikedSongs
  };
}
