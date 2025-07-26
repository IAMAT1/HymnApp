import { Song } from '@/types/music';
import { DeezerAPI } from './deezerAPI';

// Free Music Radio API for streaming URLs
interface FreeRadioTrack {
  title: string;
  artist: string;
  url: string;
  duration: number;
  cover?: string;
}

// JamendoAPI for free music
interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_name: string;
  album_name: string;
  album_image: string;
  audio: string;
  audiodownload: string;
}

interface JamendoResponse {
  results: JamendoTrack[];
}

export class MusicService {
  private static readonly API_BASE = window.location.origin; // Use backend proxy
  
  // Primary search using multiple sources
  static async searchSongs(query: string): Promise<Song[]> {
    try {
      console.log('Searching for music using multiple sources:', query);
      
      // Try Deezer first (has the largest catalog) via backend proxy
      try {
        const deezerResults = await this.searchDeezerViaProxy(query);
        if (deezerResults.length > 0) {
          console.log(`Found ${deezerResults.length} results from Deezer`);
          return deezerResults;
        }
      } catch (deezerError) {
        console.log('Deezer search failed, trying alternatives:', deezerError);
      }
      
      // Try Jamendo for free music via backend proxy
      try {
        const jamendoResults = await this.searchJamendoViaProxy(query);
        if (jamendoResults.length > 0) {
          console.log(`Found ${jamendoResults.length} results from Jamendo`);
          return jamendoResults;
        }
      } catch (jamendoError) {
        console.log('Jamendo search failed:', jamendoError);
      }
      
      // Try RadioAPI for free streaming via backend proxy
      try {
        const radioResults = await this.searchRadioViaProxy(query);
        if (radioResults.length > 0) {
          console.log(`Found ${radioResults.length} results from Radio APIs`);
          return radioResults;
        }
      } catch (radioError) {
        console.log('Radio API search failed:', radioError);
      }
      
      console.log('No results found from any music source');
      return [];
      
    } catch (error) {
      console.error('Error in comprehensive music search:', error);
      return [];
    }
  }

  // Search Deezer via backend proxy
  private static async searchDeezerViaProxy(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/music/deezer/search?q=${encodeURIComponent(query)}&limit=50`);
      
      if (!response.ok) {
        throw new Error(`Deezer proxy error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.data.map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.artist.name,
        album: track.album.title,
        duration: track.duration,
        coverUrl: track.album.cover_xl || track.album.cover_big || track.album.cover,
        audioUrl: track.preview, // Deezer provides 30-second previews
        originalId: track.id.toString()
      }));
      
    } catch (error) {
      console.error('Deezer proxy search error:', error);
      return [];
    }
  }

  // Search Jamendo via backend proxy
  private static async searchJamendoViaProxy(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/music/jamendo/search?q=${encodeURIComponent(query)}&limit=20`);
      
      if (!response.ok) {
        throw new Error(`Jamendo proxy error: ${response.status}`);
      }
      
      const data = await response.json();
      
      return data.results.map((track: any) => ({
        id: parseInt(track.id),
        title: track.name,
        artist: track.artist_name,
        album: track.album_name,
        duration: track.duration,
        coverUrl: track.album_image,
        audioUrl: track.audio || track.audiodownload,
        originalId: track.id
      }));
      
    } catch (error) {
      console.error('Jamendo proxy search error:', error);
      return [];
    }
  }

  // Search Radio via backend proxy
  private static async searchRadioViaProxy(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/music/radio/search?q=${encodeURIComponent(query)}&limit=10`);
      
      if (!response.ok) {
        throw new Error(`Radio proxy error: ${response.status}`);
      }
      
      const stations = await response.json();
      
      return stations.map((station: any, index: number) => ({
        id: station.stationuuid ? station.stationuuid.hashCode() : index,
        title: station.name || 'Unknown Station',
        artist: station.country || 'Radio',
        album: station.tags || 'Live Radio',
        duration: 0, // Live streams have no duration
        coverUrl: station.favicon || undefined,
        audioUrl: station.url || station.url_resolved,
        originalId: station.stationuuid || index.toString()
      }));
      
    } catch (error) {
      console.error('Radio proxy search error:', error);
      return [];
    }
  }

  // Search Jamendo (free Creative Commons music)
  private static async searchJamendo(query: string): Promise<Song[]> {
    try {
      const jamendoUrl = `https://api.jamendo.com/v3.0/tracks/?client_id=${this.JAMENDO_CLIENT_ID}&format=json&limit=20&search=${encodeURIComponent(query)}`;
      
      const response = await fetch(jamendoUrl);
      if (!response.ok) {
        throw new Error(`Jamendo API error: ${response.status}`);
      }
      
      const data: JamendoResponse = await response.json();
      
      return data.results.map(track => ({
        id: parseInt(track.id),
        title: track.name,
        artist: track.artist_name,
        album: track.album_name,
        duration: track.duration,
        coverUrl: track.album_image,
        audioUrl: track.audio || track.audiodownload,
        originalId: track.id
      }));
      
    } catch (error) {
      console.error('Jamendo search error:', error);
      return [];
    }
  }

  // Search Radio APIs for streaming content
  private static async searchRadioAPI(query: string): Promise<Song[]> {
    try {
      // Using Radio-Browser API (free, no auth required)
      const radioUrl = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=10`;
      
      const response = await fetch(radioUrl);
      if (!response.ok) {
        throw new Error(`Radio API error: ${response.status}`);
      }
      
      const stations = await response.json();
      
      return stations.map((station: any, index: number) => ({
        id: station.stationuuid ? station.stationuuid.hashCode() : index,
        title: station.name || 'Unknown Station',
        artist: station.country || 'Radio',
        album: station.tags || 'Live Radio',
        duration: 0, // Live streams have no duration
        coverUrl: station.favicon || undefined,
        audioUrl: station.url || station.url_resolved,
        originalId: station.stationuuid || index.toString()
      }));
      
    } catch (error) {
      console.error('Radio API search error:', error);
      return [];
    }
  }

  // Get audio stream URL - much simpler than YouTube approach
  static async getStreamUrl(song: Song): Promise<string | null> {
    try {
      console.log('Getting stream URL for:', song.title, 'by', song.artist);
      
      // If song already has audioUrl (from Deezer/Jamendo), use it directly
      if (song.audioUrl) {
        console.log('Using direct audio URL from music service');
        this.addToRecentlyPlayed(song);
        return song.audioUrl;
      }
      
      // Try to get full track from Deezer if we only have preview
      if (song.originalId) {
        try {
          const fullTrack = await DeezerAPI.getTrackDetails(parseInt(song.originalId));
          if (fullTrack?.audioUrl) {
            console.log('Got full track details from Deezer');
            this.addToRecentlyPlayed(song);
            return fullTrack.audioUrl;
          }
        } catch (error) {
          console.log('Could not get full track details:', error);
        }
      }
      
      console.log('No direct audio URL available for:', song.title);
      return null;
      
    } catch (error) {
      console.error('Error getting stream URL:', error);
      return null;
    }
  }

  // Get trending/chart music via backend proxy
  static async getTrendingMusic(): Promise<Song[]> {
    try {
      console.log('Getting trending music...');
      
      // Try Deezer charts via backend proxy
      try {
        const response = await fetch(`${this.API_BASE}/api/music/deezer/charts?limit=25`);
        
        if (response.ok) {
          const data = await response.json();
          const deezerCharts = data.data.map((track: any) => ({
            id: track.id,
            title: track.title,
            artist: track.artist.name,
            album: track.album.title,
            duration: track.duration,
            coverUrl: track.album.cover_xl || track.album.cover_big || track.album.cover,
            audioUrl: track.preview,
            originalId: track.id.toString()
          }));
          
          if (deezerCharts.length > 0) {
            console.log(`Got ${deezerCharts.length} trending songs from Deezer`);
            return deezerCharts;
          }
        }
      } catch (error) {
        console.log('Deezer charts failed:', error);
      }
      
      // Fallback to popular radio stations
      try {
        const popularStations = await this.searchRadioViaProxy('pop music');
        return popularStations.slice(0, 10);
      } catch (error) {
        console.log('Popular radio stations failed:', error);
      }
      
      return [];
    } catch (error) {
      console.error('Error getting trending music:', error);
      return [];
    }
  }

  // Get recently played (compatible with existing system)
  static async getRecentlyPlayed(): Promise<Song[]> {
    return DeezerAPI.getRecentlyPlayed();
  }

  // Add to recently played
  static addToRecentlyPlayed(song: Song): void {
    DeezerAPI.addToRecentlyPlayed(song);
  }

  // Get recommended music based on a song
  static async getRecommendedMusic(baseSong: Song): Promise<Song[]> {
    try {
      console.log('Getting recommendations based on:', baseSong.title);
      
      // Search for similar artists or genre
      const searchQuery = `${baseSong.artist} similar`;
      return await this.searchSongs(searchQuery);
      
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  // Health check for all music services
  static async checkServiceHealth(): Promise<{
    deezer: boolean;
    jamendo: boolean;
    radio: boolean;
  }> {
    const health = {
      deezer: false,
      jamendo: false,
      radio: false
    };

    // Test Deezer
    try {
      const deezerTest = await fetch('https://api.deezer.com/search?q=test&limit=1');
      health.deezer = deezerTest.ok;
    } catch {
      health.deezer = false;
    }

    // Test Jamendo
    try {
      const jamendoTest = await fetch(`https://api.jamendo.com/v3.0/tracks/?client_id=${this.JAMENDO_CLIENT_ID}&format=json&limit=1`);
      health.jamendo = jamendoTest.ok;
    } catch {
      health.jamendo = false;
    }

    // Test Radio API
    try {
      const radioTest = await fetch('https://de1.api.radio-browser.info/json/stations/search?limit=1');
      health.radio = radioTest.ok;
    } catch {
      health.radio = false;
    }

    return health;
  }
}

// Utility function for string hashing (for generating IDs)
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function(): number {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};