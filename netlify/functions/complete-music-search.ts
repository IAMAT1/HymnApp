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
    const limit = parseInt(event.queryStringParameters?.limit || '20');
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Query parameter required' })
      };
    }

    console.log('Starting comprehensive search for:', `'${query}'`);

    // Define working endpoints - prioritizing JioSaavn
    const endpoints = [
      { name: 'saavn_primary', url: 'https://saavn.dev/api' },
      { name: 'saavn_backup', url: 'https://jiosaavn.me/api.php' }
    ];

    let workingEndpoint = null;
    
    // Find a working JioSaavn endpoint
    for (const endpoint of endpoints) {
      try {
        const testResponse = await fetch(`${endpoint.url}/search/songs?query=test&page=1&limit=1`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MusicBot/1.0)' }
        });
        if (testResponse.ok) {
          workingEndpoint = endpoint;
          console.log(`Using working endpoint: ${endpoint.name} - ${endpoint.url}`);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    let results = [];

    if (workingEndpoint) {
      // Search JioSaavn
      try {
        const saavnUrl = `${workingEndpoint.url}/search/songs?query=${encodeURIComponent(query)}&page=1&limit=${limit}`;
        const saavnResponse = await fetch(saavnUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MusicBot/1.0)' }
        });
        
        if (saavnResponse.ok) {
          const saavnData = await saavnResponse.json();
          
          if (saavnData.data?.results?.length > 0) {
            const saavnSongs = saavnData.data.results.map((song: any) => ({
              id: song.id || song.perma_url || Math.random().toString(36),
              title: song.name || song.title || 'Unknown Title',
              artist: song.primaryArtists || song.artists || song.subtitle || 'Unknown Artist',
              album: song.album?.name || song.album || 'Unknown Album',
              duration: song.duration || '0:00',
              image: song.image?.[2]?.link || song.image || '',
              url: song.downloadUrl?.[4]?.link || song.media_url || '',
              source: 'JioSaavn',
              year: song.year || song.releaseDate || ''
            }));
            
            results.push(...saavnSongs);
          }
        }
      } catch (error) {
        console.log('JioSaavn search failed:', error.message);
      }
    }

    // Add YouTube search as fallback
    if (results.length < 5) {
      try {
        const youtubeQuery = `${query} official audio`;
        const ytResponse = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(youtubeQuery)}&filter=videos`);
        
        if (ytResponse.ok) {
          const ytData = await ytResponse.json();
          if (ytData.items?.length > 0) {
            const ytSongs = ytData.items.slice(0, 10).map((video: any) => ({
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
        }
      } catch (error) {
        console.log('YouTube search failed:', error.message);
      }
    }

    // Remove duplicates and limit results
    const uniqueResults = results.filter((song, index, self) => 
      index === self.findIndex(s => s.title.toLowerCase() === song.title.toLowerCase())
    ).slice(0, limit);

    console.log(`Found ${uniqueResults.length} unique songs for '${query}'`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        response: uniqueResults
      })
    };

  } catch (error) {
    console.error('Comprehensive music search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to search music' })
    };
  }
};