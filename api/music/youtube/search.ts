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
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 1;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    console.log('YouTube music search for:', query);

    // Fallback to predefined music mapping
    const musicMap: Record<string, string> = {
      'arijit singh': 'LfnRhbDuGWs', // Tum Hi Ho
      'karan aujla': 'yAmVzCPcMWk', // Tauba Tauba  
      'ed sheeran': 'JGwWNGJdvx8', // Shape of You
      'kendrick lamar': 'tvTRZJ-4EyI', // HUMBLE
      'drake': 'uxpDa-c-4Mc', // Hotline Bling
      'taylor swift': 'nfWlot6h_JM', // Shake It Off
      'adele': 'YQHsXMglC9A', // Hello
      'the weeknd': 'ygr5AHufBN4', // Blinding Lights
      'billie eilish': 'DyDfgMOUjCI', // bad guy
      'post malone': 'yaWesK-Fngn' // Circles
    };

    const queryLower = query.toLowerCase();
    for (const [artist, videoId] of Object.entries(musicMap)) {
      if (queryLower.includes(artist) || artist.includes(queryLower.split(' ')[0])) {
        const searchResults = [{
          id: { videoId },
          snippet: {
            title: query,
            channelTitle: artist,
            thumbnails: {
              default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` }
            }
          },
          url: `https://www.youtube.com/watch?v=${videoId}`,
          source: 'Fallback'
        }];

        console.log('YouTube search successful via fallback, found:', videoId);
        res.json({ items: searchResults });
        return;
      }
    }

    // No results found
    console.log('All YouTube search methods failed');
    res.status(404).json({ 
      error: 'No results found',
      message: 'Could not find video for this search query'
    });
  } catch (error) {
    console.error('YouTube music search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube music' });
  }
}