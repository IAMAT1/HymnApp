import { Link, useLocation } from 'wouter';
import { Home, Search, Library, Heart, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Search', href: '/search' },
  { icon: Library, label: 'Your Library', href: '/library' },
];

const libraryItems = [
  { icon: Heart, label: 'Liked Songs', href: '/liked-songs' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const [location] = useLocation();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "w-64 bg-black border-r border-neutral-800 p-6 transition-transform duration-300 ease-in-out z-50",
        "md:relative md:translate-x-0 md:block",
        "fixed left-0 top-0 h-full",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="mb-8">
          <h1 className="text-white text-2xl font-bold flex items-center">
            <Music className="text-green-500 mr-3" size={28} />
            Hymn
          </h1>
        </div>
        
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center py-3 px-4 rounded-lg transition-colors group',
                  isActive 
                    ? 'text-white bg-neutral-800' 
                    : 'text-neutral-400 hover:text-green-500 hover:bg-neutral-800'
                )}
                onClick={onClose}
              >
                <Icon className="mr-4 flex-shrink-0" size={20} />
                <span className="font-medium whitespace-nowrap truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-8 pt-8 border-t border-neutral-800 space-y-2">
          {libraryItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center py-3 px-4 rounded-lg transition-colors group',
                  isActive 
                    ? 'text-white bg-neutral-800' 
                    : 'text-neutral-400 hover:text-green-500 hover:bg-neutral-800'
                )}
                onClick={onClose}
              >
                <Icon className="mr-4 flex-shrink-0" size={20} />
                <span className="font-medium whitespace-nowrap truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}