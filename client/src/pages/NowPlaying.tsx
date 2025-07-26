import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function NowPlaying() {
  const { 
    playerState, 
    togglePlayPause, 
    seekTo, 
    nextSong, 
    previousSong, 
    toggleShuffle, 
    toggleRepeat, 
    formatTime 
  } = useMusicPlayer();
  const { isLiked, toggleLikedSong } = useLikedSongs();
  const { toast } = useToast();

  const { currentSong, isPlaying, progress, duration, isShuffled, repeatMode } = playerState;

  const handleProgressChange = (value: number[]) => {
    seekTo(value[0]);
  };

  const handleLikeToggle = () => {
    if (currentSong) {
      toggleLikedSong(currentSong);
    }
  };

  if (!currentSong) {
    return (
      <div className="p-6 pb-32 flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">No song playing</h2>
          <p className="text-neutral-400">Start playing music to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-32">
      <div className="flex flex-col lg:flex-row items-center lg:items-start space-y-8 lg:space-y-0 lg:space-x-12 max-w-6xl mx-auto">
        <div className="flex-shrink-0">
          <img 
            src={currentSong.coverUrl || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400'} 
            alt={currentSong.title} 
            className="w-80 h-80 rounded-lg shadow-2xl object-cover"
          />
        </div>
        
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl lg:text-6xl font-bold text-white mb-4">
            {currentSong.title}
          </h1>
          <h2 className="text-2xl lg:text-3xl text-neutral-400 mb-8">
            {currentSong.artist}
          </h2>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <span className="text-neutral-400 text-sm w-12 text-right">
                {formatTime(progress)}
              </span>
              <Slider
                value={[progress]}
                max={duration}
                step={1}
                onValueChange={handleProgressChange}
                className="flex-1"
              />
              <span className="text-neutral-400 text-sm w-12">
                {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center justify-center space-x-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleShuffle}
                className={cn(
                  'text-neutral-400 hover:text-white',
                  isShuffled && 'text-green-500'
                )}
              >
                <Shuffle size={20} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={previousSong}
                className="text-neutral-400 hover:text-white"
              >
                <SkipBack size={24} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                className="bg-green-500 hover:bg-green-400 text-black w-14 h-14 rounded-full"
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextSong}
                className="text-neutral-400 hover:text-white"
              >
                <SkipForward size={24} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRepeat}
                className={cn(
                  'text-neutral-400 hover:text-white',
                  repeatMode !== 'none' && 'text-green-500'
                )}
              >
                <Repeat size={20} />
              </Button>
            </div>
            
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLikeToggle}
                className={cn(
                  'text-neutral-400 hover:text-white',
                  isLiked(currentSong.id) && 'text-green-500'
                )}
              >
                <Heart size={24} fill={isLiked(currentSong.id) ? 'currentColor' : 'none'} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
