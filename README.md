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
    theme: { accent: '#aab947' },
  });

  // later, e.g. on SPA route change: handle.unmount();
</script>
```

**Fallback: `<iframe>`.** `embed.html` mounts the same component full-viewport,
configured via query params — use this if the host CMS can't run a script tag:

```html
<iframe
  src="/embed.html?modelUrl=/models/trade-show.glb&accent=aab947"
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
| `desktopOnly` | `false` | touch-only devices get the mobile fallback instead of the 3D scene |

Each `<TradeShowExplorer>` instance owns its own isolated state — mounting more than
one on a page is safe.

### `desktopOnly` and the mobile fallback

The venue asset is built for a real GPU, so `desktopOnly` restricts the 3D experience
to devices that can run it well. On a touch-only device the explorer renders
`MobileFallback` instead: the poster image, then every hotspot as an expandable row
with its photo, description and the same CTA (or lead-capture form) the 3D card
carries. Mobile visitors keep the whole content-and-conversion path — they just read
the venue instead of walking it.

It's a real saving, not just a different view: the Canvas never mounts, the three.js
chunk is never imported and the GLB is never fetched, so a phone downloads none of
the 3D payload. Hosts see a `mobile_fallback_shown` analytics event when it renders.

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
re-exports; hardcoded coordinates don't. A node anchor can carry a
`fallbackPosition` used until the named Empty actually ships in the asset.

Card photos: drop a ~800×500 JPEG (<150KB) at `public/images/hotspots/<id>.jpg`
and set `image: '/images/hotspots/<id>.jpg'` on the hotspot. Leave the field off
until the file exists.

## Blender → GLB export checklist

- Apply all transforms (Ctrl+A → All Transforms); model at real-world scale (meters).
- Join meshes by material where possible — draw calls matter more than poly count.
  Target ≤150 mesh/material combinations, ≤1.5M triangles for the whole floor.
- Add an Empty named `HS_<hotspot-id>` at each hotspot anchor point (must match the
  `nodeName` in `hotspots.ts`). The app checks for these on load; a config can also
  carry a `fallbackPosition` per anchor, used until the empties ship in the asset.
- Add Empties named `CAMERA_DEFAULT` (where the opening camera sits) and
  `CAMERA_TARGET` (what it looks at). The app reads both on load and they win over
  the hand-tuned defaults in `src/config/defaults.ts`.
- Add a separate, simplified collision mesh set — floor + boxy wall/booth blockers,
  a few thousand triangles — with every object named starting `COLLISION`. When
  present, walk mode raycasts ONLY against these (cheaper and intentional: you
  decide exactly what blocks movement); the app hides them from render
  automatically. Without them, walk mode raycasts the full visible geometry.
- Export: glTF Binary (.glb), +Y up, apply modifiers on, punctual lights + cameras
  off (the app supplies its own lighting and reads the `CAMERA_*` empties instead).
- Repeated props (tables, chairs, curtains) should ship as `EXT_mesh_gpu_instancing`
  — the loader turns each group into one `InstancedMesh`, so 240 objects cost 21 draw
  calls instead of 240. Blender's exporter only groups **children of a common parent**,
  so parent each shared-mesh group to an Empty or the extension silently never emits.
  Note the tradeoff: instanced children are collapsed into their holder node, so those
  objects are no longer individually addressable by name. Keep anything the app looks
  up by name (`HS_*`, `CAMERA_*`, `COLLISION_*`, ceiling, light fixtures) OUT of the
  instanced groups.
- Bake lighting to an **emissive** lightmap over a **black** `baseColorFactor` (see
  the baking section below). That makes the surface render exactly as baked and
  fully independent of the app's runtime lights — no double-lighting, no fighting.
  The app detects these **structurally** — a black `baseColorFactor` plus an emissive
  texture or factor — not by a name prefix, so any unlit material qualifies however
  it's named. All of them skip shadow casting (their shadows are already baked, or
  they're light sources).
- For surfaces whose **material detail is finer than the bake can carry** (the floor's
  concrete grain is 1–3 mm; a lightmap texel covers 2–3 cm), keep the COMBINED bake and
  add a **tiled high-pass detail map** rather than splitting albedo out of the bake.
  Put the detail map in `baseColorTexture` on `TEXCOORD_0`, tiled via
  `KHR_texture_transform`; the bake stays in `emissiveTexture` on `TEXCOORD_1`. Because
  `baseColorFactor` is black the detail map contributes nothing to lighting — it's purely
  a carrier — and the app detects exactly that shape (an unlit material that nonetheless
  has a base colour texture) and multiplies it over the emissive.
  **Normalise it to a mean of 0.5, store it LINEAR, and encode it UASTC.** The app reads
  `texel * 2`, so a mean of 0.5 averages to exactly 1.0 and adds contrast without shifting
  exposure (measured: 3.2× the high-frequency energy for a 0.01% shift in mean).
  Do *not* ship the lighting as a separate linear-irradiance map scaled to fit 8-bit —
  that parks the data in the darkest part of the range where 8-bit quantization and
  ETC1S's coarse chroma are proportionally worst, and multiplying it back up amplifies
  that error into visible colour speckle.
- **Everything that emits must be structurally unlit** (black base + emissive), because
  the app derives its entire image-based lighting by *photographing the shell*: it hides
  every non-emitting mesh, renders a cubemap from the middle of the room, and uses that
  as `scene.environment`. That means the props are lit by the same light the bake carries
  — warm LED tint included — and it re-derives itself on every export, where hand-placed
  lights silently go stale. The corollary is that anything you want contributing to the
  room's light has to follow the unlit contract, and anything that shouldn't (a video
  screen, say) simply must not.
  Note the capture is **display-referred**: the shell opts out of tone mapping and writes
  finished sRGB, so the probe's render target is flagged sRGB in order to decode back to
  linear radiance. Capturing into a linear target reads a 0.5 sRGB pixel as 0.5 radiance
  rather than 0.214 and over-brightens the room by ~2.3x.
- Distinguish **baked surfaces from emitters**, because they need opposite tone
  mapping. A baked lightmap is display-referred — the view transform is already inside
  the image — so it must skip the renderer's tone mapping or it gets graded twice. A
  glowing fixture is scene-referred HDR (`KHR_materials_emissive_strength` above 1) and
  *must* stay tone mapped, or it clips to a flat colour. The app splits them on the
  presence of an **emissive texture**: baked maps have one, emitters carry a bare
  factor. Keep that true and both work automatically.
- Compress with [gltf-transform](https://gltf-transform.dev/) rather than Blender's
  built-in Draco export, so the pipeline is re-runnable:
  ```bash
  npm run optimize-model   # Draco on public/models/trade-show.glb, in place
  ```
  Geometry only — the asset already ships its textures as KTX2, so re-encoding them
  would just be a lossy round-trip. Add `webp` back if a future export ever hands
  over plain PNG/JPEG textures.
  **Do not use `gltf-transform optimize`.** Its `flatten`/`join`/`prune` steps
  delete exactly the things the app relies on: `join` merges meshes and destroys
  per-object names, and `flatten`/`prune` drop mesh-less nodes — which silently
  removes every `HS_*` and `CAMERA_*` empty. Verified: the full `optimize` pipeline
  strips all of them, while `webp` + `draco` alone preserves everything for ~0.7 MB
  more. Re-check names in a viewer after any pipeline change.
- Sanity-check the result at https://gltf-viewer.donmccurdy.com/ before handing off:
  orientation, materials, and that the Empties survived the export.

## Making it look premium: baking lighting in Blender

The single biggest visual upgrade available is baked lighting — the app's runtime
lighting (procedural IBL + one shadow-mapped key light) is deliberately cheap, and
it cannot produce the soft contact shadows, bounced color, and depth that make
architectural renders read as "real". Baking moves that quality offline:

1. **Light the scene properly in Blender** with area lights/HDRI in Cycles —
   whatever looks good in a Blender render is what you'll get on the web.
2. **Bake ambient occlusion at minimum.** Select the large static surfaces (floor,
   walls, booth shells), give them a second UV channel (Smart UV Project is fine),
   and bake AO (`Bake type: Ambient Occlusion`, ~1024–2048px per major surface).
   Multiply the AO into the base color textures (or wire it to the glTF settings
   node so it exports as the occlusion map).
3. **Full lightmap bake** (`Bake type: Combined`, Direct + Indirect) is what makes
   floors glow softly under stage lighting. Wire the result as **emissive** with
   `emissiveFactor` 1,1,1 and set the material's **base colour to black** — that
   way the diffuse term contributes nothing, runtime lights can't double-light the
   surface, and it renders on the web exactly as it did in Cycles. The app finds
   these by that structure (black base + emissive), so the naming is free — the
   current asset uses `BAKED_*` for the shell and `EMISSIVE_*` for the ceiling light
   panels, and both are picked up the same way. Bake to a second UV set
   (`TEXCOORD_1`) so the lightmap is independent of the tiling UVs.

   **Bake with the view transform applied** (`save_render` the PNG, then reload it)
   so the map is display-referred. The app sets `toneMapped = false` on these
   materials to match: running the renderer's ACES pass over an already-graded bake
   tone-maps it twice, which desaturates and flattens exactly the contrast it was
   baked to carry. Runtime-lit props are linear and keep ACES.
4. **Compress textures to KTX2** so the added texture weight stays cheap on the
   GPU (KTX2 stays compressed in VRAM; PNG/JPG decompress to full size):
   ```bash
   npx gltf-transform etc1s public/models/trade-show.glb public/models/trade-show.glb
   ```
   The app already ships the KTX2/basis transcoder and wires it into the loader
   (`ktx2Path` prop), so KTX2 textures load with zero code changes.
5. Re-run `npm run optimize-model`, then eyeball the result in the viewer before
   committing.

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
