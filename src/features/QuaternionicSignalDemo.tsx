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
  /** When true, show the 3D trail history. */
  showTrailHistory: boolean;
  /** When true, show fiber rings along the trail (Hopf-fibration concept). */
  showFiber: boolean;
  /** When true, show the local quaternion orientation frame at the tip. */
  showLocalFrame: boolean;
  /**
   * When true, render a faint XY-plane projection of the quaternionic orbit —
   * a "classical shadow" that shows how the full quaternionic state projects down
   * to something recognisable at a lower level of representation.
   */
  showProjectionShadow: boolean;
  /** Opacity multiplier (0–1) used during mode-morph fade. */
  opacity?: number;
  /**
   * Normalized field-coupling strength [0,1].
   * Scales halo opacity and fiber ring brightness as coupling weakens —
   * the richer quaternionic structure visibly loses coherence under misalignment.
   */
  couplingStrength?: number;
  /**
   * Yaw rotation (radians, around Y-axis) of the sensing frame.
   * Rotates the entire quaternionic structure so it visibly acts as the receiving basis.
   */
  receiverYaw?: number;
  /**
   * Pitch rotation (radians, around X-axis) of the sensing frame.
   */
  receiverPitch?: number;
}

/** Shared helper: compute the current quaternion from signal params + time. */
function computeCurrentQuat(params: SignalParams, currentTime: number) {
  const theta = 2 * Math.PI * params.frequency * currentTime + params.phase;
  const axis: Vec3 = [params.orientationX, params.orientationY, params.orientationZ];
  const axisLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const normAxis: Vec3 = axisLen > 1e-10
    ? [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen]
    : [0, 0, 1];
  return { q: quatFromAxisAngle(normAxis, theta * 0.3), theta };
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
 * Faint XY-plane projection of the quaternionic trail — the "classical shadow".
 *
 * Teaching purpose: makes explicit that the full quaternionic state contains a
 * classically-recognisable projection; the viewer can compare the rich 3D orbit
 * above with its planar shadow below, building intuition for the Quaternionic
 * Fourier Transform as a higher-dimensional generalisation of the ordinary DFT.
 */
function ProjectionShadow({ trail, opacity }: { trail: [number, number, number][]; opacity: number }) {
  const shadowPoints = useMemo<[number, number, number][]>(
    () => trail.map(([x, y]) => [x, y, 0]),
    [trail]
  );
  if (shadowPoints.length < 2) return null;
  return (
    <Line
      points={shadowPoints}
      color="#00d4ff"
      lineWidth={0.8}
      transparent
      opacity={0.18 * opacity}
    />
  );
}

/**
 * Three orthogonal axis indicators at the tip, rotated by the current quaternion state.
 * The three visible axes represent projected 3D orientation; their combined rotation
 * encodes the 4th (w/scalar) component.
 */
function QuaternionFrame({ tip, params, currentTime, opacity }: {
  tip: [number, number, number];
  params: SignalParams;
  currentTime: number;
  opacity: number;
}) {
  const { q } = computeCurrentQuat(params, currentTime);

  const frameSize = 0.28;
  const localAxes: [Vec3, string][] = [
    [[frameSize, 0, 0], '#ff6688'],
    [[0, frameSize, 0], '#55ee88'],
    [[0, 0, frameSize], '#5588ff'],
  ];

  return (
    <group position={tip}>
      {localAxes.map(([dir, color], idx) => {
        const rotated = rotateVec3ByQuat(dir, q);
        return (
          <Line
            key={idx}
            points={[[0, 0, 0], rotated]}
            color={color}
            lineWidth={2.5}
            transparent
            opacity={0.9 * opacity}
          />
        );
      })}
      <mesh>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

/**
 * Pulsing translucent halo at the tip — a visual indicator of the scalar/4th-component.
 * Pulse rate is tied to |w| so the oscillation frequency reflects the hidden component.
 */
function PulsingHalo({ tip, wComponent, opacity }: { tip: [number, number, number]; wComponent: number; opacity: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      // Pulse rate directly encodes |w|: larger w → faster oscillation
      const rate = BASE_PULSE_RATE + Math.abs(wComponent) * W_PULSE_SCALE;
      const pulse = 1 + 0.18 * Math.sin(clock.getElapsedTime() * rate);
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
        opacity={0.12 * opacity}
      />
    </mesh>
  );
}

/** Rate multiplier: baseAngle = currentTime * |w| * FIBER_ROTATION_SCALE * π */
const FIBER_ROTATION_SCALE = 3;

/** Halo pulse: rate = BASE_PULSE_RATE + |w| * W_PULSE_SCALE */
const BASE_PULSE_RATE = 2.5;
const W_PULSE_SCALE = 5.0;

/**
 * Faint projected hypersphere boundary — three great-circle-like rings at
 * different orientations centred at the origin of the quaternionic receiving
 * structure.  They evoke the idea that the visible 3D orbit is a projection of
 * a 4D hyperspherical receiving boundary (as in the HypersphereVisualization
 * reference), without literally reproducing that component.
 *
 * Each ring drifts at a different rate driven by |w| — differential rotation
 * across the three great-circle planes encodes the hidden scalar component.
 * Rate factors (1.0, 0.7, 0.5) are chosen so the rings stay visually
 * distinct and never fully synchronise, giving a persistent sense of
 * independent 4D rotation.
 */
function HyperBoundary({ amplitude, wComponent, currentTime, opacity }: {
  amplitude: number;
  wComponent: number;
  currentTime: number;
  opacity: number;
}) {
  // Base drift driven by |w|; each ring gets a different fraction so they
  // rotate independently and never lock together (1.0 × base, 0.7 ×, 0.5 ×).
  const baseDrift = currentTime * Math.abs(wComponent) * 0.4;
  const r = amplitude;

  // XY-plane equatorial ring — full drift rate (×1.0)
  const ring1 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * 2 * Math.PI + baseDrift;
      pts.push([r * Math.cos(a), r * Math.sin(a), 0]);
    }
    return pts;
  }, [r, baseDrift]);

  // XZ-plane meridional ring — 70% drift rate so it stays visually distinct
  const ring2 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * 2 * Math.PI + baseDrift * 0.7;
      pts.push([r * Math.cos(a), 0, r * Math.sin(a)]);
    }
    return pts;
  }, [r, baseDrift]);

  // YZ-plane lateral ring — 50% drift rate, slowest of the three
  const ring3 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * 2 * Math.PI + baseDrift * 0.5;
      pts.push([0, r * Math.cos(a), r * Math.sin(a)]);
    }
    return pts;
  }, [r, baseDrift]);

  return (
    <group>
      {ring1.length >= 2 && (
        <Line points={ring1} color="#f59e0b" lineWidth={0.6} transparent opacity={0.10 * opacity} />
      )}
      {ring2.length >= 2 && (
        <Line points={ring2} color="#f59e0b" lineWidth={0.6} transparent opacity={0.08 * opacity} />
      )}
      {ring3.length >= 2 && (
        <Line points={ring3} color="#f59e0b" lineWidth={0.6} transparent opacity={0.08 * opacity} />
      )}
    </group>
  );
}


/**
 * Build a small ring of points centred at (cx, cy, cz) with radius r,
 * rotated by rotAngle in the XY plane.
 */
function buildRingPts(cx: number, cy: number, cz: number, r: number, rotAngle = 0): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * 2 * Math.PI + rotAngle;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), cz]);
  }
  return pts;
}

/**
 * Tiny fiber circles sampled along the trail — evokes the Hopf-fibration concept
 * where each point on the visible trajectory carries a hidden S¹ fiber.
 *
 * The rotation rate of each ring is tied to |w| (the scalar quaternion component),
 * so the fiber spin encodes the hidden 4th dimension structurally, not decoratively.
 * Since the parent re-renders every frame (currentTime changes), rotating via
 * currentTime arithmetic gives smooth animation without a separate useFrame loop.
 */
function FiberRings({ trail, currentTime, wComponent, opacity }: {
  trail: [number, number, number][];
  currentTime: number;
  wComponent: number;
  opacity: number;
}) {
  const step = Math.max(1, Math.floor(trail.length / 6));
  // Rotation rate grows with |w|: when the scalar component dominates, fibers spin faster
  const baseAngle = currentTime * Math.abs(wComponent) * Math.PI * FIBER_ROTATION_SCALE;

  return (
    <group>
      {trail
        .filter((_, i) => i > 0 && i % step === 0)
        .map(([x, y, z], idx) => {
          // Each ring gets a phase offset so they don't all rotate in lockstep
          const phaseOffset = (idx / 6) * Math.PI;
          return (
            <Line
              key={idx}
              points={buildRingPts(x, y, z, 0.06, baseAngle + phaseOffset)}
              color="#f59e0b"
              lineWidth={0.8}
              transparent
              opacity={0.3 * opacity}
            />
          );
        })}
    </group>
  );
}

export function QuaternionicSignalDemo({
  params, currentTime, tip, showClassicalSplit,
  showTrailHistory, showFiber, showLocalFrame,
  showProjectionShadow, opacity = 1, couplingStrength = 1,
  receiverYaw = 0, receiverPitch = 0,
}: QuaternionicSignalDemoProps) {
  const trail = generateTrail(params, currentTime, 2.5 / params.frequency, 180);

  // Extract scalar w component to drive fiber rotation and halo pulse
  const { q } = computeCurrentQuat(params, currentTime);
  const wComponent = q[0];

  // Halo and fiber dims as coupling weakens — minimum 0.45 so the quaternionic
  // structure is still hinted at even at worst misalignment.
  const structureOpacity = opacity * (0.45 + 0.55 * couplingStrength);

  return (
    <group rotation={[receiverPitch, receiverYaw, 0]}>
      {showClassicalSplit && <ClassicalSplitGhost params={params} currentTime={currentTime} />}

      {/* XY-plane shadow — shows how the quaternionic state projects to a classical orbit */}
      {showProjectionShadow && <ProjectionShadow trail={trail} opacity={structureOpacity} />}

      {/* Projected hypersphere boundary rings — always shown; evoke the 4D receiving  */}
      {/* surface projected into 3D, as in the HypersphereVisualization reference.    */}
      <HyperBoundary
        amplitude={params.amplitude}
        wComponent={wComponent}
        currentTime={currentTime}
        opacity={structureOpacity}
      />

      {/* Rich enhanced trail — toggled by showTrailHistory */}
      {showTrailHistory && <TrailPath points={trail} demoMode="quaternionic" enhanced opacity={structureOpacity} />}

      {/* Fiber rings — toggled by showFiber; rotation rate encodes |w| */}
      {showFiber && <FiberRings trail={trail} currentTime={currentTime} wComponent={wComponent} opacity={structureOpacity} />}

      {/* Pulsing halo — always shown; pulse rate encodes |w|; dims with coupling */}
      <PulsingHalo tip={tip} wComponent={wComponent} opacity={structureOpacity} />

      {/* Signal vector */}
      <SignalVector tip={tip} demoMode="quaternionic" enhanced opacity={structureOpacity} />

      {/* Local quaternion orientation frame — toggled by showLocalFrame */}
      {showLocalFrame && <QuaternionFrame tip={tip} params={params} currentTime={currentTime} opacity={structureOpacity} />}
    </group>
  );
}
