import { motion } from 'framer-motion';

interface AnglerBoatProps {
  width?: number;
  primaryColor?: string;
  castPhase?: number;
  flip?: boolean;
  style?: React.CSSProperties;
  className?: string;
  bobAmplitude?: number;
  showWake?: boolean;
}

function WakeSpray({ width, color }: { width: number; color: string }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.ellipse
          key={i}
          cx={-width * (0.04 + i * 0.045)}
          cy={width * 0.21 + i * 2}
          rx={width * (0.015 + i * 0.02)}
          ry={width * 0.012}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
          initial={{ opacity: 0.6 - i * 0.1, scaleX: 0.8 }}
          animate={{ opacity: [0.5 - i * 0.08, 0.2, 0.5 - i * 0.08], scaleX: [0.8, 1.15, 0.8] }}
          transition={{ duration: 0.9 + i * 0.15, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
      {/* Spray dots */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.circle
          key={`s${i}`}
          cx={-width * (0.02 + i * 0.03)}
          cy={width * 0.19 - i * 1.5}
          r={width * 0.006}
          fill="rgba(255,255,255,0.4)"
          animate={{ cy: [width * 0.19 - i * 1.5, width * 0.16 - i * 2, width * 0.22], opacity: [0.4, 0.7, 0] }}
          transition={{ duration: 0.7, delay: i * 0.08, repeat: Infinity }}
        />
      ))}
    </g>
  );
}

function AnglerFigure({ w, castPhase, color }: { w: number; castPhase: number; color: string }) {
  const armAngle = castPhase >= 2 ? -30 : castPhase >= 1 ? 60 : 30;
  const rodAngle = castPhase >= 2 ? -50 : castPhase >= 1 ? 80 : 45;
  const rodLen = w * 0.22;

  const bodyX = w * 0.42;
  const bodyY = w * 0.07;
  const headR = w * 0.028;
  const torsoH = w * 0.07;
  const legH = w * 0.055;

  const shoulderX = bodyX;
  const shoulderY = bodyY + headR * 2.2;
  const armRad = ((armAngle) * Math.PI) / 180;
  const elbowX = shoulderX + Math.cos(armRad) * w * 0.055;
  const elbowY = shoulderY + Math.sin(armRad) * w * 0.055;
  const handX = elbowX + Math.cos(armRad + 0.3) * w * 0.05;
  const handY = elbowY + Math.sin(armRad + 0.3) * w * 0.05;
  const rodRad = ((-rodAngle) * Math.PI) / 180;
  const rodTipX = handX + Math.cos(rodRad) * rodLen;
  const rodTipY = handY + Math.sin(rodRad) * rodLen;

  const lineVisible = castPhase >= 2;
  const splashVisible = castPhase >= 3;
  const waterY = w * 0.23;
  const lureX = splashVisible ? w * 0.72 : rodTipX + (waterY - rodTipY) * 0.8;
  const lureY = splashVisible ? waterY : rodTipY + (waterY - rodTipY) * 0.5;

  return (
    <g>
      {/* Fishing line */}
      {lineVisible && (
        <motion.path
          d={`M ${rodTipX} ${rodTipY} Q ${rodTipX + (lureX - rodTipX) * 0.6} ${rodTipY - w * 0.03} ${lureX} ${lureY}`}
          fill="none"
          stroke="rgba(200,230,255,0.6)"
          strokeWidth={0.8}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}
      {/* Splash */}
      {splashVisible && (
        <>
          {[-1, 0, 1].map((i) => (
            <motion.line
              key={i}
              x1={lureX + i * 3}
              y1={waterY}
              x2={lureX + i * 4}
              y2={waterY - 5}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={1}
              animate={{ y2: [waterY - 5, waterY - 12, waterY - 5], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          ))}
        </>
      )}
      {/* Rod */}
      <motion.line
        x1={handX} y1={handY} x2={rodTipX} y2={rodTipY}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        animate={{
          x1: handX, y1: handY,
          x2: rodTipX, y2: rodTipY,
        }}
        transition={{ duration: 0.3 }}
      />
      {/* Arm */}
      <line x1={shoulderX} y1={shoulderY} x2={elbowX} y2={elbowY} stroke="#ddd" strokeWidth={2} strokeLinecap="round" />
      <line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke="#ddd" strokeWidth={1.8} strokeLinecap="round" />
      {/* Body */}
      <line x1={shoulderX} y1={shoulderY} x2={bodyX} y2={shoulderY + torsoH} stroke="#ccc" strokeWidth={3} strokeLinecap="round" />
      {/* Legs */}
      <line x1={bodyX} y1={shoulderY + torsoH} x2={bodyX - w * 0.015} y2={shoulderY + torsoH + legH} stroke="#aaa" strokeWidth={2.2} strokeLinecap="round" />
      <line x1={bodyX} y1={shoulderY + torsoH} x2={bodyX + w * 0.01} y2={shoulderY + torsoH + legH} stroke="#aaa" strokeWidth={2.2} strokeLinecap="round" />
      {/* Head */}
      <circle cx={bodyX} cy={bodyY + headR} r={headR} fill="#d4a574" />
      {/* Cap */}
      <path d={`M ${bodyX - headR - 2} ${bodyY + headR} Q ${bodyX} ${bodyY - headR * 0.5} ${bodyX + headR + 2} ${bodyY + headR}`} fill="#333" />
      <rect x={bodyX - headR * 1.5} y={bodyY + headR * 0.5} width={headR * 0.8} height={headR * 0.4} rx={1} fill="#222" />
      {/* Second person in back */}
      <circle cx={bodyX - w * 0.09} cy={bodyY + headR - w * 0.005} r={headR * 0.85} fill="#c49060" />
      <line x1={bodyX - w * 0.09} y1={bodyY + headR * 2.5} x2={bodyX - w * 0.09} y2={bodyY + headR * 2.5 + torsoH} stroke="#bbb" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

export function AnglerBoat({
  width = 500,
  primaryColor = '#FF6B00',
  castPhase = 0,
  flip = false,
  style,
  className = '',
  bobAmplitude = 3,
  showWake = true,
}: AnglerBoatProps) {
  const h = width * 0.3;
  const hull = {
    bowX: width * 0.06,
    deckY: width * 0.18,
    sternX: width * 0.92,
    bottomY: width * 0.24,
  };

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width, ...style }}
      animate={{ y: [0, -bobAmplitude, 0, bobAmplitude * 0.5, 0] }}
      transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg
        viewBox={`0 0 ${width} ${h}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}
      >
        {showWake && <WakeSpray width={width} color={primaryColor} />}

        {/* Hull outer */}
        <path
          d={`M ${hull.bowX} ${hull.deckY}
              Q ${hull.bowX * 0.4} ${hull.deckY + width * 0.025} ${hull.bowX * 0.2} ${hull.bottomY}
              Q ${width * 0.35} ${hull.bottomY + width * 0.02} ${width * 0.55} ${hull.bottomY + width * 0.02}
              Q ${hull.sternX * 0.95} ${hull.bottomY + width * 0.015} ${hull.sternX} ${hull.bottomY}
              L ${hull.sternX} ${hull.deckY + width * 0.005}
              Q ${width * 0.55} ${hull.deckY - width * 0.005} ${hull.bowX} ${hull.deckY}Z`}
          fill="#1e2d42"
          stroke="#2d4060"
          strokeWidth={1.5}
        />

        {/* Hull inner deck */}
        <path
          d={`M ${hull.bowX + width * 0.03} ${hull.deckY + width * 0.005}
              Q ${width * 0.55} ${hull.deckY - width * 0.01} ${hull.sternX - width * 0.02} ${hull.deckY + width * 0.005}
              L ${hull.sternX - width * 0.02} ${hull.deckY + width * 0.025}
              Q ${width * 0.55} ${hull.deckY + width * 0.018} ${hull.bowX + width * 0.03} ${hull.deckY + width * 0.025}Z`}
          fill="#162230"
          stroke="#253548"
          strokeWidth={1}
        />

        {/* Gunwale highlight */}
        <path
          d={`M ${hull.bowX + width * 0.02} ${hull.deckY}
              Q ${width * 0.55} ${hull.deckY - width * 0.01} ${hull.sternX - width * 0.02} ${hull.deckY + width * 0.005}`}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={2}
        />

        {/* Center console */}
        <rect
          x={width * 0.38}
          y={hull.deckY - width * 0.1}
          width={width * 0.13}
          height={width * 0.1}
          rx={width * 0.01}
          fill="#111c2b"
          stroke="#243040"
          strokeWidth={1.5}
        />
        {/* Windshield */}
        <path
          d={`M ${width * 0.395} ${hull.deckY - width * 0.1}
              L ${width * 0.405} ${hull.deckY - width * 0.155}
              L ${width * 0.505} ${hull.deckY - width * 0.155}
              L ${width * 0.515} ${hull.deckY - width * 0.1}Z`}
          fill="#131f30"
          stroke="#243040"
          strokeWidth={1.5}
        />
        {/* Windshield glint */}
        <line x1={width * 0.415} y1={hull.deckY - width * 0.148} x2={width * 0.425} y2={hull.deckY - width * 0.102} stroke="rgba(0,201,167,0.3)" strokeWidth={1} />

        {/* T-top */}
        <line x1={width * 0.38} y1={hull.deckY - width * 0.155} x2={width * 0.53} y2={hull.deckY - width * 0.155} stroke="#2d4060" strokeWidth={2} strokeLinecap="round" />
        <line x1={width * 0.405} y1={hull.deckY - width * 0.155} x2={width * 0.405} y2={hull.deckY - width * 0.1} stroke="#2d4060" strokeWidth={1.5} />
        <line x1={width * 0.505} y1={hull.deckY - width * 0.155} x2={width * 0.505} y2={hull.deckY - width * 0.1} stroke="#2d4060" strokeWidth={1.5} />

        {/* Outboard motor */}
        <rect x={hull.sternX} y={hull.deckY + width * 0.01} width={width * 0.04} height={width * 0.1} rx={width * 0.008} fill="#101820" stroke="#1e2d3d" strokeWidth={1.5} />
        <path d={`M ${hull.sternX + width * 0.02} ${hull.deckY + width * 0.11} Q ${hull.sternX + width * 0.04} ${hull.deckY + width * 0.155} ${hull.sternX} ${hull.deckY + width * 0.18}`} fill="none" stroke="#1e2d3d" strokeWidth={2} />

        {/* Motor prop wash */}
        <motion.ellipse
          cx={hull.sternX + width * 0.06}
          cy={hull.bottomY + width * 0.01}
          rx={width * 0.04}
          ry={width * 0.008}
          fill="rgba(255,255,255,0.15)"
          animate={{ rx: [width * 0.04, width * 0.07, width * 0.04], opacity: [0.15, 0.3, 0.1] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />

        {/* Nav lights */}
        <circle cx={hull.bowX * 0.6} cy={hull.deckY + width * 0.01} r={width * 0.005} fill="#00ff88" opacity={0.9} />
        <circle cx={hull.sternX - width * 0.01} cy={hull.deckY + width * 0.01} r={width * 0.005} fill="#ff4444" opacity={0.9} />

        {/* Sonar transponder glow */}
        <motion.circle
          cx={width * 0.46}
          cy={hull.bottomY + width * 0.015}
          r={width * 0.012}
          fill="none"
          stroke={primaryColor}
          strokeWidth={1}
          animate={{ r: [width * 0.012, width * 0.04, width * 0.012], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />

        {/* Angler */}
        <AnglerFigure w={width} castPhase={castPhase} color={primaryColor} />
      </svg>
    </motion.div>
  );
}
