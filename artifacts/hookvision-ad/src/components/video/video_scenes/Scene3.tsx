import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 3500),
      setTimeout(() => setPhase(5), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0D1B2A] overflow-hidden"
      {...sceneTransitions.morphExpand}
    >
      {/* Background Sonar UI Image */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}sonar/sonar-demo-3.png`} 
          alt="Sonar Base" 
          className="w-full h-full object-cover opacity-50"
        />
      </motion.div>

      {/* AI Texture Overlay */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 0.6 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/sonar-ai-texture.png`} 
          alt="AI Texture" 
          className="w-full h-full object-cover mix-blend-screen"
        />
      </motion.div>

      {/* Floating UI Elements */}
      {phase >= 2 && (
        <motion.div 
          className="absolute top-[30%] left-[40%] border-2 border-[#00C9A7] rounded-full w-32 h-32 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <motion.div 
            className="w-full h-full rounded-full border border-[#00C9A7] opacity-50"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="absolute -top-8 bg-[#00C9A7] text-[#0D1B2A] px-2 py-1 text-sm font-bold rounded">
            TARGET: 98cm
          </div>
        </motion.div>
      )}

      {phase >= 3 && (
        <motion.div 
          className="absolute bottom-[20%] right-[30%] border-2 border-[#FF6B00] rounded-sm w-48 h-24"
          initial={{ scale: 0.5, opacity: 0, rotateX: 90 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <div className="absolute -top-6 left-0 text-[#FF6B00] font-mono text-sm">
            DEPTH: 4.2m // STRIKE ZONE
          </div>
          <div className="w-full h-full bg-[#FF6B00]/10 backdrop-blur-sm" />
        </motion.div>
      )}

      {/* Headline */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.div
          className="bg-[#0D1B2A]/80 backdrop-blur-md px-12 py-6 border-y border-[#00C9A7]"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={phase >= 4 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[6vw] font-display text-[#F5F0E8] leading-none text-center text-shadow-lg">
            HOOKVISION SEES<br/>
            <span className="text-[#00C9A7]">WHAT YOU MISS</span>
          </h2>
        </motion.div>
      </div>
    </motion.div>
  );
}
