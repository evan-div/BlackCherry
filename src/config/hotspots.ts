import type { Hotspot } from './types';

/**
 * Structured hotspot config — the single place to add/edit/remove points of interest.
 * No rendering logic lives here; scene code only reads this array.
 *
 * `anchor.nodeName` must match an Empty authored in the Blender file (named `HS_<id>`
 * by convention). Until the real trade-show.glb is wired in, these match the named
 * anchors created by the procedural PlaceholderScene so the whole hotspot pipeline
 * (markers, cards, fly-to) is exercisable with zero rework once the real asset lands.
 */
export const hotspots: Hotspot[] = [
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
