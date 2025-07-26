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
    const query = event.queryStringParameters?.q;
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query parameter required' })
      };
    }

    console.log('YouTube music search for:', query);

    // Search YouTube for music
    const youtubeQuery = `${query} official audio`;
    const ytResponse = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(youtubeQuery)}&filter=videos`);
    
    if (!ytResponse.ok) {
      throw new Error('YouTube search failed');
    }

    const ytData = await ytResponse.json();
    const results = [];

    if (ytData.items?.length > 0) {
      const ytSongs = ytData.items.slice(0, 20).map((video: any) => ({
        id: video.url?.replace('/watch?v=', '') || Math.random().toString(36),
        title: video.title || 'Unknown Title',
        artist: video.uploaderName || 'Unknown Artist',
        album: 'YouTube',
        duration: video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '0:00',
        image: video.thumbnail || '',
        url: `https://www.youtube.com/watch?v=${video.url?.replace('/watch?v=', '')}`,
        source: 'YouTube',
        year: new Date(video.uploadedDate || Date.now()).getFullYear().toString()
      }));
      
      results.push(...ytSongs);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results)
    };

  } catch (error) {
    console.error('YouTube music search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to search YouTube music' })
    };
  }
};