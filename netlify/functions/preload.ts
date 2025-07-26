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

  if (event.httpMethod !== 'POST') {
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

    // For Netlify, we'll simulate preload success
    // The actual preloading will be handled by the backend
    console.log(`Preload request for video ID: ${videoId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        video_id: videoId,
        message: 'Preload initiated'
      })
    };

  } catch (error) {
    console.error("Preload endpoint error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Preload failed" })
    };
  }
};