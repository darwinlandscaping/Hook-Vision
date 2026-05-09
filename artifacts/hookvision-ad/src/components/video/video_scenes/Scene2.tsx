import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video/animations';
import { GlowOrb, DataParticles } from '../Particles';
import { BoatSilhouette } from '../BoatSilhouette';

const GLITCH_CHARS = ['▓', '░', '▒', '█', '?', '!', '#', '%'];

function GlitchText({ text, active }: { text: string; active: boolean }) {
  const [displayed, setDisplayed] = useState(text);

  useEffect(() => {
    if (!active) { setDisplayed(text); return; }
    let frame = 0;
    const id = setInterval(() => {
      if (frame > 8) { setDisplayed(text); clearInterval(id); return; }
      setDisplayed(
        text
          .split('')
          .map((c, i) =>
            c !== ' ' && Math.random() < 0.35
              ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
              : c,
          )
          .join(''),
      );
      frame++;
    }, 60);
    return () => clearInterval(id);
  }, [active, text]);

  return <>{displayed}</>;
}

function SonarScreen({ corrupted }: { corrupted: boolean }) {
  return (
    <div
      className="relative w-full h-full rounded-xl overflow-hidden border"
      style={{
        borderColor: corrupted ? 'rgba(255,80,80,0.4)' : 'rgba(0,201,167,0.2)',
        background: 'rgba(4,14,26,0.95)',
        boxShadow: corrupted
          ? 'inset 0 0 40px rgba(255,40,40,0.08)'
          : 'inset 0 0 40px rgba(0,201,167,0.05)',
      }}
    >
      {/* Scan line sweep */}
      <motion.div
        className="absolute inset-x-0 h-[2px] pointer-events-none"
        style={{
          background: corrupted
            ? 'linear-gradient(90deg, transparent, rgba(255,80,80,0.6), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(0,201,167,0.5), transparent)',
        }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: corrupted ? 1.2 : 2.5, repeat: Infinity, ease: 'linear' }}
      />

      {/* Sonar circles */}
      {[20, 35, 50, 65, 80].map((r, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full border"
          style={{
            width: `${r}%`,
            height: `${r}%`,
            transform: 'translate(-50%, -50%)',
            borderColor: corrupted
              ? `rgba(255,80,80,${0.08 + i * 0.015})`
              : `rgba(0,201,167,${0.08 + i * 0.015})`,
          }}
          animate={corrupted ? { opacity: [0.3, 0.8, 0.2, 1, 0.3] } : { opacity: 1 }}
          transition={{ duration: 0.4, delay: i * 0.06, repeat: Infinity }}
        />
      ))}

      {/* Cross hairs */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${corrupted ? 'rgba(255,80,80,0.06)' : 'rgba(0,201,167,0.06)'} 1px, transparent 1px),
            linear-gradient(to bottom, ${corrupted ? 'rgba(255,80,80,0.06)' : 'rgba(0,201,167,0.06)'} 1px, transparent 1px)`,
          backgroundSize: '20% 20%',
        }}
      />

      {/* Sweep arm */}
      <motion.div
        className="absolute top-1/2 left-1/2 origin-left"
        style={{ height: 1, width: '42%' }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: corrupted ? 1.5 : 3, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="w-full h-full"
          style={{
            background: corrupted
              ? 'linear-gradient(to right, rgba(255,80,80,0.9), transparent)'
              : 'linear-gradient(to right, rgba(0,201,167,0.9), transparent)',
          }}
        />
      </motion.div>

      {/* Blips */}
      {corrupted ? (
        <>
          {[
            { x: '42%', y: '38%' }, { x: '65%', y: '52%' }, { x: '28%', y: '60%' },
          ].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-red-400"
              style={{ left: pos.x, top: pos.y, filter: 'blur(1px)' }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 0.5] }}
              transition={{ duration: 0.5, delay: i * 0.3, repeat: Infinity }}
            />
          ))}
        </>
      ) : (
        <motion.div
          className="absolute w-3 h-3 rounded-full"
          style={{ left: '55%', top: '42%', background: '#00C9A7', filter: 'blur(1px)' }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* Status line */}
      <div className="absolute bottom-0 inset-x-0 px-4 py-2 font-mono text-xs" style={{ color: corrupted ? 'rgba(255,80,80,0.7)' : 'rgba(0,201,167,0.5)' }}>
        {corrupted ? 'ERR: NO_TARGET_LOCK // SIGNAL_LOST' : 'ACQUIRING...'}
      </div>
    </div>
  );
}

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 2600),
      setTimeout(() => setPhase(4), 3800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full overflow-hidden"
      {...sceneTransitions.slideLeft}
      style={{ background: 'linear-gradient(160deg, #030b14 0%, #050f1c 50%, #020810 100%)' }}
    >
      <GlowOrb x="20%" y="30%" size="40vw" color="#FF3333" opacity={0.07} />
      <GlowOrb x="80%" y="70%" size="35vw" color="#FF6B00" opacity={0.06} />
      <DataParticles count={20} seed={3} color="#FF4444" />

      <div className="absolute inset-0 flex items-center justify-between px-[6vw] gap-[4vw]">

        {/* Left: Sonar display */}
        <motion.div
          className="flex-1 flex flex-col gap-6"
          initial={{ opacity: 0, x: -60 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -60 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Boat at top */}
          <div className="flex justify-center mb-2">
            <BoatSilhouette width={260} sonar={false} bobAmplitude={2} />
          </div>

          <div style={{ height: '36vh' }}>
            <SonarScreen corrupted />
          </div>

          {/* Error tags */}
          <motion.div
            className="flex gap-3 flex-wrap"
            initial={{ opacity: 0 }}
            animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {['NO TARGET LOCK', 'DEPTH UNCERTAIN', 'SIGNAL NOISE'].map((tag) => (
              <span
                key={tag}
                className="font-mono text-xs px-3 py-1 rounded border"
                style={{ borderColor: 'rgba(255,80,80,0.4)', color: 'rgba(255,80,80,0.7)', background: 'rgba(255,40,40,0.06)' }}
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Divider */}
        <motion.div
          className="w-[1px] self-stretch"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,107,0,0.3), transparent)' }}
          initial={{ scaleY: 0 }}
          animate={phase >= 1 ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Right: Problem statement */}
        <div className="flex-1 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 60 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="font-mono text-xs tracking-widest" style={{ color: '#FF6B00' }}>
              THE PROBLEM
            </span>
            <h2
              className="text-[5.5vw] font-display leading-[0.92] mt-3 text-white"
              style={{ textShadow: '0 0 40px rgba(255,80,80,0.2)' }}
            >
              SONAR DATA<br />
              <span style={{ color: '#FF4444' }}>
                <GlitchText text="WITHOUT ANSWERS" active={phase >= 2} />
              </span>
            </h2>
          </motion.div>

          <motion.div
            className="mt-8 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7 }}
          >
            {[
              "Squinting at noise-filled screens",
              "Guessing fish targets by eye",
              "Missing the bite window entirely",
            ].map((line, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-4"
                initial={{ opacity: 0, x: 20 }}
                animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
              >
                <div className="w-5 h-5 rounded-full border border-red-400/40 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                </div>
                <p className="text-[1.6vw] leading-snug" style={{ color: 'rgba(200,210,220,0.7)' }}>
                  {line}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            className="mt-8 text-[1.4vw] font-mono"
            style={{ color: 'rgba(255,107,0,0.6)' }}
            initial={{ opacity: 0 }}
            animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            That's the old way.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
