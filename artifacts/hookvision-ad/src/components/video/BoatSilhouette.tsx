import { motion } from 'framer-motion';

interface SonarRingProps {
  delay: number;
  originX: number;
  originY: number;
  color?: string;
}

function SonarRing({ delay, originX, originY, color = '#00C9A7' }: SonarRingProps) {
  return (
    <motion.circle
      cx={originX}
      cy={originY}
      r={10}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      initial={{ r: 10, opacity: 0.8 }}
      animate={{ r: 120, opacity: 0 }}
      transition={{ duration: 2.8, delay, repeat: Infinity, ease: 'easeOut' }}
    />
  );
}

interface BoatSilhouetteProps {
  className?: string;
  width?: number;
  sonar?: boolean;
  sonarColor?: string;
  bobAmplitude?: number;
  style?: React.CSSProperties;
}

export function BoatSilhouette({
  className = '',
  width = 480,
  sonar = true,
  sonarColor = '#00C9A7',
  bobAmplitude = 4,
  style,
}: BoatSilhouetteProps) {
  const h = width * 0.28;
  const sonarX = width * 0.52;
  const sonarY = h * 0.54;

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width, ...style }}
      animate={{ y: [0, -bobAmplitude, 0, bobAmplitude * 0.6, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg
        viewBox={`0 0 ${width} ${h}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      >
        {sonar && (
          <g>
            <SonarRing delay={0} originX={sonarX} originY={sonarY} color={sonarColor} />
            <SonarRing delay={0.9} originX={sonarX} originY={sonarY} color={sonarColor} />
            <SonarRing delay={1.8} originX={sonarX} originY={sonarY} color={sonarColor} />
          </g>
        )}

        {/* Hull bottom */}
        <path
          d={`M ${width * 0.06} ${h * 0.72}
              Q ${width * 0.18} ${h * 0.85} ${width * 0.5} ${h * 0.88}
              Q ${width * 0.82} ${h * 0.85} ${width * 0.91} ${h * 0.72}
              L ${width * 0.94} ${h * 0.58}
              Q ${width * 0.82} ${h * 0.62} ${width * 0.5} ${h * 0.65}
              Q ${width * 0.22} ${h * 0.62} ${width * 0.04} ${h * 0.56}
              Z`}
          fill="#1a2535"
          stroke="#2d3f58"
          strokeWidth={1.5}
        />

        {/* Bow (left raised tip) */}
        <path
          d={`M ${width * 0.04} ${h * 0.56}
              Q ${width * 0.015} ${h * 0.48} ${width * 0.04} ${h * 0.42}
              Q ${width * 0.06} ${h * 0.36} ${width * 0.1} ${h * 0.44}
              L ${width * 0.13} ${h * 0.56}
              Q ${width * 0.08} ${h * 0.56} ${width * 0.04} ${h * 0.56}Z`}
          fill="#1a2535"
          stroke="#2d3f58"
          strokeWidth={1.5}
        />

        {/* Hull gunwale (top rail) */}
        <path
          d={`M ${width * 0.1} ${h * 0.44}
              Q ${width * 0.22} ${h * 0.38} ${width * 0.5} ${h * 0.36}
              Q ${width * 0.78} ${h * 0.38} ${width * 0.9} ${h * 0.46}
              L ${width * 0.94} ${h * 0.58}
              Q ${width * 0.82} ${h * 0.52} ${width * 0.5} ${h * 0.49}
              Q ${width * 0.22} ${h * 0.52} ${width * 0.08} ${h * 0.56}
              Z`}
          fill="#1e2e44"
          stroke="#2d3f58"
          strokeWidth={1}
        />

        {/* Center console body */}
        <rect
          x={width * 0.42}
          y={h * 0.16}
          width={width * 0.14}
          height={h * 0.24}
          rx={width * 0.012}
          fill="#141e2c"
          stroke="#2d3f58"
          strokeWidth={1.5}
        />

        {/* Windshield */}
        <path
          d={`M ${width * 0.43} ${h * 0.16}
              L ${width * 0.44} ${h * 0.08}
              L ${width * 0.56} ${h * 0.08}
              L ${width * 0.57} ${h * 0.16}Z`}
          fill="#1a2a3e"
          stroke="#2d3f58"
          strokeWidth={1.5}
        />

        {/* Windshield glint */}
        <line
          x1={width * 0.455}
          y1={h * 0.09}
          x2={width * 0.465}
          y2={h * 0.155}
          stroke="#00C9A7"
          strokeWidth={1}
          opacity={0.4}
        />

        {/* T-top frame bar */}
        <line
          x1={width * 0.41}
          y1={h * 0.08}
          x2={width * 0.59}
          y2={h * 0.08}
          stroke="#2d3f58"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={width * 0.44}
          y1={h * 0.08}
          x2={width * 0.44}
          y2={h * 0.16}
          stroke="#2d3f58"
          strokeWidth={1.5}
        />
        <line
          x1={width * 0.56}
          y1={h * 0.08}
          x2={width * 0.56}
          y2={h * 0.16}
          stroke="#2d3f58"
          strokeWidth={1.5}
        />

        {/* Sonar pole */}
        <line
          x1={width * 0.495}
          y1={h * 0.08}
          x2={width * 0.495}
          y2={-h * 0.1}
          stroke="#2d3f58"
          strokeWidth={1.5}
        />
        <circle cx={width * 0.495} cy={-h * 0.12} r={width * 0.008} fill="#FF6B00" opacity={0.9} />

        {/* Outboard motor */}
        <rect
          x={width * 0.88}
          y={h * 0.54}
          width={width * 0.045}
          height={h * 0.28}
          rx={width * 0.008}
          fill="#141e2c"
          stroke="#2d3f58"
          strokeWidth={1.5}
        />
        <path
          d={`M ${width * 0.9} ${h * 0.82}
              Q ${width * 0.93} ${h * 0.9} ${width * 0.88} ${h * 0.96}
              Q ${width * 0.84} ${h * 0.92} ${width * 0.87} ${h * 0.82}Z`}
          fill="#141e2c"
          stroke="#2d3f58"
          strokeWidth={1}
        />

        {/* Fishing rod */}
        <line
          x1={width * 0.25}
          y1={h * 0.38}
          x2={width * 0.08}
          y2={-h * 0.15}
          stroke="#2d3f58"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Running lights */}
        <circle cx={width * 0.06} cy={h * 0.44} r={width * 0.006} fill="#00ff88" opacity={0.9} />
        <circle cx={width * 0.93} cy={h * 0.5} r={width * 0.006} fill="#ff3333" opacity={0.9} />
      </svg>
    </motion.div>
  );
}
