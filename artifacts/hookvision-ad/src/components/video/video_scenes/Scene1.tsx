import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { StarField, WaterSurface, GlowOrb } from '../Particles';
import { BoatSilhouette } from '../BoatSilhouette';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3200),
      setTimeout(() => setPhase(4), 4600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      {/* Deep night sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #020810 0%, #040d1a 35%, #061526 55%, #0a1e35 75%, #0d2540 100%)',
        }}
      />

      {/* Stars */}
      <StarField count={180} seed={13} />

      {/* Milky Way band */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 200% 30% at 60% 30%, rgba(150,180,255,0.3) 0%, transparent 70%)',
        }}
      />

      {/* Aurora glow top */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[40%] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,201,167,0.12) 0%, transparent 70%)',
        }}
        animate={{ opacity: [0.6, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Horizon glow */}
      <GlowOrb x="50%" y="58%" size="90vw" color="#FF6B00" opacity={0.08} />
      <GlowOrb x="50%" y="56%" size="50vw" color="#FF8C00" opacity={0.12} />

      {/* Water surface lower half */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '42%', background: 'linear-gradient(180deg, #061828 0%, #040e18 100%)' }}
      >
        <WaterSurface className="absolute inset-0" />

        {/* Water reflection shimmer */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(255,107,0,0.06) 40%, rgba(0,201,167,0.04) 100%)',
          }}
          animate={{ opacity: [0.5, 1, 0.6] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Boat reflection (blurred, inverted) */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{ filter: 'blur(6px)', opacity: 0.2, transform: 'scaleY(-0.5) translateX(-50%)' }}
          initial={{ opacity: 0 }}
          animate={phase >= 1 ? { opacity: 0.2 } : { opacity: 0 }}
          transition={{ duration: 1.5 }}
        >
          <BoatSilhouette width={320} sonar={false} bobAmplitude={0} />
        </motion.div>
      </div>

      {/* Horizon line */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{ top: '58%', height: '1px', background: 'rgba(0,201,167,0.2)' }}
        initial={{ scaleX: 0 }}
        animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Boat on water */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '38%' }}
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <BoatSilhouette width={420} sonar sonarColor="#00C9A7" bobAmplitude={5} />
      </motion.div>

      {/* Text block bottom */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-[8vh]">
        <div className="overflow-hidden mb-3">
          <motion.h1
            className="text-[10vw] font-display leading-none tracking-tight text-white"
            style={{ textShadow: '0 0 60px rgba(255,107,0,0.4), 0 2px 8px rgba(0,0,0,0.8)' }}
            initial={{ y: '110%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '110%' }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            KIMBERLEY, WA
          </motion.h1>
        </div>

        <motion.div
          className="flex items-center gap-5"
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="h-[1px] bg-gradient-to-r from-transparent to-[#FF6B00]"
            initial={{ width: 0 }}
            animate={phase >= 3 ? { width: 48 } : { width: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
          <span
            className="text-[1.4vw] tracking-[0.35em] font-semibold uppercase"
            style={{ color: '#00C9A7', textShadow: '0 0 20px rgba(0,201,167,0.6)' }}
          >
            WILD COUNTRY. BIG FISH.
          </span>
          <motion.div
            className="h-[1px] bg-gradient-to-l from-transparent to-[#FF6B00]"
            initial={{ width: 0 }}
            animate={phase >= 3 ? { width: 48 } : { width: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="mt-6 flex flex-col items-center gap-1"
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-white/30 text-xs tracking-widest font-mono uppercase">HookVision</span>
          <motion.div
            className="w-[1px] bg-gradient-to-b from-[#00C9A7] to-transparent"
            animate={{ height: [0, 28, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
