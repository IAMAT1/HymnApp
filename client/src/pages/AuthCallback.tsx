import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Auth callback page - processing OAuth response');
        console.log('Current URL:', window.location.href);
        
        // First, check if there are auth fragments in the URL that Supabase needs to process
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        console.log('URL params:', Object.fromEntries(urlParams));
        console.log('Hash params:', Object.fromEntries(hashParams));
        
        // If we have access_token or other auth parameters, let Supabase handle them
        if (hashParams.get('access_token') || urlParams.get('code')) {
          console.log('Found OAuth parameters, letting Supabase process them...');
          
          // Wait a moment for Supabase to process the OAuth response
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Now check for session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          navigate('/?error=' + encodeURIComponent(error.message));
          return;
        }

        console.log('Session check result:', { 
          hasSession: !!data.session, 
          userId: data.session?.user?.id,
          email: data.session?.user?.email 
        });

        if (data.session?.user) {
          console.log('✅ OAuth authentication successful!');
          console.log('User authenticated:', data.session.user.email);
          // Give AuthContext time to update, then redirect
          setTimeout(() => {
            console.log('Redirecting to main app...');
            navigate('/');
          }, 500);
        } else {
          // If still no session, try one more time after a longer wait
          console.log('No session yet, trying again in 2 seconds...');
          setTimeout(async () => {
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData.session?.user) {
              console.log('✅ Session found on retry!');
              navigate('/');
            } else {
              console.log('❌ No session found, redirecting to landing');
              navigate('/');
            }
          }, 2000);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/?error=' + encodeURIComponent('Authentication failed'));
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="text-white mt-4">Completing sign in...</p>
      </div>
    </div>
  );
}