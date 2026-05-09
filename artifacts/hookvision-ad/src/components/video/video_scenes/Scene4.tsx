import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { GlowOrb, DataParticles } from '../Particles';
import { BarramundiFish } from '../BarramundiFish';
import type { RegionConfig } from '@/lib/region';

interface Props { region: RegionConfig }

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
        borderColor: `${color}28`,
        background: 'linear-gradient(135deg, rgba(8,18,32,0.96) 0%, rgba(12,24,40,0.92) 100%)',
        boxShadow: visible ? `0 0 35px ${color}10, inset 0 1px 0 rgba(255,255,255,0.04)` : 'none',
      }}
      initial={{ opacity: 0, y: 50, rotateX: 15 }}
      animate={visible ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 50, rotateX: 15 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22, delay: index * 0.1 }}
    >
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        animate={visible ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ delay: index * 0.1 + 0.25, duration: 0.5 }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl">{icon}</span>
          <span
            className="font-mono text-[9px] tracking-widest px-2 py-1 rounded border"
            style={{ color, borderColor: `${color}40`, background: `${color}0e` }}
          >
            {tag}
          </span>
        </div>
        <h3 className="text-[1.7vw] font-display text-white leading-tight">{title}</h3>
        <p className="text-[0.95vw] mt-1.5 font-mono leading-snug" style={{ color: 'rgba(140,170,195,0.6)' }}>
          {subtitle}
        </p>
      </div>
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(105deg, transparent 30%, ${color}07 50%, transparent 70%)` }}
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 3.5, delay: index * 0.4, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}

export function Scene4({ region }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const features = [
    { icon: '🎙️', title: 'LIVE AI NARRATION', subtitle: 'Real-time audio analysis of your sonar feed', tag: 'LIVE', color: region.secondaryColor },
    { icon: '🌊', title: 'TIDE INTELLIGENCE', subtitle: `${region.waters[0]} · ${region.waters[1]}`, tag: 'REGIONAL', color: region.primaryColor },
    { icon: '🐟', title: 'TROPHY BARRA AI', subtitle: 'Strike zone & trophy size prediction', tag: 'AI', color: region.secondaryColor },
    { icon: '📡', title: 'DEPTH STRIKE ZONES', subtitle: 'AI-mapped hot spot sonar overlay', tag: 'OVERLAY', color: region.primaryColor },
  ];

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.wipe}
      style={{ background: 'linear-gradient(160deg, #020c16 0%, #030f1c 60%, #020810 100%)' }}
    >
      <GlowOrb x="10%" y="85%" size="50vw" color={region.secondaryColor} opacity={0.06} />
      <GlowOrb x="90%" y="15%" size="40vw" color={region.primaryColor} opacity={0.05} />
      <DataParticles count={16} seed={17} color={region.secondaryColor} />

      {/* Watermark barra */}
      <motion.div
        className="absolute -bottom-8 right-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 0.05 } : { opacity: 0 }}
        transition={{ duration: 2 }}
      >
        <BarramundiFish width={600} color="#ffffff" glowColor={region.secondaryColor} swimAmplitude={3} swimDuration={6} />
      </motion.div>

      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        {/* Header */}
        <motion.div
          className="mb-7"
          initial={{ opacity: 0, y: -20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.7 }}
        >
          <div className="flex items-center gap-4 mb-3">
            <motion.div
              className="h-[1px] flex-1"
              style={{ background: `linear-gradient(to right, ${region.secondaryColor}, transparent)`, transformOrigin: 'left' }}
              initial={{ scaleX: 0 }}
              animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 0.8 }}
            />
            <span className="font-mono text-xs tracking-[0.3em] whitespace-nowrap" style={{ color: region.primaryColor }}>
              WHAT'S INSIDE
            </span>
            <motion.div
              className="h-[1px] flex-1"
              style={{ background: `linear-gradient(to left, ${region.primaryColor}, transparent)` }}
              initial={{ scaleX: 0 }}
              animate={phase >= 1 ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            />
          </div>
          <h2
            className="text-[4.5vw] font-display text-white leading-none"
            style={{ textShadow: `0 0 40px ${region.secondaryColor}25` }}
          >
            AI BUILT FOR{' '}
            <span style={{ color: region.secondaryColor }}>THE WATER</span>
          </h2>
        </motion.div>

        {/* Feature grid */}
        <div className="grid grid-cols-4 gap-3.5" style={{ perspective: '1000px' }}>
          {features.map((f, i) => (
            <FeatureCard key={f.title} index={i} {...f} visible={phase >= 2} />
          ))}
        </div>

        {/* Region badges */}
        <motion.div
          className="mt-5 flex items-center gap-5"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <span className="font-mono text-xs tracking-widest text-white/25">AVAILABLE FOR</span>
          {(['KIMBERLEY WA', 'NORTH QLD', 'NORTHERN TERRITORY'] as const).map((r, i) => (
            <motion.span
              key={r}
              className="font-mono text-xs px-3 py-1.5 rounded-full border"
              style={{
                borderColor: r.includes(region.id.toUpperCase()) || (region.id === 'wa' && r.includes('KIMBERLEY')) || (region.id === 'nq' && r.includes('QLD')) || (region.id === 'nt' && r.includes('NORTHERN'))
                  ? `${region.secondaryColor}60`
                  : 'rgba(255,255,255,0.12)',
                color: r.includes(region.id.toUpperCase()) || (region.id === 'wa' && r.includes('KIMBERLEY')) || (region.id === 'nq' && r.includes('QLD')) || (region.id === 'nt' && r.includes('NORTHERN'))
                  ? region.secondaryColor
                  : 'rgba(255,255,255,0.3)',
                background: r.includes(region.id.toUpperCase()) || (region.id === 'wa' && r.includes('KIMBERLEY')) || (region.id === 'nq' && r.includes('QLD')) || (region.id === 'nt' && r.includes('NORTHERN'))
                  ? `${region.secondaryColor}10`
                  : 'transparent',
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              transition={{ delay: 0.6 + i * 0.08 }}
            >
              {r}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
