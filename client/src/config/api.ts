// API Configuration
export const API_CONFIG = {
  // iTunes Search API for metadata
  ITUNES_API_URL: 'https://itunes.apple.com/search',
  
  // Alternative YouTube search API endpoints
  YOUTUBE_SEARCH_APIS: [
    'https://yt.lemnoslife.com/noKey/search',
    'https://pipedapi.kavin.rocks/search',
    'https://pipedapi.adminforge.de/search'
  ],
  
  // Local backend URL for streaming
  BACKEND_URL: window.location.origin,
  
  // Request timeout in milliseconds
  TIMEOUT: 30000,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Helper function to build iTunes Search API URLs
export function buildItunesUrl(params: Record<string, string>): string {
  const url = new URL(API_CONFIG.ITUNES_API_URL);
  
  // Add default parameters
  url.searchParams.append('entity', 'song');
  url.searchParams.append('limit', '50');
  url.searchParams.append('media', 'music');
  
  // Add custom parameters
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  return url.toString();
}

// Helper function to build YouTube search URLs with CORS proxy
export function buildYouTubeSearchUrls(trackName: string, artistName: string): string[] {
  const query = `${trackName} ${artistName}`;
  
  // Multiple CORS proxy options
  const corsProxies = [
    'https://api.allorigins.win/raw?url=',
    'https://proxy.cors.sh/',
    'https://cors-anywhere.herokuapp.com/'
  ];
  
  const urls: string[] = [];
  
  // Try each API with different CORS proxies
  API_CONFIG.YOUTUBE_SEARCH_APIS.forEach(apiUrl => {
    corsProxies.forEach(corsProxy => {
      let targetUrl: string;
      
      // Different APIs might have different parameter names
      if (apiUrl.includes('lemnoslife')) {
        const url = new URL(apiUrl);
        url.searchParams.append('query', query);
        url.searchParams.append('type', 'video');
        targetUrl = url.toString();
      } else if (apiUrl.includes('piped')) {
        const url = new URL(apiUrl);
        url.searchParams.append('q', query);
        url.searchParams.append('filter', 'videos');
        targetUrl = url.toString();
      } else {
        targetUrl = apiUrl;
      }
      
      // Add CORS proxy
      urls.push(`${corsProxy}${encodeURIComponent(targetUrl)}`);
    });
  });
  
  return urls;
}

// Helper function to build local backend streaming URLs
export function buildStreamUrl(videoId: string): string {
  const url = new URL('/.netlify/functions/stream', API_CONFIG.BACKEND_URL);
  url.searchParams.append('v', videoId);
  return url.toString();
}

// Helper function for API requests with timeout and retry
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  retryCount = 0,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    // Retry logic
    if (
      retryCount < API_CONFIG.RETRY_ATTEMPTS &&
      error instanceof Error &&
      error.name !== "AbortError"
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, API_CONFIG.RETRY_DELAY),
      );
      return apiRequest<T>(url, options, retryCount + 1);
    }

    throw error;
  }
}
