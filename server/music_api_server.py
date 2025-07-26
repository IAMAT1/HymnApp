
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
import uvicorn

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
    
    async def find_working_endpoint(self) -> str:
        """Find the first working API endpoint"""
        for name, endpoint in self.apis.items():
            try:
                response = await self.client.get(f"{endpoint}/search/songs?query=test&limit=1", timeout=10.0)
                if response.status_code in [200, 400]:
                    logger.info(f"Using working endpoint: {name} - {endpoint}")
                    return endpoint
            except:
                continue
        
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
                                'artists': [{'name': artist.get('name', '')} for artist in song.get('artists', {}).get('primary', [])] if isinstance(song.get('artists'), dict) else [{'name': str(artist)} for artist in song.get('artists', [])],
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
    
    async def comprehensive_search(self, query: str) -> Dict:
        """Search across all available sources"""
        all_songs = []
        
        # Get search variations
        variations = self.generate_search_variations(query)
        
        # Try each API endpoint
        working_endpoint = await self.find_working_endpoint()
        if working_endpoint:
            for variation in variations[:3]:  # Limit to first 3 variations
                result = await self.search_saavn_api(variation, working_endpoint)
                if result['status'] == 200:
                    all_songs.extend(result['response'])
                    if len(all_songs) >= 10:  # Enough results
                        break
        
        # Deduplicate and prioritize
        unique_songs = self.deduplicate_songs(all_songs)
        prioritized_songs = sorted(unique_songs, key=lambda x: self.calculate_priority(x, query), reverse=True)
        
        return {
            "status": 200 if prioritized_songs else 404,
            "response": prioritized_songs[:10],
            "total_found": len(prioritized_songs),
            "search_variations": variations[:3]
        }
    
    def deduplicate_songs(self, songs: List[Dict]) -> List[Dict]:
        """Remove duplicate songs based on title similarity"""
        unique_songs = []
        
        for song in songs:
            is_duplicate = False
            song_title = song.get('title', '').lower().strip()
            
            for existing in unique_songs:
                existing_title = existing.get('title', '').lower().strip()
                from difflib import SequenceMatcher
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
        
        return priority

# Initialize the music client
music_client = CompleteMusicClient()

@app.get("/")
async def root():
    return {"message": "Complete Music API Server Running", "version": "2.0.0"}

@app.get("/search")
async def search_songs(q: str = Query(..., description="Search query")):
    """Search for songs across all sources"""
    try:
        logger.info(f"Searching for: {q}")
        result = await music_client.comprehensive_search(q)
        return result
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stream/{song_id}")
async def stream_song(song_id: str):
    """Stream a song by ID (placeholder - would need implementation)"""
    return {"message": f"Streaming song {song_id}", "status": "not_implemented"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
