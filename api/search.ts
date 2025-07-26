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
    
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    // Cache for searches
    const searchTimeout = 5000; // 5 second timeout per search method

    // Try multiple YouTube search methods in order with timeout
    let videoId = null;

    // Method 1: Try Piped API (reliable public instance) with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), searchTimeout);
      
      const pipedResponse = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (pipedResponse.ok) {
        const data = await pipedResponse.json();
        if (data.items && data.items.length > 0) {
          const firstVideo = data.items[0];
          if (firstVideo.url) {
            videoId = firstVideo.url.replace('/watch?v=', '');
            console.log('Found via Piped API:', videoId);
          }
        }
      }
    } catch (pipedError) {
      console.log('Piped API failed:', (pipedError as Error).message);
    }

    // Method 2: Try InnerTube API alternative with timeout
    if (!videoId) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), searchTimeout);
        
        const innertubeResponse = await fetch('https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20241201'
              }
            },
            query: query
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (innertubeResponse.ok) {
          const data = await innertubeResponse.json();
          if (data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents) {
            const results = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
            for (const section of results) {
              if (section.itemSectionRenderer?.contents) {
                for (const item of section.itemSectionRenderer.contents) {
                  if (item.videoRenderer?.videoId) {
                    videoId = item.videoRenderer.videoId;
                    console.log('Found via InnerTube API:', videoId);
                    break;
                  }
                }
                if (videoId) break;
              }
            }
          }
        }
      } catch (innertubeError) {
        console.log('InnerTube API failed:', (innertubeError as Error).message);
      }
    }

    if (videoId && videoId.length === 11) {
      res.json({ video_id: videoId });
    } else {
      res.status(500).json({ error: "No video found" });
    }

  } catch (error) {
    console.error("Search endpoint error:", error);
    res.status(500).json({ error: "Search failed" });
  }
}