import { useState } from 'react';

function detectWebgl(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

/** Checked once, synchronously, before the Canvas ever mounts — no point paying for
 * a Three.js/GLTF chunk load only to fail inside it on genuinely unsupported browsers. */
export function useWebglSupported(): boolean {
  const [supported] = useState(detectWebgl);
  return supported;
}
