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
    const limit = req.query.limit || '25';
    
    const response = await fetch(`https://api.deezer.com/chart/0/tracks?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Deezer charts error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Deezer charts proxy error:', error);
    res.status(500).json({ error: 'Failed to get Deezer charts' });
  }
}