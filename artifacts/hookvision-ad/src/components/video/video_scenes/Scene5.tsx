import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { StarField, WaterSurface, GlowOrb } from '../Particles';
import { AnglerBoat } from '../AnglerBoat';
import { BarramundiFish } from '../BarramundiFish';
import type { RegionConfig } from '@/lib/region';

interface Props { region: RegionConfig }

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function BurstParticles({ active, color1, color2 }: { active: boolean; color1: string; color2: string }) {
  const rand = useMemo(() => seededRand(99), []);
  const particles = useMemo(
    () =>
      Array.from({ length: 55 }, (_, i) => ({
        id: i,
        angle: (i / 55) * 360 + rand() * 12,
        speed: 70 + rand() * 160,
        size: rand() * 3 + 1,
        color: i % 3 === 0 ? color1 : i % 3 === 1 ? color2 : '#ffffff',
        dur: rand() * 1.1 + 0.7,
      })),
    [rand, color1, color2],
  );

  return (
    <AnimatePresence>
      {active && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            return (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{ width: p.size, height: p.size, background: p.color }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(rad) * p.speed, y: Math.sin(rad) * p.speed, opacity: 0, scale: 0.2 }}
                transition={{ duration: p.dur, ease: [0.2, 1, 0.4, 1] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

export function Scene5({ region }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 250),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2600),
      setTimeout(() => setPhase(5), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.zoomThrough}
      style={{ background: `linear-gradient(180deg, ${region.skyFrom} 0%, #020c16 40%, #040f1e 70%, #061826 100%)` }}
    >
      <StarField count={200} seed={55} />

      {/* Dawn atmosphere */}
      <GlowOrb x="50%" y="58%" size="100vw" color={region.primaryColor} opacity={0.06} />
      <GlowOrb x="50%" y="52%" size="55vw" color={region.primaryColor} opacity={0.09} />
      <GlowOrb x="50%" y="48%" size="25vw" color="#FFB347" opacity={0.06} />

      {/* Horizon glow */}
      <motion.div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: '58%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${region.primaryColor}50, rgba(255,180,0,0.6), ${region.primaryColor}50, transparent)`,
        }}
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.5 }}
      />

      {/* Sun disc */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          left: '50%',
          top: '57%',
          transform: 'translate(-50%,-50%)',
          background: `radial-gradient(circle, rgba(255,200,80,0.7) 0%, ${region.primaryColor}50 40%, transparent 70%)`,
          filter: 'blur(3px)',
        }}
        initial={{ width: 0, height: 0, opacity: 0 }}
        animate={phase >= 1 ? { width: '15vw', height: '15vw', opacity: 1 } : {}}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Water */}
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden"
        style={{ height: '42%', background: 'linear-gradient(180deg, #061828 0%, #030d18 100%)' }}
      >
        <WaterSurface className="absolute inset-0" />
        {/* Sun reflection */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 bottom-0"
          style={{
            width: 6,
            height: '100%',
            background: `linear-gradient(to bottom, ${region.primaryColor}50, ${region.primaryColor}20, transparent)`,
            filter: 'blur(6px)',
          }}
          animate={{ opacity: [0.5, 1, 0.6], scaleX: [1, 3, 1.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Boat at horizon */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '38%' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1.2 }}
      >
        <AnglerBoat
          width={300}
          primaryColor={region.primaryColor}
          castPhase={3}
          showWake={false}
          bobAmplitude={3}
        />
      </motion.div>

      {/* Barra leaping out of water */}
      <AnimatePresence>
        {phase >= 3 && (
          <motion.div
            className="absolute"
            style={{ left: '72%', bottom: '35%' }}
            initial={{ opacity: 0, y: 60, rotate: -40 }}
            animate={{ opacity: [0, 1, 1, 0], y: [60, -30, -50, 20], rotate: [-40, -60, -80, -100] }}
            transition={{ duration: 1.8, times: [0, 0.3, 0.6, 1], ease: 'easeOut' }}
          >
            <BarramundiFish
              width={180}
              color="#a0cce0"
              glowColor={region.secondaryColor}
              swimAmplitude={0}
              style={{ transform: 'rotate(-30deg)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centre: logo + burst */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: '8vh' }}>
        <div className="relative">
          <BurstParticles active={phase >= 2} color1={region.primaryColor} color2={region.secondaryColor} />

          {/* Ripple rings */}
          {phase >= 2 && [0, 0.25, 0.5, 0.75].map((delay) => (
            <motion.div
              key={delay}
              className="absolute rounded-full border pointer-events-none"
              style={{
                borderColor: `${region.primaryColor}60`,
                left: '50%', top: '50%',
                transform: 'translate(-50%,-50%)',
              }}
              initial={{ width: 60, height: 60, opacity: 0.8 }}
              animate={{ width: '110vw', height: '110vw', opacity: 0 }}
              transition={{ duration: 1.6, delay, ease: 'easeOut' }}
            />
          ))}

          <motion.div
            initial={{ opacity: 0, scale: 0.65, filter: 'blur(24px)' }}
            animate={phase >= 2 ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={`${import.meta.env.BASE_URL}images/hv-logo2-nobg.png`}
              alt="HookVision"
              style={{
                width: '36vw',
                maxWidth: 540,
                filter: `drop-shadow(0 0 40px ${region.primaryColor}60) drop-shadow(0 0 80px ${region.primaryColor}25)`,
              }}
            />
          </motion.div>
        </div>

        {/* Tagline */}
        <motion.h2
          className="text-[4vw] font-display tracking-wide mt-5 text-center"
          style={{
            color: region.primaryColor,
            textShadow: `0 0 60px ${region.primaryColor}60`,
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          {region.tagline.toUpperCase()}
        </motion.h2>

        {/* Region badge */}
        <motion.div
          className="flex items-center gap-5 mt-4"
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {(['WA', 'NQ', 'NT'] as const).map((r, i) => {
            const active = r.toLowerCase() === region.id;
            return (
              <motion.div key={r} className="flex items-center gap-2"
                initial={{ opacity: 0, y: 8 }}
                animate={phase >= 4 ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08 }}
              >
                <motion.div
                  className="w-2 h-2 rounded-full"
                  style={{ background: active ? region.secondaryColor : 'rgba(255,255,255,0.2)' }}
                  animate={active ? { boxShadow: [`0 0 0 ${region.secondaryColor}`, `0 0 12px ${region.secondaryColor}`, `0 0 0 ${region.secondaryColor}`] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: active ? 'white' : 'rgba(255,255,255,0.3)' }}
                >{r}</span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-7 px-10 py-4 rounded-full font-display text-[1.6vw] tracking-widest text-white border-2"
          style={{
            borderColor: region.secondaryColor,
            background: `linear-gradient(135deg, ${region.secondaryColor}18, ${region.secondaryColor}06)`,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 5 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6 }}
        >
          <motion.span
            animate={{ textShadow: [`0 0 20px ${region.secondaryColor}30`, `0 0 50px ${region.secondaryColor}70`, `0 0 20px ${region.secondaryColor}30`] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            {region.ctaLine}
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}
