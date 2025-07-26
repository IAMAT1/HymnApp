import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { SplashScreen } from './SplashScreen';
import { LandingPage } from './LandingPage';
import { AuthModal } from './AuthModal';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  // Show splash screen for 2 seconds on initial load, but skip if user is already authenticated
  useEffect(() => {
    if (!loading) {
      // If user is already authenticated, skip splash screen
      if (user) {
        setShowSplash(false);
      } else {
        const timer = setTimeout(() => {
          setShowSplash(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, user]);

  const handleSignIn = () => {
    setAuthMode('signin');
    setShowAuthModal(true);
  };

  const handleSignUp = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  // Show splash screen while loading or during initial 2 seconds
  if (loading || showSplash) {
    return (
      <AnimatePresence>
        <SplashScreen onComplete={() => setShowSplash(false)} />
      </AnimatePresence>
    );
  }

  // If user is authenticated, show the main app
  if (user) {
    return <>{children}</>;
  }

  // Show landing page for unauthenticated users
  return (
    <>
      <LandingPage onSignIn={handleSignIn} onSignUp={handleSignUp} />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}