import { useState } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Volume2, 
  Heart,
  List,
  Monitor,
  Loader2,
  Youtube
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useYouTubePlayer } from '@/contexts/YouTubePlayerContext';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { QueueView } from '@/components/queue/QueueView';
import { cn } from '@/lib/utils';

export function YouTubeMusicPlayerBar() {
  const { 
    playerState, 
    togglePlayPause, 
    setVolume, 
    seekTo, 
    nextSong, 
    previousSong, 
    toggleShuffle, 
    toggleRepeat, 
    formatTime, 
    isLoading, 
    loadingError, 
    pendingSong 
  } = useYouTubePlayer();
  
  const { isLiked, toggleLikedSong } = useLikedSongs();
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isPiPMode, setIsPiPMode] = useState(false);

  const { currentSong, isPlaying, volume, progress, duration, isShuffled, repeatMode } = playerState;

  // Debug: Log player state changes
  console.log('YouTubeMusicPlayerBar render - currentSong:', currentSong?.title, 'isPlaying:', isPlaying, 'loading:', isLoading, 'pendingSong:', pendingSong?.title);

  const handleProgressChange = (value: number[]) => {
    seekTo(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const handleLikeToggle = () => {
    if (currentSong) {
      toggleLikedSong(currentSong);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-800 border-t border-neutral-700 p-4 z-50">
      <div className="flex items-center justify-between">
        {/* Current Song Info */}
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          {currentSong ? (
            <>
              <div className="relative">
                <img 
                  src={currentSong.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60'} 
                  alt={currentSong.title} 
                  className="w-14 h-14 rounded object-cover"
                />

              </div>
              
              <div className="hidden md:block min-w-0 flex-1">
                <h4 className="font-medium text-white truncate">
                  {currentSong.title}
                </h4>
                <p className="text-neutral-400 text-sm truncate">
                  {currentSong.artist}
                  {isLoading && pendingSong && (
                    <span className="ml-2 text-blue-400 animate-pulse flex items-center">
                      <Loader2 size={12} className="animate-spin mr-1" />
                      Loading "{pendingSong.title}" from YouTube...
                    </span>
                  )}
                  {loadingError && (
                    <span className="ml-2 text-yellow-500 text-xs flex items-center">
                      {loadingError.includes('Loading') || loadingError.includes('Searching') ? (
                        <>
                          <Loader2 size={12} className="animate-spin mr-1" />
                          {loadingError}
                        </>
                      ) : (
                        <>⚠️ {loadingError}</>
                      )}
                    </span>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLikeToggle}
                className={cn(
                  'text-neutral-400 hover:text-white',
                  isLiked(currentSong.id) && 'text-red-500 hover:text-red-400'
                )}
              >
                <Heart size={16} fill={isLiked(currentSong.id) ? 'currentColor' : 'none'} />
              </Button>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="w-14 h-14 bg-neutral-700 rounded flex items-center justify-center">
                <Youtube size={20} className="text-red-600" />
              </div>
              <div className="text-neutral-400">
                <p className="text-sm font-medium">YouTube Music Player Ready</p>
                <p className="text-xs">Select a song to start streaming</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Player Controls */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-center space-x-4 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={cn(
                'text-neutral-400 hover:text-white',
                isShuffled && 'text-red-500'
              )}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={previousSong}
              disabled={isLoading}
              className="text-neutral-400 hover:text-white disabled:opacity-50"
              title={isLoading ? "Loading..." : "Previous song"}
            >
              <SkipBack size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlayPause}
              disabled={isLoading || (!currentSong && !isLoading)}
              className="bg-neutral-800 hover:bg-neutral-700 text-white w-12 h-12 rounded-full disabled:opacity-30 relative"
              title={
                isLoading ? `Loading ${pendingSong?.title || "song"}...` : 
                isPlaying ? "Pause" : 
                "Play"
              }
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 size={18} className="animate-spin text-white" />
                </div>
              ) : isPlaying ? (
                <Pause size={18} />
              ) : (
                <Play size={18} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextSong}
              disabled={isLoading}
              className="text-neutral-400 hover:text-white disabled:opacity-50"
              title={isLoading ? "Loading..." : "Next song"}
            >
              <SkipForward size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRepeat}
              className={cn(
                'text-neutral-400 hover:text-white relative',
                repeatMode !== 'none' && 'text-red-500'
              )}
              title={`Repeat: ${repeatMode === 'none' ? 'Off' : repeatMode === 'all' ? 'All' : 'One'}`}
            >
              <Repeat size={16} />
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                  1
                </span>
              )}
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-neutral-400 text-xs w-10 text-right">
              {formatTime(progress)}
            </span>
            <Slider
              value={[progress]}
              max={duration || 100}
              step={1}
              onValueChange={handleProgressChange}
              className="flex-1"
              disabled={!currentSong || isLoading}
            />
            <span className="text-neutral-400 text-xs w-10">
              {formatTime(duration)}
            </span>
          </div>
          

        </div>
        
        {/* Volume Controls */}
        <div className="flex items-center space-x-4 flex-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowQueue(true)}
            className="text-neutral-400 hover:text-white hidden md:block"
            title="Queue"
          >
            <List size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (currentSong && 'pictureInPictureEnabled' in document) {
                setIsPiPMode(!isPiPMode);
                console.log('Picture-in-Picture toggled:', !isPiPMode);
              } else {
                console.log('Picture-in-Picture not supported in this browser');
              }
            }}
            className={cn(
              'text-neutral-400 hover:text-white hidden md:block',
              isPiPMode && 'text-red-500'
            )}
            title="Picture-in-Picture"
          >
            <Monitor size={16} />
          </Button>
          <div className="flex items-center space-x-2 hidden md:flex">
            <Button
              variant="ghost"
              size="icon"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
              className="text-neutral-400 hover:text-white"
              title="Volume"
            >
              <Volume2 size={16} />
            </Button>
            <div className="w-20 relative">
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden YouTube Player Container */}
      <div id="youtube-player-container" className="hidden"></div>
      
      {/* Queue View */}
      <QueueView isOpen={showQueue} onClose={() => setShowQueue(false)} />
    </div>
  );
}