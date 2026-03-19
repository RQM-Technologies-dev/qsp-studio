import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Mesh } from 'three';
import { SignalParams, computeSignalTip } from '../math/signal';
import { SignalVector } from '../components/SignalVector';
import { TrailPath } from '../components/TrailPath';
import { generateTrail } from '../math/polarization';
import { quatFromAxisAngle, rotateVec3ByQuat, Vec3 } from '../math/quaternion';

interface QuaternionicSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
  showClassicalSplit: boolean;
}

/** Ghost circle showing where the classical complex signal would sit (XY plane only). */
function ClassicalSplitGhost({ params, currentTime }: { params: SignalParams; currentTime: number }) {
  const ghostPoints = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    const a = params.amplitude;
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * 2 * Math.PI;
      pts.push([a * Math.cos(t), a * Math.sin(t), 0]);
    }
    return pts;
  }, [params.amplitude]);

  const classicParams = { ...params, demoMode: 'complex' as const };
  const classicTip = computeSignalTip(classicParams, currentTime);

  return (
    <group>
      <Line points={ghostPoints} color="#00d4ff" lineWidth={1} transparent opacity={0.18} />
      <mesh position={classicTip}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1} transparent opacity={0.45} />
      </mesh>
      <Line points={[[0, 0, 0], classicTip]} color="#00d4ff" lineWidth={1.5} transparent opacity={0.25} />
    </group>
  );
}

/**
 * Three orthogonal axis indicators at the tip, rotated by the current quaternion state.
 * Encodes the orientation component of the quaternionic signal — the three visible axes
 * represent projected 3D orientation; their combined rotation encodes the 4th component.
 */
function QuaternionFrame({ tip, params, currentTime }: {
  tip: [number, number, number];
  params: SignalParams;
  currentTime: number;
}) {
  const theta = 2 * Math.PI * params.frequency * currentTime + params.phase;
  const axis: Vec3 = [params.orientationX, params.orientationY, params.orientationZ];
  const axisLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const normAxis: Vec3 = axisLen > 1e-10
    ? [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen]
    : [0, 0, 1];
  const rotQ = quatFromAxisAngle(normAxis, theta * 0.3);

  const frameSize = 0.28;
  const localAxes: [Vec3, string][] = [
    [[frameSize, 0, 0], '#ff6688'],
    [[0, frameSize, 0], '#55ee88'],
    [[0, 0, frameSize], '#5588ff'],
  ];

  return (
    <group position={tip}>
      {localAxes.map(([dir, color], idx) => {
        const rotated = rotateVec3ByQuat(dir, rotQ);
        return (
          <Line
            key={idx}
            points={[[0, 0, 0], rotated]}
            color={color}
            lineWidth={2.5}
            transparent
            opacity={0.9}
          />
        );
      })}
      {/* Small sphere at frame origin (same as tip) */}
      <mesh>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

/**
 * Pulsing translucent halo at the tip — a visual indicator of the scalar/4th-component
 * of the quaternionic state. The scale oscillation hints at a dimension beyond the
 * three visible axes.
 */
function PulsingHalo({ tip }: { tip: [number, number, number] }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const pulse = 1 + 0.18 * Math.sin(clock.getElapsedTime() * 4.5);
      ref.current.scale.setScalar(pulse);
    }
  });
  return (
    <mesh ref={ref} position={tip}>
      <sphereGeometry args={[0.14, 20, 20]} />
      <meshStandardMaterial
        color="#f59e0b"
        emissive="#f59e0b"
        emissiveIntensity={0.6}
        transparent
        opacity={0.12}
      />
    </mesh>
  );
}

/**
 * Build a small ring of points centred at (cx, cy, cz) with radius r in the XY plane.
 * Defined outside the component to avoid re-creation on every render.
 */
function buildRingPts(cx: number, cy: number, cz: number, r: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * 2 * Math.PI;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), cz]);
  }
  return pts;
}

/**
 * Tiny fiber circles along the trail — visually suggests "fiber over trajectory",
 * evoking the Hopf-fibration concept where each point carries a hidden S¹ fiber.
 */
function FiberRings({ trail }: { trail: [number, number, number][] }) {
  const step = Math.max(1, Math.floor(trail.length / 6));

  return (
    <group>
      {trail
        .filter((_, i) => i > 0 && i % step === 0)
        .map(([x, y, z], idx) => (
          <Line
            key={idx}
            points={buildRingPts(x, y, z, 0.06)}
            color="#f59e0b"
            lineWidth={0.8}
            transparent
            opacity={0.3}
          />
        ))}
    </group>
  );
}

export function QuaternionicSignalDemo({ params, currentTime, tip, showClassicalSplit }: QuaternionicSignalDemoProps) {
  // Longer trail with more samples for richness
  const trail = generateTrail(params, currentTime, 2.5 / params.frequency, 180);
  return (
    <>
      {showClassicalSplit && <ClassicalSplitGhost params={params} currentTime={currentTime} />}

      {/* Rich enhanced trail */}
      <TrailPath points={trail} demoMode="quaternionic" enhanced />

      {/* Fiber rings at sample points along the trail */}
      <FiberRings trail={trail} />

      {/* Pulsing halo — encodes scalar / 4th quaternion component */}
      <PulsingHalo tip={tip} />

      {/* Signal vector */}
      <SignalVector tip={tip} demoMode="quaternionic" enhanced />

      {/* Local quaternion orientation frame at tip */}
      <QuaternionFrame tip={tip} params={params} currentTime={currentTime} />
    </>
  );
}
