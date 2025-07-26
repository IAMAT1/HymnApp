import { useState, useEffect } from 'react';
import { Play, Heart, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Song } from '@/types/music';
import completeMusicService from '@/services/completeMusicService';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MusicCategory {
  name: string;
  color: string;
  searchTerms: string[];
  songs: Song[];
  isLoading: boolean;
}

export default function Browse() {
  const [categories, setCategories] = useState<MusicCategory[]>([
    {
      name: 'Popular Indian Hip-Hop',
      color: 'from-orange-600 to-red-800',
      searchTerms: ['karan aujla', 'divine', 'shubh'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Bollywood Hits',
      color: 'from-purple-600 to-pink-800',
      searchTerms: ['arijit singh', 'shreya ghoshal', 'rahat fateh ali khan'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Punjabi Superstars',
      color: 'from-yellow-600 to-orange-800',
      searchTerms: ['ap dhillon', 'sidhu moose wala', 'badshah'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Global Chart Toppers',
      color: 'from-blue-600 to-purple-800',
      searchTerms: ['ed sheeran', 'taylor swift', 'drake'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Electronic & Dance',
      color: 'from-green-600 to-blue-800',
      searchTerms: ['calvin harris', 'deadmau5', 'david guetta'],
      songs: [],
      isLoading: true
    },
    {
      name: 'Hip-Hop Legends',
      color: 'from-red-600 to-yellow-800',
      searchTerms: ['kendrick lamar', 'eminem', 'jay z'],
      songs: [],
      isLoading: true
    }
  ]);

  const { playSongWithPlaylist, isLoading: playerLoading } = useMusicPlayer();
  const { isLiked, toggleLikedSong } = useLikedSongs();
  const { toast } = useToast();

  useEffect(() => {
    const fetchCategoryMusic = async () => {
      const updatedCategories = await Promise.all(
        categories.map(async (category) => {
          try {
            // Get songs from multiple search terms for variety
            const allSongs: Song[] = [];
            
            for (const term of category.searchTerms) {
              const results = await completeMusicService.search(term);
              if (results && results.length > 0) {
                // Take top 10 songs from each search term
                const convertedSongs: Song[] = results.slice(0, 10).map((song, index) => ({
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
            
            // Shuffle and limit to 20 songs per category
            const shuffledSongs = allSongs.sort(() => Math.random() - 0.5).slice(0, 20);
            
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

  const handlePlaySong = async (song: Song, categoryIndex: number) => {
    try {
      const categoryPlaylist = categories[categoryIndex].songs;
      await playSongWithPlaylist(song, categoryPlaylist);
    } catch (error) {
      toast({
        title: "Couldn't play song",
        description: "Failed to load audio. Please try again.",
        variant: "destructive"
      });
    }
  };

  const scrollCategory = (categoryIndex: number, direction: 'left' | 'right') => {
    const container = document.getElementById(`category-${categoryIndex}`);
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
        <h2 className="text-3xl font-bold text-white mb-6">Browse Music</h2>
        <p className="text-neutral-400 text-lg mb-8">
          Discover trending songs from your favorite artists and genres
        </p>
      </div>

      <div className="space-y-12">
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
                  id={`category-${categoryIndex}`}
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
                        
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLikedSong(song);
                            }}
                            className={cn(
                              "text-neutral-400 hover:text-white w-6 h-6",
                              isLiked(song.id) && "text-green-500 hover:text-green-400"
                            )}
                          >
                            <Heart 
                              size={14} 
                              fill={isLiked(song.id) ? "currentColor" : "none"} 
                            />
                          </Button>
                          
                          <span className="text-neutral-500 text-xs">
                            {song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '3:45'}
                          </span>
                        </div>
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