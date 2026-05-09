import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface ParticleConfig {
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
  seed?: number;
}

function seededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function StarField({ count = 120, seed = 42 }: { count?: number; seed?: number }) {
  const rand = useMemo(() => seededRandom(seed), [seed]);
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: rand() * 100,
        y: rand() * 100,
        size: rand() * 1.8 + 0.4,
        opacity: rand() * 0.6 + 0.2,
        duration: rand() * 3 + 2,
        delay: rand() * 4,
      })),
    [count, rand],
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [s.opacity * 0.3, s.opacity, s.opacity * 0.3] }}
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export function DataParticles({
  count = 40,
  seed = 7,
  color = '#00C9A7',
}: ParticleConfig) {
  const rand = useMemo(() => seededRandom(seed), [seed]);
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: rand() * 100,
        startY: rand() * 100,
        size: rand() * 2 + 1,
        duration: rand() * 8 + 6,
        delay: rand() * 8,
        drift: (rand() - 0.5) * 8,
      })),
    [count, rand],
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: color,
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
          }}
          initial={{ y: `${p.startY}%`, opacity: 0, x: 0 }}
          animate={{ y: `${p.startY - 60}%`, opacity: [0, 0.8, 0.8, 0], x: p.drift }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

export function WaterSurface({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-x-0 h-[2px] rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(0,201,167,${0.12 - i * 0.03}), transparent)`,
            top: `${30 + i * 30}%`,
          }}
          animate={{ scaleX: [0.6, 1.1, 0.7], x: ['-5%', '5%', '-3%'] }}
          transition={{
            duration: 4 + i * 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.8,
          }}
        />
      ))}
      <motion.div
        className="absolute inset-x-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,201,167,0.35) 20%, rgba(255,107,0,0.2) 50%, rgba(0,201,167,0.35) 80%, transparent 100%)',
          top: '50%',
        }}
        animate={{ opacity: [0.4, 1, 0.4], scaleX: [0.95, 1.02, 0.97] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export function GlowOrb({
  x, y, size, color, opacity = 0.15, animate: doAnimate = true,
}: {
  x: string; y: string; size: string; color: string; opacity?: number; animate?: boolean;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        opacity,
        transform: 'translate(-50%, -50%)',
        filter: 'blur(40px)',
      }}
      animate={doAnimate ? { opacity: [opacity * 0.6, opacity, opacity * 0.7] } : undefined}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
