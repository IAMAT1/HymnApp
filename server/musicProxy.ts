import express from 'express';

const router = express.Router();

// Proxy for Deezer API to handle CORS
router.get('/deezer/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit || '50';
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Deezer API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Add CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json(data);
  } catch (error) {
    console.error('Deezer proxy error:', error);
    res.status(500).json({ error: 'Failed to search Deezer' });
  }
});

// Proxy for Deezer charts
router.get('/deezer/charts', async (req, res) => {
  try {
    const limit = req.query.limit || '25';
    
    const response = await fetch(`https://api.deezer.com/chart/0/tracks?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Deezer charts error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json(data);
  } catch (error) {
    console.error('Deezer charts proxy error:', error);
    res.status(500).json({ error: 'Failed to get Deezer charts' });
  }
});

// Proxy for Jamendo API (Creative Commons music)
router.get('/jamendo/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit || '20';
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Use the free Jamendo API (no client_id needed for basic searches)
    const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?format=json&limit=${limit}&search=${encodeURIComponent(query)}&include=musicinfo`);
    
    if (!response.ok) {
      throw new Error(`Jamendo API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json(data);
  } catch (error) {
    console.error('Jamendo proxy error:', error);
    res.status(500).json({ error: 'Failed to search Jamendo' });
  }
});

// Proxy for Radio Browser API (live radio streams)
router.get('/radio/search', async (req, res) => {
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
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json(data);
  } catch (error) {
    console.error('Radio API proxy error:', error);
    res.status(500).json({ error: 'Failed to search radio stations' });
  }
});

// Free Music Archive proxy
router.get('/freemusicarchive/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit || '20';
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Search Free Music Archive
    const response = await fetch(`https://freemusicarchive.org/api/get/tracks.json?q=${encodeURIComponent(query)}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`FMA API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json(data);
  } catch (error) {
    console.error('FMA proxy error:', error);
    res.status(500).json({ error: 'Failed to search Free Music Archive' });
  }
});

// YouTube Music search proxy (for metadata only)
router.get('/youtube/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit || '20';
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // Use Piped API as YouTube proxy
    const response = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`);
    
    if (!response.ok) {
      throw new Error(`YouTube search error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json(data);
  } catch (error) {
    console.error('YouTube search proxy error:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// SoundCloud proxy (for discovery)
router.get('/soundcloud/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit || '20';
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    // SoundCloud public API (limited but functional)
    const response = await fetch(`https://api.soundcloud.com/tracks?q=${encodeURIComponent(query)}&limit=${limit}&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`);
    
    if (!response.ok) {
      throw new Error(`SoundCloud API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    res.json(data);
  } catch (error) {
    console.error('SoundCloud proxy error:', error);
    res.status(500).json({ error: 'Failed to search SoundCloud' });
  }
});

// Health check for all music services
router.get('/health', async (req, res) => {
  const services = {
    deezer: false,
    jamendo: false,
    radio: false,
    freemusicarchive: false,
    youtube: false,
    soundcloud: false
  };

  // Test all services
  try {
    const deezerTest = await fetch('https://api.deezer.com/search?q=test&limit=1');
    services.deezer = deezerTest.ok;
  } catch {}

  try {
    const jamendoTest = await fetch('https://api.jamendo.com/v3.0/tracks/?format=json&limit=1');
    services.jamendo = jamendoTest.ok;
  } catch {}

  try {
    const radioTest = await fetch('https://de1.api.radio-browser.info/json/stations/search?limit=1');
    services.radio = radioTest.ok;
  } catch {}

  try {
    const fmaTest = await fetch('https://freemusicarchive.org/api/get/tracks.json?limit=1');
    services.freemusicarchive = fmaTest.ok;
  } catch {}

  try {
    const youtubeTest = await fetch('https://pipedapi.kavin.rocks/search?q=test&filter=music_songs');
    services.youtube = youtubeTest.ok;
  } catch {}

  try {
    const soundcloudTest = await fetch('https://api.soundcloud.com/tracks?q=test&limit=1&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX');
    services.soundcloud = soundcloudTest.ok;
  } catch {}

  res.header('Access-Control-Allow-Origin', '*');
  res.json({
    services,
    healthy: Object.values(services).some(status => status)
  });
});

export default router;