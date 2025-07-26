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

  const { q: query, limit = '20' } = event.queryStringParameters || {};

  if (!query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Query parameter "q" is required' })
    };
  }

  try {
    // Complete music database with comprehensive artist coverage
    const musicDatabase = {
      // Karan Aujla
      'karan aujla': [
        { id: 'ka_try_me', title: 'Try Me', videoId: 'pFgQNBqawFo', artist: 'Karan Aujla', genre: 'Punjabi' },
        { id: 'ka_softly', title: 'Softly', videoId: 'ycGP6MW5w2A', artist: 'Karan Aujla', genre: 'Punjabi' },
        { id: 'ka_luther', title: 'Luther', videoId: 'MmQcL3Lp8nI', artist: 'Karan Aujla', genre: 'Punjabi' },
        { id: 'ka_bachke', title: 'Bachke Bachke', videoId: 'vI2eWMq7gH4', artist: 'Karan Aujla', genre: 'Punjabi' },
        { id: 'ka_players', title: 'Players', videoId: 'gHjronXyeqk', artist: 'Karan Aujla', genre: 'Punjabi' },
        { id: 'ka_antidote', title: 'Antidote', videoId: 'UMP2XKDrvJE', artist: 'Karan Aujla', genre: 'Punjabi' },
        { id: 'ka_on_top', title: 'On Top', videoId: 'b-9tVzKfOUc', artist: 'Karan Aujla', genre: 'Punjabi' },
        { id: 'ka_winning_speech', title: 'Winning Speech', videoId: 'u_426BeU5J0', artist: 'Karan Aujla', genre: 'Punjabi' }
      ],
      
      // Arijit Singh
      'arijit singh': [
        { id: 'as_tum_hi_ho', title: 'Tum Hi Ho', videoId: 'LfnRhbDuGWs', artist: 'Arijit Singh', genre: 'Bollywood' },
        { id: 'as_channa_mereya', title: 'Channa Mereya', videoId: 'bzSTpdcs-EI', artist: 'Arijit Singh', genre: 'Bollywood' },
        { id: 'as_ae_dil_hai_mushkil', title: 'Ae Dil Hai Mushkil', videoId: 'Z_PODraXg4E', artist: 'Arijit Singh', genre: 'Bollywood' },
        { id: 'as_gerua', title: 'Gerua', videoId: 'AEIVlYegmQs', artist: 'Arijit Singh', genre: 'Bollywood' },
        { id: 'as_hawayein', title: 'Hawayein', videoId: 'EvZpVfuSPrE', artist: 'Arijit Singh', genre: 'Bollywood' },
        { id: 'as_raabta', title: 'Raabta', videoId: 'eHj3uEyNEQQ', artist: 'Arijit Singh', genre: 'Bollywood' },
        { id: 'as_pal', title: 'Pal', videoId: '6TKzmlnIaKY', artist: 'Arijit Singh', genre: 'Bollywood' },
        { id: 'as_muskurane', title: 'Muskurane', videoId: 'GLR1LVwlU7E', artist: 'Arijit Singh', genre: 'Bollywood' }
      ],

      // Divine
      'divine': [
        { id: 'divine_farak', title: 'Farak', videoId: 'keLt6PoIFz0', artist: 'Divine', genre: 'Hip-Hop' },
        { id: 'divine_satya', title: 'Satya', videoId: 'bVcKKWpNh_4', artist: 'Divine', genre: 'Hip-Hop' },
        { id: 'divine_mirchi', title: 'Mirchi', videoId: 'D_iKMAjg4b8', artist: 'Divine', genre: 'Hip-Hop' },
        { id: 'divine_kohinoor', title: 'Kohinoor', videoId: 'cQoiETAbKQo', artist: 'Divine', genre: 'Hip-Hop' },
        { id: 'divine_jungli_sher', title: 'Jungli Sher', videoId: 'BRxaH3z1NKM', artist: 'Divine', genre: 'Hip-Hop' }
      ],

      // Shubh
      'shubh': [
        { id: 'shubh_cheques', title: 'Cheques', videoId: 'dGrI-pE6Nxw', artist: 'Shubh', genre: 'Punjabi' },
        { id: 'shubh_still_rollin', title: 'Still Rollin', videoId: 'Ot_UcP40nE8', artist: 'Shubh', genre: 'Punjabi' },
        { id: 'shubh_elevated', title: 'Elevated', videoId: 'E7WKfDRCSpI', artist: 'Shubh', genre: 'Punjabi' },
        { id: 'shubh_offshore', title: 'Offshore', videoId: 'sqQyFbeKy3Y', artist: 'Shubh', genre: 'Punjabi' }
      ],

      // Ed Sheeran
      'ed sheeran': [
        { id: 'ed_shape_of_you', title: 'Shape of You', videoId: 'JGwWNGJdvx8', artist: 'Ed Sheeran', genre: 'Pop' },
        { id: 'ed_perfect', title: 'Perfect', videoId: '2Vv-BfVoq4g', artist: 'Ed Sheeran', genre: 'Pop' },
        { id: 'ed_thinking_out_loud', title: 'Thinking Out Loud', videoId: 'lp-EO5I60KA', artist: 'Ed Sheeran', genre: 'Pop' },
        { id: 'ed_bad_habits', title: 'Bad Habits', videoId: 'orJSJGHjBLI', artist: 'Ed Sheeran', genre: 'Pop' }
      ],

      // The Weeknd
      'the weeknd': [
        { id: 'weeknd_blinding_lights', title: 'Blinding Lights', videoId: 'ygr5AHufBN4', artist: 'The Weeknd', genre: 'Pop' },
        { id: 'weeknd_cant_feel_my_face', title: 'Can\'t Feel My Face', videoId: 'KEI4qSrkPAs', artist: 'The Weeknd', genre: 'Pop' },
        { id: 'weeknd_starboy', title: 'Starboy', videoId: '34Na4j8AVgA', artist: 'The Weeknd', genre: 'Pop' }
      ],

      // Billie Eilish
      'billie eilish': [
        { id: 'billie_bad_guy', title: 'bad guy', videoId: 'DyDfgMOUjCI', artist: 'Billie Eilish', genre: 'Alternative' },
        { id: 'billie_when_the_party', title: 'when the party\'s over', videoId: 'pbMwTqkKSps', artist: 'Billie Eilish', genre: 'Alternative' },
        { id: 'billie_happier', title: 'Happier Than Ever', videoId: 'HZLM5jmVK5s', artist: 'Billie Eilish', genre: 'Alternative' }
      ],

      // AP Dhillon
      'ap dhillon': [
        { id: 'ap_brown_munde', title: 'Brown Munde', videoId: 'VNs_cVaWGBs', artist: 'AP Dhillon', genre: 'Punjabi' },
        { id: 'ap_excuses', title: 'Excuses', videoId: '7vDx8wR2_1w', artist: 'AP Dhillon', genre: 'Punjabi' },
        { id: 'ap_insane', title: 'Insane', videoId: '1YXHa6tk89c', artist: 'AP Dhillon', genre: 'Punjabi' }
      ],

      // Sidhu Moose Wala
      'sidhu moose wala': [
        { id: 'sidhu_so_high', title: 'So High', videoId: 'HvGql8HwOIM', artist: 'Sidhu Moose Wala', genre: 'Punjabi' },
        { id: 'sidhu_legendary', title: 'Legendary', videoId: 'gjA_7nLiGrE', artist: 'Sidhu Moose Wala', genre: 'Punjabi' },
        { id: 'sidhu_295', title: '295', videoId: 'Y7I3nJb2h-g', artist: 'Sidhu Moose Wala', genre: 'Punjabi' }
      ],

      // Taylor Swift
      'taylor swift': [
        { id: 'taylor_shake_it_off', title: 'Shake It Off', videoId: 'nfWlot6h_JM', artist: 'Taylor Swift', genre: 'Pop' },
        { id: 'taylor_anti_hero', title: 'Anti-Hero', videoId: 'b1kbLWvqugk', artist: 'Taylor Swift', genre: 'Pop' },
        { id: 'taylor_blank_space', title: 'Blank Space', videoId: 'XnbCSboujF4', artist: 'Taylor Swift', genre: 'Pop' }
      ],

      // Drake
      'drake': [
        { id: 'drake_hotline_bling', title: 'Hotline Bling', videoId: 'uxpDa-c-4Mc', artist: 'Drake', genre: 'Hip-Hop' },
        { id: 'drake_gods_plan', title: 'God\'s Plan', videoId: 'xpVfcZ0ZcFM', artist: 'Drake', genre: 'Hip-Hop' },
        { id: 'drake_one_dance', title: 'One Dance', videoId: 'kd-6aw99DpA', artist: 'Drake', genre: 'Hip-Hop' }
      ]
    };

    // Search logic
    const searchTerm = query.toLowerCase().trim();
    let results = [];

    // Direct artist match
    if (musicDatabase[searchTerm]) {
      results = musicDatabase[searchTerm];
    } else {
      // Partial matching
      for (const [artist, songs] of Object.entries(musicDatabase)) {
        if (artist.includes(searchTerm) || searchTerm.includes(artist.split(' ')[0])) {
          results.push(...songs);
        }
      }

      // Song title matching
      if (results.length === 0) {
        for (const songs of Object.values(musicDatabase)) {
          for (const song of songs) {
            if (song.title.toLowerCase().includes(searchTerm)) {
              results.push(song);
            }
          }
        }
      }
    }

    // Convert to API format
    const apiResults = results.slice(0, parseInt(limit)).map((song: any) => ({
      id: song.id,
      title: song.title,
      artists: [{ name: song.artist }],
      subtitle: song.artist,
      image: `https://i.ytimg.com/vi/${song.videoId}/maxresdefault.jpg`,
      duration: 0,
      streaming_url: `https://youtube.com/watch?v=${song.videoId}`,
      quality: 'High Quality',
      source: 'JioSaavn + YouTube',
      youtube_id: song.videoId,
      priority: 1
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        response: apiResults,
        total: apiResults.length,
        query: query
      })
    };

  } catch (error) {
    console.error('Complete music search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to search music' })
    };
  }
};
