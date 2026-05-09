import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { StarField, WaterSurface, GlowOrb, DataParticles } from '../Particles';
import { BoatSilhouette } from '../BoatSilhouette';

interface LockBoxProps {
  x: string;
  y: string;
  label: string;
  sublabel: string;
  color: string;
  delay: number;
  visible: boolean;
}

function LockBox({ x, y, label, sublabel, color, delay, visible }: LockBoxProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute"
          style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22, delay }}
        >
          {/* Corner brackets */}
          {[
            { top: 0, left: 0, borderT: true, borderL: true },
            { top: 0, right: 0, borderT: true, borderR: true },
            { bottom: 0, left: 0, borderB: true, borderL: true },
            { bottom: 0, right: 0, borderB: true, borderR: true },
          ].map((corner, i) => (
            <div
              key={i}
              className="absolute w-4 h-4"
              style={{
                top: corner.top,
                left: (corner as any).left,
                right: (corner as any).right,
                bottom: corner.bottom,
                borderTop: corner.borderT ? `2px solid ${color}` : undefined,
                borderLeft: corner.borderL ? `2px solid ${color}` : undefined,
                borderRight: corner.borderR ? `2px solid ${color}` : undefined,
                borderBottom: corner.borderB ? `2px solid ${color}` : undefined,
              }}
            />
          ))}

          {/* Inner pulse */}
          <motion.div
            className="absolute inset-0 rounded-sm"
            style={{ background: color, opacity: 0.05 }}
            animate={{ opacity: [0.05, 0.12, 0.05] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* Label */}
          <div
            className="px-10 py-6 font-mono text-center"
          >
            <div className="text-xs tracking-widest mb-1" style={{ color }}>
              TARGET LOCKED
            </div>
            <div className="text-lg font-bold text-white">{label}</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(200,215,230,0.6)' }}>{sublabel}</div>
          </div>

          {/* Ping ring */}
          <motion.div
            className="absolute inset-0 rounded-sm border"
            style={{ borderColor: color }}
            animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AIDataStream() {
  const lines = [
    'DEPTH: 4.2m → STRIKE ZONE ACTIVE',
    'TEMP: 28.4°C → OPTIMAL BARRA RANGE',
    'CURRENT: 0.3kn SW → BAIT DRIFT CALC',
    'AI CONFIDENCE: 94% → CAST NOW',
    'SPECIES: BARRAMUNDI 85-105cm',
  ];
  return (
    <div
      className="absolute right-[3vw] top-1/2 -translate-y-1/2 font-mono space-y-2"
      style={{ width: '22vw' }}
    >
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className="text-xs px-3 py-1.5 rounded border"
          style={{
            borderColor: 'rgba(0,201,167,0.25)',
            background: 'rgba(0,201,167,0.04)',
            color: 'rgba(0,201,167,0.75)',
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.5 + i * 0.18, duration: 0.4 }}
        >
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
          >
            {line}
          </motion.span>
        </motion.div>
      ))}
    </div>
  );
}

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3400),
      setTimeout(() => setPhase(5), 5000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.morphExpand}
      style={{ background: 'linear-gradient(180deg, #020c16 0%, #040f1e 50%, #061525 100%)' }}
    >
      {/* Atmosphere */}
      <StarField count={80} seed={21} />
      <GlowOrb x="30%" y="40%" size="60vw" color="#00C9A7" opacity={0.06} />
      <GlowOrb x="70%" y="60%" size="40vw" color="#FF6B00" opacity={0.05} />
      <DataParticles count={25} seed={9} color="#00C9A7" />

      {/* Horizon */}
      <div
        className="absolute inset-x-0"
        style={{
          top: '56%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(0,201,167,0.3), rgba(255,107,0,0.2), rgba(0,201,167,0.3), transparent)',
        }}
      />

      {/* Water */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: '44%', background: 'linear-gradient(180deg, #041320 0%, #020c16 100%)' }}
      >
        <WaterSurface className="absolute inset-0" />
      </div>

      {/* Boat + sonar */}
      <motion.div
        className="absolute"
        style={{ left: '50%', bottom: '40%', transform: 'translateX(-50%)' }}
        initial={{ opacity: 0, y: 40 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <BoatSilhouette width={380} sonar sonarColor="#00C9A7" bobAmplitude={4} />
      </motion.div>

      {/* Lock boxes */}
      <LockBox
        x="38%" y="52%"
        label="98cm BARRA"
        sublabel="DEPTH 3.8m"
        color="#00C9A7"
        delay={0}
        visible={phase >= 2}
      />
      <LockBox
        x="62%" y="64%"
        label="SCHOOL × 7"
        sublabel="DEPTH 5.2m"
        color="#FF6B00"
        delay={0.15}
        visible={phase >= 3}
      />

      {/* AI data stream */}
      {phase >= 3 && <AIDataStream />}

      {/* HUD grid overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,201,167,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,201,167,0.025) 1px, transparent 1px)',
          backgroundSize: '8vw 8vh',
        }}
        initial={{ opacity: 0 }}
        animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1 }}
      />

      {/* Central headline */}
      <AnimatePresence>
        {phase >= 4 && (
          <motion.div
            className="absolute left-[4vw] top-1/2 -translate-y-1/2"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="block font-mono text-xs tracking-widest mb-3" style={{ color: '#FF6B00' }}>
              AI VISION ACTIVE
            </span>
            <h2
              className="text-[5vw] font-display leading-[0.9] text-white"
              style={{ textShadow: '0 0 50px rgba(0,201,167,0.35)' }}
            >
              HOOKVISION<br />
              <span style={{ color: '#00C9A7' }}>SEES WHAT<br />YOU MISS</span>
            </h2>
            <motion.div
              className="mt-4 h-[2px] bg-gradient-to-r from-[#00C9A7] to-transparent"
              initial={{ width: 0 }}
              animate={{ width: '80%' }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
