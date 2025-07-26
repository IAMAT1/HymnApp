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
    const limit = req.query.limit || '10';
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}&limit=${limit}&hidebroken=true`);
    
    if (!response.ok) {
      throw new Error(`Radio API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    console.error('Radio API proxy error:', error);
    res.status(500).json({ error: 'Failed to search radio stations' });
  }
}