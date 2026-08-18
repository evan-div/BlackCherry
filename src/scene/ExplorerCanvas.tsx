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
        // ACES rather than three's AgX, even though the bake is authored through
        // Blender's AgX. The shell never reaches this curve at all — the 30 baked
        // maps render with toneMapped = false, and measure bit-identical under
        // every option — so the only things it shapes are the runtime-lit props
        // and the HDR ceiling emitters. On the emitters ACES is the measured
        // winner: three's AgX is not Blender's and desaturates a bright saturated
        // emitter less, which the export measured as an LED core of #fffcec under
        // ACES against #fff4e0 under AgX, reference #fdfaf8.
        //
        // This was briefly switched to AgX while the venue was reading yellow,
        // on the theory that props and room should share one curve; on that asset
        // it cooled the foreground tablecloths from R-B 34.1 to 28.1. The bake now
        // carries a solved white balance, so a neutral-albedo cloth renders at
        // linear R/B 1.03 and the two curves measure identically on it (R-B 2.5
        // either way) — the warmth the switch was buying back is gone at source,
        // and ACES keeps slightly more highlight snap. Worth re-measuring only if
        // the LED colour or strength moves back toward saturation.
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
