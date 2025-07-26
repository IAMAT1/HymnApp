import { useState, useEffect } from 'react';
import { Play, Heart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Song } from '@/types/music';
import completeMusicService from '@/services/completeMusicService';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface GenreSongsProps {
  params: {
    genre: string;
  };
}

const genreSearchTerms: Record<string, string[]> = {
  pop: ['taylor swift', 'billie eilish', 'dua lipa', 'ariana grande', 'ed sheeran'],
  rock: ['coldplay', 'imagine dragons', 'onerepublic', 'maroon 5', 'linkin park'],
  'hip-hop': ['kendrick lamar', 'drake', 'eminem', 'post malone', 'travis scott'],
  electronic: ['calvin harris', 'david guetta', 'martin garrix', 'deadmau5', 'skrillex'],
  jazz: ['miles davis', 'john coltrane', 'billie holiday', 'ella fitzgerald', 'louis armstrong'],
  classical: ['beethoven', 'mozart', 'bach', 'chopin', 'vivaldi'],
  'r&b': ['the weeknd', 'bruno mars', 'john legend', 'alicia keys', 'usher'],
  country: ['taylor swift country', 'keith urban', 'carrie underwood', 'blake shelton', 'luke bryan']
};

export default function GenreSongs({ params }: GenreSongsProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { playSongWithPlaylist, isLoading: playerLoading } = useMusicPlayer();
  const { isLiked, toggleLikedSong } = useLikedSongs();
  const { toast } = useToast();

  const genre = params.genre.toLowerCase();
  const displayGenreName = genre.charAt(0).toUpperCase() + genre.slice(1).replace('-', ' & ');

  useEffect(() => {
    const fetchGenreSongs = async () => {
      setIsLoading(true);
      try {
        const searchTerms = genreSearchTerms[genre] || [genre];
        const allSongs: Song[] = [];
        
        for (const term of searchTerms) {
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
        
        // Shuffle and limit to 24 songs
        const shuffledSongs = allSongs.sort(() => Math.random() - 0.5).slice(0, 24);
        setSongs(shuffledSongs);
      } catch (error) {
        console.error(`Error fetching ${genre} songs:`, error);
        toast({
          title: "Failed to load songs",
          description: "Could not fetch songs for this genre. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenreSongs();
  }, [genre, toast]);

  const handlePlaySong = async (song: Song) => {
    try {
      await playSongWithPlaylist(song, songs);
    } catch (error) {
      toast({
        title: "Couldn't play song",
        description: "Failed to load audio. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 pb-32 fade-in">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-32 min-h-screen fade-in">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => setLocation('/search')}
          className="mb-4 text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="mr-2" size={16} />
          Back to Search
        </Button>
        <h2 className="text-3xl font-bold text-white mb-2">{displayGenreName}</h2>
        <p className="text-neutral-400 text-lg">
          Discover the best {displayGenreName.toLowerCase()} music
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {songs.map((song) => (
          <div
            key={song.id}
            className={cn(
              "bg-neutral-800 hover:bg-neutral-700 p-3 rounded-lg cursor-pointer transition-all group",
              playerLoading && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => handlePlaySong(song)}
          >
            <div className="relative mb-3">
              <img 
                src={song.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=160&h=160'} 
                alt={song.title} 
                className="w-full aspect-square rounded-lg object-cover"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Play size={16} className="text-white" />
              </Button>
            </div>
            <div className="space-y-1">
              <h4 className="font-medium text-white text-sm truncate">{song.title}</h4>
              <p className="text-neutral-400 text-xs truncate">{song.artist}</p>
              
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLikedSong(song);
                  }}
                  className={cn(
                    "text-neutral-400 hover:text-white w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity",
                    isLiked(song.id) && "text-green-500 hover:text-green-400 opacity-100"
                  )}
                >
                  <Heart 
                    size={12} 
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
  );
}