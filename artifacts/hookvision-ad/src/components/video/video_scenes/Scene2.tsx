import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import lifestyleRef from '@assets/live_sonar_refs/humminbird-megalive2-lifestyle.webp';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0D1B2A]"
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute inset-0 grid grid-cols-2">
        {/* Left Side - Image */}
        <motion.div 
          className="relative h-full overflow-hidden"
          initial={{ x: '-10%' }}
          animate={{ x: '0%' }}
          transition={{ duration: 5, ease: 'easeOut' }}
        >
          <img 
            src={lifestyleRef} 
            alt="Angler with sonar" 
            className="w-full h-full object-cover filter grayscale contrast-125"
          />
          <div className="absolute inset-0 bg-[#0D1B2A]/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0D1B2A]" />
        </motion.div>

        {/* Right Side - Text */}
        <div className="flex flex-col justify-center px-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 50 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-[6vw] font-display leading-[0.9] text-[#F5F0E8]">
              READING SONAR<br/>
              <span className="text-[#FF6B00]">IN THE FIELD?</span>
            </h2>
          </motion.div>

          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-2xl text-[#A0AAB5] border-l-4 border-[#00C9A7] pl-4">
              Squinting at screens. Guessing targets.<br/>
              That's the old way.
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
