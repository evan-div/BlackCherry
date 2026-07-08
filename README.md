# Trade Show Explorer

A standalone, embeddable Three.js "explore a booth" experience: orbit/pan/zoom around
a trade show environment, inspect product/area hotspots, and optionally drop into a
first-person WASD walk mode. Built with Vite + React + TypeScript +
[react-three-fiber](https://docs.pmnd.rs/react-three-fiber) + drei.

It is deliberately decoupled from any specific host website — it ships as an npm
package with a `mount()` function that works from a plain `<script type="module">`
on any site, regardless of that site's own stack.

## Development

```bash
npm install
npm run dev        # demo page at http://localhost:5173 — the explorer embedded
                    # mid-scroll in fake marketing copy, to exercise lazy-mount and
                    # scroll behavior the way it'll actually be used
```

Until a real model is supplied, the scene renders a procedural placeholder booth
(`src/scene/PlaceholderScene.tsx`) with the same node-naming contract the real GLB is
expected to follow, so every system (hotspots, walk-mode collision, camera framing)
is fully exercisable before the asset exists.

## Building

Two separate build targets:

```bash
npm run build       # dist/  — the demo site + the iframe-embeddable embed.html
npm run build:lib    # dist-lib/ — the npm package
```

`dist-lib/` contains several chunk files (`trade-show-explorer.js` is the entry;
`drei-*.js`, `LazyScene-*.js`, etc. are code-split, lazy-loaded pieces it imports by
relative URL at runtime). **Deploy the whole `dist-lib/` directory**, not just one
file — and copy `public/draco/` and `public/basis/` alongside it (or point
`decoderPath`/`ktx2Path` at wherever you do host them).

## Embedding on the main site

**Recommended: the built library, loaded as a plain ES module.** No React knowledge
required on the host page — React is bundled in, and the heavy three.js/GLTF code
stays split into a separate chunk that only loads once the container scrolls near
(or immediately with `lazy: 'eager'`).

```html
<link rel="stylesheet" href="/path/to/blackcherry.css" />
<div id="explorer" style="height: 70vh"></div>
<script type="module">
  import { mount } from '/path/to/trade-show-explorer.js';

  const handle = mount(document.getElementById('explorer'), {
    modelUrl: '/models/trade-show.glb',
    theme: { accent: '#c8102e' },
  });

  // later, e.g. on SPA route change: handle.unmount();
</script>
```

**Fallback: `<iframe>`.** `embed.html` mounts the same component full-viewport,
configured via query params — use this if the host CMS can't run a script tag:

```html
<iframe
  src="/embed.html?modelUrl=/models/trade-show.glb&accent=c8102e"
  style="width: 100%; height: 70vh; border: 0"
></iframe>
```

**React hosts** can instead import the component directly:

```tsx
import { TradeShowExplorer } from '@blackcherry/trade-show-explorer';

<TradeShowExplorer modelUrl="/models/trade-show.glb" hotspots={hotspots} />;
```

### Props (`ExplorerProps`, see `src/config/types.ts`)

| Prop | Default | Notes |
|---|---|---|
| `modelUrl` | placeholder scene | path to the GLB |
| `hotspots` | `src/config/hotspots.ts` sample data | see below |
| `theme` | neutral defaults | `--tse-*` CSS custom properties |
| `defaultMode` | `'explore'` | `'walk'` is ignored on touch-only devices |
| `aspect` / `height` | `16/9` | `height="fill"` fills a sized parent instead |
| `lazy` | `'viewport'` | mounts the 3D chunk only once scrolled near |
| `decoderPath` / `ktx2Path` | `/draco/`, `/basis/` | override if self-hosting decoders elsewhere |

Each `<TradeShowExplorer>` instance owns its own isolated state — mounting more than
one on a page is safe.

## Editing hotspots

Hotspots are plain data in `src/config/hotspots.ts` — no rendering logic to touch:

```ts
{
  id: 'led-wall',
  anchor: { type: 'node', nodeName: 'HS_led-wall' }, // matches a Blender Empty
  title: 'LED Video Wall',
  description: '…',
  category: 'av',
  ctaUrl: '#',
  ctaLabel: 'AV equipment specs',
}
```

Prefer `{ type: 'node', nodeName: '...' }` anchors over hardcoded
`{ type: 'position', position: [...] }` coordinates — node anchors survive Blender
re-exports; hardcoded coordinates don't.

## Blender → GLB export checklist

- Apply all transforms (Ctrl+A → All Transforms); model at real-world scale (meters).
- Join meshes by material where possible — draw calls matter more than poly count.
  Target ≤150 mesh/material combinations, ≤1.5M triangles for the whole floor.
- Add an Empty named `HS_<hotspot-id>` at each hotspot anchor point (must match the
  `nodeName` in `hotspots.ts`).
- Add an Empty named `CAMERA_DEFAULT` at the desired default presentation viewpoint.
- Add a separate, simplified collision mesh (floor + boxy wall/booth blockers, a few
  thousand triangles) with every object named starting `COLLISION` — this drives
  walk-mode ground height and boundaries (`src/controls/collision.ts`). Without it,
  walk mode falls back to a flat plane and a hard bounding box.
- Bake lighting into base color textures where practical — the app uses a procedural
  IBL + one directional light with a single non-updating shadow map, not full
  real-time shadows.
- Export: glTF Binary (.glb), +Y up, apply modifiers on, punctual lights + cameras
  off (the app supplies its own lighting and reads `CAMERA_DEFAULT` instead).
- Compress with [gltf-transform](https://gltf-transform.dev/) rather than Blender's
  built-in Draco export, so the pipeline is re-runnable:
  ```bash
  npm run optimize-model   # Draco-compresses public/models/trade-show.glb in place
  ```
- Sanity-check the result at https://gltf-viewer.donmccurdy.com/ before handing off:
  orientation, materials, and that the Empties survived the export.

## Architecture

```
src/
  config/     hotspot + theme + camera/walk default data (no rendering logic)
  state/      per-instance zustand store (state/createExplorerStore.ts) + context
  scene/      Canvas setup, lighting, model loading, placeholder scene
  controls/   orbit rig, walk rig, camera transitions, collision, keyboard
  hotspots/   anchor resolution + marker rendering
  ui/         DOM overlay chrome (loading/error, mode toggle, hotspot card, etc.)
  hooks/      cross-cutting hooks (viewport detection, touch detection, etc.)
```
