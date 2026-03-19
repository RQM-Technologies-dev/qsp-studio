import { MutableRefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import { Mesh, MeshStandardMaterial } from 'three';

interface ReceiverNodeProps {
  position: [number, number, number];
  /** Yaw rotation around Y-axis (radians). */
  yaw?: number;
  /** Pitch rotation around X-axis (radians). */
  pitch?: number;
  /** Shared ref set to 1 on each sample; decayed in useFrame. */
  sampleFlashRef?: MutableRefObject<number>;
  opacity?: number;
}

const RING_SEGS = 32;
const RING_R = 0.32;
const AXIS_LEN = 0.44;

/** YZ-ring in local space (origin-centred), perpendicular to local +X. */
function buildYZRingLocal(r: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= RING_SEGS; i++) {
    const a = (i / RING_SEGS) * 2 * Math.PI;
    pts.push([0, r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/** XY-ring in local space. */
function buildXYRingLocal(r: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= RING_SEGS; i++) {
    const a = (i / RING_SEGS) * 2 * Math.PI;
    pts.push([r * Math.cos(a), r * Math.sin(a), 0]);
  }
  return pts;
}

/**
 * Compact antenna/aperture receiver node.
 *
 * The whole structure is placed in a <group> with Euler rotation [pitch, yaw, 0]
 * so it tilts together with the receiver orientation controlled by the user.
 *
 * Two coloured "sensing axis" arrows show the local I-channel (j_r, red-ish)
 * and Q-channel (k_r, green-ish) directions — the receiver axes that the field
 * gets projected onto.  The core flashes brightly on each sample event.
 */
export function ReceiverNode({
  position,
  yaw = 0,
  pitch = 0,
  sampleFlashRef,
  opacity = 1,
}: ReceiverNodeProps) {
  const coreRef  = useRef<Mesh>(null);
  const haloRef  = useRef<Mesh>(null);
  const flashRef = useRef(0); // local decay copy

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const basePulse = 1 + 0.14 * Math.sin(t * 4.8);

    // Consume sample flash from the shared ref
    if (sampleFlashRef && sampleFlashRef.current > 0) {
      flashRef.current = sampleFlashRef.current;
      sampleFlashRef.current = 0; // consume so other frames don't double-count
    }
    // Decay local flash at a frame-rate-independent 6 units/second
    if (flashRef.current > 0) {
      flashRef.current = Math.max(0, flashRef.current - delta * 6);
    }
    const flash = flashRef.current;

    if (coreRef.current) {
      const mat = coreRef.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = (3 + flash * 4) * opacity;
      coreRef.current.scale.setScalar(basePulse * (1 + flash * 0.35));
    }
    if (haloRef.current) {
      const mat = haloRef.current.material as MeshStandardMaterial;
      mat.opacity = (0.1 + 0.06 * Math.sin(t * 4.8) + flash * 0.2) * opacity;
    }
  });

  const arm = RING_R * 1.4;
  const yzRing = buildYZRingLocal(RING_R);
  const xyRing = buildXYRingLocal(RING_R * 0.65);

  return (
    /* Three.js Euler XYZ: pitch around X first, then yaw around Y. */
    <group position={position} rotation={[pitch, yaw, 0]}>
      {/* Primary aperture ring — YZ plane, perpendicular to local +X (forward) */}
      <Line
        points={yzRing}
        color="#f59e0b"
        lineWidth={1.5}
        transparent
        opacity={0.45 * opacity}
      />

      {/* Secondary ring — XY plane */}
      <Line
        points={xyRing}
        color="#f59e0b"
        lineWidth={0.8}
        transparent
        opacity={0.22 * opacity}
      />

      {/* Dipole arm — local Y direction */}
      <Line
        points={[[0, -arm, 0], [0, arm, 0]]}
        color="#f59e0b"
        lineWidth={1.8}
        transparent
        opacity={0.38 * opacity}
      />

      {/* Short forward arm — local X direction */}
      <Line
        points={[[-RING_R * 0.6, 0, 0], [RING_R * 0.4, 0, 0]]}
        color="#f59e0b"
        lineWidth={1}
        transparent
        opacity={0.22 * opacity}
      />

      {/* ── Sensing axis arrows ──────────────────────────────────────── */}
      {/* j_r (I-channel) — local +Y — red */}
      <Line
        points={[[0, 0, 0], [0, AXIS_LEN, 0]]}
        color="#ff5566"
        lineWidth={2.2}
        transparent
        opacity={0.7 * opacity}
      />
      <mesh position={[0, AXIS_LEN, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#ff5566" emissive="#ff5566" emissiveIntensity={2} transparent opacity={0.85 * opacity} />
      </mesh>
      <Text position={[0, AXIS_LEN + 0.1, 0]} fontSize={0.09} color="#ff5566" fillOpacity={0.8 * opacity} anchorX="center">I</Text>

      {/* k_r (Q-channel) — local +Z — green */}
      <Line
        points={[[0, 0, 0], [0, 0, AXIS_LEN]]}
        color="#44ee88"
        lineWidth={2.2}
        transparent
        opacity={0.7 * opacity}
      />
      <mesh position={[0, 0, AXIS_LEN]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#44ee88" emissive="#44ee88" emissiveIntensity={2} transparent opacity={0.85 * opacity} />
      </mesh>
      <Text position={[0, 0, AXIS_LEN + 0.12]} fontSize={0.09} color="#44ee88" fillOpacity={0.8 * opacity} anchorX="center">Q</Text>

      {/* Active core — pulsing amber sphere (animated in useFrame) */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={3}
          transparent
          opacity={0.92 * opacity}
        />
      </mesh>

      {/* Outer glow halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={1}
          transparent
          opacity={0.1 * opacity}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, arm + 0.18, 0]}
        fontSize={0.1}
        color="#f59e0b"
        fillOpacity={0.65 * opacity}
        anchorX="center"
      >
        RECEIVER
      </Text>
    </group>
  );
}

