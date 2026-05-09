import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS: Record<string, number> = {
  hook: 6000,
  problem: 5000,
  solution: 7000,
  features: 6000,
  close: 6000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook: Scene1,
  problem: Scene2,
  solution: Scene3,
  features: Scene4,
  close: Scene5,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="w-full h-screen overflow-hidden relative bg-[#0D1B2A] font-body text-[#F5F0E8]">

      {/* PERSISTENT BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[100px] opacity-20 mix-blend-screen"
          style={{ background: 'radial-gradient(circle, #FF6B00, transparent)' }}
          animate={{
            x: ['-20%', '40%', '-10%'],
            y: ['-10%', '30%', '-20%'],
            scale: [1, 1.2, 0.9]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[80px] opacity-20 mix-blend-screen bottom-0 right-0"
          style={{ background: 'radial-gradient(circle, #00C9A7, transparent)' }}
          animate={{
            x: ['20%', '-30%', '10%'],
            y: ['20%', '-10%', '30%'],
            scale: [0.8, 1.3, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
        />
      </div>

      {/* PERSISTENT MIDGROUND - morphs with sceneIndex */}
      <motion.div
        className="absolute z-10 w-[2px] bg-[#FF6B00]"
        animate={{
          left: ['10%', '50%', '80%', '20%', '50%'][sceneIndex] ?? '10%',
          height: '100vh',
          top: 0,
          opacity: [0.3, 0.6, 0.8, 0.5, 0.2][sceneIndex] ?? 0.3,
          skewX: [0, 15, -10, 20, 0][sceneIndex] ?? 0,
        }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.div
        className="absolute z-10 rounded-full border border-[#00C9A7]"
        animate={{
          width: ['20vw', '40vw', '80vw', '15vw', '50vw'][sceneIndex] ?? '20vw',
          height: ['20vw', '40vw', '80vw', '15vw', '50vw'][sceneIndex] ?? '20vw',
          x: ['-10vw', '30vw', '10vw', '80vw', '25vw'][sceneIndex] ?? '-10vw',
          y: ['40vh', '10vh', '10vh', '60vh', '25vh'][sceneIndex] ?? '40vh',
          opacity: [0.1, 0.15, 0.3, 0.2, 0.1][sceneIndex] ?? 0.1,
        }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* FOREGROUND */}
      <div className="relative z-20 w-full h-full">
        <AnimatePresence mode="sync">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
