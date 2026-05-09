import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { StarField, GlowOrb, DataParticles } from '../Particles';
import { BarramundiFish } from '../BarramundiFish';
import { ARBubble, ARTrackingLine } from '../ARBubble';
import type { RegionConfig } from '@/lib/region';

interface Props { region: RegionConfig }

function SonarOverlay({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {[15, 28, 42, 56, 70].map((r, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${r}%`,
            height: `${r}%`,
            borderColor: `${color}${Math.round((0.06 + i * 0.02) * 255).toString(16).padStart(2, '0')}`,
          }}
        />
      ))}
      {/* Sweep arm */}
      <motion.div
        className="absolute top-1/2 left-1/2 origin-left"
        style={{ height: 1, width: '36%' }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
      >
        <div
          style={{
            height: '100%',
            background: `linear-gradient(to right, ${color}cc, transparent)`,
          }}
        />
      </motion.div>
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(${color} 1px, transparent 1px),
            linear-gradient(90deg, ${color} 1px, transparent 1px)`,
          backgroundSize: '8% 8%',
        }}
      />
    </div>
  );
}

export function Scene3({ region }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 4200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.morphExpand}
      style={{ background: 'linear-gradient(180deg, #020c18 0%, #030f1e 50%, #020a14 100%)' }}
    >
      <StarField count={60} seed={33} />
      <DataParticles count={20} seed={11} color={region.secondaryColor} />
      <GlowOrb x="50%" y="50%" size="70vw" color={region.secondaryColor} opacity={0.05} />
      <GlowOrb x="30%" y="70%" size="40vw" color={region.primaryColor} opacity={0.04} />

      {/* Sonar UI background */}
      <motion.div
        className="absolute inset-0 opacity-30"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 0.3 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      >
        <img
          src={`${import.meta.env.BASE_URL}sonar/sonar-demo-3.png`}
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: `hue-rotate(${region.id === 'nq' ? '60deg' : '0deg'}) saturate(0.6)` }}
        />
      </motion.div>

      <SonarOverlay color={region.secondaryColor} />

      {/* BARRAMUNDI FISH SWIMMING IN */}
      <AnimatePresence>
        {phase >= 2 && (
          <motion.div
            className="absolute"
            style={{ left: '12%', top: '35%' }}
            initial={{ opacity: 0, x: '-15vw' }}
            animate={{ opacity: 0.85, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <BarramundiFish
              width={220}
              color="#8ac8e0"
              glowColor={region.secondaryColor}
              swimAmplitude={7}
              swimDuration={3}
            />
          </motion.div>
        )}
        {phase >= 2 && (
          <motion.div
            className="absolute"
            style={{ left: '55%', top: '55%' }}
            initial={{ opacity: 0, x: '15vw' }}
            animate={{ opacity: 0.75, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <BarramundiFish
              width={160}
              color="#6ab0c8"
              glowColor={region.primaryColor}
              flip
              swimAmplitude={9}
              swimDuration={2.6}
              swimDelay={0.4}
            />
          </motion.div>
        )}
        {phase >= 3 && (
          <motion.div
            className="absolute"
            style={{ left: '34%', top: '60%' }}
            initial={{ opacity: 0, y: '8vh' }}
            animate={{ opacity: 0.6, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <BarramundiFish
              width={120}
              color="#5098b0"
              glowColor={region.secondaryColor}
              swimAmplitude={5}
              swimDuration={3.5}
              swimDelay={0.8}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* AR TRACKING LINES */}
      <ARTrackingLine x1="24%" y1="42%" x2="34%" y2="48%" color={region.secondaryColor} visible={phase >= 3} delay={0} />
      <ARTrackingLine x1="63%" y1="60%" x2="55%" y2="52%" color={region.primaryColor} visible={phase >= 3} delay={0.15} />

      {/* AR BUBBLES */}
      <ARBubble
        label="BARRAMUNDI 104cm"
        sublabel="DEPTH 2.8m · TROPHY GRADE"
        confidence={97}
        x="34%" y="40%"
        color={region.secondaryColor}
        visible={phase >= 3}
        delay={0}
      />
      <ARBubble
        label="BARRAMUNDI 82cm"
        sublabel="DEPTH 4.1m · GOOD EATING"
        confidence={91}
        x="68%" y="54%"
        color={region.primaryColor}
        visible={phase >= 3}
        delay={0.2}
      />

      {/* Depth strike zone box */}
      <AnimatePresence>
        {phase >= 4 && (
          <motion.div
            className="absolute border font-mono text-xs px-3 py-2"
            style={{
              left: '44%',
              top: '44%',
              borderColor: `${region.primaryColor}60`,
              background: `${region.primaryColor}08`,
              color: region.primaryColor,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            ⚡ STRIKE ZONE 2–5m
          </motion.div>
        )}
      </AnimatePresence>

      {/* Headline */}
      <AnimatePresence>
        {phase >= 5 && (
          <motion.div
            className="absolute top-8 left-8 right-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="font-mono text-xs tracking-widest" style={{ color: region.primaryColor }}>
              AI SONAR VISION
            </span>
            <h2
              className="text-[5vw] font-display text-white leading-[0.9] mt-2"
              style={{ textShadow: `0 0 50px ${region.secondaryColor}50` }}
            >
              HOOKVISION<br />
              <span style={{ color: region.secondaryColor }}>SEES WHAT<br />YOU MISS</span>
            </h2>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
