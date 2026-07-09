import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import type { ReactNode } from 'react';
import { DPR_RANGE, DPR_TOUCH_CAP } from '../config/defaults';
import { useIsTouchOnly } from '../hooks/useIsTouchOnly';

interface ExplorerCanvasProps {
  children: ReactNode;
  initialCameraPosition: [number, number, number];
  /** Camera far plane — must clear the whole scene's depth, or distant geometry clips. */
  far: number;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

/** Owns all renderer-level configuration: DPR capping, color management, tone
 * mapping, and a demand-driven frame loop so an embedded, mostly-static widget
 * doesn't spin the GPU while the user isn't interacting with it. */
export function ExplorerCanvas({
  children,
  initialCameraPosition,
  far,
  onContextLost,
  onContextRestored,
}: ExplorerCanvasProps) {
  const isTouchOnly = useIsTouchOnly();
  const dpr: [number, number] = isTouchOnly ? [1, DPR_TOUCH_CAP] : DPR_RANGE;

  return (
    <Canvas
      dpr={dpr}
      frameloop="demand"
      shadows
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.shadowMap.autoUpdate = false;

        const canvas = gl.domElement;
        const handleLost = (e: Event) => {
          e.preventDefault();
          onContextLost?.();
        };
        const handleRestored = () => onContextRestored?.();
        canvas.addEventListener('webglcontextlost', handleLost);
        canvas.addEventListener('webglcontextrestored', handleRestored);
      }}
      camera={{ fov: 50, near: 0.1, far, position: initialCameraPosition }}
    >
      {children}
    </Canvas>
  );
}
