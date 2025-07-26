import { Song } from '../types/music';

// Free music streaming services that provide full songs
export class FreeMusicService {
  private static readonly API_BASE = window.location.origin;

  // Search across multiple free music sources
  static async searchSongs(query: string): Promise<Song[]> {
    console.log('Searching free music sources for:', query);
    
    const results: Song[] = [];
    
    // Try all free sources in parallel for faster results
    const [jamendoResults, soundcloudResults, internetArchiveResults, bandcampResults] = await Promise.allSettled([
      this.searchJamendo(query),
      this.searchSoundCloud(query),
      this.searchInternetArchive(query),
      this.searchBandcamp(query)
    ]);

    // Collect results from all successful searches
    if (jamendoResults.status === 'fulfilled') {
      results.push(...jamendoResults.value.slice(0, 15));
    }
    
    if (soundcloudResults.status === 'fulfilled') {
      results.push(...soundcloudResults.value.slice(0, 20));
    }
    
    if (internetArchiveResults.status === 'fulfilled') {
      results.push(...internetArchiveResults.value.slice(0, 10));
    }
    
    if (bandcampResults.status === 'fulfilled') {
      results.push(...bandcampResults.value.slice(0, 10));
    }

    console.log(`Found ${results.length} free songs total`);
    return results;
  }

  // Jamendo - Creative Commons music with full tracks
  private static async searchJamendo(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/music/jamendo/search?q=${encodeURIComponent(query)}&limit=20`);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      
      return data.results?.map((track: any) => ({
        id: parseInt(track.id),
        title: track.name,
        artist: track.artist_name,
        album: track.album_name || 'Unknown Album',
        duration: track.duration || 0,
        coverUrl: track.album_image || track.image,
        audioUrl: track.audio || track.audiodownload,
        originalId: track.id,
        source: 'Jamendo'
      })) || [];
      
    } catch (error) {
      console.log('Jamendo search failed:', error);
      return [];
    }
  }

  // Internet Archive - Massive collection of free music
  private static async searchInternetArchive(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/music/archive/search?q=${encodeURIComponent(query)}&limit=15`);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      
      return data.response?.docs?.map((item: any, index: number) => ({
        id: item.identifier ? item.identifier.hashCode() : index,
        title: item.title || 'Unknown Title',
        artist: item.creator || item.artist || 'Unknown Artist',
        album: item.collection || 'Internet Archive',
        duration: 0, // Archive doesn't provide duration in search
        coverUrl: `https://archive.org/services/img/${item.identifier}`,
        audioUrl: `https://archive.org/download/${item.identifier}/${item.identifier}.mp3`,
        originalId: item.identifier,
        source: 'Internet Archive'
      })) || [];
      
    } catch (error) {
      console.log('Internet Archive search failed:', error);
      return [];
    }
  }

  // SoundCloud - High quality music streaming
  private static async searchSoundCloud(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/music/soundcloud/search?q=${encodeURIComponent(query)}&limit=20`);
      
      if (!response.ok) return [];
      
      const tracks = await response.json();
      
      return tracks.filter((track: any) => track.streamable).map((track: any) => ({
        id: track.id,
        title: track.title,
        artist: track.user?.username || 'Unknown Artist',
        album: track.genre || 'SoundCloud',
        duration: Math.floor(track.duration / 1000), // Convert from ms to seconds
        coverUrl: track.artwork_url?.replace('large', 't500x500') || track.user?.avatar_url,
        audioUrl: `${track.stream_url}?client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`,
        originalId: track.id.toString(),
        source: 'SoundCloud'
      }));
      
    } catch (error) {
      console.log('SoundCloud search failed:', error);
      return [];
    }
  }

  // Bandcamp - Independent artists and high quality audio
  private static async searchBandcamp(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`${this.API_BASE}/api/music/bandcamp/search?q=${encodeURIComponent(query)}&limit=15`);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      
      const results: Song[] = [];
      
      // Process tracks from search results
      if (data.results?.tracks) {
        data.results.tracks.forEach((track: any, index: number) => {
          if (track.audio) {
            results.push({
              id: track.id || index,
              title: track.title || 'Unknown Title',
              artist: track.artist || 'Unknown Artist',
              album: track.album || 'Bandcamp',
              duration: track.duration || 0,
              coverUrl: track.art || undefined,
              audioUrl: track.audio,
              originalId: track.id?.toString() || index.toString(),
              source: 'Bandcamp'
            });
          }
        });
      }
      
      return results;
      
    } catch (error) {
      console.log('Bandcamp search failed:', error);
      return [];
    }
  }

  // Get trending free music
  static async getTrendingMusic(): Promise<Song[]> {
    console.log('Getting trending free music...');
    
    try {
      // Get popular tracks from multiple sources
      const [jamendoPopular, soundcloudTrending, internetArchiveRecent] = await Promise.allSettled([
        this.searchJamendo('popular music'),
        this.searchSoundCloud('trending'),
        this.searchInternetArchive('music')
      ]);
      
      const trending: Song[] = [];
      
      if (jamendoPopular.status === 'fulfilled') {
        trending.push(...jamendoPopular.value.slice(0, 10));
      }
      
      if (soundcloudTrending.status === 'fulfilled') {
        trending.push(...soundcloudTrending.value.slice(0, 15));
      }
      
      if (internetArchiveRecent.status === 'fulfilled') {
        trending.push(...internetArchiveRecent.value.slice(0, 5));
      }
      
      console.log(`Got ${trending.length} trending free songs`);
      return trending;
      
    } catch (error) {
      console.error('Error getting trending free music:', error);
      return [];
    }
  }

  // Health check for all free music services
  static async checkServiceHealth(): Promise<{[key: string]: boolean}> {
    const services = {
      jamendo: false,
      internetArchive: false,
      soundcloud: false,
      bandcamp: false
    };

    try {
      const response = await fetch(`${this.API_BASE}/api/music/health`);
      if (response.ok) {
        const data = await response.json();
        return { ...services, ...data.services };
      }
    } catch (error) {
      console.log('Health check failed:', error);
    }

    return services;
  }
}

// Helper function for string hashing (for generating IDs)
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function() {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};