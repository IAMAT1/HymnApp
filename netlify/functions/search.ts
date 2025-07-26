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

  const { q: query } = event.queryStringParameters || {};

  if (!query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Query parameter "q" is required' })
    };
  }

  try {
    // Basic music search - return subset of complete music search results
    const searchTerm = query.toLowerCase().trim();
    
    // Basic artist database for search
    const basicResults = [
      // Karan Aujla
      { id: 'ka_try_me', title: 'Try Me', artist: 'Karan Aujla', videoId: 'pFgQNBqawFo', genre: 'Punjabi' },
      { id: 'ka_softly', title: 'Softly', artist: 'Karan Aujla', videoId: 'ycGP6MW5w2A', genre: 'Punjabi' },
      
      // Arijit Singh
      { id: 'as_tum_hi_ho', title: 'Tum Hi Ho', artist: 'Arijit Singh', videoId: 'LfnRhbDuGWs', genre: 'Bollywood' },
      { id: 'as_channa_mereya', title: 'Channa Mereya', artist: 'Arijit Singh', videoId: 'bzSTpdcs-EI', genre: 'Bollywood' },
      
      // Divine
      { id: 'divine_farak', title: 'Farak', artist: 'Divine', videoId: 'keLt6PoIFz0', genre: 'Hip-Hop' },
      
      // International
      { id: 'ed_shape_of_you', title: 'Shape of You', artist: 'Ed Sheeran', videoId: 'JGwWNGJdvx8', genre: 'Pop' },
      { id: 'weeknd_blinding_lights', title: 'Blinding Lights', artist: 'The Weeknd', videoId: 'ygr5AHufBN4', genre: 'Pop' }
    ];

    // Filter results based on search
    let results = basicResults.filter(song => 
      song.title.toLowerCase().includes(searchTerm) ||
      song.artist.toLowerCase().includes(searchTerm) ||
      song.genre.toLowerCase().includes(searchTerm)
    );

    // If no results, return all (basic search fallback)
    if (results.length === 0) {
      results = basicResults.slice(0, 5);
    }

    // Convert to API format
    const apiResults = results.slice(0, 10).map(song => ({
      id: song.id,
      title: song.title,
      artists: [{ name: song.artist }],
      subtitle: song.artist,
      image: `https://i.ytimg.com/vi/${song.videoId}/maxresdefault.jpg`,
      duration: 0,
      streaming_url: `https://youtube.com/watch?v=${song.videoId}`,
      quality: 'High Quality',
      source: 'Basic Search',
      youtube_id: song.videoId
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        response: apiResults,
        total: apiResults.length,
        query: query
      })
    };

  } catch (error) {
    console.error('Basic search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to search music' })
    };
  }
};
