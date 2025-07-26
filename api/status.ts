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
    const { v: videoId } = req.query;
    
    if (!videoId || typeof videoId !== 'string') {
      return res.status(400).json({ error: 'Video ID is required' });
    }
    
    console.log('Status request for video ID:', videoId);
    
    // Return estimated total duration (15s + 3*30s = 105s for 4 segments)
    const totalDuration = 105;
    
    res.json({
      videoId,
      totalSegments: 4,
      totalDuration: totalDuration,
      segmentDurations: [15, 30, 30, 30]
    });
    
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ 
      error: "Status check failed",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}