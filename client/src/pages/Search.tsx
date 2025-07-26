import { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, Heart, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Song } from '@/types/music';
import { UniversalMusicService } from '@/services/universalMusicService';
import completeMusicService from '@/services/completeMusicService';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

const genres = [
  { name: 'Pop', color: 'from-purple-600 to-purple-800' },
  { name: 'Rock', color: 'from-red-600 to-red-800' },
  { name: 'Hip-Hop', color: 'from-yellow-600 to-yellow-800' },
  { name: 'Electronic', color: 'from-blue-600 to-blue-800' },
  { name: 'Jazz', color: 'from-green-600 to-green-800' },
  { name: 'Classical', color: 'from-indigo-600 to-indigo-800' },
  { name: 'R&B', color: 'from-pink-600 to-pink-800' },
  { name: 'Country', color: 'from-orange-600 to-orange-800' },
];

export default function Search() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { playSong, playSongWithPlaylist, formatTime, isLoading: playerLoading, pendingSong, addToQueue } = useMusicPlayer();
  const { isLiked, toggleLikedSong } = useLikedSongs();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (query.trim()) {
        setIsLoading(true);
        try {
          console.log('Searching with Complete Music API:', query);
          
          // Primary: Complete Music API with JioSaavn + YouTube integration
          const completeResults = await completeMusicService.search(query);
          
          if (completeResults && completeResults.length > 0) {
            console.log('Found', completeResults.length, 'results from Complete Music API (JioSaavn + YouTube)');
            
            // Convert Complete Music API results to frontend Song format
            const convertedResults: Song[] = completeResults.map((song, index) => ({
              id: Date.now() + index, // Generate unique numeric ID
              title: song.title,
              artist: typeof song.artists === 'string' ? song.artists : 
                     Array.isArray(song.artists) ? song.artists.map(a => typeof a === 'string' ? a : a.name).join(', ') : 'Unknown Artist',
              album: song.subtitle || 'Unknown Album',
              duration: song.duration || 0,
              coverUrl: song.image || '/api/placeholder-image',
              audioUrl: song.streaming_url || completeMusicService.getStreamUrl(song.id),
              originalId: song.id // Store original Complete Music API ID for streaming
            }));
            
            setSearchResults(convertedResults);
          } else {
            // Fallback to Universal Music Service
            console.log('Complete Music API returned no results, falling back to Universal Music Service');
            const universalResults = await UniversalMusicService.searchSongs(query);
            setSearchResults(universalResults);
          }
        } catch (error) {
          console.error('Error searching songs:', error);
          try {
            // Final fallback to Universal Music Service
            console.log('Complete Music API failed, trying Universal Music Service');
            const universalResults = await UniversalMusicService.searchSongs(query);
            setSearchResults(universalResults);
          } catch (fallbackError) {
            console.error('All search methods failed:', fallbackError);
            setSearchResults([]);
            toast({
              title: "Search failed",
              description: "No results found. Please try a different search term.",
              variant: "destructive"
            });
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query, toast]);

  const handlePlaySong = async (song: Song, index?: number) => {
    // Prevent multiple clicks while loading
    if (playerLoading) {
      console.log('Player is loading, ignoring click');
      return;
    }

    try {
      // If search results has multiple songs, use them as playlist
      if (searchResults.length > 1) {
        console.log('Playing song from search results of', searchResults.length, 'songs');
        await playSongWithPlaylist(song, searchResults, true);
      } else {
        // Single song play
        await playSong(song);
      }
    } catch (error) {
      toast({
        title: "Couldn't play song",
        description: "Failed to load audio. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleLikeToggle = (song: Song) => {
    toggleLikedSong(song);
  };

  return (
    <div className="p-6 pb-32 fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-6">Search</h2>
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={20} />
          <Input
            type="text"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white text-black pl-10 pr-4 py-3 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>
      
      {/* Search Results */}
      {query && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Songs</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((song, index) => (
                <div
                  key={song.id}
                  className="flex items-center space-x-4 p-3 rounded-lg hover:bg-neutral-800 cursor-pointer group"
                >
                  <div className="relative">
                    <img 
                      src={song.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60'} 
                      alt={song.title} 
                      className="w-12 h-12 rounded object-cover"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlaySong(song, index)}
                      disabled={playerLoading}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                      title={playerLoading ? (pendingSong?.id === song.id ? `Loading ${song.title}...` : 'Another song is loading...') : `Play ${song.title}`}
                    >
                      {playerLoading && pendingSong?.id === song.id ? (
                        <Loader2 size={16} className="text-white animate-spin" />
                      ) : (
                        <Play size={16} className="text-white" />
                      )}
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate flex items-center">
                      {song.title}
                      {playerLoading && pendingSong?.id === song.id && (
                        <span className="ml-2 text-blue-400 text-xs animate-pulse">Loading...</span>
                      )}
                    </h4>
                    <p className="text-neutral-400 text-sm truncate">{song.artist}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleLikeToggle(song)}
                    className={cn(
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      isLiked(song.id) ? 'text-green-500' : 'text-neutral-400 hover:text-green-500'
                    )}
                  >
                    <Heart size={16} fill={isLiked(song.id) ? 'currentColor' : 'none'} />
                  </Button>
                  <span className="text-neutral-400 text-sm">
                    {formatTime(song.duration)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-neutral-400 text-lg">No results found for "{query}"</p>
              <p className="text-neutral-500 text-sm mt-2">Try different keywords or check spelling</p>
            </div>
          )}
        </div>
      )}
      
      {/* Browse Genres */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-white mb-4">Browse all</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {genres.map((genre) => (
            <div
              key={genre.name}
              onClick={() => setLocation(`/genre/${genre.name.toLowerCase().replace('&', '-')}`)}
              className={cn(
                'bg-gradient-to-br p-4 rounded-lg cursor-pointer hover:scale-105 transition-transform',
                genre.color
              )}
            >
              <h4 className="font-bold text-white">{genre.name}</h4>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
