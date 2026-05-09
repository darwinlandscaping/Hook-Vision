import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0D1B2A]"
      {...sceneTransitions.zoomThrough}
    >
      {/* Cinematic Background */}
      <motion.div 
        className="absolute inset-0"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 6, ease: 'easeOut' }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/underwater-barra.png`} 
          alt="Underwater Barra" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A] via-[#0D1B2A]/50 to-transparent" />
      </motion.div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 50, scale: 0.9 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/hv-logo2-nobg.png`} 
            alt="HookVision Logo" 
            className="w-[40vw] max-w-[600px] mb-8"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 1.2 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.2 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <h2 className="text-[5vw] font-display text-[#FF6B00] tracking-wide leading-none text-shadow-md">
            AI EYES ON THE WATER
          </h2>
        </motion.div>

        <motion.div
          className="mt-8 flex items-center justify-center gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-2xl font-mono text-[#F5F0E8] font-bold">WA</span>
          <span className="w-2 h-2 rounded-full bg-[#00C9A7]" />
          <span className="text-2xl font-mono text-[#F5F0E8] font-bold">NQ</span>
          <span className="w-2 h-2 rounded-full bg-[#00C9A7]" />
          <span className="text-2xl font-mono text-[#F5F0E8] font-bold">NT</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
