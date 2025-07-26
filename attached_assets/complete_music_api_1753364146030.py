import asyncio
import httpx
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import re
from typing import List, Dict, Optional
from difflib import SequenceMatcher
import yt_dlp

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Complete Music API Server", 
    description="All-in-One Music Streaming with Multiple Sources",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompleteMusicClient:
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            verify=False,
            follow_redirects=True,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        )
        
        # Multiple API endpoints for redundancy
        self.apis = {
            'saavn_primary': "https://saavn.dev/api",
            'saavn_alt': "https://jiosaavn-api-privatecvc.vercel.app",
            'saavn_alt2': "https://jiosaavn-api-2-harsh-patel.vercel.app",
            'saavn_alt3': "https://saavn-music-api.vercel.app"
        }
        
        # Karan Aujla specific song mappings
        self.karan_aujla_songs = {
            'try me': ['Try Me Karan Aujla', 'Try Me Official', 'Try Me Audio', 'Try Me Song'],
            'luther': ['Luther Karan Aujla', 'Luther Official', 'Luther Song', 'Luther Audio'],
            'softly': ['Softly Karan Aujla', 'Softly Official', 'Softly Song'],
            'bachke bachke': ['Bachke Bachke Karan Aujla', 'Bachke Bachke Official'],
            'players': ['Players Karan Aujla', 'Players Official', 'Players Song'],
            'antidote': ['Antidote Karan Aujla', 'Antidote Official'],
            'white brown black': ['White Brown Black Karan Aujla', 'White Brown Black'],
            'jee ni lagda': ['Jee Ni Lagda Karan Aujla', 'Jee Ni Lagda'],
            'chitta kurta': ['Chitta Kurta Karan Aujla', 'Chitta Kurta Official'],
            'on top': ['On Top Karan Aujla', 'On Top Official']
        }
    
    async def test_api_endpoint(self, endpoint: str) -> bool:
        """Test if an API endpoint is working"""
        try:
            response = await self.client.get(f"{endpoint}/search/songs?query=test&limit=1", timeout=10.0)
            return response.status_code in [200, 400]  # 400 might be parameter issue but server is up
        except:
            return False
    
    async def find_working_endpoint(self) -> str:
        """Find the first working API endpoint"""
        for name, endpoint in self.apis.items():
            if await self.test_api_endpoint(endpoint):
                logger.info(f"Using working endpoint: {name} - {endpoint}")
                return endpoint
        
        logger.warning("All external APIs failed")
        return None
    
    def generate_search_variations(self, query: str) -> List[str]:
        """Generate multiple search variations for better results"""
        variations = [query]  # Original query
        
        # Basic variations
        variations.extend([
            query.replace("by", "").strip(),
            query.replace(" by ", " ").strip(),
            query.split(" by ")[0].strip() if " by " in query else query,
            f"{query} Official",
            f"{query} Song",
            f"{query} Audio"
        ])
        
        # Karan Aujla specific variations
        query_lower = query.lower()
        if "karan" in query_lower and ("aujla" in query_lower or "aujla" in query_lower):
            variations.extend([
                query.replace("Aujla", "Aujla"),
                query.replace("aujla", "aujla"),
                query.replace("Karan Aujla", "Karan Aujla"),
                query.replace("karan aujla", "karan aujla"),
                query.replace(" by Karan Aujla", ""),
                query.replace(" Karan Aujla", "")
            ])
            
            # Check for specific song mappings
            for song_key, song_variations in self.karan_aujla_songs.items():
                if song_key in query_lower:
                    variations.extend(song_variations)
                    break
        
        # Remove duplicates while preserving order
        unique_variations = []
        seen = set()
        for var in variations:
            var_clean = var.strip()
            if var_clean and var_clean not in seen:
                unique_variations.append(var_clean)
                seen.add(var_clean)
        
        return unique_variations
    
    async def search_saavn_api(self, query: str, endpoint: str) -> Dict:
        """Search using JioSaavn API variants"""
        try:
            search_urls = [
                f"{endpoint}/search/songs",
                f"{endpoint}/api/search/songs",
                f"{endpoint}/search"
            ]
            
            for url in search_urls:
                try:
                    params = {"query": query, "page": 1, "limit": 15}
                    if "vercel.app" in endpoint:
                        params = {"query": query, "limit": 15}
                    
                    response = await self.client.get(url, params=params)
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        songs = []
                        results = []
                        
                        # Handle different response formats
                        if 'data' in data:
                            if 'results' in data['data']:
                                results = data['data']['results']
                            elif isinstance(data['data'], list):
                                results = data['data']
                        elif 'results' in data:
                            results = data['results']
                        elif isinstance(data, list):
                            results = data
                        
                        for song in results:
                            download_urls = song.get('downloadUrl', [])
                            streaming_url = ""
                            quality = "Unknown"
                            
                            if download_urls:
                                # Get highest quality URL
                                best_quality = download_urls[-1]
                                streaming_url = best_quality.get('url', best_quality.get('link', ''))
                                quality = best_quality.get('quality', '320kbps')
                            
                            songs.append({
                                'id': song.get('id', ''),
                                'title': song.get('name', song.get('title', 'Unknown')),
                                'subtitle': song.get('subtitle', ''),
                                'artists': song.get('artists', {}).get('primary', []) if isinstance(song.get('artists'), dict) else song.get('artists', []),
                                'image': song.get('image', [{}])[-1].get('url', song.get('image', [{}])[-1].get('link', '')) if song.get('image') else '',
                                'duration': song.get('duration', 0),
                                'streaming_url': streaming_url,
                                'quality': quality,
                                'source': f'JioSaavn ({endpoint})',
                                'search_term': query
                            })
                        
                        return {"status": 200, "response": songs}
                        
                except Exception as e:
                    logger.error(f"Error with {url}: {e}")
                    continue
            
            return {"status": 404, "response": [], "message": "No results found"}
            
        except Exception as e:
            logger.error(f"Saavn API error: {e}")
            return {"status": 500, "response": [], "message": str(e)}
    
    async def search_youtube_music(self, query: str) -> Dict:
        """Search YouTube Music as fallback"""
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'default_search': 'ytsearch15:'
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                search_results = ydl.extract_info(query, download=False)
                
                songs = []
                if search_results and 'entries' in search_results:
                    for entry in search_results['entries']:
                        # Filter for music content
                        title = entry.get('title', '').lower()
                        if any(word in title for word in ['official', 'music', 'song', 'audio', 'video']):
                            songs.append({
                                'id': f"youtube_{entry.get('id', '')}",
                                'title': entry.get('title', 'Unknown'),
                                'subtitle': f"by {entry.get('uploader', 'Unknown')}",
                                'artists': [{'name': entry.get('uploader', 'Unknown')}],
                                'duration': entry.get('duration', 0),
                                'streaming_url': f"https://youtube.com/watch?v={entry.get('id', '')}",
                                'quality': 'Variable (up to 320kbps)',
                                'source': 'YouTube',
                                'youtube_id': entry.get('id', '')
                            })
                
                return {"status": 200, "response": songs[:10]}
                
        except Exception as e:
            logger.error(f"YouTube search error: {e}")
            return {"status": 500, "response": [], "message": str(e)}
    
    def deduplicate_songs(self, songs: List[Dict]) -> List[Dict]:
        """Remove duplicate songs based on title similarity"""
        unique_songs = []
        
        for song in songs:
            is_duplicate = False
            song_title = song.get('title', '').lower().strip()
            
            for existing in unique_songs:
                existing_title = existing.get('title', '').lower().strip()
                similarity = SequenceMatcher(None, song_title, existing_title).ratio()
                
                if similarity > 0.85:  # 85% similarity threshold
                    # Keep the one with streaming URL if available
                    if song.get('streaming_url') and not existing.get('streaming_url'):
                        unique_songs.remove(existing)
                        unique_songs.append(song)
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique_songs.append(song)
        
        return unique_songs
    
    def calculate_priority(self, song: Dict, original_query: str) -> int:
        """Calculate priority score for search results"""
        priority = 0
        song_title = song.get('title', '').lower()
        song_artists = str(song.get('artists', [])).lower()
        query_lower = original_query.lower()
        
        # Exact title match
        if query_lower in song_title:
            priority += 100
        
        # Artist match (especially Karan Aujla)
        if 'karan' in song_artists and 'aujla' in song_artists:
            priority += 80
        
        # Has streaming URL
        if song.get('streaming_url'):
            priority += 50
        
        # Quality bonus
        quality = song.get('quality', '').lower()
        if '320' in quality:
            priority += 30
        elif '256' in quality or '192' in quality:
            priority += 20
        
        # Source preference
        source = song.get('source', '').lower()
        if 'jiosaavn' in source:
            priority += 25
        elif 'youtube' in source:
            priority += 10
        
        # Word match in title
        query_words = query_lower.split()
        title_words = song_title.split()
        common_words = set(query_words) & set(title_words)
        priority += len(common_words) * 10
        
        return priority
    
    async def comprehensive_search(self, query: str) -> Dict:
        """Comprehensive search across all sources with variations"""
        logger.info(f"Starting comprehensive search for: '{query}'")
        
        all_songs = []
        search_variations = self.generate_search_variations(query)
        
        # Find working API endpoint
        working_endpoint = await self.find_working_endpoint()
        
        # Search JioSaavn APIs with variations
        if working_endpoint:
            for variation in search_variations[:5]:  # Limit variations to avoid too many requests
                try:
                    result = await self.search_saavn_api(variation, working_endpoint)
                    if result.get('response'):
                        all_songs.extend(result['response'])
                except Exception as e:
                    logger.error(f"Error searching variation '{variation}': {e}")
                    continue
        
        # Search alternative JioSaavn APIs
        for api_name, endpoint in list(self.apis.items())[1:3]:  # Try 2 alternative APIs
            if endpoint != working_endpoint:
                try:
                    if await self.test_api_endpoint(endpoint):
                        result = await self.search_saavn_api(query, endpoint)
                        if result.get('response'):
                            all_songs.extend(result['response'])
                except Exception as e:
                    logger.error(f"Error with {api_name}: {e}")
                    continue
        
        # YouTube fallback if insufficient results
        if len(all_songs) < 3:
            try:
                youtube_result = await self.search_youtube_music(query)
                if youtube_result.get('response'):
                    all_songs.extend(youtube_result['response'])
            except Exception as e:
                logger.error(f"YouTube fallback error: {e}")
        
        # Remove duplicates
        unique_songs = self.deduplicate_songs(all_songs)
        
        # Calculate priorities and sort
        for song in unique_songs:
            song['priority'] = self.calculate_priority(song, query)
        
        unique_songs.sort(key=lambda x: x.get('priority', 0), reverse=True)
        
        # Limit results
        final_results = unique_songs[:20]
        
        logger.info(f"Found {len(final_results)} unique songs for '{query}'")
        
        return {"status": 200 if final_results else 404, "response": final_results}
    
    async def get_youtube_stream_url(self, youtube_id: str) -> str:
        """Get direct streaming URL from YouTube"""
        try:
            youtube_url = f"https://youtube.com/watch?v={youtube_id}"
            
            ydl_opts = {
                'format': 'bestaudio[abr>=128]/bestaudio',
                'quiet': True,
                'no_warnings': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
                return info.get('url', '')
                
        except Exception as e:
            logger.error(f"YouTube stream URL error: {e}")
            return ""

# Initialize the complete music client
music_client = CompleteMusicClient()

# API Endpoints
@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the frontend interface"""
    return get_frontend_html()

@app.get("/api")
async def api_info():
    """API information and status"""
    working_endpoint = await music_client.find_working_endpoint()
    
    return {
        "message": "Complete Music API Server - All Solutions Combined",
        "version": "2.0.0",
        "features": [
            "Multi-source search (JioSaavn + YouTube)",
            "Enhanced search with variations",
            "Karan Aujla song optimization",
            "320kbps quality streaming",
            "Duplicate removal",
            "Priority-based sorting",
            "YouTube fallback streaming"
        ],
        "endpoints": {
            "search": "/search?q=song_name",
            "stream": "/stream?id=song_id",
            "stream_youtube": "/stream-youtube?id=youtube_id", 
            "quick_play": "/quick-play?q=song_name",
            "search_youtube": "/search-youtube?q=song_name",
            "test": "/test-connection"
        },
        "working_api": working_endpoint if working_endpoint else "YouTube only",
        "status": "online"
    }

@app.get("/test-connection")
async def test_connection():
    """Test all API connections"""
    results = {}
    
    for name, endpoint in music_client.apis.items():
        is_working = await music_client.test_api_endpoint(endpoint)
        results[name] = {
            "endpoint": endpoint,
            "status": "✅ Working" if is_working else "❌ Failed"
        }
    
    # Test YouTube
    try:
        youtube_test = await music_client.search_youtube_music("test")
        results["youtube"] = {
            "endpoint": "YouTube Music API",
            "status": "✅ Working" if youtube_test["status"] == 200 else "❌ Failed"
        }
    except:
        results["youtube"] = {
            "endpoint": "YouTube Music API", 
            "status": "❌ Failed"
        }
    
    return {"connection_tests": results}

@app.get("/search")
async def search_music(q: str = Query(..., description="Search query")):
    """Comprehensive search across all sources"""
    result = await music_client.comprehensive_search(q)
    
    if result["status"] != 200:
        raise HTTPException(status_code=404, detail="No songs found with comprehensive search")
    
    return result

@app.get("/search-youtube")
async def search_youtube_only(q: str = Query(..., description="Search query for YouTube only")):
    """Search YouTube Music only"""
    result = await music_client.search_youtube_music(q)
    
    if result["status"] != 200:
        raise HTTPException(status_code=404, detail="No YouTube results found")
    
    return result

@app.get("/stream")
async def stream_music(id: str = Query(..., description="Song ID from search results")):
    """Stream music by song ID"""
    logger.info(f"Streaming song ID: {id}")
    
    # Handle YouTube IDs
    if id.startswith("youtube_"):
        youtube_id = id.replace("youtube_", "")
        return await stream_youtube_direct(youtube_id)
    
    # Handle regular JioSaavn IDs
    # First try to find the song in a fresh search to get streaming URL
    try:
        search_result = await music_client.comprehensive_search(f"id:{id}")
        
        for song in search_result.get("response", []):
            if song.get("id") == id and song.get("streaming_url"):
                return await stream_direct_url(song["streaming_url"], song.get("title", "Unknown"))
    except:
        pass
    
    raise HTTPException(status_code=404, detail="Stream not available. Try using quick-play instead.")

@app.get("/stream-youtube")
async def stream_youtube_direct(id: str = Query(..., description="YouTube video ID")):
    """Stream directly from YouTube"""
    try:
        youtube_id = id.replace("youtube_", "")
        stream_url = await music_client.get_youtube_stream_url(youtube_id)
        
        if not stream_url:
            raise HTTPException(status_code=404, detail="YouTube stream URL not found")
        
        async with music_client.client.stream('GET', stream_url) as response:
            if response.status_code == 200:
                return StreamingResponse(
                    response.aiter_bytes(chunk_size=8192),
                    media_type="audio/mpeg",
                    headers={"Cache-Control": "no-cache"}
                )
            else:
                raise HTTPException(status_code=500, detail="YouTube streaming failed")
                
    except Exception as e:
        logger.error(f"YouTube streaming error: {e}")
        raise HTTPException(status_code=500, detail=f"YouTube streaming error: {str(e)}")

async def stream_direct_url(streaming_url: str, title: str = "Unknown"):
    """Stream from direct URL"""
    try:
        async with music_client.client.stream('GET', streaming_url) as response:
            if response.status_code == 200:
                return StreamingResponse(
                    response.aiter_bytes(chunk_size=8192),
                    media_type="audio/mpeg",
                    headers={
                        "Cache-Control": "no-cache",
                        "Content-Disposition": f"inline; filename=\"{title}.mp3\""
                    }
                )
            else:
                raise HTTPException(status_code=500, detail=f"Streaming failed: HTTP {response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming error: {str(e)}")

@app.get("/quick-play")
async def quick_play(q: str = Query(..., description="Search query")):
    """Search and play the first streamable result instantly"""
    logger.info(f"Quick play: '{q}'")
    
    search_result = await music_client.comprehensive_search(q)
    
    if search_result["status"] != 200 or not search_result.get("response"):
        raise HTTPException(status_code=404, detail="No songs found for quick play")
    
    # Find first streamable song
    for song in search_result["response"]:
        if song.get("streaming_url"):
            logger.info(f"Quick playing: {song['title']} from {song.get('source', 'Unknown')}")
            
            if song.get("youtube_id"):
                return await stream_youtube_direct(song["youtube_id"])
            else:
                return await stream_direct_url(song["streaming_url"], song["title"])
    
    raise HTTPException(status_code=404, detail="No streamable songs found")

@app.get("/test-streaming")
async def test_streaming():
    """Test streaming capability with multiple sources"""
    test_queries = ["sajni", "try me karan aujla", "luther"]
    results = {}
    
    for query in test_queries:
        try:
            search_result = await music_client.comprehensive_search(query)
            
            if search_result["status"] == 200 and search_result["response"]:
                first_song = search_result["response"][0]
                
                results[query] = {
                    "search_working": True,
                    "song_found": first_song["title"],
                    "streaming_url_present": bool(first_song.get("streaming_url")),
                    "quality": first_song.get("quality", "Unknown"),
                    "source": first_song.get("source", "Unknown"),
                    "priority": first_song.get("priority", 0)
                }
            else:
                results[query] = {"search_working": False, "error": "No songs found"}
                
        except Exception as e:
            results[query] = {"search_working": False, "error": str(e)}
    
    return {"streaming_tests": results}

def get_frontend_html() -> str:
    """Return the complete frontend HTML"""
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete Music Player - All Solutions</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(15px);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }
        
        .search-section {
            background: rgba(255, 255, 255, 0.1);
            padding: 25px;
            border-radius: 15px;
            margin-bottom: 25px;
        }
        
        .search-box {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        input[type="text"] {
            flex: 1;
            min-width: 300px;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            background: rgba(255, 255, 255, 0.9);
            color: #333;
        }
        
        button {
            padding: 15px 25px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            min-width: 120px;
        }
        
        .search-btn { background: #4CAF50; color: white; }
        .quick-btn { background: #ff6b35; color: white; }
        .youtube-btn { background: #ff0000; color: white; }
        .test-btn { background: #6c5ce7; color: white; }
        
        button:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .quick-searches {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 15px;
        }
        
        .quick-search-btn {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 14px;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .quick-search-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .status {
            padding: 15px;
            margin: 15px 0;
            border-radius: 10px;
            text-align: center;
            font-weight: bold;
            display: none;
        }
        
        .loading { 
            background: rgba(255, 193, 7, 0.3); 
            border: 2px solid #ffc107;
            animation: pulse 2s infinite;
        }
        .success { background: rgba(40, 167, 69, 0.3); border: 2px solid #28a745; }
        .error { background: rgba(220, 53, 69, 0.3); border: 2px solid #dc3545; }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .results {
            margin: 25px 0;
            max-height: 500px;
            overflow-y: auto;
        }
        
        .song-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            margin: 15px 0;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 20px;
            border-left: 5px solid transparent;
            position: relative;
        }
        
        .song-item:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateX(10px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        }
        
        .song-item.high-priority { border-left-color: #4CAF50; }
        .song-item.medium-priority { border-left-color: #ff9800; }
        .song-item.low-priority { border-left-color: #f44336; }
        .song-item.youtube-source { border-left-color: #ff0000; }
        
        .song-image {
            width: 80px;
            height: 80px;
            border-radius: 12px;
            object-fit: cover;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        
        .song-details {
            flex: 1;
        }
        
        .song-title {
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 8px;
            line-height: 1.3;
        }
        
        .song-subtitle {
            opacity: 0.8;
            font-size: 14px;
            margin-bottom: 8px;
        }
        
        .song-meta {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        
        .song-quality, .song-source, .song-priority {
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .song-quality { background: rgba(76, 175, 80, 0.3); }
        .song-source { background: rgba(33, 150, 243, 0.3); }
        .song-priority { background: rgba(156, 39, 176, 0.3); }
        
        .play-indicator {
            position: absolute;
            top: 10px;
            right: 15px;
            background: #4CAF50;
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        .song-item:hover .play-indicator {
            opacity: 1;
        }
        
        .player-section {
            background: rgba(255, 255, 255, 0.1);
            padding: 25px;
            border-radius: 15px;
            margin: 25px 0;
        }
        
        audio {
            width: 100%;
            margin: 20px 0;
            border-radius: 10px;
        }
        
        .now-playing {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 25px 0;
        }
        
        .stat-card {
            background: rgba(255, 255, 255, 0.1);
            padding: 15px;
            border-radius: 10px;
            text-align: center;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #4CAF50;
        }
        
        .stat-label {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }
        
        @media (max-width: 768px) {
            .search-box {
                flex-direction: column;
            }
            
            input[type="text"] {
                min-width: 100%;
            }
            
            .song-item {
                flex-direction: column;
                text-align: center;
            }
            
            .song-image {
                width: 60px;
                height: 60px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 Complete Music Player</h1>
            <p>All-in-One Music Streaming with Multiple Sources & Enhanced Search</p>
        </div>
        
        <div class="search-section">
            <div class="search-box">
                <input type="text" id="searchQuery" placeholder="Search for any song... (e.g., Try Me Karan Aujla, Sajni, Luther)" />
                <button class="search-btn" onclick="searchMusic()" id="searchBtn">🔍 Smart Search</button>
                <button class="quick-btn" onclick="quickPlay()" id="quickBtn">⚡ Quick Play</button>
                <button class="youtube-btn" onclick="searchYoutube()" id="youtubeBtn">📺 YouTube Only</button>
                <button class="test-btn" onclick="runTests()" id="testBtn">🧪 Test All</button>
            </div>
            
            <div class="quick-searches">
                <button class="quick-search-btn" onclick="quickSearch('Try Me Karan Aujla')">Try Me</button>
                <button class="quick-search-btn" onclick="quickSearch('Luther Karan Aujla')">Luther</button>
                <button class="quick-search-btn" onclick="quickSearch('Sajni')">Sajni</button>
                <button class="quick-search-btn" onclick="quickSearch('Antidote Karan Aujla')">Antidote</button>
                <button class="quick-search-btn" onclick="quickSearch('Softly Karan Aujla')">Softly</button>
            </div>
        </div>

        <div id="status" class="status"></div>
        
        <div id="stats" class="stats" style="display: none;">
            <div class="stat-card">
                <div class="stat-number" id="totalSongs">0</div>
                <div class="stat-label">Songs Found</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="streamableSongs">0</div>
                <div class="stat-label">Streamable</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="highQuality">0</div>
                <div class="stat-label">High Quality</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="sources">0</div>
                <div class="stat-label">Sources</div>
            </div>
        </div>
        
        <div id="results" class="results"></div>
        
        <div class="player-section" id="playerSection" style="display: none;">
            <audio id="player" controls>
                Your browser does not support the audio element.
            </audio>
            
            <div id="nowPlaying" class="now-playing" style="display: none;">
                <h3>🎵 Now Playing</h3>
                <div id="songInfo"></div>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = window.location.origin;
        let currentSearch = '';
        
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = `status ${type}`;
            status.style.display = 'block';
            
            if (type !== 'loading') {
                setTimeout(() => {
                    status.style.display = 'none';
                }, 5000);
            }
        }
        
        function toggleButtons(disabled = false) {
            ['searchBtn', 'quickBtn', 'youtubeBtn', 'testBtn'].forEach(id => {
                document.getElementById(id).disabled = disabled;
            });
        }
        
        function quickSearch(query) {
            document.getElementById('searchQuery').value = query;
            searchMusic();
        }
        
        async function searchMusic() {
            const query = document.getElementById('searchQuery').value.trim();
            
            if (!query) {
                showStatus('Please enter a search query', 'error');
                return;
            }
            
            currentSearch = query;
            showStatus('🔍 Smart searching across all sources...', 'loading');
            toggleButtons(true);
            
            try {
                const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                if (data.status === 200 && data.response.length > 0) {
                    displayResults(data.response);
                    updateStats(data.response);
                    showStatus(`✅ Found ${data.response.length} songs from multiple sources!`, 'success');
                } else {
                    showStatus('No songs found. Try different keywords or use YouTube search.', 'error');
                    document.getElementById('results').innerHTML = '';
                    document.getElementById('stats').style.display = 'none';
                }
            } catch (error) {
                showStatus('Search failed: ' + error.message, 'error');
                console.error('Search error:', error);
            } finally {
                toggleButtons(false);
            }
        }
        
        async function searchYoutube() {
            const query = document.getElementById('searchQuery').value.trim();
            
            if (!query) {
                showStatus('Please enter a search query', 'error');
                return;
            }
            
            showStatus('📺 Searching YouTube Music...', 'loading');
            toggleButtons(true);
            
            try {
                const response = await fetch(`${API_BASE}/search-youtube?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                if (data.status === 200 && data.response.length > 0) {
                    displayResults(data.response);
                    updateStats(data.response);
                    showStatus(`📺 Found ${data.response.length} YouTube results!`, 'success');
                } else {
                    showStatus('No YouTube results found', 'error');
                }
            } catch (error) {
                showStatus('YouTube search failed: ' + error.message, 'error');
            } finally {
                toggleButtons(false);
            }
        }
        
        function updateStats(songs) {
            const totalSongs = songs.length;
            const streamableSongs = songs.filter(song => song.streaming_url).length;
            const highQuality = songs.filter(song => song.quality && song.quality.includes('320')).length;
            const sources = new Set(songs.map(song => song.source)).size;
            
            document.getElementById('totalSongs').textContent = totalSongs;
            document.getElementById('streamableSongs').textContent = streamableSongs;
            document.getElementById('highQuality').textContent = highQuality;
            document.getElementById('sources').textContent = sources;
            document.getElementById('stats').style.display = 'grid';
        }
        
        function displayResults(songs) {
            const results = document.getElementById('results');
            results.innerHTML = '';
            
            songs.forEach((song, index) => {
                const div = document.createElement('div');
                const hasStream = song.streaming_url && song.streaming_url.trim() !== '';
                const priority = song.priority || 0;
                
                let priorityClass = 'low-priority';
                if (priority > 150) priorityClass = 'high-priority';
                else if (priority > 100) priorityClass = 'medium-priority';
                
                if (song.source && song.source.includes('YouTube')) {
                    priorityClass = 'youtube-source';
                }
                
                div.className = `song-item ${priorityClass}`;
                
                const artistNames = Array.isArray(song.artists) 
                    ? song.artists.map(a => a.name || a).join(', ')
                    : 'Unknown Artist';
                
                div.innerHTML = `
                    ${song.image ? `<img src="${song.image}" alt="Album Art" class="song-image" onerror="this.style.display='none'">` : ''}
                    <div class="song-details">
                        <div class="song-title">${song.title || 'Unknown Title'}</div>
                        <div class="song-subtitle">${song.subtitle || artistNames}</div>
                        <div class="song-meta">
                            <span class="song-quality">${song.quality || 'Unknown'}</span>
                            <span class="song-source">${song.source || 'Unknown'}</span>
                            <span class="song-priority">Score: ${priority}</span>
                            ${song.duration ? `<small>${Math.floor((song.duration || 0) / 60)}:${String((song.duration || 0) % 60).padStart(2, '0')}</small>` : ''}
                        </div>
                    </div>
                    <div class="play-indicator">▶ Click to Play</div>
                `;
                
                if (hasStream) {
                    div.onclick = () => playSong(song);
                } else {
                    div.style.opacity = '0.6';
                    div.style.cursor = 'not-allowed';
                }
                
                results.appendChild(div);
            });
        }
        
        async function playSong(song) {
            showStatus('🎵 Loading stream...', 'loading');
            
            try {
                let streamUrl;
                
                if (song.id && song.id.startsWith('youtube_')) {
                    streamUrl = `${API_BASE}/stream-youtube?id=${encodeURIComponent(song.youtube_id || song.id.replace('youtube_', ''))}`;
                } else if (song.streaming_url && !song.streaming_url.includes('youtube.com')) {
                    // Direct streaming URL
                    streamUrl = song.streaming_url;
                } else {
                    streamUrl = `${API_BASE}/stream?id=${encodeURIComponent(song.id)}`;
                }
                
                const player = document.getElementById('player');
                player.src = streamUrl;
                
                document.getElementById('playerSection').style.display = 'block';
                
                // Show now playing info
                const songInfo = document.getElementById('songInfo');
                songInfo.innerHTML = `
                    ${song.image ? `<img src="${song.image}" style="width: 100px; height: 100px; border-radius: 15px; float: left; margin-right: 20px;">` : ''}
                    <div>
                        <strong>${song.title || 'Unknown Title'}</strong><br>
                        <small>${song.subtitle || 'Unknown Artist'}</small><br>
                        <small>Source: ${song.source || 'Unknown'} | Quality: ${song.quality || 'Unknown'}</small>
                    </div>
                    <div style="clear: both;"></div>
                `;
                document.getElementById('nowPlaying').style.display = 'block';
                
                // Handle player events
                player.onloadstart = () => showStatus('🔄 Buffering...', 'loading');
                player.oncanplay = () => showStatus('✅ Ready to play!', 'success');
                player.onerror = () => showStatus('❌ Playback error - try another song', 'error');
                
                // Try to auto-play
                player.play().catch(() => {
                    showStatus('🎵 Click the play button to start', 'success');
                });
                
            } catch (error) {
                showStatus('❌ Stream failed: ' + error.message, 'error');
                console.error('Stream error:', error);
            }
        }
        
        async function quickPlay() {
            const query = document.getElementById('searchQuery').value.trim();
            
            if (!query) {
                showStatus('Please enter a search query', 'error');
                return;
            }
            
            showStatus('⚡ Quick playing best result...', 'loading');
            toggleButtons(true);
            
            try {
                const streamUrl = `${API_BASE}/quick-play?q=${encodeURIComponent(query)}`;
                const player = document.getElementById('player');
                
                player.src = streamUrl;
                document.getElementById('playerSection').style.display = 'block';
                
                document.getElementById('songInfo').innerHTML = `
                    <strong>${query}</strong><br>
                    <small>Quick Play Mode - Best Available Result</small>
                `;
                document.getElementById('nowPlaying').style.display = 'block';
                
                player.oncanplay = () => showStatus('⚡ Quick playing!', 'success');
                player.onerror = () => showStatus('❌ Quick play failed - try regular search', 'error');
                
                player.play().catch(() => {
                    showStatus('🎵 Click play button to start', 'success');
                });
                
            } catch (error) {
                showStatus('❌ Quick play failed: ' + error.message, 'error');
            } finally {
                toggleButtons(false);
            }
        }
        
        async function runTests() {
            showStatus('🧪 Running comprehensive tests...', 'loading');
            toggleButtons(true);
            
            try {
                const response = await fetch(`${API_BASE}/test-streaming`);
                const data = await response.json();
                
                let passedTests = 0;
                let totalTests = Object.keys(data.streaming_tests).length;
                
                for (const [query, result] of Object.entries(data.streaming_tests)) {
                    if (result.search_working && result.streaming_url_present) {
                        passedTests++;
                    }
                }
                
                if (passedTests === totalTests) {
                    showStatus(`✅ All tests passed! (${passedTests}/${totalTests})`, 'success');
                } else {
                    showStatus(`⚠️ ${passedTests}/${totalTests} tests passed`, 'error');
                }
                
                console.log('Test Results:', data);
                
            } catch (error) {
                showStatus('❌ Tests failed: ' + error.message, 'error');
            } finally {
                toggleButtons(false);
            }
        }
        
        // Enter key support
        document.getElementById('searchQuery').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchMusic();
            }
        });
        
        // Auto-test on load
        window.onload = async () => {
            try {
                const response = await fetch(`${API_BASE}/test-connection`);
                const data = await response.json();
                
                const workingAPIs = Object.values(data.connection_tests).filter(api => 
                    api.status.includes('Working')
                ).length;
                
                showStatus(`🚀 Music API loaded! ${workingAPIs} sources available`, 'success');
            } catch (error) {
                showStatus('⚠️ Some API connections may be limited', 'error');
            }
        };
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    import uvicorn
    print("🎵 Starting Complete Music API Server...")
    print("🔥 All Solutions Combined in One File!")
    print("📍 Access at: http://localhost:8000")
    print("🚀 Features:")
    print("   • Multi-source search (JioSaavn + YouTube)")
    print("   • Enhanced Karan Aujla song optimization")
    print("   • Priority-based result sorting")
    print("   • 320kbps quality streaming")
    print("   • Complete web interface included")
    print("   • YouTube fallback streaming")
    print("   • Comprehensive error handling")
    print()
    print("🧪 Test endpoints:")
    print("   • http://localhost:8000/test-connection")
    print("   • http://localhost:8000/test-streaming")
    print("   • http://localhost:8000/api")
    
    uvicorn.run(
        "complete_music_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )