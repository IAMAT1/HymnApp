interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  streamingUrl?: string;
  quality?: string;
  source: string;
  youtube_id?: string;
  album?: string;
  year?: number;
  genre?: string;
}

interface SearchResponse {
  success: boolean;
  results: Song[];
  total: number;
  source: string;
}

class ComprehensiveMusicService {
  private karanAujlaSongs = {
    'try me': { title: 'Try Me', videoId: 'pFgQNBqawFo' },
    'luther': { title: 'Luther', videoId: 'MmQcL3Lp8nI' },
    'softly': { title: 'Softly', videoId: 'ycGP6MW5w2A' },
    'bachke bachke': { title: 'Bachke Bachke', videoId: 'vI2eWMq7gH4' },
    'players': { title: 'Players', videoId: 'gHjronXyeqk' },
    'antidote': { title: 'Antidote', videoId: 'UMP2XKDrvJE' },
    'white brown black': { title: 'White Brown Black', videoId: 'cfAU1fvKOSA' },
    'jee ni lagda': { title: 'Jee Ni Lagda', videoId: '4QpMdu0SX_s' },
    'chitta kurta': { title: 'Chitta Kurta', videoId: 'oFqsOMBh26E' },
    'on top': { title: 'On Top', videoId: 'XLUdZ52QZpw' }
  };

  private arijitSinghSongs = {
    'tum hi ho': { title: 'Tum Hi Ho', videoId: 'LfnRhbDuGWs' },
    'channa mereya': { title: 'Channa Mereya', videoId: 'bzSTpdcs-EI' },
    'ae dil hai mushkil': { title: 'Ae Dil Hai Mushkil', videoId: 'Z_PODraXg4E' },
    'gerua': { title: 'Gerua', videoId: 'AEIVlYegmQs' },
    'hamari adhuri kahani': { title: 'Hamari Adhuri Kahani', videoId: 'Wq4tyDTSk_U' },
    'raabta': { title: 'Raabta', videoId: 'eHj3uEyNEQQ' },
    'pal pal dil ke paas': { title: 'Pal Pal Dil Ke Paas', videoId: 'JFcgOboQZ08' },
    'hawayein': { title: 'Hawayein', videoId: 'EvZpVfuSPrE' }
  };

  private popularSongs = {
    // English Artists
    'ed sheeran shape of you': { title: 'Shape of You', artist: 'Ed Sheeran', videoId: 'JGwWNGJdvx8' },
    'ed sheeran perfect': { title: 'Perfect', artist: 'Ed Sheeran', videoId: '2Vv-BfVoq4g' },
    'kendrick lamar humble': { title: 'HUMBLE.', artist: 'Kendrick Lamar', videoId: 'tvTRZJ-4EyI' },
    'drake hotline bling': { title: 'Hotline Bling', artist: 'Drake', videoId: 'uxpDa-c-4Mc' },
    'taylor swift shake it off': { title: 'Shake It Off', artist: 'Taylor Swift', videoId: 'nfWlot6h_JM' },
    'adele hello': { title: 'Hello', artist: 'Adele', videoId: 'YQHsXMglC9A' },
    'billie eilish bad guy': { title: 'bad guy', artist: 'Billie Eilish', videoId: 'DyDfgMOUjCI' },
    'the weeknd blinding lights': { title: 'Blinding Lights', artist: 'The Weeknd', videoId: 'ygr5AHufBN4' },
    'post malone circles': { title: 'Circles', artist: 'Post Malone', videoId: 'yaWesK-Fngn' },
    
    // Indian Artists
    'divine farak': { title: 'Farak', artist: 'Divine', videoId: 'keLt6PoIFz0' },
    'divine satya': { title: 'Satya', artist: 'Divine', videoId: 'bVcKKWpNh_4' },
    'shubh cheques': { title: 'Cheques', artist: 'Shubh', videoId: 'dGrI-pE6Nxw' },
    'shubh we rollin': { title: 'We Rollin', artist: 'Shubh', videoId: 'pFgQNBqawFo' },
    'ap dhillon brown munde': { title: 'Brown Munde', artist: 'AP Dhillon', videoId: 'VNs_cVaWGBs' },
    'sidhu moose wala so high': { title: 'So High', artist: 'Sidhu Moose Wala', videoId: 'HvGql8HwOIM' },
  };

  private generateSearchVariations(query: string): string[] {
    const variations = [query];
    const cleanQuery = query.toLowerCase().trim();
    
    // Basic cleaning
    variations.push(
      cleanQuery.replace(/by\s+/g, ' ').trim(),
      cleanQuery.replace(/\s+by\s+/g, ' ').trim(),
      cleanQuery.replace(/official/g, '').trim(),
      cleanQuery.replace(/video/g, '').trim(),
      cleanQuery.replace(/song/g, '').trim(),
      cleanQuery.replace(/audio/g, '').trim()
    );

    // Artist-specific variations
    if (cleanQuery.includes('karan') && cleanQuery.includes('aujla')) {
      Object.keys(this.karanAujlaSongs).forEach(songKey => {
        if (cleanQuery.includes(songKey)) {
          variations.push(songKey, `karan aujla ${songKey}`, `${songKey} karan aujla`);
        }
      });
    }

    if (cleanQuery.includes('arijit') && cleanQuery.includes('singh')) {
      Object.keys(this.arijitSinghSongs).forEach(songKey => {
        if (cleanQuery.includes(songKey)) {
          variations.push(songKey, `arijit singh ${songKey}`, `${songKey} arijit singh`);
        }
      });
    }

    // Remove duplicates
    return [...new Set(variations.filter(v => v.length > 0))];
  }

  private async searchJioSaavn(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`/api/music/jiosaavn/search?q=${encodeURIComponent(query)}&limit=10`);
      if (!response.ok) throw new Error(`JioSaavn API failed: ${response.status}`);
      
      const data = await response.json();
      const songs: Song[] = [];

      if (data.data && data.data.results) {
        for (const song of data.data.results) {
          const downloadUrls = song.downloadUrl || [];
          const streamingUrl = downloadUrls.length > 0 ? downloadUrls[downloadUrls.length - 1].url : '';
          
          songs.push({
            id: `jiosaavn_${song.id}`,
            title: song.name || song.title || 'Unknown',
            artist: song.artists?.primary?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
            albumArt: song.image?.[song.image.length - 1]?.url || '/api/placeholder-image',
            duration: parseInt(song.duration) || 0,
            streamingUrl: streamingUrl,
            quality: downloadUrls.length > 0 ? downloadUrls[downloadUrls.length - 1].quality : '320kbps',
            source: 'JioSaavn',
            album: song.album?.name || '',
            year: parseInt(song.year) || new Date().getFullYear(),
            genre: 'Music'
          });
        }
      }

      return songs;
    } catch (error) {
      console.error('JioSaavn search error:', error);
      return [];
    }
  }

  private async searchYouTubeMusic(query: string): Promise<Song[]> {
    try {
      const response = await fetch(`/api/music/youtube/search?q=${encodeURIComponent(query)}&limit=5`);
      if (!response.ok) throw new Error(`YouTube API failed: ${response.status}`);
      
      const data = await response.json();
      const songs: Song[] = [];

      if (data.items) {
        for (const item of data.items) {
          const videoId = item.id?.videoId || item.url?.split('v=')[1]?.split('&')[0];
          if (videoId) {
            songs.push({
              id: `youtube_${videoId}`,
              title: item.snippet?.title || 'Unknown',
              artist: item.snippet?.channelTitle || 'Unknown Artist',
              albumArt: item.snippet?.thumbnails?.default?.url || `https://i.ytimg.com/vi/${videoId}/default.jpg`,
              duration: 0, // YouTube doesn't provide duration in search
              streamingUrl: item.streaming_url || `https://youtube.com/watch?v=${videoId}`,
              quality: item.quality || 'Variable',
              source: item.source || 'YouTube',
              youtube_id: videoId,
              album: '',
              year: new Date().getFullYear(),
              genre: 'Music'
            });
          }
        }
      }

      return songs;
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  }

  private searchCuratedDatabase(query: string): Song[] {
    const cleanQuery = query.toLowerCase().trim();
    const songs: Song[] = [];

    // Search Karan Aujla songs
    if (cleanQuery.includes('karan') || cleanQuery.includes('aujla')) {
      Object.entries(this.karanAujlaSongs).forEach(([key, song]) => {
        if (cleanQuery.includes(key) || key.includes(cleanQuery.split(' ')[0])) {
          songs.push({
            id: `curated_karan_${song.videoId}`,
            title: song.title,
            artist: 'Karan Aujla',
            albumArt: `https://i.ytimg.com/vi/${song.videoId}/default.jpg`,
            duration: 0,
            streamingUrl: `https://youtube.com/watch?v=${song.videoId}`,
            quality: 'High Quality',
            source: 'Curated Database',
            youtube_id: song.videoId,
            album: 'Karan Aujla Collection',
            year: 2024,
            genre: 'Punjabi'
          });
        }
      });
    }

    // Search Arijit Singh songs
    if (cleanQuery.includes('arijit') || cleanQuery.includes('singh')) {
      Object.entries(this.arijitSinghSongs).forEach(([key, song]) => {
        if (cleanQuery.includes(key) || key.includes(cleanQuery.split(' ')[0])) {
          songs.push({
            id: `curated_arijit_${song.videoId}`,
            title: song.title,
            artist: 'Arijit Singh',
            albumArt: `https://i.ytimg.com/vi/${song.videoId}/default.jpg`,
            duration: 0,
            streamingUrl: `https://youtube.com/watch?v=${song.videoId}`,
            quality: 'High Quality',
            source: 'Curated Database',
            youtube_id: song.videoId,
            album: 'Arijit Singh Collection',
            year: 2024,
            genre: 'Bollywood'
          });
        }
      });
    }

    // Search popular songs
    Object.entries(this.popularSongs).forEach(([key, song]) => {
      if (cleanQuery.includes(key) || key.includes(cleanQuery)) {
        songs.push({
          id: `curated_popular_${song.videoId}`,
          title: song.title,
          artist: song.artist,
          albumArt: `https://i.ytimg.com/vi/${song.videoId}/default.jpg`,
          duration: 0,
          streamingUrl: `https://youtube.com/watch?v=${song.videoId}`,
          quality: 'High Quality',
          source: 'Curated Database',
          youtube_id: song.videoId,
          album: 'Popular Collection',
          year: 2024,
          genre: 'Music'
        });
      }
    });

    return songs;
  }

  private deduplicateSongs(songs: Song[]): Song[] {
    const unique: Song[] = [];
    const seenTitles = new Set<string>();

    for (const song of songs) {
      const key = `${song.title.toLowerCase()}_${song.artist.toLowerCase()}`;
      if (!seenTitles.has(key)) {
        seenTitles.add(key);
        unique.push(song);
      }
    }

    return unique;
  }

  private calculatePriority(song: Song, originalQuery: string): number {
    let priority = 0;
    const queryLower = originalQuery.toLowerCase();
    const titleLower = song.title.toLowerCase();
    const artistLower = song.artist.toLowerCase();

    // Exact title match
    if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
      priority += 100;
    }

    // Artist match
    if (artistLower.includes('karan aujla') || artistLower.includes('arijit singh')) {
      priority += 80;
    }

    // Source preference
    if (song.source === 'JioSaavn') priority += 50;
    else if (song.source === 'Curated Database') priority += 40;
    else if (song.source === 'YouTube') priority += 30;

    // Has streaming URL
    if (song.streamingUrl) priority += 25;

    // Quality bonus
    if (song.quality?.includes('320')) priority += 20;

    return priority;
  }

  async comprehensiveSearch(query: string, limit: number = 10): Promise<SearchResponse> {
    try {
      console.log('Comprehensive music search for:', query);
      const allSongs: Song[] = [];

      // Get search variations
      const variations = this.generateSearchVariations(query);
      
      // Search all sources in parallel
      const searchPromises = [
        this.searchCuratedDatabase(query),
        ...variations.slice(0, 2).map(variation => this.searchJioSaavn(variation)),
        this.searchYouTubeMusic(query)
      ];

      const results = await Promise.allSettled(searchPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (index === 0) {
            // Curated database results
            allSongs.push(...result.value);
          } else if (Array.isArray(result.value)) {
            allSongs.push(...result.value);
          }
        }
      });

      // Deduplicate and prioritize
      const uniqueSongs = this.deduplicateSongs(allSongs);
      const prioritizedSongs = uniqueSongs
        .sort((a, b) => this.calculatePriority(b, query) - this.calculatePriority(a, query))
        .slice(0, limit);

      console.log(`Found ${prioritizedSongs.length} songs from comprehensive search`);

      return {
        success: true,
        results: prioritizedSongs,
        total: prioritizedSongs.length,
        source: 'ComprehensiveMusicService'
      };
    } catch (error) {
      console.error('Comprehensive search error:', error);
      return {
        success: false,
        results: [],
        total: 0,
        source: 'ComprehensiveMusicService'
      };
    }
  }

  async getTrendingMusic(): Promise<Song[]> {
    // Return a curated list of trending songs
    const trending = [
      // Karan Aujla hits
      { key: 'try me', song: this.karanAujlaSongs['try me'], artist: 'Karan Aujla', genre: 'Punjabi' },
      { key: 'softly', song: this.karanAujlaSongs['softly'], artist: 'Karan Aujla', genre: 'Punjabi' },
      
      // Arijit Singh hits
      { key: 'tum hi ho', song: this.arijitSinghSongs['tum hi ho'], artist: 'Arijit Singh', genre: 'Bollywood' },
      { key: 'channa mereya', song: this.arijitSinghSongs['channa mereya'], artist: 'Arijit Singh', genre: 'Bollywood' },
      
      // International hits
      { key: 'shape of you', song: this.popularSongs['ed sheeran shape of you'], artist: 'Ed Sheeran', genre: 'Pop' },
      { key: 'blinding lights', song: this.popularSongs['the weeknd blinding lights'], artist: 'The Weeknd', genre: 'Pop' },
    ];

    return trending.map(({ key, song, artist, genre }) => ({
      id: `trending_${song.videoId}`,
      title: song.title,
      artist: artist,
      albumArt: `https://i.ytimg.com/vi/${song.videoId}/default.jpg`,
      duration: 0,
      streamingUrl: `https://youtube.com/watch?v=${song.videoId}`,
      quality: 'High Quality',
      source: 'Trending',
      youtube_id: song.videoId,
      album: 'Trending Collection',
      year: 2024,
      genre: genre
    }));
  }
}

export const comprehensiveMusicService = new ComprehensiveMusicService();
export default ComprehensiveMusicService;