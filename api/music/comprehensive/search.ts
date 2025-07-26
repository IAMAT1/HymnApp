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
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    console.log('Comprehensive music search for:', query);

    // For now, redirect to existing APIs and let frontend handle the logic
    // This ensures the comprehensive music service works properly
    res.json({
      success: false,
      results: [],
      total: 0,
      message: 'Use frontend comprehensive music service directly',
      source: 'Backend'
    });
  } catch (error) {
    console.error('Comprehensive music search error:', error);
    res.status(500).json({ error: 'Failed to search music' });
  }
}