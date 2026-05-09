import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { StarField, GlowOrb } from '../Particles';
import { AnglerBoat } from '../AnglerBoat';
import type { RegionConfig } from '@/lib/region';

interface Props { region: RegionConfig }

export function Scene1({ region }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 2800),
      setTimeout(() => setPhase(4), 4200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      {/* Video background */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 6, ease: 'easeOut' }}
      >
        <video
          src={`${import.meta.env.BASE_URL}videos/creek-sunrise.mp4`}
          className="w-full h-full object-cover"
          autoPlay muted loop playsInline
        />
        {/* Cinematic grade */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              rgba(0,0,0,0.55) 0%,
              rgba(0,0,0,0.2) 40%,
              rgba(0,0,0,0.15) 60%,
              rgba(0,0,0,0.7) 100%)`,
          }}
        />
        {/* Color tint */}
        <div
          className="absolute inset-0 mix-blend-multiply"
          style={{ background: `${region.skyFrom}99` }}
        />
      </motion.div>

      {/* Stars */}
      <StarField count={100} seed={13} />

      {/* Atmosphere glow */}
      <GlowOrb x="50%" y="45%" size="80vw" color={region.primaryColor} opacity={0.06} />

      {/* RACING BOAT — enters from right, slows to stop */}
      <motion.div
        className="absolute"
        style={{ bottom: '28%', left: 0, right: 0 }}
        initial={{ x: '100vw' }}
        animate={phase >= 1 ? { x: '8vw' } : { x: '100vw' }}
        transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnglerBoat
          width={560}
          primaryColor={region.primaryColor}
          castPhase={0}
          showWake
          bobAmplitude={4}
        />
      </motion.div>

      {/* Water surface line */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          bottom: '26%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${region.secondaryColor}40, ${region.primaryColor}30, ${region.secondaryColor}40, transparent)`,
        }}
        initial={{ scaleX: 0 }}
        animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 1.5 }}
      />

      {/* Region title */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start pl-[8vw] pb-[12vh]">
        <div className="overflow-hidden mb-2">
          <motion.h1
            className="text-[9vw] font-display leading-none tracking-tight text-white"
            style={{ textShadow: `0 0 80px ${region.primaryColor}60, 0 2px 12px rgba(0,0,0,0.9)` }}
            initial={{ y: '110%' }}
            animate={phase >= 2 ? { y: 0 } : { y: '110%' }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          >
            {region.location}
          </motion.h1>
        </div>

        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="h-[2px]"
            style={{ background: region.primaryColor }}
            initial={{ width: 0 }}
            animate={phase >= 3 ? { width: 40 } : { width: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />
          <span
            className="text-[1.5vw] tracking-[0.3em] font-semibold uppercase font-mono"
            style={{ color: region.secondaryColor, textShadow: `0 0 20px ${region.secondaryColor}80` }}
          >
            {region.subtitle}
          </span>
        </motion.div>

        {/* Waters list */}
        <motion.div
          className="flex items-center gap-3 mt-3"
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {region.waters.map((w, i) => (
            <span key={w} className="flex items-center gap-3">
              <span className="font-mono text-[1vw] text-white/50">{w}</span>
              {i < region.waters.length - 1 && (
                <span className="w-1 h-1 rounded-full" style={{ background: region.primaryColor }} />
              )}
            </span>
          ))}
        </motion.div>
      </div>

      {/* HookVision wordmark top right */}
      <motion.div
        className="absolute top-8 right-8 font-mono text-xs tracking-widest text-white/40"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        HOOKVISION AI
      </motion.div>
    </motion.div>
  );
}
