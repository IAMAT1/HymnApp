import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Eye, EyeOff, Github, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'signin' | 'signup';
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, mode, onSuccess }: AuthModalProps) {
  const [currentMode, setCurrentMode] = useState(mode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (currentMode === 'signup') {
        if (password !== confirmPassword) {
          toast({
            title: "Passwords don't match",
            description: "Please make sure your passwords match.",
            variant: "destructive"
          });
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            }
          }
        });

        if (error) throw error;

        toast({
          title: "Welcome to Hymn!",
          description: "Your account has been created successfully.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully.",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Authentication failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      console.log('Initiating Google OAuth with redirect to:', `${window.location.origin}/auth/callback`);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('Google OAuth error:', error);
        throw error;
      }

      // OAuth will redirect, so we don't expect immediate data
      console.log('Google OAuth redirect initiated:', data);
      
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast({
        title: "Google sign in failed",
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
    // Note: Don't set setIsLoading(false) in finally because we're redirecting
  };

  const handleGithubSignIn = async () => {
    setIsLoading(true);
    try {
      console.log('Initiating GitHub OAuth with redirect to:', `${window.location.origin}/auth/callback`);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'read:user user:email'
        }
      });

      if (error) {
        console.error('GitHub OAuth error:', error);
        throw error;
      }

      // OAuth will redirect, so we don't expect immediate data
      console.log('GitHub OAuth redirect initiated:', data);
      
    } catch (error: any) {
      console.error('GitHub sign in error:', error);
      toast({
        title: "GitHub sign in failed",
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
    // Note: Don't set setIsLoading(false) in finally because we're redirecting
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-neutral-900 rounded-2xl p-8 w-full max-w-md border border-neutral-800"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {currentMode === 'signin' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="text-neutral-400 text-sm">
                  {currentMode === 'signin' 
                    ? 'Sign in to your Hymn account' 
                    : 'Start your musical journey today'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Social Sign In */}
            <div className="space-y-3 mb-6">
              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full bg-white text-black hover:bg-neutral-100 border-0"
                disabled={isLoading}
              >
                <Chrome className="mr-2" size={18} />
                Continue with Google
              </Button>
              <Button
                onClick={handleGithubSignIn}
                variant="outline"
                className="w-full bg-neutral-800 text-white hover:bg-neutral-700 border-neutral-700"
                disabled={isLoading}
              >
                <Github className="mr-2" size={18} />
                Continue with GitHub
              </Button>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <div className="flex-1 h-px bg-neutral-700"></div>
              <span className="text-neutral-500 text-sm">or</span>
              <div className="flex-1 h-px bg-neutral-700"></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {currentMode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
                  <Input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white pl-10"
                    required
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 text-white pl-10"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-neutral-800 border-neutral-700 text-white pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </Button>
              </div>

              {currentMode === 'signup' && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" size={18} />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-neutral-800 border-neutral-700 text-white pl-10"
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-green-500 to-purple-500 hover:from-green-600 hover:to-purple-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <motion.div
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  currentMode === 'signin' ? 'Sign In' : 'Create Account'
                )}
              </Button>
            </form>

            {/* Switch mode */}
            <div className="mt-6 text-center text-sm">
              <span className="text-neutral-400">
                {currentMode === 'signin' 
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </span>
              <button
                onClick={() => setCurrentMode(currentMode === 'signin' ? 'signup' : 'signin')}
                className="text-green-400 hover:text-green-300 font-medium"
              >
                {currentMode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </div>

            {currentMode === 'signup' && (
              <p className="text-xs text-neutral-500 text-center mt-4">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}