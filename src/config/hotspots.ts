import type { Hotspot } from './types';

/**
 * Structured hotspot config — the single place to add/edit/remove points of interest.
 * No rendering logic lives here; scene code only reads this array.
 *
 * Prefer `{ type: 'node', nodeName: '...' }` anchors matching an Empty authored in
 * the Blender file (named `HS_<id>` by convention) — they survive re-exports.
 * `placeholderHotspots` below matches the procedural PlaceholderScene's anchors,
 * used automatically when no `modelUrl` is set.
 */
export const placeholderHotspots: Hotspot[] = [
  {
    id: 'reception',
    anchor: { type: 'node', nodeName: 'HS_reception' },
    title: 'Reception Desk',
    description:
      'A custom-fabricated reception counter with backlit branding, greeting attendees as they enter the booth.',
    category: 'furniture',
    ctaLabel: 'See reception options',
    ctaUrl: '#',
  },
  {
    id: 'led-wall',
    anchor: { type: 'node', nodeName: 'HS_led-wall' },
    title: 'LED Video Wall',
    description:
      'A high-resolution LED wall for looping brand content, live demos, or sponsor reels — visible from across the show floor.',
    category: 'av',
    ctaLabel: 'AV equipment specs',
    ctaUrl: '#',
    cameraView: { distance: 5 },
  },
  {
    id: 'lounge-seating',
    anchor: { type: 'node', nodeName: 'HS_lounge-seating' },
    title: 'Lounge Seating',
    description:
      'A relaxed seating area for one-on-one conversations and longer meetings away from the main aisle traffic.',
    category: 'furniture',
  },
  {
    id: 'product-display',
    anchor: { type: 'node', nodeName: 'HS_product-display' },
    title: 'Product Display',
    description:
      'A dedicated plinth for hero products, with directional lighting to keep the focus where it belongs.',
    category: 'product',
    ctaLabel: 'View product catalog',
    ctaUrl: '#',
  },
  {
    id: 'signage-tower',
    anchor: { type: 'node', nodeName: 'HS_signage-tower' },
    title: 'Overhead Signage Tower',
    description:
      'Tall format signage for long-distance brand visibility across a crowded show floor.',
    category: 'signage',
  },
];

/**
 * Hotspots for the real trade-show.glb. That particular export has no authored
 * `HS_*` anchor Empties (see README's Blender export checklist for the naming
 * contract a future export should follow), so these use hand-picked
 * `{ type: 'position', ... }` coordinates read from the model's actual geometry
 * instead — workable, but brittler across re-exports than node anchors.
 */
export const tradeShowHotspots: Hotspot[] = [
  {
    id: 'main-stage',
    anchor: { type: 'position', position: [0, 2, 3] },
    title: 'Main Stage',
    description:
      'The keynote stage with podium, ready for keynote speakers, panels, and product announcements.',
    category: 'stage',
    cameraView: { position: [6, 2.2, 10], distance: 6 },
    ctaLabel: 'Check it out',
    ctaUrl: '#',
  },
  {
    id: 'stage-backdrop',
    anchor: { type: 'position', position: [0, 3.5, -3] },
    title: 'Presentation Backdrop',
    description:
      'A full-width curtain and screen backdrop frames the stage for maximum visual impact from every seat.',
    category: 'av',
    cameraView: { distance: 8 },
    ctaLabel: 'Check it out',
    ctaUrl: '#',
  },
  {
    id: 'banquet-seating',
    anchor: { type: 'position', position: [0, 1, 20] },
    title: 'Banquet Seating',
    description:
      'Round-table seating for banquet dinners, awards ceremonies, and networking sessions between sessions.',
    category: 'furniture',
    cameraView: { position: [0, 12, 4], distance: 20 },
    ctaLabel: 'Check it out',
    ctaUrl: '#',
  },
  {
    id: 'exhibitor-tables',
    anchor: { type: 'position', position: [-33, 1, 20] },
    title: 'Exhibitor Tables',
    description:
      'Dedicated tables for sponsors and exhibiting partners to showcase their products alongside the main program.',
    category: 'product',
    cameraView: { position: [-33, 10, 0], distance: 18 },
    ctaLabel: 'Check it out',
    ctaUrl: '#',
  },
  {
    id: 'registration',
    anchor: { type: 'position', position: [16, 1.5, 78] },
    title: 'Registration & Lobby',
    description:
      'The registration desk and lobby area — the first impression attendees get when they arrive.',
    category: 'furniture',
    ctaLabel: 'Check it out',
    ctaUrl: '#',
  },
];

/** Default export kept for backwards-compatible imports; prefer the named exports. */
export const hotspots = placeholderHotspots;
