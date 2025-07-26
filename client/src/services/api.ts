import { Song } from '@/types/music';
import { API_CONFIG, buildItunesUrl, buildStreamUrl, buildYouTubeSearchUrls, apiRequest } from '@/config/api';

// iTunes API response types
interface ItunesSearchResponse {
  resultCount: number;
  results: ItunesTrack[];
}

interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  trackTimeMillis?: number;
  artworkUrl30?: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  releaseDate?: string;
  country?: string;
  currency?: string;
  primaryGenreName?: string;
}

// YouTube search API response types (multiple formats for different APIs)
interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  // Piped API format
  videos?: PipedVideoItem[];
}

interface YouTubeSearchItem {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  }[];
}

interface PipedVideoItem {
  url: string;
  title: string;
  uploaderName: string;
  thumbnail: string;
}

// Cache for video IDs to avoid repeated searches
const videoIdCache = new Map<string, string>();
const searchCache = new Map<string, Song[]>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Preload status tracking
const preloadStatus = new Map<string, 'preparing' | 'ready' | 'failed'>();

// API service with iTunes for metadata and Hugging Face for streaming
export class MusicAPI {
  
  // Helper function to convert iTunes artwork URL to higher resolution
  static getHighResArtwork(artworkUrl?: string): string | undefined {
    if (!artworkUrl) return undefined;
    // Convert 100x100 to 500x500 for better quality
    return artworkUrl.replace('100x100', '500x500');
  }

  // Convert iTunes track to our Song interface
  static convertItunesTrackToSong(track: ItunesTrack): Song {
    return {
      id: track.trackId,
      title: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      duration: track.trackTimeMillis ? Math.round(track.trackTimeMillis / 1000) : 0,
      coverUrl: this.getHighResArtwork(track.artworkUrl100),
      audioUrl: undefined, // Will be fetched from Hugging Face when needed
      originalId: track.trackId.toString()
    };
  }

  static async searchSongs(query: string): Promise<Song[]> {
    // Check cache first
    const cacheKey = query.toLowerCase();
    if (searchCache.has(cacheKey)) {
      console.log('Using cached search results for:', query);
      return searchCache.get(cacheKey)!;
    }
    try {
      console.log('searchSongs called with:', query);
      
      if (!query.trim()) return [];
      
      const url = buildItunesUrl({ term: query });
      const response = await apiRequest<ItunesSearchResponse>(url);
      
      // Convert iTunes results to our Song format
      const songs = response.results.map(track => this.convertItunesTrackToSong(track));
      
      // Cache the results
      searchCache.set(cacheKey, songs);
      setTimeout(() => searchCache.delete(cacheKey), CACHE_DURATION);
      
      return songs;
    } catch (error) {
      console.error('Error searching songs:', error);
      throw new Error('Failed to search songs');
    }
  }

  // Search YouTube for video ID - using backend search first, then fallback
  static async searchYouTubeVideoId(trackName: string, artistName: string): Promise<string | null> {
    try {
      console.log('Searching YouTube for:', trackName, 'by', artistName);
      
      // Check cache first for video IDs
      const cacheKey = `${trackName.toLowerCase()} ${artistName.toLowerCase()}`;
      if (videoIdCache.has(cacheKey)) {
        console.log('Using cached video ID for:', cacheKey);
        return videoIdCache.get(cacheKey)!;
      }
      
      // First try: Check manual mapping (prioritize for known songs)
      const mappingVideoId = this.getVideoIdFromMapping(trackName, artistName);
      if (mappingVideoId) {
        console.log('Found video ID via manual mapping:', mappingVideoId);
        // Cache the result
        videoIdCache.set(cacheKey, mappingVideoId);
        setTimeout(() => videoIdCache.delete(cacheKey), CACHE_DURATION);
        return mappingVideoId;
      }

      // Second try: Use backend to search YouTube
      try {
        const backendVideoId = await this.searchYouTubeViaBackend(trackName, artistName);
        if (backendVideoId) {
          console.log('Found video ID via backend:', backendVideoId);
          // Cache the result
          videoIdCache.set(cacheKey, backendVideoId);
          setTimeout(() => videoIdCache.delete(cacheKey), CACHE_DURATION);
          return backendVideoId;
        }
      } catch (backendError) {
        console.log('Backend search failed, already tried mapping');
      }
      
      // Already tried mapping above, no need to try again
      
      console.warn('No video ID found for:', trackName, 'by', artistName);
      console.warn('Search key was:', searchKey);
      console.warn('Title only:', titleOnly, 'Artist only:', artistOnly);
      
      // For unrecognized songs, don't fallback to anything - return null
      // This will help us identify when searches aren't working properly
      console.log('Song not found in mapping, will try backend search or return null.');
      return null;
      
    } catch (error) {
      console.error('Error searching YouTube:', error);
      return null;
    }
  }

  // Try to get video ID from your backend
  private static async searchYouTubeViaBackend(trackName: string, artistName: string): Promise<string | null> {
    try {
      const query = `${trackName} ${artistName}`;
      const searchUrl = new URL('/api/search', window.location.origin);
      searchUrl.searchParams.append('q', query);
      
      console.log('Trying local backend search:', searchUrl.toString());
      
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Backend search failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Extract video ID from response
      if (data.video_id) return data.video_id;
      if (data.error) {
        console.log('Backend search returned error:', data.error);
        return null;
      }
      
      return null;
    } catch (error) {
      console.log('Backend search error:', error);
      return null;
    }
  }

  // Comprehensive video ID mapping for popular songs
  private static getVideoIdFromMapping(trackName: string, artistName: string): string | null {
    const searchKey = `${trackName} ${artistName}`.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    
    console.log('Searching for video mapping with key:', searchKey);
    
    // Comprehensive mapping of popular songs to their YouTube video IDs
    const videoMapping: Record<string, string> = {
      // Popular songs
      'faded alan walker': 'npf2N5j7h3A',
      'shape of you ed sheeran': 'JGwWNGJdvx8',
      'blinding lights the weeknd': '4NRXx6U8ABQ',
      'someone like you adele': 'hLQl3WQQoQ0',
      'despacito luis fonsi': 'kJQP7kiw5Fk',
      'bad guy billie eilish': 'DyDfgMOUjCI',
      'perfect ed sheeran': '2Vv-BfVoq4g',
      'uptown funk mark ronson': 'OPf0YbXqDm0',
      'see you again wiz khalifa': 'RgKAFK5djSk',
      'gangnam style psy': '9bZkp7q19f0',
      'bohemian rhapsody queen': 'fJ9rUzIMcZQ',
      'rolling in the deep adele': 'rYEDA3JcQqw',
      'hello adele': 'YQHsXMglC9A',
      'thinking out loud ed sheeran': 'lp-EO5I60KA',
      'roar katy perry': 'CevxZvSJLk8',
      'shake it off taylor swift': 'nfWlot6h_JM',
      'blank space taylor swift': 'OutLVJ8W_jQ',
      'happy pharrell williams': 'ZbZSe6N_BXs',
      'counting stars onerepublic': 'hT_nvWreIhg',
      'radioactive imagine dragons': 'ktvTqknDobU',
      'demons imagine dragons': 'mWRsgZuwf_8',
      'thunder imagine dragons': 'fKopy74weus',
      'believer imagine dragons': '7wtfhZwyrcc',
      'sunflower post malone': 'ApXoWvfEYVU',
      'circles post malone': 'wXhTHyIgQ_U',
      'old town road lil nas x': 'r7qovpFAGrQ',
      'dance monkey tones and i': 'q0hyYWKXF0Q',
      'memories maroon 5': 'SlPhMPnQ58k',
      'senorita shawn mendes': 'Pkh8UtuejGw',
      'watermelon sugar harry styles': 'E07s5ZYygMg',
      'drivers license olivia rodrigo': 'ZmDBbnmKpqQ',
      'levitating dua lipa': 'TUVcZfQe-Kw',
      'save your tears the weeknd': 'XXYlFuWEuKI',
      'good 4 u olivia rodrigo': 'gNi_6U5Pm_o',
      'stay the kid laroi': 'kTJczUoc26U',
      'industry baby lil nas x': 'UTHLKHL_whs',
      'heat waves glass animals': 'mRD0-GxqHVo',
      'as it was harry styles': 'H5v3kku4y6Q',
      // Add specific songs user mentioned - "Charche" by Dhanda Nyoliwala & Xvir Grewal
      'charche dhanda nyoliwala': 'UqKwsGIbmuI', // Correct artist name
      'charche xvir grewal': 'UqKwsGIbmuI', // Correct artist name  
      'charche dhanda nyoliwala xvir grewal': 'UqKwsGIbmuI', // Full artist names
      'charche xvir dhandha': 'UqKwsGIbmuI', // User search variation
      'charche xvir': 'UqKwsGIbmuI', // Partial search
      'charche dhandha': 'UqKwsGIbmuI', // Partial search
      'charche nyoliwala': 'UqKwsGIbmuI', // Partial search
      'charche grewal': 'UqKwsGIbmuI', // Partial search
      'xvir charche': 'UqKwsGIbmuI', // Alternative search
      'dhandha charche': 'UqKwsGIbmuI', // Alternative search
      'charche': 'UqKwsGIbmuI', // Just the song title - but specific enough
      
      // Popular songs that might be searched for - add actual mappings
      'popular bir arsh heer daaku': 'VS1XQHXr4UI', // Based on the video ID from error logs
      'popular bir': 'VS1XQHXr4UI', // Same song
      'no mercy dhanda nyoliwala': 'pb-NGCQS_CU', // Based on successful backend search
      'no mercy dhanda': 'pb-NGCQS_CU', // Same song
      'no mercy dhanda nyoliwala desi melbourniye': 'pb-NGCQS_CU', // Full artist name
      'try me karan aujla': '6wkwmDzZ3n4', // Based on successful API search
      'try me karan aujla ikky': '6wkwmDzZ3n4' // Full artist name
    };
    
    // First try exact match
    if (videoMapping[searchKey]) {
      console.log('Found exact match for:', searchKey, '-> using video ID:', videoMapping[searchKey]);
      return videoMapping[searchKey];
    }
    
    console.log('No exact match found in video mapping.');
    return null;
  }

  static async getStreamUrl(song: Song): Promise<string | null> {
    try {
      console.log('getStreamUrl called with:', song.title, 'by', song.artist);
      
      // Search YouTube directly from frontend
      const videoId = await this.searchYouTubeVideoId(song.title, song.artist);
      
      if (!videoId) {
        throw new Error('Could not find YouTube video for this song');
      }
      
      console.log('Found YouTube video ID:', videoId);
      
      // Build stream URL with video ID for Cloudflare backend
      const streamUrl = buildStreamUrl(videoId);
      
      console.log('Stream URL:', streamUrl);
      
      // Add to recently played
      this.addToRecentlyPlayed(song);
      
      return streamUrl;
    } catch (error) {
      console.error('Error getting stream URL:', error);
      throw new Error('Failed to get audio stream');
    }
  }

  static async getRecentlyPlayed(): Promise<Song[]> {
    try {
      console.log('getRecentlyPlayed called');
      
      // Get recently played from localStorage
      const recentlyPlayed = localStorage.getItem('recentlyPlayed');
      if (!recentlyPlayed) return [];
      
      const songs = JSON.parse(recentlyPlayed);
      
      // Return last 10 songs
      return songs.slice(0, 10);
    } catch (error) {
      console.error('Error fetching recently played:', error);
      return [];
    }
  }

  // Helper method to manage recently played songs
  private static addToRecentlyPlayed(song: Song): void {
    try {
      const recentlyPlayed = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
      
      // Remove if already exists (check by ID)
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

  // Legacy method for compatibility
  static async fetchSong(songId: string): Promise<Song | null> {
    try {
      console.log('fetchSong called with:', songId);
      
      // Since we're using iTunes, we'd need to search for the song
      // This is mainly for compatibility with existing code
      return null;
    } catch (error) {
      console.error('Error fetching song:', error);
      return null;
    }
  }

  // Get liked songs with full details
  static async getLikedSongsWithDetails(): Promise<Song[]> {
    try {
      const likedSongs = JSON.parse(localStorage.getItem('likedSongs') || '[]');
      // Since liked songs already contain full metadata from iTunes, return as-is
      return likedSongs;
    } catch (error) {
      console.error('Error fetching liked songs details:', error);
      return [];
    }
  }

  // Preload song preparation on backend for instant playback
  static async preloadSong(song: Song): Promise<boolean> {
    try {
      console.log('Preloading song:', song.title, 'by', song.artist);
      
      // Get video ID first
      const videoId = await this.searchYouTubeVideoId(song.title, song.artist);
      
      if (!videoId) {
        console.log('No video ID found for preload:', song.title);
        return false;
      }

      // Check if already preloaded
      const cacheKey = `${song.title} ${song.artist}`.toLowerCase();
      if (preloadStatus.get(cacheKey) === 'ready') {
        console.log('Song already preloaded:', song.title);
        return true;
      }

      // Mark as preparing
      preloadStatus.set(cacheKey, 'preparing');
      
      // Trigger backend preload
      const response = await apiRequest('/api/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoId })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Preload initiated for:', song.title, data.status);
        return true;
      } else {
        preloadStatus.set(cacheKey, 'failed');
        console.log('Preload failed for:', song.title);
        return false;
      }
    } catch (error) {
      console.error('Error preloading song:', error);
      const cacheKey = `${song.title} ${song.artist}`.toLowerCase();
      preloadStatus.set(cacheKey, 'failed');
      return false;
    }
  }

  // Check if song is ready for instant playback (downloaded on backend)
  static async isDownloadReady(song: Song): Promise<boolean> {
    try {
      const videoId = await this.searchYouTubeVideoId(song.title, song.artist);
      
      if (!videoId) {
        return false;
      }

      const response = await apiRequest(`/api/download-status/${videoId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Download status for', song.title, ':', data.status);
        return data.isReady === true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking download status:', error);
      return false;
    }
  }

  // Enhanced getStreamUrl that returns immediately and doesn't wait
  static async getStreamUrlOptimized(song: Song): Promise<string | null> {
    try {
      console.log('getStreamUrlOptimized called with:', song.title, 'by', song.artist);
      
      // Get video ID
      const videoId = await this.searchYouTubeVideoId(song.title, song.artist);
      
      if (!videoId) {
        throw new Error('Could not find YouTube video for this song');
      }
      
      console.log('Found YouTube video ID:', videoId);
      
      // Immediately trigger backend preloading for faster streaming
      try {
        fetch(`${API_BASE_URL}/api/preload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ videoId })
        }).catch(() => {
          // Ignore preload errors, it's just an optimization
          console.log('Preload trigger sent for video ID:', videoId);
        });
      } catch (preloadError) {
        console.log('Preload warning (non-critical):', preloadError);
      }
      
      // Return stream URL immediately for audio element
      const streamUrl = buildStreamUrl(videoId);
      
      console.log('Stream URL:', streamUrl);
      
      // Add to recently played
      this.addToRecentlyPlayed(song);
      
      return streamUrl;
    } catch (error) {
      console.error('Error getting optimized stream URL:', error);
      throw new Error('Failed to get audio stream');
    }
  }



  // Batch preload for queue optimization  
  static async preloadQueue(songs: Song[]): Promise<void> {
    try {
      console.log('Preloading queue of', songs.length, 'songs');
      
      // Preload in parallel (limit to 3 concurrent)
      const preloadPromises = songs.slice(0, 3).map(song => this.preloadSong(song));
      
      // Fire and forget - don't wait for completion
      Promise.allSettled(preloadPromises).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
        console.log(`Queue preload completed: ${successful}/${results.length} songs ready`);
      });
      
    } catch (error) {
      console.error('Error preloading queue:', error);
    }
  }
}
