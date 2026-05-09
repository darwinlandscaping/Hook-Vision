import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { GlowOrb } from '../Particles';
import { AnglerBoat } from '../AnglerBoat';
import { BarramundiFish } from '../BarramundiFish';
import { ARBubble, ARTrackingLine } from '../ARBubble';
import type { RegionConfig } from '@/lib/region';

interface Props { region: RegionConfig }

export function Scene2({ region }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),   // boat visible
      setTimeout(() => setPhase(2), 1400),  // cast back
      setTimeout(() => setPhase(3), 2000),  // cast forward
      setTimeout(() => setPhase(4), 2500),  // lure hits water
      setTimeout(() => setPhase(5), 3000),  // fish detected
      setTimeout(() => setPhase(6), 3600),  // AR bubbles
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const castPhase = phase >= 4 ? 3 : phase >= 3 ? 2 : phase >= 2 ? 1 : 0;

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.slideLeft}
    >
      {/* VIDEO BACKGROUND — real footage of water */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.04 }}
        animate={{ scale: 1 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      >
        <video
          src={`${import.meta.env.BASE_URL}videos/creek-sunrise.mp4`}
          className="w-full h-full object-cover"
          autoPlay muted loop playsInline
        />
        {/* Heavy cinematic grade */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.6) 100%)',
          }}
        />
        <div
          className="absolute inset-0 mix-blend-multiply opacity-60"
          style={{ background: 'linear-gradient(160deg, #040d18, #061520)' }}
        />
      </motion.div>

      <GlowOrb x="55%" y="65%" size="50vw" color={region.primaryColor} opacity={0.06} />

      {/* WATER HORIZON LINE */}
      <div
        className="absolute inset-x-0 pointer-events-none"
        style={{
          top: '62%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${region.secondaryColor}50, ${region.primaryColor}30, transparent)`,
        }}
      />

      {/* UNDERWATER FISH (below waterline — semi-transparent) */}
      <AnimatePresence>
        {phase >= 5 && (
          <>
            <motion.div
              className="absolute"
              style={{ left: '30%', top: '68%' }}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 0.45, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <BarramundiFish
                width={180}
                color="#7ab8d0"
                glowColor={region.secondaryColor}
                swimAmplitude={5}
                swimDuration={3.2}
                swimDelay={0}
              />
            </motion.div>
            <motion.div
              className="absolute"
              style={{ left: '52%', top: '74%' }}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 0.35, x: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <BarramundiFish
                width={130}
                color="#5a9ab8"
                glowColor={region.primaryColor}
                flip
                swimAmplitude={6}
                swimDuration={2.8}
                swimDelay={0.5}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AR TRACKING LINES */}
      <ARTrackingLine
        x1="38%" y1="62%"
        x2="36%" y2="72%"
        color={region.secondaryColor}
        visible={phase >= 6}
        delay={0}
      />
      <ARTrackingLine
        x1="60%" y1="60%"
        x2="58%" y2="75%"
        color={region.primaryColor}
        visible={phase >= 6}
        delay={0.15}
      />

      {/* AR BUBBLES */}
      <ARBubble
        label="BARRAMUNDI 96cm"
        sublabel="DEPTH 3.4m · WEIGHT ~8.2kg"
        confidence={96}
        x="38%" y="58%"
        color={region.secondaryColor}
        visible={phase >= 6}
        delay={0}
      />
      <ARBubble
        label="BARRAMUNDI 74cm"
        sublabel="DEPTH 4.8m · WEIGHT ~4.6kg"
        confidence={88}
        x="62%" y="56%"
        color={region.primaryColor}
        visible={phase >= 6}
        delay={0.18}
      />

      {/* BOAT + ANGLER */}
      <motion.div
        className="absolute"
        style={{ left: '50%', bottom: '32%', transform: 'translateX(-50%)' }}
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
      >
        <AnglerBoat
          width={520}
          primaryColor={region.primaryColor}
          castPhase={castPhase}
          showWake={false}
          bobAmplitude={3}
        />
      </motion.div>

      {/* SCAN RING at lure impact */}
      <AnimatePresence>
        {phase >= 4 && (
          <motion.div
            className="absolute rounded-full border-2"
            style={{
              left: '60%',
              top: '63%',
              transform: 'translate(-50%,-50%)',
              borderColor: region.secondaryColor,
            }}
            initial={{ width: 0, height: 0, opacity: 0.9 }}
            animate={{ width: '8vw', height: '8vw', opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* "AI SCANNING" → "TARGETS LOCKED" status */}
      <motion.div
        className="absolute top-8 left-8 font-mono text-xs"
        style={{ color: region.secondaryColor }}
        initial={{ opacity: 0 }}
        animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.span
          animate={phase >= 6
            ? { color: region.secondaryColor }
            : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.5, repeat: phase >= 6 ? 0 : Infinity }}
        >
          {phase >= 6 ? '● TARGETS LOCKED' : '● AI SCANNING...'}
        </motion.span>
      </motion.div>

      {/* Scene label */}
      <motion.div
        className="absolute bottom-8 left-8 font-mono text-xs tracking-widest text-white/30"
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {region.location} · LIVE AI VISION
      </motion.div>
    </motion.div>
  );
}
