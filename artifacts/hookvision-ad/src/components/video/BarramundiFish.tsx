import { motion } from 'framer-motion';

interface BarramundiProps {
  width?: number;
  color?: string;
  glowColor?: string;
  flip?: boolean;
  className?: string;
  style?: React.CSSProperties;
  swimAmplitude?: number;
  swimDuration?: number;
  swimDelay?: number;
  opacity?: number;
}

export function BarramundiFish({
  width = 280,
  color = '#b8d4e8',
  glowColor = '#00C9A7',
  flip = false,
  className = '',
  style,
  swimAmplitude = 8,
  swimDuration = 3,
  swimDelay = 0,
  opacity = 1,
}: BarramundiProps) {
  const h = width * 0.42;
  const mx = width;
  const my = h;
  const sx = mx * 0.07;
  const sy = my * 0.5;

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width, opacity, ...style }}
      animate={{ y: [0, -swimAmplitude, 0, swimAmplitude * 0.6, 0] }}
      transition={{ duration: swimDuration, delay: swimDelay, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg
        viewBox={`0 0 ${mx} ${my}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}
      >
        <defs>
          <radialGradient id="barraGrad" cx="35%" cy="50%" r="60%">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.55" />
          </radialGradient>
          <filter id="barraGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Body */}
        <path
          d={`M ${mx * 0.07} ${my * 0.5}
              Q ${mx * 0.12} ${my * 0.2} ${mx * 0.28} ${my * 0.18}
              L ${mx * 0.72} ${my * 0.22}
              Q ${mx * 0.82} ${my * 0.24} ${mx * 0.87} ${my * 0.44}
              L ${mx * 0.97} ${my * 0.25}
              L ${mx * 0.97} ${my * 0.75}
              L ${mx * 0.87} ${my * 0.56}
              Q ${mx * 0.82} ${my * 0.76} ${mx * 0.72} ${my * 0.78}
              L ${mx * 0.28} ${my * 0.82}
              Q ${mx * 0.15} ${my * 0.8} ${mx * 0.07} ${my * 0.55}
              Q ${mx * 0.02} ${my * 0.52} ${mx * 0.07} ${my * 0.5}Z`}
          fill="url(#barraGrad)"
          stroke={color}
          strokeWidth={0.8}
          filter="url(#barraGlow)"
        />

        {/* Lateral line */}
        <path
          d={`M ${mx * 0.18} ${my * 0.42} Q ${mx * 0.5} ${my * 0.36} ${mx * 0.82} ${my * 0.4}`}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          strokeOpacity={0.5}
          strokeDasharray="3 4"
        />

        {/* Scale pattern (subtle) */}
        {[0.3, 0.45, 0.6].flatMap((x) =>
          [0.3, 0.45, 0.6].map((y) => (
            <ellipse
              key={`${x}-${y}`}
              cx={mx * x}
              cy={my * y}
              rx={mx * 0.04}
              ry={my * 0.07}
              fill="none"
              stroke={color}
              strokeWidth={0.4}
              strokeOpacity={0.2}
            />
          )),
        )}

        {/* Dorsal fin */}
        <path
          d={`M ${mx * 0.3} ${my * 0.19}
              Q ${mx * 0.38} ${my * 0.03} ${mx * 0.5} ${my * 0.06}
              Q ${mx * 0.62} ${my * 0.04} ${mx * 0.68} ${my * 0.2}
              Z`}
          fill={color}
          fillOpacity={0.5}
          stroke={color}
          strokeWidth={0.6}
          strokeOpacity={0.6}
        />

        {/* Pectoral fin */}
        <path
          d={`M ${mx * 0.28} ${my * 0.5}
              Q ${mx * 0.3} ${my * 0.68} ${mx * 0.42} ${my * 0.72}
              Q ${mx * 0.35} ${my * 0.6} ${mx * 0.28} ${my * 0.5}Z`}
          fill={color}
          fillOpacity={0.4}
          stroke={color}
          strokeWidth={0.5}
          strokeOpacity={0.4}
        />

        {/* Anal fin */}
        <path
          d={`M ${mx * 0.6} ${my * 0.78}
              Q ${mx * 0.67} ${my * 0.92} ${mx * 0.75} ${my * 0.88}
              Q ${mx * 0.68} ${my * 0.82} ${mx * 0.6} ${my * 0.78}Z`}
          fill={color}
          fillOpacity={0.35}
        />

        {/* Eye */}
        <circle cx={mx * 0.14} cy={my * 0.4} r={mx * 0.028} fill="rgba(20,30,40,0.9)" />
        <circle cx={mx * 0.14} cy={my * 0.4} r={mx * 0.014} fill="rgba(10,15,20,0.95)" />
        <circle cx={mx * 0.135} cy={my * 0.375} r={mx * 0.005} fill="rgba(255,255,255,0.6)" />
        <circle cx={mx * 0.14} cy={my * 0.4} r={mx * 0.03} fill="none" stroke={glowColor} strokeWidth={0.8} strokeOpacity={0.3} />

        {/* Mouth opening (barramundi has large mouth) */}
        <path
          d={`M ${sx * 0.8} ${sy * 0.85} Q ${sx * 0.3} ${sy} ${sx * 0.8} ${sy * 1.15}`}
          fill="rgba(10,15,20,0.8)"
          stroke="none"
        />

        {/* Glow overlay */}
        <motion.path
          d={`M ${mx * 0.07} ${my * 0.5}
              Q ${mx * 0.12} ${my * 0.2} ${mx * 0.28} ${my * 0.18}
              L ${mx * 0.72} ${my * 0.22}
              Q ${mx * 0.82} ${my * 0.24} ${mx * 0.87} ${my * 0.44}
              L ${mx * 0.97} ${my * 0.25}
              L ${mx * 0.97} ${my * 0.75}
              L ${mx * 0.87} ${my * 0.56}
              Q ${mx * 0.82} ${my * 0.76} ${mx * 0.72} ${my * 0.78}
              L ${mx * 0.28} ${my * 0.82}
              Q ${mx * 0.15} ${my * 0.8} ${mx * 0.07} ${my * 0.55}
              Q ${mx * 0.02} ${my * 0.52} ${mx * 0.07} ${my * 0.5}Z`}
          fill="none"
          stroke={glowColor}
          strokeWidth={1.5}
          strokeOpacity={0}
          animate={{ strokeOpacity: [0, 0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </svg>
    </motion.div>
  );
}
