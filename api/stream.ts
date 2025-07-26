import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const videoId = req.query.v as string;
    
    if (!videoId) {
      return res.status(400).json({ error: "Video ID parameter 'v' is required" });
    }

    // Validate video ID format (YouTube video IDs are 11 characters)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return res.status(400).json({ error: "Invalid video ID format" });
    }

    console.log(`Stream request for video ID: ${videoId}`);

    // For Vercel, we'll use direct streaming from external backend
    const BACKEND_URL = 'https://implement-franchise-becoming-set.trycloudflare.com';
    const directUrl = `${BACKEND_URL}/stream?v=${videoId}`;
    
    try {
      // Create a fetch request to the backend
      const backendResponse = await fetch(directUrl, {
        headers: {
          'Range': req.headers.range || ''
        }
      });

      if (!backendResponse.ok) {
        throw new Error(`Backend responded with ${backendResponse.status}`);
      }

      // Copy headers from backend response
      const contentType = backendResponse.headers.get('content-type') || 'audio/mp4';
      const contentLength = backendResponse.headers.get('content-length');
      const acceptRanges = backendResponse.headers.get('accept-ranges');
      const contentRange = backendResponse.headers.get('content-range');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', acceptRanges || 'bytes');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
        res.status(206); // Partial content
      }

      // Stream the response
      if (backendResponse.body) {
        const reader = backendResponse.body.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (streamError) {
          console.error('Streaming error:', streamError);
          res.end();
        }
      } else {
        res.status(500).json({ error: 'No response body from backend' });
      }

    } catch (proxyError) {
      console.log('Direct proxy failed, trying redirect:', (proxyError as Error).message);
      // Fallback to redirect
      res.redirect(302, directUrl);
    }

  } catch (error) {
    console.error("Stream endpoint error:", error);
    res.status(500).json({ error: "Stream failed" });
  }
}