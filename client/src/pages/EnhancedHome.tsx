import { useState, useEffect } from 'react';
import { Play, Heart, ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Song } from '@/types/music';
import completeMusicService from '@/services/completeMusicService';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface MusicCategory {
  name: string;
  color: string;
  searchTerms: string[];
  songs: Song[];
  isLoading: boolean;
}

export default function EnhancedHome() {
  const [, navigate] = useLocation();
  const { playSongWithPlaylist, isLoading: playerLoading, playerState } = useMusicPlayer();
  const { isLiked, toggleLikedSong, likedSongs } = useLikedSongs();
  const { user } = useAuth();
  const { toast } = useToast();
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);

  const [categories, setCategories] = useState<MusicCategory[]>([
    {
      name: 'Made For You',
      color: 'from-purple-600 to-pink-800',
      searchTerms: ['arijit singh', 'shreya ghoshal', 'rahat fateh ali khan'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Popular Right Now',
      color: 'from-orange-600 to-red-800',
      searchTerms: ['karan aujla', 'divine', 'shubh', 'badshah'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Punjabi Hits',
      color: 'from-yellow-600 to-orange-800',
      searchTerms: ['ap dhillon', 'sidhu moose wala', 'diljit dosanjh'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Global Trending',
      color: 'from-blue-600 to-purple-800',
      searchTerms: ['ed sheeran', 'taylor swift', 'drake', 'david guetta'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Hip Hop Vibes',
      color: 'from-green-600 to-teal-800',
      searchTerms: ['eminem', 'kendrick lamar', 'jay z'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Chill Indie',
      color: 'from-indigo-600 to-blue-800',
      searchTerms: ['billie eilish', 'lorde', 'lana del rey'],
      songs: [],
      isLoading: true
    }
  ]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = user?.user_metadata?.full_name || 
                     user?.user_metadata?.name || 
                     user?.email?.split('@')[0] || 
                     'there';
    
    if (hour < 12) return `Good Morning, ${userName}`;
    if (hour < 18) return `Good Afternoon, ${userName}`;
    return `Good Evening, ${userName}`;
  };

  // Load recently played songs from localStorage
  useEffect(() => {
    const loadRecentlyPlayed = () => {
      try {
        const stored = localStorage.getItem('recentlyPlayed');
        if (stored) {
          const parsed = JSON.parse(stored);
          setRecentlyPlayed(parsed.slice(0, 6)); // Show only last 6 songs
        }
      } catch (error) {
        console.error('Failed to load recently played:', error);
      }
    };

    loadRecentlyPlayed();
  }, []);

  // Track current song in recently played
  useEffect(() => {
    if (playerState.currentSong) {
      setRecentlyPlayed(prev => {
        const currentSong = playerState.currentSong!;
        const newList = [currentSong, ...prev.filter(song => song.id !== currentSong.id)];
        const limited = newList.slice(0, 6);
        
        // Save to localStorage
        try {
          localStorage.setItem('recentlyPlayed', JSON.stringify(limited));
        } catch (error) {
          console.error('Failed to save recently played:', error);
        }
        
        return limited;
      });
    }
  }, [playerState.currentSong]);

  useEffect(() => {
    const fetchCategoryMusic = async () => {
      const updatedCategories = await Promise.all(
        categories.map(async (category) => {
          try {
            const allSongs: Song[] = [];
            
            for (const term of category.searchTerms) {
              const results = await completeMusicService.search(term);
              if (results && results.length > 0) {
                const convertedSongs: Song[] = results.slice(0, 8).map((song, index) => ({
                  id: Date.now() + Math.random() + index,
                  title: song.title,
                  artist: typeof song.artists === 'string' ? song.artists : 
                         Array.isArray(song.artists) ? song.artists.map(a => typeof a === 'string' ? a : a.name).join(', ') : 'Unknown Artist',
                  album: song.subtitle || 'Unknown Album',
                  duration: song.duration || 0,
                  coverUrl: song.image || '/api/placeholder-image',
                  audioUrl: song.streaming_url || completeMusicService.getStreamUrl(song.id),
                  source: 'jiosaavn'
                }));
                allSongs.push(...convertedSongs);
              }
            }
            
            const shuffledSongs = allSongs.sort(() => Math.random() - 0.5).slice(0, 18);
            
            return {
              ...category,
              songs: shuffledSongs,
              isLoading: false
            };
          } catch (error) {
            console.error(`Error fetching ${category.name}:`, error);
            return {
              ...category,
              songs: [],
              isLoading: false
            };
          }
        })
      );
      
      setCategories(updatedCategories);
    };

    fetchCategoryMusic();
  }, []);

  const handlePlaySong = async (song: Song, categoryIndex?: number) => {
    try {
      if (categoryIndex !== undefined) {
        const categoryPlaylist = categories[categoryIndex].songs;
        await playSongWithPlaylist(song, categoryPlaylist);
      } else {
        await playSongWithPlaylist(song, [song]);
      }
    } catch (error) {
      toast({
        title: "Couldn't play song",
        description: "Failed to load audio. Please try again.",
        variant: "destructive"
      });
    }
  };

  const scrollCategory = (categoryIndex: number, direction: 'left' | 'right') => {
    const container = document.getElementById(`home-category-${categoryIndex}`);
    if (container) {
      const scrollAmount = 300;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 pb-32 min-h-screen fade-in">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">{getGreeting()}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div 
            onClick={() => navigate('/liked-songs')}
            className="bg-neutral-800 hover:bg-neutral-700 p-3 rounded-lg flex items-center space-x-3 cursor-pointer transition-all group relative h-16 max-w-xs"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-800 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">♥</span>
            </div>
            <span className="font-medium text-white text-sm truncate flex-1">Liked Songs</span>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity text-green-500 w-8 h-8"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/liked-songs');
              }}
            >
              <Play size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <Clock className="mr-2 text-neutral-400" size={18} />
            <h3 className="text-lg font-bold text-white">Recently Played</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {recentlyPlayed.map((song) => (
              <div
                key={`recent-${song.id}`}
                className={cn(
                  "bg-neutral-800 hover:bg-neutral-700 p-2 rounded-lg cursor-pointer transition-all group w-[140px] flex-shrink-0",
                  playerLoading && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handlePlaySong(song)}
              >
                <div className="relative mb-2">
                  <img 
                    src={song.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120'} 
                    alt={song.title} 
                    className="w-[120px] h-[120px] rounded-md object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8"
                  >
                    <Play size={14} className="text-white" />
                  </Button>
                </div>
                <h4 className="font-medium text-white text-xs truncate leading-tight">{song.title}</h4>
                <p className="text-neutral-400 text-xs truncate mt-1">{song.artist}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Music Categories */}
      <div className="space-y-8">
        {categories.map((category, categoryIndex) => (
          <div key={category.name} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">{category.name}</h3>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollCategory(categoryIndex, 'left')}
                  className="text-neutral-400 hover:text-white"
                >
                  <ChevronLeft size={20} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollCategory(categoryIndex, 'right')}
                  className="text-neutral-400 hover:text-white"
                >
                  <ChevronRight size={20} />
                </Button>
              </div>
            </div>

            {category.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="relative">
                <div
                  id={`home-category-${categoryIndex}`}
                  className="flex space-x-4 overflow-x-auto scrollbar-hide pb-4"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {category.songs.map((song) => (
                    <div
                      key={song.id}
                      className={cn(
                        "flex-shrink-0 w-44 bg-neutral-800 hover:bg-neutral-700 p-4 rounded-lg cursor-pointer transition-all group",
                        playerLoading && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => handlePlaySong(song, categoryIndex)}
                    >
                      <div className="relative mb-4">
                        <img
                          src={song.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200'}
                          alt={song.title}
                          className="w-full aspect-square rounded object-cover"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Play size={20} className="text-white" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium text-white truncate text-sm">
                          {song.title}
                        </h4>
                        <p className="text-neutral-400 text-xs truncate">
                          {song.artist}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}