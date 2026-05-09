import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { GlowOrb, DataParticles } from '../Particles';
import { BoatSilhouette } from '../BoatSilhouette';

interface FeatureCardProps {
  index: number;
  icon: string;
  title: string;
  subtitle: string;
  tag: string;
  color: string;
  visible: boolean;
}

function FeatureCard({ index, icon, title, subtitle, tag, color, visible }: FeatureCardProps) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: `${color}30`,
        background: `linear-gradient(135deg, rgba(10,20,35,0.95) 0%, rgba(15,28,48,0.9) 100%)`,
        boxShadow: visible ? `0 0 40px ${color}12, inset 0 1px 0 rgba(255,255,255,0.04)` : 'none',
      }}
      initial={{ opacity: 0, y: 60, rotateX: 20 }}
      animate={visible ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 60, rotateX: 20 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: index * 0.12 }}
    >
      {/* Accent line */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        animate={visible ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ delay: index * 0.12 + 0.3, duration: 0.6 }}
      />

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl">{icon}</span>
          <span
            className="font-mono text-[10px] tracking-widest px-2 py-1 rounded border"
            style={{ color, borderColor: `${color}40`, background: `${color}10` }}
          >
            {tag}
          </span>
        </div>
        <h3 className="text-[1.8vw] font-display text-white leading-tight">{title}</h3>
        <p className="text-[1vw] mt-1.5 font-mono" style={{ color: 'rgba(150,180,200,0.6)' }}>
          {subtitle}
        </p>
      </div>

      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(105deg, transparent 30%, ${color}08 50%, transparent 70%)`,
        }}
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 3, delay: index * 0.4, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}

const FEATURES = [
  {
    icon: '🎙️',
    title: 'LIVE AI NARRATION',
    subtitle: 'REAL-TIME AUDIO SONAR ANALYSIS',
    tag: 'LIVE',
    color: '#00C9A7',
  },
  {
    icon: '🌊',
    title: 'TIDE INTELLIGENCE',
    subtitle: 'REGIONAL GULF & COASTAL FORECASTS',
    tag: 'REGIONAL',
    color: '#FF6B00',
  },
  {
    icon: '🐟',
    title: 'TROPHY BARRA AI',
    subtitle: 'STRIKE ZONE & SIZE PREDICTION',
    tag: 'AI',
    color: '#00C9A7',
  },
  {
    icon: '📡',
    title: 'DEPTH STRIKE ZONES',
    subtitle: 'AI-MAPPED HOT SPOT OVERLAY',
    tag: 'OVERLAY',
    color: '#FF6B00',
  },
];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.wipe}
      style={{ background: 'linear-gradient(160deg, #020c16 0%, #030f1c 60%, #020810 100%)' }}
    >
      <GlowOrb x="10%" y="80%" size="50vw" color="#00C9A7" opacity={0.07} />
      <GlowOrb x="90%" y="20%" size="40vw" color="#FF6B00" opacity={0.06} />
      <DataParticles count={18} seed={17} color="#00C9A7" />

      {/* Background boat silhouette */}
      <motion.div
        className="absolute bottom-0 right-0 opacity-[0.06] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 0.06 } : { opacity: 0 }}
        transition={{ duration: 2 }}
      >
        <BoatSilhouette width={800} sonar={false} bobAmplitude={2} />
      </motion.div>

      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.7 }}
        >
          <div className="flex items-center gap-4">
            <motion.div
              className="h-[1px] flex-1 bg-gradient-to-r from-[#00C9A7] to-transparent"
              initial={{ scaleX: 0 }}
              animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
              style={{ transformOrigin: 'left' }}
              transition={{ duration: 0.8 }}
            />
            <span className="font-mono text-xs tracking-[0.3em] whitespace-nowrap" style={{ color: '#FF6B00' }}>
              WHAT'S INSIDE
            </span>
            <motion.div
              className="h-[1px] flex-1 bg-gradient-to-l from-[#FF6B00] to-transparent"
              initial={{ scaleX: 0 }}
              animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
              style={{ transformOrigin: 'right' }}
              transition={{ duration: 0.8, delay: 0.1 }}
            />
          </div>
          <h2
            className="text-[5vw] font-display text-white mt-3 leading-none"
            style={{ textShadow: '0 0 40px rgba(0,201,167,0.2)' }}
          >
            AI BUILT FOR{' '}
            <span style={{ color: '#00C9A7' }}>THE WATER</span>
          </h2>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-4 gap-4" style={{ perspective: '800px' }}>
          {FEATURES.map((f, i) => (
            <FeatureCard
              key={f.title}
              index={i}
              icon={f.icon}
              title={f.title}
              subtitle={f.subtitle}
              tag={f.tag}
              color={f.color}
              visible={phase >= 2}
            />
          ))}
        </div>

        {/* Region badges */}
        <motion.div
          className="mt-6 flex items-center gap-6"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <span className="font-mono text-xs tracking-widest" style={{ color: 'rgba(150,175,200,0.4)' }}>
            AVAILABLE FOR
          </span>
          {['KIMBERLEY WA', 'NORTH QLD', 'NORTHERN TERRITORY'].map((region, i) => (
            <motion.span
              key={region}
              className="font-mono text-xs px-3 py-1.5 rounded-full border"
              style={{
                borderColor: 'rgba(0,201,167,0.3)',
                color: 'rgba(0,201,167,0.7)',
                background: 'rgba(0,201,167,0.05)',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.7 + i * 0.1 }}
            >
              {region}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
