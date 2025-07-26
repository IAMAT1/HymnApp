import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showLogo, setShowLogo] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Show logo after a brief delay
    const logoTimer = setTimeout(() => setShowLogo(true), 200);
    
    // Animate progress bar
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          setTimeout(onComplete, 300);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    return () => {
      clearTimeout(logoTimer);
      clearInterval(progressTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-green-900/20" />
      
      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-green-400 rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0.3,
            }}
            animate={{
              y: [null, Math.random() * window.innerHeight],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        <AnimatePresence>
          {showLogo && (
            <motion.div
              className="flex flex-col items-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* Logo */}
              <motion.div
                className="mb-8"
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <h1 className="text-6xl md:text-8xl font-bold text-white tracking-wider">
                  <span className="bg-gradient-to-r from-green-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
                    Hymn
                  </span>
                </h1>
              </motion.div>

              {/* Tagline */}
              <motion.p
                className="text-neutral-400 text-lg mb-12 tracking-wide"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
              >
                Your Music, Your World
              </motion.p>

              {/* Progress bar */}
              <div className="w-64 h-1 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-400 to-purple-400"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                />
              </div>

              {/* Loading text */}
              <motion.div
                className="mt-4 text-neutral-500 text-sm"
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                Loading {progress.toFixed(0)}%
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Geeky tech overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-4 text-green-400 text-xs font-mono opacity-30">
          INIT_AUDIO_ENGINE...
        </div>
        <div className="absolute top-4 right-4 text-purple-400 text-xs font-mono opacity-30">
          LOADING_MODULES...
        </div>
        <div className="absolute bottom-4 left-4 text-blue-400 text-xs font-mono opacity-30">
          CONN_ESTABLISHED
        </div>
        <div className="absolute bottom-4 right-4 text-green-400 text-xs font-mono opacity-30">
          READY_STATE: {progress > 90 ? 'TRUE' : 'FALSE'}
        </div>
      </div>
    </motion.div>
  );
}