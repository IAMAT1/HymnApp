import express, { Request, Response } from 'express';
import axios from 'axios';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

interface Song {
  id: string;
  title: string;
  subtitle?: string;
  artists: Array<{ name: string }> | string[];
  image?: string;
  duration: number;
  streaming_url?: string;
  quality?: string;
  source: string;
  youtube_id?: string;
  priority?: number;
}

interface SearchResponse {
  status: number;
  response: Song[];
  message?: string;
}

class CompleteMusicAPI {
  private client = axios.create({
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  private apis = {
    'saavn_primary': "https://saavn.dev/api",
    'saavn_alt': "https://jiosaavn-api-privatecvc.vercel.app",
    'saavn_alt2': "https://jiosaavn-api-2-harsh-patel.vercel.app",
    'saavn_alt3': "https://saavn-music-api.vercel.app"
  };

  private karanAujlaSongs = {
    'try me': ['Try Me Karan Aujla', 'Try Me Official', 'Try Me Audio', 'Try Me Song'],
    'luther': ['Luther Karan Aujla', 'Luther Official', 'Luther Song', 'Luther Audio'],
    'softly': ['Softly Karan Aujla', 'Softly Official', 'Softly Song'],
    'bachke bachke': ['Bachke Bachke Karan Aujla', 'Bachke Bachke Official'],
    'players': ['Players Karan Aujla', 'Players Official', 'Players Song'],
    'antidote': ['Antidote Karan Aujla', 'Antidote Official'],
    'white brown black': ['White Brown Black Karan Aujla', 'White Brown Black'],
    'jee ni lagda': ['Jee Ni Lagda Karan Aujla', 'Jee Ni Lagda'],
    'chitta kurta': ['Chitta Kurta Karan Aujla', 'Chitta Kurta Official'],
    'on top': ['On Top Karan Aujla', 'On Top Official']
  };

  async testApiEndpoint(endpoint: string): Promise<boolean> {
    try {
      const response = await this.client.get(`${endpoint}/search/songs?query=test&limit=1`, { timeout: 10000 });
      return [200, 400].includes(response.status);
    } catch {
      return false;
    }
  }

  async findWorkingEndpoint(): Promise<string | null> {
    for (const [name, endpoint] of Object.entries(this.apis)) {
      if (await this.testApiEndpoint(endpoint)) {
        console.log(`Using working endpoint: ${name} - ${endpoint}`);
        return endpoint;
      }
    }
    console.warn("All external APIs failed");
    return null;
  }

  generateSearchVariations(query: string): string[] {
    const variations = [query];
    
    // Basic variations
    variations.push(
      query.replace("by", "").trim(),
      query.replace(" by ", " ").trim(),
      query.split(" by ")[0].trim(),
      `${query} Official`,
      `${query} Song`,
      `${query} Audio`
    );
    
    // Karan Aujla specific variations
    const queryLower = query.toLowerCase();
    if (queryLower.includes("karan") && queryLower.includes("aujla")) {
      variations.push(
        query.replace("Aujla", "Aujla"),
        query.replace("aujla", "aujla"),
        query.replace("Karan Aujla", "Karan Aujla"),
        query.replace("karan aujla", "karan aujla"),
        query.replace(" by Karan Aujla", ""),
        query.replace(" Karan Aujla", "")
      );
      
      // Check for specific song mappings
      for (const [songKey, songVariations] of Object.entries(this.karanAujlaSongs)) {
        if (queryLower.includes(songKey)) {
          variations.push(...songVariations);
          break;
        }
      }
    }
    
    // Remove duplicates while preserving order
    const uniqueVariations: string[] = [];
    const seen = new Set<string>();
    for (const variation of variations) {
      const varClean = variation.trim();
      if (varClean && !seen.has(varClean)) {
        uniqueVariations.push(varClean);
        seen.add(varClean);
      }
    }
    
    return uniqueVariations;
  }

  async searchSaavnAPI(query: string, endpoint: string): Promise<SearchResponse> {
    try {
      const searchUrls = [
        `${endpoint}/search/songs`,
        `${endpoint}/api/search/songs`,
        `${endpoint}/search`
      ];
      
      for (const url of searchUrls) {
        try {
          let params: any = { query, page: 1, limit: 15 };
          if (endpoint.includes("vercel.app")) {
            params = { query, limit: 15 };
          }
          
          const response = await this.client.get(url, { params });
          
          if (response.status === 200) {
            const data = response.data;
            const songs: Song[] = [];
            let results: any[] = [];
            
            // Handle different response formats
            if (data.data) {
              if (data.data.results) {
                results = data.data.results;
              } else if (Array.isArray(data.data)) {
                results = data.data;
              }
            } else if (data.results) {
              results = data.results;
            } else if (Array.isArray(data)) {
              results = data;
            }
            
            for (const song of results) {
              const downloadUrls = song.downloadUrl || [];
              let streamingUrl = "";
              let quality = "Unknown";
              
              if (downloadUrls.length > 0) {
                const bestQuality = downloadUrls[downloadUrls.length - 1];
                streamingUrl = bestQuality.url || bestQuality.link || '';
                quality = bestQuality.quality || '320kbps';
              }
              
              songs.push({
                id: song.id || '',
                title: song.name || song.title || 'Unknown',
                subtitle: song.subtitle || '',
                artists: song.artists?.primary || song.artists || [],
                image: song.image?.[song.image.length - 1]?.url || song.image?.[song.image.length - 1]?.link || '',
                duration: song.duration || 0,
                streaming_url: streamingUrl,
                quality,
                source: `JioSaavn (${endpoint})`,
              });
            }
            
            return { status: 200, response: songs };
          }
        } catch (error) {
          console.error(`Error with ${url}:`, error);
          continue;
        }
      }
      
      return { status: 404, response: [], message: "No results found" };
    } catch (error) {
      console.error(`Saavn API error:`, error);
      return { status: 500, response: [], message: String(error) };
    }
  }

  async searchYouTubeMusic(query: string): Promise<SearchResponse> {
    try {
      // Use yt-dlp for YouTube search
      const command = `yt-dlp --quiet --no-warnings --extract-flat --default-search "ytsearch15:" "${query}"`;
      const { stdout } = await execAsync(command);
      
      const songs: Song[] = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          if (line.includes('youtube.com/watch?v=')) {
            const videoId = line.match(/watch\?v=([a-zA-Z0-9_-]+)/)?.[1];
            if (videoId) {
              // Get video info
              const infoCommand = `yt-dlp --quiet --no-warnings --print "%(title)s|%(uploader)s|%(duration)s" "https://youtube.com/watch?v=${videoId}"`;
              const { stdout: infoOutput } = await execAsync(infoCommand);
              const [title, uploader, duration] = infoOutput.trim().split('|');
              
              if (title && title.toLowerCase().includes('music')) {
                songs.push({
                  id: `youtube_${videoId}`,
                  title: title || 'Unknown',
                  subtitle: `by ${uploader || 'Unknown'}`,
                  artists: [{ name: uploader || 'Unknown' }],
                  duration: parseInt(duration) || 0,
                  streaming_url: `https://youtube.com/watch?v=${videoId}`,
                  quality: 'Variable (up to 320kbps)',
                  source: 'YouTube',
                  youtube_id: videoId
                });
              }
            }
          }
        } catch (error) {
          console.error('Error processing YouTube result:', error);
        }
      }
      
      return { status: 200, response: songs.slice(0, 10) };
    } catch (error) {
      console.error(`YouTube search error:`, error);
      return { status: 500, response: [], message: String(error) };
    }
  }

  deduplicateSongs(songs: Song[]): Song[] {
    const uniqueSongs: Song[] = [];
    
    for (const song of songs) {
      let isDuplicate = false;
      const songTitle = song.title.toLowerCase().trim();
      
      for (const existing of uniqueSongs) {
        const existingTitle = existing.title.toLowerCase().trim();
        const similarity = this.calculateSimilarity(songTitle, existingTitle);
        
        if (similarity > 0.85) {
          // Keep the one with streaming URL if available
          if (song.streaming_url && !existing.streaming_url) {
            const index = uniqueSongs.indexOf(existing);
            uniqueSongs[index] = song;
          }
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueSongs.push(song);
      }
    }
    
    return uniqueSongs;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = this.getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private getEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  calculatePriority(song: Song, originalQuery: string): number {
    let priority = 0;
    const songTitle = song.title.toLowerCase();
    const songArtists = String(song.artists).toLowerCase();
    const queryLower = originalQuery.toLowerCase();
    
    // Exact title match
    if (queryLower.includes(songTitle) || songTitle.includes(queryLower)) {
      priority += 100;
    }
    
    // Artist match (especially Karan Aujla)
    if (songArtists.includes('karan') && songArtists.includes('aujla')) {
      priority += 80;
    }
    
    // Has streaming URL
    if (song.streaming_url) {
      priority += 50;
    }
    
    // Quality bonus
    const quality = song.quality?.toLowerCase() || '';
    if (quality.includes('320')) {
      priority += 30;
    } else if (quality.includes('256') || quality.includes('192')) {
      priority += 20;
    }
    
    // Source preference
    const source = song.source.toLowerCase();
    if (source.includes('jiosaavn')) {
      priority += 25;
    } else if (source.includes('youtube')) {
      priority += 10;
    }
    
    return priority;
  }

  async comprehensiveSearch(query: string): Promise<SearchResponse> {
    console.log(`Starting comprehensive search for: '${query}'`);
    
    let allSongs: Song[] = [];
    const searchVariations = this.generateSearchVariations(query);
    
    // Find working API endpoint
    const workingEndpoint = await this.findWorkingEndpoint();
    
    // Search JioSaavn APIs with variations
    if (workingEndpoint) {
      for (const variation of searchVariations.slice(0, 5)) {
        try {
          const result = await this.searchSaavnAPI(variation, workingEndpoint);
          if (result.response) {
            allSongs.push(...result.response);
          }
        } catch (error) {
          console.error(`Error searching variation '${variation}':`, error);
          continue;
        }
      }
    }
    
    // Search alternative JioSaavn APIs
    const altApis = Object.entries(this.apis).slice(1, 3);
    for (const [apiName, endpoint] of altApis) {
      if (endpoint !== workingEndpoint) {
        try {
          if (await this.testApiEndpoint(endpoint)) {
            const result = await this.searchSaavnAPI(query, endpoint);
            if (result.response) {
              allSongs.push(...result.response);
            }
          }
        } catch (error) {
          console.error(`Error with ${apiName}:`, error);
          continue;
        }
      }
    }
    
    // YouTube fallback if insufficient results
    if (allSongs.length < 3) {
      try {
        const youtubeResult = await this.searchYouTubeMusic(query);
        if (youtubeResult.response) {
          allSongs.push(...youtubeResult.response);
        }
      } catch (error) {
        console.error(`YouTube fallback error:`, error);
      }
    }
    
    // Remove duplicates
    const uniqueSongs = this.deduplicateSongs(allSongs);
    
    // Calculate priorities and sort
    for (const song of uniqueSongs) {
      song.priority = this.calculatePriority(song, query);
    }
    
    uniqueSongs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Limit results
    const finalResults = uniqueSongs.slice(0, 20);
    
    console.log(`Found ${finalResults.length} unique songs for '${query}'`);
    
    return {
      status: finalResults.length > 0 ? 200 : 404,
      response: finalResults
    };
  }

  async getYouTubeStreamUrl(youtubeId: string): Promise<string> {
    try {
      const youtubeUrl = `https://youtube.com/watch?v=${youtubeId}`;
      const command = `yt-dlp --quiet --no-warnings -f "bestaudio[abr>=128]/bestaudio" --get-url "${youtubeUrl}"`;
      const { stdout } = await execAsync(command);
      return stdout.trim();
    } catch (error) {
      console.error(`YouTube stream URL error:`, error);
      return "";
    }
  }
}

export const completeMusicAPI = new CompleteMusicAPI();

// Express router setup
export const completeMusicRouter = express.Router();

// Test connection endpoint
completeMusicRouter.get('/test-connection', async (req: Request, res: Response) => {
  try {
    const results: Record<string, any> = {};
    
    for (const [name, endpoint] of Object.entries(completeMusicAPI['apis'])) {
      const isWorking = await completeMusicAPI.testApiEndpoint(endpoint);
      results[name] = {
        endpoint,
        status: isWorking ? "✅ Working" : "❌ Failed"
      };
    }
    
    // Test YouTube
    try {
      const youtubeTest = await completeMusicAPI.searchYouTubeMusic("test");
      results["youtube"] = {
        endpoint: "YouTube Music API",
        status: youtubeTest.status === 200 ? "✅ Working" : "❌ Failed"
      };
    } catch {
      results["youtube"] = {
        endpoint: "YouTube Music API",
        status: "❌ Failed"
      };
    }
    
    res.json({ connection_tests: results });
  } catch (error) {
    res.status(500).json({ error: 'Test connection failed', details: String(error) });
  }
});

// Comprehensive search endpoint
completeMusicRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const result = await completeMusicAPI.comprehensiveSearch(query);
    
    if (result.status !== 200) {
      return res.status(404).json({ error: 'No songs found', ...result });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Search failed', details: String(error) });
  }
});

// YouTube-only search endpoint
completeMusicRouter.get('/search-youtube', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const result = await completeMusicAPI.searchYouTubeMusic(query);
    
    if (result.status !== 200) {
      return res.status(404).json({ error: 'No YouTube results found', ...result });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'YouTube search failed', details: String(error) });
  }
});

// Stream music endpoint
completeMusicRouter.get('/stream/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`Streaming song ID: ${id}`);
    
    // Handle YouTube IDs
    if (id.startsWith("youtube_")) {
      const youtubeId = id.replace("youtube_", "");
      const streamUrl = await completeMusicAPI.getYouTubeStreamUrl(youtubeId);
      
      if (!streamUrl) {
        return res.status(404).json({ error: 'YouTube stream URL not found' });
      }
      
      // Proxy the stream
      const response = await axios.get(streamUrl, { responseType: 'stream' });
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache'
      });
      response.data.pipe(res);
      return;
    }
    
    // Handle regular JioSaavn IDs - try to find streaming URL
    try {
      const searchResult = await completeMusicAPI.comprehensiveSearch(`id:${id}`);
      
      for (const song of searchResult.response) {
        if (song.id === id && song.streaming_url) {
          const response = await axios.get(song.streaming_url, { responseType: 'stream' });
          res.set({
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-cache',
            'Content-Disposition': `inline; filename="${song.title}.mp3"`
          });
          response.data.pipe(res);
          return;
        }
      }
    } catch (error) {
      console.error('Error finding song for streaming:', error);
    }
    
    res.status(404).json({ error: 'Stream not available. Try searching for the song again.' });
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({ error: 'Streaming failed', details: String(error) });
  }
});

// Quick play endpoint
completeMusicRouter.get('/quick-play', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchResult = await completeMusicAPI.comprehensiveSearch(query);
    
    if (searchResult.response.length === 0) {
      return res.status(404).json({ error: 'No songs found for quick play' });
    }
    
    // Find first song with streaming URL
    const firstStreamableSong = searchResult.response.find(song => song.streaming_url);
    
    if (!firstStreamableSong) {
      return res.status(404).json({ error: 'No streamable songs found' });
    }
    
    // Stream the first result
    if (firstStreamableSong.id.startsWith("youtube_")) {
      const youtubeId = firstStreamableSong.id.replace("youtube_", "");
      const streamUrl = await completeMusicAPI.getYouTubeStreamUrl(youtubeId);
      
      if (streamUrl) {
        const response = await axios.get(streamUrl, { responseType: 'stream' });
        res.set({
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache'
        });
        response.data.pipe(res);
        return;
      }
    } else if (firstStreamableSong.streaming_url) {
      const response = await axios.get(firstStreamableSong.streaming_url, { responseType: 'stream' });
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache'
      });
      response.data.pipe(res);
      return;
    }
    
    res.status(404).json({ error: 'Quick play streaming failed' });
  } catch (error) {
    console.error('Quick play error:', error);
    res.status(500).json({ error: 'Quick play failed', details: String(error) });
  }
});