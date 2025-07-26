import { useState } from 'react';
import { Plus, Search, List, Grid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';

export default function Library() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [, navigate] = useLocation();

  return (
    <div className="p-6 pb-32 fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white">Your Library</h2>
        <Button
          variant="ghost"
          size="icon"
          className="text-neutral-400 hover:text-white"
        >
          <Plus size={20} />
        </Button>
      </div>
      
      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={16} />
          <Input
            type="text"
            placeholder="Search in Your Library"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-800 text-white pl-10 pr-4 py-2 rounded-md border-neutral-700 focus:border-green-500"
          />
        </div>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'text-green-500' : 'text-neutral-400 hover:text-white'}
          >
            <List size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'text-green-500' : 'text-neutral-400 hover:text-white'}
          >
            <Grid size={16} />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-center py-12">
          <h3 className="text-xl font-bold text-white mb-4">Your library is empty</h3>
          <p className="text-neutral-400 mb-6">
            Start building your music collection by liking songs and creating playlists
          </p>
          <Button 
            onClick={() => navigate('/browse')}
            className="bg-green-500 hover:bg-green-400 text-black px-6 py-2 rounded-full font-medium"
          >
            Browse Music
          </Button>
        </div>
      </div>
    </div>
  );
}
