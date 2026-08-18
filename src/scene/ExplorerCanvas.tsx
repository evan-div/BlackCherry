import { Canvas } from '@react-three/fiber';
import { AgXToneMapping, SRGBColorSpace } from 'three';
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
        // AgX, not ACES, because AgX is the view transform the venue was authored
        // through: the shell's 30 baked maps are photographs of the room already
        // taken through Blender's AgX, and they render with toneMapped = false so
        // they arrive on screen untouched. Everything the bake does NOT cover —
        // cloths, curtains, counters, and the LED emitters — is still lit at
        // runtime and does go through this curve, so picking ACES here meant the
        // props were shaped by a different transform than the room they stand in.
        // ACES rolls warm saturated content toward orange where AgX desaturates it
        // toward white, and the props are lit by an IBL probed from a warm shell,
        // so that divergence showed up exactly where it hurts: measured on the
        // foreground tablecloths, ACES rendered them at R-B 34.1 against AgX's
        // 28.1. The baked surfaces are bit-identical either way — they never reach
        // the tone mapper — which is also why no choice here can fix a warm bake.
        gl.toneMapping = AgXToneMapping;
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
