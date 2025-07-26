import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    console.log('Pre-loading song for video ID:', videoId);
    
    // Trigger backend processing without waiting for completion
    const streamUrl = `https://implement-franchise-becoming-set.trycloudflare.com/stream?v=${videoId}`;
    
    // Make a quick HEAD request to wake up the backend
    fetch(streamUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(1000) // 1 second timeout for quick trigger
    }).catch(() => {
      // Ignore errors, this is just to trigger processing
      console.log('Preload trigger sent for:', videoId);
    });

    res.json({ success: true, message: 'Preload triggered', videoId });
  } catch (error) {
    console.error('Preload error:', error);
    res.status(500).json({ error: 'Preload failed' });
  }
}