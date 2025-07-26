import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Song } from '@/types/music';
import { UniversalMusicService } from '@/services/universalMusicService';
import completeMusicService from '@/services/completeMusicService';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';


export default function Home() {
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [trendingMusic, setTrendingMusic] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { playSongWithPlaylist, isLoading: playerLoading } = useMusicPlayer();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const getGreeting = () => {
    const hour = new Date().getHours();
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
    
    if (hour < 12) {
      return `Good Morning, ${userName}`;
    } else if (hour < 17) {
      return `Good Afternoon, ${userName}`;
    } else {
      return `Good Evening, ${userName}`;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Get user's recently played songs (local storage)
        const recent = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]').slice(0, 10);
        setRecentlyPlayed(recent);
        
        console.log('Getting trending music from all sources...');
        
        // Try the new Complete Music API for trending songs first
        try {
          const completeTrending = await completeMusicService.getTrending();
          if (completeTrending.length > 0) {
            const formattedTrending = completeTrending.map(song => 
              completeMusicService.convertToFrontendFormat(song)
            );
            setTrendingMusic(formattedTrending);
            console.log('Got', formattedTrending.length, 'trending songs from comprehensive service');
          } else {
            // Fallback to Universal Music Service
            const universalTrending = await UniversalMusicService.getTrendingMusic();
            setTrendingMusic(universalTrending);
            console.log('Got', universalTrending.length, 'trending songs from universal service');
          }
        } catch (error) {
          console.error('Complete Music API trending failed, falling back:', error);
          // Fallback to Universal Music Service
          const universalTrending = await UniversalMusicService.getTrendingMusic();
          setTrendingMusic(universalTrending);
          console.log('Got', universalTrending.length, 'trending songs from universal service (fallback)');
        }
      } catch (error) {
        console.error('Error fetching home data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePlaySong = async (song: Song, songList: Song[] = []) => {
    // Prevent multiple clicks while loading
    if (playerLoading) {
      console.log('Player is loading, ignoring click');
      return;
    }

    try {
      // If playing from a list (trending/recent), use the entire list as queue
      if (songList.length > 0) {
        console.log('Playing song from list of', songList.length, 'songs');
        await playSongWithPlaylist(song, songList, true);
      } else {
        // Single song play
        await playSongWithPlaylist(song);
      }
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
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-32 min-h-screen fade-in">
      <div className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">{getGreeting()}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div 
            onClick={() => {
              navigate('/liked-songs');
            }}
            className="bg-neutral-800 hover:bg-neutral-700 p-4 rounded-lg flex items-center space-x-4 cursor-pointer transition-all group relative"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-800 rounded flex items-center justify-center">
              <span className="text-white text-xl">♥</span>
            </div>
            <span className="font-medium text-white">Liked Songs</span>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity text-green-500"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/liked-songs');
              }}
            >
              <Play size={16} />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-white mb-4">Recently played</h3>
        {recentlyPlayed.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {recentlyPlayed.map((song) => (
              <div
                key={song.id}
                className={cn(
                  "bg-neutral-800 hover:bg-neutral-700 p-4 rounded-lg cursor-pointer transition-all group",
                  playerLoading && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handlePlaySong(song, recentlyPlayed)}
              >
                <img 
                  src={song.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200'} 
                  alt={song.title} 
                  className="w-full aspect-square rounded mb-4 object-cover"
                />
                <h4 className="font-medium text-white truncate">{song.title}</h4>
                <p className="text-neutral-400 text-sm truncate">{song.artist}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-green-500"
                >
                  <Play size={16} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-neutral-400 text-lg">No recently played songs</p>
            <p className="text-neutral-500 text-sm mt-2">Start listening to see your recent tracks here</p>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-2xl font-bold text-white mb-4">Trending Now</h3>
        {trendingMusic.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {trendingMusic.map((song) => (
              <div
                key={song.id}
                className={cn(
                  "bg-neutral-800 hover:bg-neutral-700 p-4 rounded-lg cursor-pointer transition-all group",
                  playerLoading && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => handlePlaySong(song, trendingMusic)}
              >
                <img 
                  src={song.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&h=200'} 
                  alt={song.title} 
                  className="w-full aspect-square rounded mb-4 object-cover"
                />
                <h4 className="font-medium text-white truncate">{song.title}</h4>
                <p className="text-neutral-400 text-sm truncate">{song.artist}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 text-green-500"
                >
                  <Play size={16} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-neutral-400 text-lg">No trending music available</p>
            <p className="text-neutral-500 text-sm mt-2">Check back later for popular tracks</p>
          </div>
        )}
      </div>


    </div>
  );
}
