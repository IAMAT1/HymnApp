import { useMusicPlayer } from '@/contexts/MusicPlayerContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Play, Trash2, Music } from 'lucide-react';
import { Song } from '@/types/music';

interface QueueViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueueView({ isOpen, onClose }: QueueViewProps) {
  const { 
    playerState, 
    playSong,
    clearQueue
  } = useMusicPlayer();

  if (!isOpen) return null;

  const handlePlaySong = async (song: Song) => {
    try {
      await playSong(song);
    } catch (error) {
      console.error('Failed to play song:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="bg-zinc-900 w-96 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold">Queue</h2>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearQueue}
              className="text-zinc-400 hover:text-white"
            >
              <Trash2 size={16} />
              Clear
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-zinc-400 hover:text-white"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Current Song */}
        {playerState.currentSong && (
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-white text-sm font-medium mb-2 flex items-center">
              <Music size={16} className="mr-2 text-green-500" />
              Now Playing
            </h3>
            <div className="flex items-center gap-3">
              <img
                src={playerState.currentSong.coverUrl || 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?ixlib=rb-4.0.3&auto=format&fit=crop&w=40&h=40'}
                alt={playerState.currentSong.title}
                className="w-10 h-10 rounded object-cover bg-zinc-800"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {playerState.currentSong.title}
                </p>
                <p className="text-zinc-400 text-xs truncate">
                  {playerState.currentSong.artist}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Queue Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Music size={48} className="mx-auto mb-4 text-green-500" />
            <h3 className="text-white font-medium mb-2">Music Queue</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Your song queue will appear here
            </p>
            <div className="bg-zinc-800 rounded-lg p-4 text-left max-w-sm">
              <h4 className="text-white text-sm font-medium mb-2">Features:</h4>
              <ul className="text-zinc-400 text-xs space-y-1">
                <li>• Direct audio streaming</li>
                <li>• High-quality playback</li>  
                <li>• Queue management</li>
                <li>• Seamless song transitions</li>
              </ul>
            </div>
            <p className="text-zinc-400 text-xs mt-4">
              Add songs to start building your queue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}