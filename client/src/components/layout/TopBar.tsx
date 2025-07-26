import { ChevronLeft, ChevronRight, User, Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useState } from 'react';

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleGoBack = () => {
    try {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      navigate('/');
    }
  };

  const handleGoForward = () => {
    try {
      window.history.forward();
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  // Close menu when clicking outside
  const handleOutsideClick = () => {
    setShowProfileMenu(false);
  };

  return (
    <div className="bg-neutral-900 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleSidebar}
          className="md:hidden text-neutral-400 hover:text-white"
        >
          <Menu size={20} />
        </Button>
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleGoBack}
            className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
            title="Go back"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleGoForward}
            className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
            title="Go forward"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {user && (
          <>
            <span className="text-sm text-neutral-400 hidden md:block">
              Welcome, {user.user_metadata?.full_name || user.email}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={signOut}
              className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-red-400"
              title="Sign out"
            >
              <LogOut size={16} />
            </Button>
          </>
        )}
        <div className="relative">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleProfileClick}
            className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white"
            title="Profile menu"
          >
            <User size={16} />
          </Button>
          {showProfileMenu && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={handleOutsideClick}
              />
              <div className="absolute right-0 top-10 bg-neutral-800 border border-neutral-700 rounded-lg p-2 min-w-48 z-50 shadow-xl">
                <div className="text-sm text-neutral-300 p-2 border-b border-neutral-700">
                  {user?.user_metadata?.full_name || user?.email}
                </div>
                <button 
                  onClick={() => {
                    navigate('/library');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left text-sm text-neutral-300 hover:text-white p-2 hover:bg-neutral-700 rounded"
                >
                  Your Library
                </button>
                <button 
                  onClick={() => {
                    navigate('/liked-songs');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left text-sm text-neutral-300 hover:text-white p-2 hover:bg-neutral-700 rounded"
                >
                  Liked Songs
                </button>
                <button 
                  onClick={signOut}
                  className="w-full text-left text-sm text-red-400 hover:text-red-300 p-2 hover:bg-neutral-700 rounded"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
