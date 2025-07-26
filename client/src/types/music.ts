export interface Song {
  id: number;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  coverUrl?: string;
  audioUrl?: string;
  originalId?: string; // Store original backend ID for streaming
}

export interface Playlist {
  id: number;
  name: string;
  description?: string;
  coverUrl?: string;
  songs: Song[];
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  queue: Song[];
  currentIndex: number;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
}

export interface SearchResult {
  songs: Song[];
  artists: string[];
  albums: string[];
}
