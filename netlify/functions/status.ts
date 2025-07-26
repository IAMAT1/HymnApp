import { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

    // For Netlify, return ready status for immediate playback
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        video_id: videoId,
        ready: true,
        progress: 100,
        stream_url: `/.netlify/functions/stream?v=${videoId}`
      })
    };

  } catch (error) {
    console.error("Status endpoint error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Status check failed" })
    };
  }
};