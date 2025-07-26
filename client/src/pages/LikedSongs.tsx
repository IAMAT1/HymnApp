import { Play, Heart, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

export default function LikedSongs() {
  const { likedSongs, toggleLikedSong } = useLikedSongs();
  const { playSongWithPlaylist } = useMusicPlayer();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [, setLocation] = useLocation();

  const filteredSongs = likedSongs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePlaySong = async (song: any) => {
    try {
      await playSongWithPlaylist(song, filteredSongs);
    } catch (error) {
      toast({
        title: "Couldn't play song",
        description: "Failed to load audio. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePlayAll = async () => {
    if (filteredSongs.length > 0) {
      try {
        await playSongWithPlaylist(filteredSongs[0], filteredSongs);
      } catch (error) {
        toast({
          title: "Couldn't play song",
          description: "Failed to load audio. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="p-6 pb-32 fade-in">
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <Heart className="text-white" size={36} />
        </div>
        <div>
          <p className="text-neutral-400 text-xs uppercase tracking-wide">Playlist</p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">Liked Songs</h1>
          <p className="text-neutral-400 text-sm">
            {likedSongs.length} {likedSongs.length === 1 ? 'song' : 'songs'}
          </p>
        </div>
      </div>
      
      {likedSongs.length > 0 ? (
        <>
          <div className="flex items-center space-x-4 mb-6">
            <Button
              onClick={handlePlayAll}
              className="bg-green-500 hover:bg-green-400 text-black px-8 py-3 rounded-full font-medium"
            >
              <Play className="mr-2" size={16} />
              Play
            </Button>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={16} />
              <Input
                type="text"
                placeholder="Search in liked songs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-800 text-white pl-10 pr-4 py-2 rounded-md border-neutral-700 focus:border-green-500"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center space-x-4 p-3 rounded-lg hover:bg-neutral-800 cursor-pointer group"
              >
                <div className="relative">
                  <img 
                    src={song.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60'} 
                    alt={song.title} 
                    className="w-12 h-12 rounded object-cover"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePlaySong(song)}
                    className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Play size={16} className="text-white" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{song.title}</h4>
                  <p className="text-neutral-400 text-sm truncate">{song.artist}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleLikedSong(song)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-green-500 hover:text-green-400"
                >
                  <Heart size={16} fill="currentColor" />
                </Button>
                <span className="text-neutral-400 text-sm">
                  {song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '0:00'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <Heart className="mx-auto text-neutral-500 mb-4" size={64} />
          <h3 className="text-xl font-bold text-white mb-4">No liked songs yet</h3>
          <p className="text-neutral-400 mb-6">
            Songs you like will appear here
          </p>
          <Button 
            onClick={() => setLocation('/browse')}
            className="bg-green-500 hover:bg-green-400 text-black px-6 py-2 rounded-full font-medium"
          >
            Find something to like
          </Button>
        </div>
      )}
    </div>
  );
}
