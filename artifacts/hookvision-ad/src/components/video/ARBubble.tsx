import { motion, AnimatePresence } from 'framer-motion';

interface ARBubbleProps {
  label: string;
  sublabel: string;
  confidence?: number;
  x: string;
  y: string;
  lineToX?: string;
  lineToY?: string;
  color?: string;
  visible: boolean;
  delay?: number;
}

export function ARBubble({
  label,
  sublabel,
  confidence = 94,
  x,
  y,
  lineToX,
  lineToY,
  color = '#00C9A7',
  visible,
  delay = 0,
}: ARBubbleProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute pointer-events-none"
          style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26, delay }}
        >
          {/* SVG line connector */}
          {lineToX && lineToY && (
            <svg
              className="absolute pointer-events-none"
              style={{ overflow: 'visible', left: 0, top: 0 }}
              width="1"
              height="1"
            >
              <motion.line
                x1="0"
                y1="0"
                x2={lineToX}
                y2={lineToY}
                stroke={color}
                strokeWidth={1.2}
                strokeDasharray="4 3"
                opacity={0.7}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, delay: delay + 0.1 }}
              />
            </svg>
          )}

          {/* Bubble card */}
          <motion.div
            className="relative rounded-xl px-4 py-3 min-w-[140px]"
            style={{
              background: 'rgba(4,14,26,0.9)',
              border: `1.5px solid ${color}60`,
              boxShadow: `0 0 20px ${color}30, inset 0 1px 0 rgba(255,255,255,0.05)`,
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Ping ring */}
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{ border: `1.5px solid ${color}` }}
              animate={{ scale: [1, 1.12], opacity: [0.5, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />

            {/* Status dot */}
            <div className="flex items-center gap-2 mb-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
              <span className="font-mono text-[10px] tracking-widest" style={{ color: `${color}cc` }}>
                TARGET LOCKED
              </span>
            </div>

            {/* Main label */}
            <div className="font-display text-white text-base leading-tight">{label}</div>

            {/* Sublabel */}
            <div className="font-mono text-[11px] mt-0.5" style={{ color: 'rgba(180,200,220,0.65)' }}>
              {sublabel}
            </div>

            {/* Confidence bar */}
            <div className="mt-2.5">
              <div className="flex justify-between font-mono text-[9px] mb-1" style={{ color: 'rgba(150,175,200,0.5)' }}>
                <span>AI CONF.</span>
                <span style={{ color }}>{confidence}%</span>
              </div>
              <div className="h-[3px] rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${confidence}%` }}
                  transition={{ duration: 0.6, delay: delay + 0.2 }}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ARTrackingLineProps {
  x1: string; y1: string;
  x2: string; y2: string;
  color?: string;
  visible: boolean;
  delay?: number;
}

export function ARTrackingLine({ x1, y1, x2, y2, color = '#00C9A7', visible, delay = 0 }: ARTrackingLineProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay }}
        >
          <defs>
            <filter id="lineGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Glow line */}
          <motion.line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={2}
            strokeOpacity={0.2}
            filter="url(#lineGlow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay }}
          />
          {/* Main line */}
          <motion.line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={1.2}
            strokeOpacity={0.75}
            strokeDasharray="6 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay }}
          />
          {/* Moving dot */}
          <motion.circle
            r={3}
            fill={color}
            initial={{ offsetDistance: '0%' } as any}
            animate={{ offsetDistance: '100%' } as any}
            style={{ offsetPath: `path('M ${x1} ${y1} L ${x2} ${y2}')` } as any}
            transition={{ duration: 1.2, delay, repeat: Infinity, ease: 'linear' }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}
