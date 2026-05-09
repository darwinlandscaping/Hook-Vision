import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import waAppScreenshot from '@assets/screenshots/898f5a0e-eba6-4a78-b40d-d78f0539d56e-00-o6803yqna0ig_spock_replit_dev_hookvision-wa.png';
import nqAppScreenshot from '@assets/screenshots/898f5a0e-eba6-4a78-b40d-d78f0539d56e-00-o6803yqna0ig_spock_replit_dev_hookvision-nq.png';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),  // Narrator
      setTimeout(() => setPhase(2), 2000), // Tide Intel
      setTimeout(() => setPhase(3), 3500), // Trophy Barra
      setTimeout(() => setPhase(4), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const featureItem = (title: string, subtitle: string, delay: number, isVisible: boolean) => (
    <motion.div
      className="bg-[#1F2937]/80 backdrop-blur-md border-l-4 border-[#FF6B00] p-6 mb-6"
      initial={{ x: '100%', opacity: 0, skewX: -10 }}
      animate={isVisible ? { x: 0, opacity: 1, skewX: 0 } : { x: '100%', opacity: 0, skewX: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <h3 className="text-4xl font-display text-[#F5F0E8]">{title}</h3>
      <p className="text-lg text-[#00C9A7] font-mono mt-1">{subtitle}</p>
    </motion.div>
  );

  return (
    <motion.div 
      className="absolute inset-0 w-full h-full bg-[#0D1B2A] overflow-hidden"
      {...sceneTransitions.wipe}
    >
      <div className="absolute inset-0 flex items-center justify-between px-16">
        
        {/* Left Side: Mockups Animating In */}
        <div className="relative w-[45%] h-[80%] flex items-center justify-center">
          <motion.div
            className="absolute z-10 w-[280px]"
            initial={{ y: '100%', rotate: -15, opacity: 0 }}
            animate={{ y: '0%', rotate: -5, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
          >
            <img src={waAppScreenshot} alt="WA App" className="w-full rounded-[2rem] shadow-2xl border-4 border-[#1F2937]" />
          </motion.div>
          <motion.div
            className="absolute z-20 w-[300px]"
            initial={{ y: '100%', rotate: 15, opacity: 0 }}
            animate={{ y: '10%', rotate: 5, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.4 }}
          >
            <img src={nqAppScreenshot} alt="NQ App" className="w-full rounded-[2rem] shadow-2xl border-4 border-[#00C9A7]" />
          </motion.div>
        </div>

        {/* Right Side: Features */}
        <div className="w-[50%] flex flex-col justify-center">
          {featureItem("LIVE AI NARRATION", "AUDIO ANALYSIS IN REAL-TIME", 0, phase >= 1)}
          {featureItem("TIDE INTEL", "REGIONAL GULF & COASTAL DATA", 0, phase >= 2)}
          {featureItem("TROPHY BARRA PREDICTION", "AI STRIKE ZONE FORECASTING", 0, phase >= 3)}
        </div>
      </div>
    </motion.div>
  );
}
