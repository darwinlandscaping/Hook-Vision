import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full"
      {...sceneTransitions.fadeBlur}
    >
      {/* Background Video */}
      <motion.div 
        className="absolute inset-0"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 6, ease: 'easeOut' }}
      >
        <video 
          src={`${import.meta.env.BASE_URL}videos/creek-sunrise.mp4`}
          className="w-full h-full object-cover"
          autoPlay muted loop playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A] via-transparent to-transparent opacity-80" />
      </motion.div>

      {/* Foreground Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-[15vh]">
        <div className="overflow-hidden">
          <motion.h1 
            className="text-[12vw] font-display leading-none tracking-tight text-[#F5F0E8] text-shadow-lg"
            initial={{ y: '100%' }}
            animate={phase >= 1 ? { y: 0 } : { y: '100%' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            KIMBERLEY, WA
          </motion.h1>
        </div>
        
        <motion.div 
          className="flex items-center gap-4 mt-4"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1 }}
        >
          <div className="w-12 h-[2px] bg-[#FF6B00]" />
          <p className="text-xl tracking-[0.2em] text-[#00C9A7] font-semibold">
            WILD COUNTRY
          </p>
          <div className="w-12 h-[2px] bg-[#FF6B00]" />
        </motion.div>
      </div>
    </motion.div>
  );
}
