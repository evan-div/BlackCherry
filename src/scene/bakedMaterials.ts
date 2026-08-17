import { Material, Mesh, MeshStandardMaterial } from 'three';

export function meshMaterials(mesh: Mesh): Material[] {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
    (m): m is Material => m instanceof Material,
  );
}

/**
 * True for a material authored as UNLIT — the export's convention for anything whose
 * appearance is already finished and must not be re-lit at runtime: a BLACK base colour
 * (so lights and shadows contribute nothing) carrying its entire appearance in emissive.
 *
 * Deliberately a STRUCTURAL test rather than a name-prefix one, so it covers the baked
 * shell, the ceiling emitters, and whatever the next export names them.
 *
 * The emissive test accepts a factor OR a texture, because both kinds belong here for
 * LIGHTING purposes. They differ for TONE MAPPING — see isBakedSurface. A black base
 * with NEITHER is genuinely just a black object and is correctly excluded; it still
 * wants normal lighting and shadow behaviour.
 */
export function isUnlitMaterial(m: Material): boolean {
  if (!(m instanceof MeshStandardMaterial)) return false;
  const baseIsBlack = m.color.r === 0 && m.color.g === 0 && m.color.b === 0;
  if (!baseIsBlack) return false;
  return !!m.emissiveMap || m.emissive.r > 0 || m.emissive.g > 0 || m.emissive.b > 0;
}

/**
 * True for the subset of unlit materials that are DISPLAY-REFERRED — a finished picture
 * rather than a radiance value — and so must skip the renderer's tone mapping.
 *
 * The discriminator is the emissive TEXTURE, and the distinction is real rather than
 * cosmetic. The 30 baked shell maps are photographs of the lit room with Blender's AgX
 * view transform already applied, at emissiveIntensity 1: they are finished sRGB and
 * running ACES over them grades twice. The ceiling LED strips carry no texture — just a
 * colour at emissiveIntensity 15, which is scene-referred HDR that NEEDS tone mapping to
 * land in display range.
 *
 * Getting this backwards is visible: opting the LEDs out clips them to flat yellow
 * (the export measured #ffffb8 against a #fdfaf8 reference, vs #fffcec when tone mapped).
 * An earlier export note advised extending the opt-out to everything named `EMISSIVE_*`
 * and was later retracted on measurement — hence testing what the material IS rather
 * than what it's called.
 */
export function isBakedSurface(m: Material): boolean {
  return isUnlitMaterial(m) && !!(m as MeshStandardMaterial).emissiveMap;
}

/**
 * True when a mesh lights ITSELF — the baked shell, the floors and the ceiling LED
 * strips. These are the only things in the export that emit; everything else (curtains,
 * cloths, counters, metalwork) is ordinary PBR and renders black without illumination.
 *
 * Used for two things: excluding these meshes from the runtime shadow pass (their
 * shadows are already in the bake), and selecting what the environment probe captures.
 */
export function isSelfIlluminated(mesh: Mesh): boolean {
  return meshMaterials(mesh).some(isUnlitMaterial);
}
