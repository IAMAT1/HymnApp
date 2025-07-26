import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range',
    'Access-Control-Max-Age': '86400',
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
    const videoId = event.queryStringParameters?.v;
    
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Video ID parameter 'v' is required" })
      };
    }

    // Validate video ID format (YouTube video IDs are 11 characters)
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid video ID format" })
      };
    }

    console.log(`Stream request for video ID: ${videoId}`);

    // For Netlify, we'll redirect to direct backend stream
    const BACKEND_URL = 'https://implement-franchise-becoming-set.trycloudflare.com';
    const directUrl = `${BACKEND_URL}/stream?v=${videoId}`;
    
    // Return redirect response
    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Location': directUrl,
        'Cache-Control': 'public, max-age=86400'
      }
    };

  } catch (error) {
    console.error("Stream endpoint error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Stream failed" })
    };
  }
};