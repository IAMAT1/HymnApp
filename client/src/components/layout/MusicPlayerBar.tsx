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
  Music
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { QueueView } from '@/components/queue/QueueView';
import { cn } from '@/lib/utils';

export function MusicPlayerBar() {
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
  } = useMusicPlayer();
  
  const { isLiked, toggleLikedSong } = useLikedSongs();

  const [showQueue, setShowQueue] = useState(false);
  const [isPiPMode, setIsPiPMode] = useState(false);

  const { currentSong, isPlaying, volume, progress, duration, isShuffled, repeatMode } = playerState;

  // Debug: Log player state changes
  console.log('MusicPlayerBar render - currentSong:', currentSong?.title, 'isPlaying:', isPlaying, 'loading:', isLoading, 'pendingSong:', pendingSong?.title);

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
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-md border-t border-neutral-700/50 px-3 sm:px-6 py-2 z-50 w-full shadow-2xl">
      <div className="flex items-center justify-between max-w-full overflow-hidden rounded-xl bg-neutral-800/60 px-4 py-2 mx-auto max-w-7xl">
        {/* Current Song Info */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 max-w-[200px] sm:max-w-[300px]">
          {currentSong ? (
            <>
              <div className="relative">
                <img 
                  src={currentSong.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=60&h=60'} 
                  alt={currentSong.title} 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shadow-lg"
                />
              </div>
              
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-white truncate text-xs sm:text-sm">
                  {currentSong.title}
                </h4>
                <p className="text-neutral-400 text-xs truncate hidden sm:block">
                  {currentSong.artist}
                  {isLoading && pendingSong && (
                    <span className="ml-2 text-blue-400 animate-pulse flex items-center">
                      <Loader2 size={12} className="animate-spin mr-1" />
                      Loading "{pendingSong.title}"...
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
                  'text-neutral-400 hover:text-white hidden sm:flex',
                  isLiked(currentSong.id) && 'text-red-500 hover:text-red-400'
                )}
              >
                <Heart size={16} fill={isLiked(currentSong.id) ? 'currentColor' : 'none'} />
              </Button>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-neutral-700 rounded-lg flex items-center justify-center shadow-lg">
                <Music size={16} className="text-green-500 sm:w-5 sm:h-5" />
              </div>
              <div className="text-neutral-400 hidden sm:block">
                <p className="text-sm font-medium">Music Player Ready</p>
                <p className="text-xs">Select a song to start streaming</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Player Controls */}
        <div className="flex-1 max-w-sm sm:max-w-lg mx-1 sm:mx-2 md:mx-4">
          <div className="flex items-center justify-center space-x-1 sm:space-x-2 mb-1 sm:mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={cn(
                'text-neutral-400 hover:text-white',
                isShuffled && 'text-green-500'
              )}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={previousSong}
              disabled={isLoading || playerState.queue.length === 0}
              className="text-neutral-400 hover:text-white disabled:opacity-50"
              title={isLoading ? "Loading..." : playerState.queue.length === 0 ? "No previous song" : "Previous song"}
            >
              <SkipBack size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlayPause}
              disabled={!currentSong || isLoading}
              className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:bg-neutral-600 disabled:text-neutral-400 w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-lg"
              title={!currentSong ? "No song selected" : isLoading ? "Loading..." : isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin sm:w-5 sm:h-5" />
              ) : isPlaying ? (
                <Pause size={16} className="sm:w-5 sm:h-5" />
              ) : (
                <Play size={16} className="sm:w-5 sm:h-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextSong}
              disabled={isLoading || playerState.queue.length === 0}
              className="text-neutral-400 hover:text-white disabled:opacity-50"
              title={isLoading ? "Loading..." : playerState.queue.length === 0 ? "No next song" : "Next song"}
            >
              <SkipForward size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRepeat}
              className={cn(
                'text-neutral-400 hover:text-white',
                repeatMode !== 'none' && 'text-green-500'
              )}
              title={`Repeat: ${repeatMode}`}
            >
              <Repeat size={16} />
              {repeatMode === 'one' && (
                <span className="absolute top-1 right-1 text-xs font-bold">1</span>
              )}
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center space-x-2 text-xs text-neutral-400">
            <span className="w-10 text-right">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              max={duration || 100}
              step={1}
              onValueChange={handleProgressChange}
              className="flex-1"
              disabled={!currentSong}
            />
            <span className="w-10">{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* Right Controls */}
        <div className="flex items-center space-x-1 sm:space-x-2 max-w-[150px] sm:max-w-[300px] justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowQueue(!showQueue)}
            className="text-neutral-400 hover:text-white hidden md:flex"
            title="Queue"
          >
            <List size={14} />
          </Button>
          
          {/* Volume Control - Always visible slider */}
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-[80px] sm:min-w-[120px]">
            <Button
              variant="ghost"
              size="icon"
              className="text-neutral-400 hover:text-white w-6 h-6 sm:w-8 sm:h-8"
              title="Volume"
            >
              <Volume2 size={14} className="sm:w-4 sm:h-4" />
            </Button>
            <Slider
              value={[volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="w-12 sm:w-20 flex-shrink-0"
            />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPiPMode(!isPiPMode)}
            className="text-neutral-400 hover:text-white hidden lg:flex"
            title="Picture in Picture"
          >
            <Monitor size={14} />
          </Button>
        </div>
      </div>
      
      {/* Queue View */}
      <QueueView isOpen={showQueue} onClose={() => setShowQueue(false)} />
    </div>
  );
}