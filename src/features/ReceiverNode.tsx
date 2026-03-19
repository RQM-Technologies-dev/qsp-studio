import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Text } from '@react-three/drei';
import { Mesh, MeshStandardMaterial } from 'three';

interface ReceiverNodeProps {
  position: [number, number, number];
  opacity?: number;
}

const RING_SEGS = 32;
const RING_R = 0.32;

/** Generate a circle of points in the YZ plane (perpendicular to wave propagation). */
function buildYZRing(cx: number, cy: number, cz: number, r: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= RING_SEGS; i++) {
    const a = (i / RING_SEGS) * 2 * Math.PI;
    pts.push([cx, cy + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return pts;
}

/** Generate a circle in the XY plane. */
function buildXYRing(cx: number, cy: number, cz: number, r: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= RING_SEGS; i++) {
    const a = (i / RING_SEGS) * 2 * Math.PI;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), cz]);
  }
  return pts;
}

/**
 * Compact antenna/aperture receiver node that sits between the incoming wave
 * and the geometric representation.  The YZ-plane ring is perpendicular to the
 * wave propagation direction (+X), so it reads as an aperture capturing the
 * arriving field.  The pulsing amber core signals active reception.
 */
export function ReceiverNode({ position, opacity = 1 }: ReceiverNodeProps) {
  const coreRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = 1 + 0.14 * Math.sin(t * 4.8);
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
    }
    if (haloRef.current) {
      const mat = haloRef.current.material as MeshStandardMaterial;
      mat.opacity = (0.1 + 0.06 * Math.sin(t * 4.8)) * opacity;
    }
  });

  const [px, py, pz] = position;
  const yzRing = buildYZRing(px, py, pz, RING_R);
  const xyRing = buildXYRing(px, py, pz, RING_R * 0.65);
  const arm = RING_R * 1.4;

  return (
    <group>
      {/* Primary aperture ring — YZ plane, perpendicular to incoming wave */}
      <Line
        points={yzRing}
        color="#f59e0b"
        lineWidth={1.5}
        transparent
        opacity={0.45 * opacity}
      />

      {/* Secondary ring — XY plane, gives 3D depth */}
      <Line
        points={xyRing}
        color="#f59e0b"
        lineWidth={0.8}
        transparent
        opacity={0.22 * opacity}
      />

      {/* Horizontal dipole arm — Y direction */}
      <Line
        points={[[px, py - arm, pz], [px, py + arm, pz]]}
        color="#f59e0b"
        lineWidth={1.8}
        transparent
        opacity={0.38 * opacity}
      />

      {/* Short propagation-axis arm — X direction (shows it senses the incoming field) */}
      <Line
        points={[[px - RING_R * 0.6, py, pz], [px + RING_R * 0.4, py, pz]]}
        color="#f59e0b"
        lineWidth={1}
        transparent
        opacity={0.22 * opacity}
      />

      {/* Active core — pulsing amber sphere */}
      <mesh ref={coreRef} position={position}>
        <sphereGeometry args={[0.055, 14, 14]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={3}
          transparent
          opacity={0.92 * opacity}
        />
      </mesh>

      {/* Outer glow halo — opacity animated in useFrame */}
      <mesh ref={haloRef} position={position}>
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
        position={[px, py + arm + 0.18, pz]}
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
