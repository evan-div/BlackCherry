/**
 * Procedural stand-in for the real Blender export. Reproduces the same node-naming
 * contract the real GLB is expected to follow (`HS_<id>` anchor empties, a
 * `CAMERA_DEFAULT` marker) so every downstream system — hotspot anchoring, orbit
 * framing, walk-mode bounds — is fully buildable and testable before the real asset
 * arrives. Swapping in the real model should require no code changes beyond pointing
 * `modelUrl` at it and updating hotspot node names if they differ.
 */
export function PlaceholderScene() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[32, 24]} />
        <meshStandardMaterial color="#d8d9dc" roughness={0.9} />
      </mesh>

      {/* Camera presentation marker (read by useHotspotAnchors-style lookups later if needed) */}
      <object3D name="CAMERA_DEFAULT" position={[9, 6, 11]} />

      {/* Reception desk — named to match the walk-mode collision system's
          furniture-obstacle pattern (see controls/collision.ts), so it's solid. */}
      <group position={[-8, 0, -6]}>
        <mesh name="counter-reception" position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.1, 0.8]} />
          <meshStandardMaterial color="#1f2430" roughness={0.4} metalness={0.1} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[3.4, 0.08, 1]} />
          <meshStandardMaterial color="#2d3345" roughness={0.3} />
        </mesh>
        <object3D name="HS_reception" position={[0, 1.6, 0.5]} />
      </group>

      {/* LED video wall */}
      <group position={[0, 0, -10]}>
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 3.4, 0.25]} />
          <meshStandardMaterial color="#0a0c10" emissive="#1a2f6b" emissiveIntensity={0.6} roughness={0.5} />
        </mesh>
        <object3D name="HS_led-wall" position={[0, 2.6, 0.6]} />
      </group>

      {/* Lounge seating */}
      <group position={[7, 0, 4]}>
        {[[-1.1, 0], [1.1, 0], [0, 1.1]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.4, z]} castShadow receiveShadow>
            <boxGeometry args={[1, 0.8, 1]} />
            <meshStandardMaterial color="#7a3b3b" roughness={0.8} />
          </mesh>
        ))}
        <object3D name="HS_lounge-seating" position={[0, 0.9, 0]} />
      </group>

      {/* Product display plinth */}
      <group position={[-3, 0, 5]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.8, 0.9, 1, 24]} />
          <meshStandardMaterial color="#f4f4f6" roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.35, 0]} castShadow>
          <icosahedronGeometry args={[0.4, 0]} />
          <meshStandardMaterial color="#aab947" roughness={0.25} metalness={0.2} />
        </mesh>
        <object3D name="HS_product-display" position={[0, 1.8, 0]} />
      </group>

      {/* Signage tower */}
      <group position={[10, 0, -8]}>
        <mesh position={[0, 3, 0]} castShadow>
          <boxGeometry args={[0.3, 6, 0.3]} />
          <meshStandardMaterial color="#2d3345" roughness={0.5} />
        </mesh>
        <mesh position={[0, 5.6, 0]} castShadow>
          <boxGeometry args={[1.6, 0.9, 0.1]} />
          <meshStandardMaterial color="#aab947" roughness={0.4} />
        </mesh>
        <object3D name="HS_signage-tower" position={[0, 5.6, 0.1]} />
      </group>

      {/* Ambient booth clutter for visual richness / scale reference — also solid,
          via the same "table" name-pattern match as the reception counter. */}
      {[
        [-11, -3], [-6, 3], [3, -7], [12, 2], [-2, -3], [6, -3],
      ].map(([x, z], i) => (
        <mesh key={i} name={`table-clutter-${i}`} position={[x, 0.35, z]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 0.7, 1.4]} />
          <meshStandardMaterial color="#aeb2bd" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
