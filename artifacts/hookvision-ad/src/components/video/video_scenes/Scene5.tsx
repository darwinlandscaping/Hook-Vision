import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { StarField, WaterSurface, GlowOrb } from '../Particles';
import { BoatSilhouette } from '../BoatSilhouette';

function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function LogoBurstParticles({ active }: { active: boolean }) {
  const rand = useMemo(() => seededRand(99), []);
  const particles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        angle: (i / 60) * 360 + rand() * 15,
        speed: 80 + rand() * 180,
        size: rand() * 3 + 1,
        color: i % 3 === 0 ? '#FF6B00' : i % 3 === 1 ? '#00C9A7' : '#ffffff',
        duration: rand() * 1.2 + 0.8,
      })),
    [rand],
  );

  return (
    <AnimatePresence>
      {active && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.speed;
            const ty = Math.sin(rad) * p.speed;
            return (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{ width: p.size, height: p.size, background: p.color }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: tx, y: ty, opacity: 0, scale: 0.2 }}
                transition={{ duration: p.duration, ease: [0.2, 1, 0.4, 1] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

function GoldRipples({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active &&
        [0, 0.3, 0.6, 0.9].map((delay) => (
          <motion.div
            key={delay}
            className="absolute inset-0 rounded-full border pointer-events-none"
            style={{ borderColor: 'rgba(255,107,0,0.5)', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}
            initial={{ width: 80, height: 80, opacity: 0.8 }}
            animate={{ width: '120vw', height: '120vw', opacity: 0 }}
            transition={{ duration: 1.8, delay, ease: 'easeOut' }}
          />
        ))}
    </AnimatePresence>
  );
}

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 4200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.zoomThrough}
      style={{ background: 'linear-gradient(180deg, #010609 0%, #020c16 40%, #040f1e 70%, #061826 100%)' }}
    >
      {/* Stars */}
      <StarField count={220} seed={55} />

      {/* Atmosphere layers */}
      <GlowOrb x="50%" y="55%" size="100vw" color="#FF6B00" opacity={0.05} />
      <GlowOrb x="50%" y="50%" size="60vw" color="#FF8C00" opacity={0.08} />
      <GlowOrb x="50%" y="45%" size="30vw" color="#FFB347" opacity={0.06} />

      {/* Horizon */}
      <motion.div
        className="absolute inset-x-0"
        style={{
          top: '58%',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,107,0,0.3) 20%, rgba(255,180,0,0.5) 50%, rgba(255,107,0,0.3) 80%, transparent 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.5 }}
      />

      {/* Sun/dawn disc */}
      <motion.div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '57%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(255,200,80,0.7) 0%, rgba(255,107,0,0.3) 40%, transparent 70%)',
          filter: 'blur(2px)',
        }}
        initial={{ width: 0, height: 0, opacity: 0 }}
        animate={phase >= 1 ? { width: '18vw', height: '18vw', opacity: 1 } : {}}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Water */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '42%', background: 'linear-gradient(180deg, #061828 0%, #030d18 100%)' }}
      >
        <WaterSurface className="absolute inset-0" />
        {/* Reflection streak */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 bottom-0"
          style={{
            width: '4px',
            height: '100%',
            background: 'linear-gradient(to bottom, rgba(255,180,80,0.4), rgba(255,107,0,0.15), transparent)',
            filter: 'blur(4px)',
          }}
          animate={{ opacity: [0.5, 1, 0.6], scaleX: [1, 2.5, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Silhouette boat */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '38%' }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <BoatSilhouette width={340} sonar sonarColor="#FF6B00" bobAmplitude={3} />
      </motion.div>

      {/* Logo + burst */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ bottom: '10%' }}>
        <div className="relative">
          <GoldRipples active={phase >= 2} />
          <LogoBurstParticles active={phase >= 2} />

          <motion.div
            initial={{ opacity: 0, scale: 0.7, filter: 'blur(20px)' }}
            animate={
              phase >= 2
                ? { opacity: 1, scale: 1, filter: 'blur(0px)' }
                : { opacity: 0, scale: 0.7, filter: 'blur(20px)' }
            }
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <img
              src={`${import.meta.env.BASE_URL}images/hv-logo2-nobg.png`}
              alt="HookVision"
              style={{
                width: '38vw',
                maxWidth: 580,
                filter: 'drop-shadow(0 0 40px rgba(255,107,0,0.5)) drop-shadow(0 0 80px rgba(255,180,0,0.2))',
              }}
            />
          </motion.div>
        </div>

        {/* Tagline */}
        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.8 }}
        >
          <h2
            className="text-[4.5vw] font-display tracking-wide"
            style={{
              color: '#FF6B00',
              textShadow: '0 0 60px rgba(255,107,0,0.5), 0 0 120px rgba(255,107,0,0.2)',
            }}
          >
            AI EYES ON THE WATER
          </h2>
        </motion.div>

        {/* Region dots */}
        <motion.div
          className="flex items-center gap-6 mt-5"
          initial={{ opacity: 0 }}
          animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          {['WA', 'NQ', 'NT'].map((region, i) => (
            <motion.div
              key={region}
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ delay: i * 0.1 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-[#00C9A7]"
                animate={{ boxShadow: ['0 0 0px #00C9A7', '0 0 12px #00C9A7', '0 0 0px #00C9A7'] }}
                transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
              />
              <span className="font-mono text-sm font-bold text-white/80">{region}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 5 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="px-10 py-4 rounded-full font-display text-[1.8vw] tracking-widest text-white border-2 border-[#00C9A7]"
            style={{
              background: 'linear-gradient(135deg, rgba(0,201,167,0.15), rgba(0,201,167,0.05))',
              boxShadow: '0 0 40px rgba(0,201,167,0.2)',
            }}
            animate={{ boxShadow: ['0 0 30px rgba(0,201,167,0.15)', '0 0 60px rgba(0,201,167,0.35)', '0 0 30px rgba(0,201,167,0.15)'] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            DOWNLOAD FREE
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
