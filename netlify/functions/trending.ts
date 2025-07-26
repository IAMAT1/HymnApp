import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Return curated trending music
    const trendingMusic = [
      // Karan Aujla hits
      {
        id: 'trending_pFgQNBqawFo',
        title: 'Try Me',
        artist: 'Karan Aujla',
        albumArt: 'https://i.ytimg.com/vi/pFgQNBqawFo/maxresdefault.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=pFgQNBqawFo',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'pFgQNBqawFo',
        album: 'Trending Collection',
        year: 2024,
        genre: 'Punjabi'
      },
      {
        id: 'trending_ycGP6MW5w2A',
        title: 'Softly',
        artist: 'Karan Aujla',
        albumArt: 'https://i.ytimg.com/vi/ycGP6MW5w2A/maxresdefault.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=ycGP6MW5w2A',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'ycGP6MW5w2A',
        album: 'Trending Collection',
        year: 2024,
        genre: 'Punjabi'
      },
      // Arijit Singh hits
      {
        id: 'trending_LfnRhbDuGWs',
        title: 'Tum Hi Ho',
        artist: 'Arijit Singh',
        albumArt: 'https://i.ytimg.com/vi/LfnRhbDuGWs/maxresdefault.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=LfnRhbDuGWs',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'LfnRhbDuGWs',
        album: 'Trending Collection',
        year: 2024,
        genre: 'Bollywood'
      },
      {
        id: 'trending_bzSTpdcs-EI',
        title: 'Channa Mereya',
        artist: 'Arijit Singh',
        albumArt: 'https://i.ytimg.com/vi/bzSTpdcs-EI/maxresdefault.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=bzSTpdcs-EI',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'bzSTpdcs-EI',
        album: 'Trending Collection',
        year: 2024,
        genre: 'Bollywood'
      },
      // International hits
      {
        id: 'trending_JGwWNGJdvx8',
        title: 'Shape of You',
        artist: 'Ed Sheeran',
        albumArt: 'https://i.ytimg.com/vi/JGwWNGJdvx8/maxresdefault.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=JGwWNGJdvx8',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'JGwWNGJdvx8',
        album: 'Trending Collection',
        year: 2024,
        genre: 'Pop'
      },
      {
        id: 'trending_ygr5AHufBN4',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        albumArt: 'https://i.ytimg.com/vi/ygr5AHufBN4/maxresdefault.jpg',
        duration: 0,
        streamingUrl: 'https://youtube.com/watch?v=ygr5AHufBN4',
        quality: 'High Quality',
        source: 'Trending',
        youtube_id: 'ygr5AHufBN4',
        album: 'Trending Collection',
        year: 2024,
        genre: 'Pop'
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        response: trendingMusic
      })
    };

  } catch (error) {
    console.error('Trending music error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch trending music' })
    };
  }
};
