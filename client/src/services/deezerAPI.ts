import { Song } from '@/types/music';

// Deezer API response types
interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
  next?: string;
}

interface DeezerTrack {
  id: number;
  title: string;
  title_short: string;
  duration: number;
  rank: number;
  explicit_lyrics: boolean;
  preview: string;
  artist: {
    id: number;
    name: string;
    picture: string;
    picture_small: string;
    picture_medium: string;
    picture_big: string;
  };
  album: {
    id: number;
    title: string;
    cover: string;
    cover_small: string;
    cover_medium: string;
    cover_big: string;
    cover_xl: string;
  };
}

interface DeezerAlbumResponse {
  id: number;
  title: string;
  duration: number;
  tracks: {
    data: DeezerTrack[];
  };
}

// Cache for search results
const searchCache = new Map<string, Song[]>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export class DeezerAPI {
  private static readonly BASE_URL = 'https://api.deezer.com';
  private static readonly CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

  // Convert Deezer track to our Song interface
  static convertDeezerTrackToSong(track: DeezerTrack): Song {
    return {
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      duration: track.duration,
      coverUrl: track.album.cover_xl || track.album.cover_big || track.album.cover,
      audioUrl: track.preview, // Deezer provides 30-second previews
      originalId: track.id.toString()
    };
  }

  // Search for songs using Deezer API
  static async searchSongs(query: string): Promise<Song[]> {
    // Check cache first
    const cacheKey = query.toLowerCase();
    if (searchCache.has(cacheKey)) {
      console.log('Using cached Deezer search results for:', query);
      return searchCache.get(cacheKey)!;
    }

    try {
      console.log('Searching Deezer for:', query);
      
      if (!query.trim()) return [];
      
      // Search Deezer API directly (no authentication required)
      const searchUrl = `${this.BASE_URL}/search?q=${encodeURIComponent(query)}&limit=50`;
      
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`Deezer API error: ${response.status}`);
      }
      
      const data: DeezerSearchResponse = await response.json();
      
      // Convert Deezer results to our Song format
      const songs = data.data.map(track => this.convertDeezerTrackToSong(track));
      
      // Cache the results
      searchCache.set(cacheKey, songs);
      setTimeout(() => searchCache.delete(cacheKey), CACHE_DURATION);
      
      console.log(`Found ${songs.length} songs on Deezer for: ${query}`);
      return songs;
      
    } catch (error) {
      console.error('Error searching Deezer:', error);
      
      // If direct access fails, try with CORS proxy
      try {
        console.log('Trying Deezer with CORS proxy...');
        const proxyUrl = `${this.CORS_PROXY}${this.BASE_URL}/search?q=${encodeURIComponent(query)}&limit=50`;
        
        const proxyResponse = await fetch(proxyUrl);
        if (!proxyResponse.ok) {
          throw new Error(`Deezer proxy error: ${proxyResponse.status}`);
        }
        
        const proxyData: DeezerSearchResponse = await proxyResponse.json();
        const songs = proxyData.data.map(track => this.convertDeezerTrackToSong(track));
        
        // Cache the results
        searchCache.set(cacheKey, songs);
        setTimeout(() => searchCache.delete(cacheKey), CACHE_DURATION);
        
        console.log(`Found ${songs.length} songs on Deezer (via proxy): ${query}`);
        return songs;
        
      } catch (proxyError) {
        console.error('Error with Deezer proxy:', proxyError);
        throw new Error('Failed to search Deezer');
      }
    }
  }

  // Get full track details
  static async getTrackDetails(trackId: number): Promise<Song | null> {
    try {
      const trackUrl = `${this.BASE_URL}/track/${trackId}`;
      
      const response = await fetch(trackUrl);
      if (!response.ok) {
        throw new Error(`Deezer track error: ${response.status}`);
      }
      
      const track: DeezerTrack = await response.json();
      return this.convertDeezerTrackToSong(track);
      
    } catch (error) {
      console.error('Error getting Deezer track details:', error);
      return null;
    }
  }

  // Get album tracks
  static async getAlbumTracks(albumId: number): Promise<Song[]> {
    try {
      const albumUrl = `${this.BASE_URL}/album/${albumId}`;
      
      const response = await fetch(albumUrl);
      if (!response.ok) {
        throw new Error(`Deezer album error: ${response.status}`);
      }
      
      const album: DeezerAlbumResponse = await response.json();
      return album.tracks.data.map(track => this.convertDeezerTrackToSong(track));
      
    } catch (error) {
      console.error('Error getting Deezer album tracks:', error);
      return [];
    }
  }

  // Get artist's top tracks
  static async getArtistTopTracks(artistId: number): Promise<Song[]> {
    try {
      const artistUrl = `${this.BASE_URL}/artist/${artistId}/top?limit=50`;
      
      const response = await fetch(artistUrl);
      if (!response.ok) {
        throw new Error(`Deezer artist error: ${response.status}`);
      }
      
      const data: DeezerSearchResponse = await response.json();
      return data.data.map(track => this.convertDeezerTrackToSong(track));
      
    } catch (error) {
      console.error('Error getting Deezer artist top tracks:', error);
      return [];
    }
  }

  // Search by genre
  static async searchByGenre(genreId: number): Promise<Song[]> {
    try {
      const genreUrl = `${this.BASE_URL}/genre/${genreId}/artists`;
      
      const response = await fetch(genreUrl);
      if (!response.ok) {
        throw new Error(`Deezer genre error: ${response.status}`);
      }
      
      const data = await response.json();
      // This would need additional processing to get actual tracks
      return [];
      
    } catch (error) {
      console.error('Error searching Deezer by genre:', error);
      return [];
    }
  }

  // Get charts/top tracks
  static async getCharts(limit: number = 25): Promise<Song[]> {
    try {
      const chartsUrl = `${this.BASE_URL}/chart/0/tracks?limit=${limit}`;
      
      const response = await fetch(chartsUrl);
      if (!response.ok) {
        throw new Error(`Deezer charts error: ${response.status}`);
      }
      
      const data: DeezerSearchResponse = await response.json();
      return data.data.map(track => this.convertDeezerTrackToSong(track));
      
    } catch (error) {
      console.error('Error getting Deezer charts:', error);
      return [];
    }
  }

  // Helper method to get high-quality audio URL (if available)
  // Note: Deezer only provides 30-second previews in their free API
  static getFullAudioUrl(song: Song): string | null {
    // Deezer's free API only provides 30-second previews
    // For full tracks, you'd need Deezer Premium API or user authentication
    return song.audioUrl || null;
  }

  // Get recently played from localStorage (compatible with existing system)
  static async getRecentlyPlayed(): Promise<Song[]> {
    try {
      const recentlyPlayed = localStorage.getItem('recentlyPlayed');
      if (!recentlyPlayed) return [];
      
      const songs = JSON.parse(recentlyPlayed);
      return songs.slice(0, 10);
    } catch (error) {
      console.error('Error fetching recently played:', error);
      return [];
    }
  }

  // Add to recently played (compatible with existing system)
  static addToRecentlyPlayed(song: Song): void {
    try {
      const recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
      
      // Remove if already exists
      const filtered = recentlyPlayed.filter((s: Song) => s.id !== song.id);
      
      // Add to beginning
      filtered.unshift(song);
      
      // Keep only last 50 songs
      const limited = filtered.slice(0, 50);
      
      localStorage.setItem('recentlyPlayed', JSON.stringify(limited));
    } catch (error) {
      console.error('Error managing recently played:', error);
    }
  }
}