import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { useRegion } from '@/lib/region';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import type { RegionConfig } from '@/lib/region';

export const SCENE_DURATIONS: Record<string, number> = {
  hook: 6000,
  action: 5000,
  sonar: 7000,
  features: 6000,
  close: 6000,
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
  const { currentSceneKey } = useVideoPlayer({ durations, loop });
  const region = useRegion();

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseKey = currentSceneKey.replace(/_r[12]$/, '');

  const sceneProps = { region };

  return (
    <div className="w-full h-screen overflow-hidden relative font-body text-white bg-[#010810]">
      <div className="relative z-10 w-full h-full">
        <AnimatePresence mode="sync">
          {baseKey === 'hook' && <Scene1 key={currentSceneKey} {...sceneProps} />}
          {baseKey === 'action' && <Scene2 key={currentSceneKey} {...sceneProps} />}
          {baseKey === 'sonar' && <Scene3 key={currentSceneKey} {...sceneProps} />}
          {baseKey === 'features' && <Scene4 key={currentSceneKey} {...sceneProps} />}
          {baseKey === 'close' && <Scene5 key={currentSceneKey} {...sceneProps} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
