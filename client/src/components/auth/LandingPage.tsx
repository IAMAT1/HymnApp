import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Music, Headphones, Zap, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  const [email, setEmail] = useState('');

  const features = [
    {
      icon: Music,
      title: "Unlimited Music",
      description: "Access millions of songs from around the world"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Instant streaming with zero buffering"
    },
    {
      icon: Headphones,
      title: "High Quality",
      description: "Crystal clear audio up to 320kbps"
    },
    {
      icon: Star,
      title: "Personalized",
      description: "AI-powered recommendations just for you"
    },
    {
      icon: Users,
      title: "Social",
      description: "Share playlists and discover new music"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-green-900/20">
        <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-gradient-to-r from-green-400 to-purple-400 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                scale: 0,
              }}
              animate={{
                scale: [0, 1, 0],
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              transition={{
                duration: 4 + Math.random() * 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <motion.header
        className="relative z-10 p-6 flex justify-between items-center"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center space-x-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-purple-400 bg-clip-text text-transparent">
            Hymn
          </h1>
        </div>
        <div className="flex space-x-4">
          <Button
            variant="ghost"
            onClick={onSignIn}
            className="text-white hover:text-green-400 transition-colors"
          >
            Sign In
          </Button>
          <Button
            onClick={onSignUp}
            className="bg-gradient-to-r from-green-500 to-purple-500 hover:from-green-600 hover:to-purple-600 text-white px-6 rounded-full"
          >
            Sign Up
          </Button>
        </div>
      </motion.header>

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {/* Main title */}
          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Music for
            <br />
            <span className="bg-gradient-to-r from-green-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              everyone
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-xl md:text-2xl text-neutral-300 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            Millions of songs, podcasts, and audiobooks. No credit card needed.
          </motion.p>

          {/* CTA Section */}
          <motion.div
            className="space-y-4 mb-12"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <Button
              onClick={onSignUp}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-purple-500 hover:from-green-600 hover:to-purple-600 text-white px-12 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105"
            >
              <Play className="mr-2" size={20} />
              Start Listening Now
            </Button>
            
            <div className="flex items-center justify-center space-x-4 text-sm text-neutral-400">
              <span>or</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500 rounded-full px-6 py-3"
              />
              <Button
                onClick={() => onSignUp()}
                className="bg-white text-black hover:bg-neutral-200 rounded-full px-8 py-3 font-semibold whitespace-nowrap"
              >
                Get Started
              </Button>
            </div>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            className="flex flex-wrap justify-center items-center space-x-8 text-neutral-500 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            <span>✓ Free forever</span>
            <span>✓ No ads</span>
            <span>✓ High quality</span>
            <span>✓ Offline mode</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Features Section */}
      <motion.section
        className="relative z-10 py-20 px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.2 }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Why choose <span className="text-green-400">Hymn</span>?
            </h2>
            <p className="text-xl text-neutral-400">
              Experience music like never before
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6 hover:border-green-500/50 transition-all duration-300"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6, delay: 1.4 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 bg-gradient-to-r from-green-500/20 to-purple-500/20 rounded-xl">
                    <feature.icon className="text-green-400" size={24} />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                </div>
                <p className="text-neutral-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Footer CTA */}
      <motion.section
        className="relative z-10 py-20 px-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.8 }}
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-6">
            Ready to start your musical journey?
          </h2>
          <p className="text-xl text-neutral-400 mb-8">
            Join millions of music lovers around the world
          </p>
          <div className="space-y-4">
            <Button
              onClick={onSignUp}
              size="lg"
              className="bg-gradient-to-r from-green-500 to-purple-500 hover:from-green-600 hover:to-purple-600 text-white px-12 py-4 rounded-full text-lg font-semibold"
            >
              Create Your Account
            </Button>
            <div className="text-sm text-neutral-500">
              Already have an account?{' '}
              <button
                onClick={onSignIn}
                className="text-green-400 hover:text-green-300 underline"
              >
                Sign in here
              </button>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}