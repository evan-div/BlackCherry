import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Texture } from 'three';

/**
 * Procedurally generated surface textures — no external image files, so the
 * embeddable widget stays self-contained (same principle as the procedural IBL
 * in Lighting.tsx). Everything here runs once at model-load time on a 2D canvas;
 * the results are handed to MeshStandardMaterials in applySurfaceMaterials.ts.
 *
 * The polished-concrete floor is the star: a color map (mottled aggregate + faint
 * slab control joints), a roughness map (so some patches are more polished/
 * reflective than others — the single most important thing separating "polished
 * concrete" from "flat gray plastic"), and a gentle normal map for micro-relief.
 */

/** Real-world meters covered by one texture tile. Floor UVs are baked in world
 * space at this scale (see applySurfaceMaterials), so control joints land on a
 * believable ~4 m slab grid. */
export const CONCRETE_TILE_METERS = 4;

/** World meters per wall texture tile. The wall shell is textured by world-space
 * triplanar projection (no UVs), so this sets the physical size of the board-formed
 * concrete pattern — board seams land every tile/BOARDS_PER_TILE meters of height. */
export const WALL_TILE_METERS = 2.4;
const BOARDS_PER_TILE = 8; // ~0.3 m form boards

const TEX_SIZE = 512;

export interface SurfaceTextures {
  map: Texture;
  roughnessMap?: Texture;
  normalMap?: Texture;
}

// --- tiny deterministic PRNG + tileable value noise ---------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Tileable value noise sampled in [0,1)² — wraps at the edges so the texture
 * repeats seamlessly across the floor. */
function tileNoise(cells: number, seed: number): (x: number, y: number) => number {
  const rnd = mulberry32(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x, y) => {
    const fx = x * cells;
    const fy = y * cells;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const x0 = ((ix % cells) + cells) % cells;
    const y0 = ((iy % cells) + cells) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const a = g[y0 * cells + x0];
    const b = g[y0 * cells + x1];
    const c = g[y1 * cells + x0];
    const d = g[y1 * cells + x1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  };
}

function makeTexture(data: Uint8ClampedArray, srgb: boolean): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Soft distance-to-nearest-slab-edge factor in [0,1] (1 = on a joint), for the
 * faint recessed control joints of a poured slab at tile borders. */
function jointFactor(u: number, v: number): number {
  const band = 0.02;
  const du = Math.min(u, 1 - u);
  const dv = Math.min(v, 1 - v);
  const d = Math.min(du, dv);
  return d >= band ? 0 : 1 - d / band;
}

export function createConcreteTextures(): SurfaceTextures {
  const n = TEX_SIZE * TEX_SIZE;
  const color = new Uint8ClampedArray(n * 4);
  const rough = new Uint8ClampedArray(n * 4);
  const height = new Float32Array(n);

  // Large slow pour mottling, medium blotches, and a fine grain — layered so the
  // surface never looks uniform (real concrete is patchy from curing + polishing).
  const mottle = tileNoise(4, 1337);
  const blotch = tileNoise(11, 9001);
  const grain = tileNoise(64, 7);
  const fleckRnd = mulberry32(24601);

  // Base concrete tone — a cool mid gray with the faintest warm cast.
  const baseR = 150;
  const baseG = 150;
  const baseB = 147;

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const u = x / TEX_SIZE;
      const v = y / TEX_SIZE;

      const m = mottle(u, v) - 0.5; // [-0.5, 0.5]
      const b = blotch(u, v) - 0.5;
      const g = grain(u, v) - 0.5;
      const joint = jointFactor(u, v);

      // Sparse darker aggregate specks + occasional bright fleck.
      let fleck = 0;
      const r = fleckRnd();
      if (r > 0.985) fleck = -34;
      else if (r < 0.01) fleck = 22;

      let bright = m * 34 + b * 18 + g * 10 + fleck;
      // Joints read as a recessed darker line.
      bright -= joint * 40;

      color[i * 4] = baseR + bright;
      color[i * 4 + 1] = baseG + bright;
      color[i * 4 + 2] = baseB + bright * 1.04; // a hair cooler in shadow
      color[i * 4 + 3] = 255;

      // Roughness: polished patches (lower) vs matte/curing patches (higher),
      // driven mostly by the slow mottle so reflective zones are broad, plus
      // rougher joints. Encoded equal across RGB (three samples .g).
      const roughValue = 0.44 + b * 0.22 + g * 0.06 + joint * 0.28 - m * 0.05;
      const rq = Math.max(0, Math.min(1, roughValue)) * 255;
      rough[i * 4] = rq;
      rough[i * 4 + 1] = rq;
      rough[i * 4 + 2] = rq;
      rough[i * 4 + 3] = 255;

      // Height field for the normal map: grain relief plus recessed joints.
      height[i] = g * 0.6 + b * 0.15 - joint * 1.4;
    }
  }

  // Normal map from the height field via finite differences (wrapping so it tiles).
  const normal = new Uint8ClampedArray(n * 4);
  const strength = 1.6;
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const xl = height[y * TEX_SIZE + ((x - 1 + TEX_SIZE) % TEX_SIZE)];
      const xr = height[y * TEX_SIZE + ((x + 1) % TEX_SIZE)];
      const yt = height[((y - 1 + TEX_SIZE) % TEX_SIZE) * TEX_SIZE + x];
      const yb = height[((y + 1) % TEX_SIZE) * TEX_SIZE + x];
      const dx = (xl - xr) * strength;
      const dy = (yt - yb) * strength;
      const len = Math.hypot(dx, dy, 1);
      normal[i * 4] = ((dx / len) * 0.5 + 0.5) * 255;
      normal[i * 4 + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      normal[i * 4 + 2] = (1 / len) * 255;
      normal[i * 4 + 3] = 255;
    }
  }

  return {
    map: makeTexture(color, true),
    roughnessMap: makeTexture(rough, false),
    normalMap: makeTexture(normal, false),
  };
}

/**
 * Wall/shell texture: board-formed concrete — the imprint of the timber form
 * boards a concrete wall was poured against (horizontal seams every ~0.3 m, each
 * board a slightly different tone, with a faint along-grain streak). It pairs with
 * the polished-concrete floor the way it does in real modern architecture: same
 * material family, but matte and textured where the floor is smooth and reflective.
 *
 * Applied by world-space triplanar projection (see applySurfaceMaterials), not
 * authored UVs — the V axis maps to world height, so the board seams sit at
 * consistent, believable heights across every wall regardless of its facing.
 */
export function createWallTexture(): SurfaceTextures {
  const n = TEX_SIZE * TEX_SIZE;
  const color = new Uint8ClampedArray(n * 4);
  const mottle = tileNoise(5, 555);
  const grain = tileNoise(40, 88);
  // Fine, horizontally-stretched noise for the wood grain that runs along each board.
  const streak = tileNoise(80, 314);

  const baseR = 168;
  const baseG = 163;
  const baseB = 154;

  // Per-board tone offsets — real board-formed concrete has each board cure to a
  // slightly different shade, which is most of what makes the pattern read.
  const toneRnd = mulberry32(4242);
  const boardTone: number[] = [];
  for (let b = 0; b < BOARDS_PER_TILE; b++) boardTone.push((toneRnd() - 0.5) * 22);

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const i = y * TEX_SIZE + x;
      const u = x / TEX_SIZE;
      const v = y / TEX_SIZE;

      const boardF = v * BOARDS_PER_TILE;
      const board = Math.floor(boardF) % BOARDS_PER_TILE;
      const withinBoard = boardF - Math.floor(boardF); // 0..1 up each board

      // Recessed seam grooves at each board boundary (soft falloff to top & bottom).
      const seamDist = Math.min(withinBoard, 1 - withinBoard);
      const seam = seamDist < 0.06 ? (1 - seamDist / 0.06) : 0;

      const m = mottle(u, v) - 0.5;
      const g = grain(u, v) - 0.5;
      // Grain streak sampled so it's smeared horizontally (along the board).
      const s = streak(u * 0.15, v) - 0.5;

      const bright = boardTone[board] + m * 12 + g * 5 + s * 7 - seam * 34;

      color[i * 4] = baseR + bright;
      color[i * 4 + 1] = baseG + bright;
      color[i * 4 + 2] = baseB + bright * 0.96;
      color[i * 4 + 3] = 255;
    }
  }

  return { map: makeTexture(color, true) };
}
