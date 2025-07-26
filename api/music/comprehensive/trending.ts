import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Getting trending music from comprehensive API');

    // Return curated trending songs
    const trendingSongs = [
      // Karan Aujla
      {
        id: 'trending_karan_1',
        title: 'Try Me',
        artist: 'Karan Aujla',
        albumArt: 'https://i.ytimg.com/vi/pFgQNBqawFo/default.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=pFgQNBqawFo',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'pFgQNBqawFo',
        album: 'Karan Aujla Collection',
        year: 2024,
        genre: 'Punjabi'
      },
      {
        id: 'trending_karan_2',
        title: 'Softly',
        artist: 'Karan Aujla',
        albumArt: 'https://i.ytimg.com/vi/ycGP6MW5w2A/default.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=ycGP6MW5w2A',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'ycGP6MW5w2A',
        album: 'Karan Aujla Collection',
        year: 2024,
        genre: 'Punjabi'
      },
      // Arijit Singh
      {
        id: 'trending_arijit_1',
        title: 'Tum Hi Ho',
        artist: 'Arijit Singh',
        albumArt: 'https://i.ytimg.com/vi/LfnRhbDuGWs/default.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=LfnRhbDuGWs',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'LfnRhbDuGWs',
        album: 'Arijit Singh Collection',
        year: 2024,
        genre: 'Bollywood'
      },
      {
        id: 'trending_arijit_2',
        title: 'Channa Mereya',
        artist: 'Arijit Singh',
        albumArt: 'https://i.ytimg.com/vi/bzSTpdcs-EI/default.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=bzSTpdcs-EI',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'bzSTpdcs-EI',
        album: 'Arijit Singh Collection',
        year: 2024,
        genre: 'Bollywood'
      },
      // International
      {
        id: 'trending_ed_1',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        albumArt: 'https://i.ytimg.com/vi/JGwWNGJdvx8/default.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=JGwWNGJdvx8',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'JGwWNGJdvx8',
        album: 'Popular Collection',
        year: 2024,
        genre: 'Pop'
      },
      {
        id: 'trending_weeknd_1',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        albumArt: 'https://i.ytimg.com/vi/ygr5AHufBN4/default.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=ygr5AHufBN4',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'ygr5AHufBN4',
        album: 'Popular Collection',
        year: 2024,
        genre: 'Pop'
      }
    ];
    
    res.json({
      success: true,
      results: trendingSongs,
      total: trendingSongs.length,
      source: 'ComprehensiveTrending'
    });
  } catch (error) {
    console.error('Comprehensive trending error:', error);
    res.status(500).json({ error: 'Failed to get trending music' });
  }
}