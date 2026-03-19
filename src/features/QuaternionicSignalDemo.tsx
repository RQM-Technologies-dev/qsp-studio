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
  /**
   * When true, render a small ring ripple at the current tip on the hypersphere
   * boundary surface — shows the receiver manifold actively excited by the field.
   */
  showExcitation?: boolean;
}

/** Shared helper: compute the current quaternion from signal params + time.
 *
 * Returns q(t) = cos(θ) + u·sin(θ) — the same unit quaternion used by
 * computeSignalTip — so that every downstream visual (fiber rings, pulsing halo,
 * local frame) derives from the identical geometric state.
 *
 * Implementation: quatFromAxisAngle(u, 2θ) gives w = cos(θ), xyz = u·sin(θ). ✓
 */
function computeCurrentQuat(params: SignalParams, currentTime: number) {
  const theta = 2 * Math.PI * params.frequency * currentTime + params.phase;
  const axis: Vec3 = [params.orientationX, params.orientationY, params.orientationZ];
  const axisLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const normAxis: Vec3 = axisLen > 1e-10
    ? [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen]
    : [0, 0, 1];
  // q(t) = cos(θ) + u·sin(θ)  ⟺  quatFromAxisAngle(u, 2θ)
  return { q: quatFromAxisAngle(normAxis, 2 * theta), theta };
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

/** Sphere geometry subdivisions for the HyperBoundary transparent shells. */
const SPHERE_WIDTH_SEGMENTS = 28;
const SPHERE_HEIGHT_SEGMENTS = 16;

/**
 * Hypersphere boundary — great-circle rings + dynamic translucent sphere that
 * visually evoke the 4-D receiving surface, inspired by HypersphereVisualization.
 *
 * Key design decisions (matching the HypersphereVisualization reference):
 *
 *  • Outer radius r = amplitude stays constant (the S³ envelope).
 *  • Inner radius rInner = amplitude × |w|  — tracks the quaternion scalar
 *    component exactly as the reference visualization scales sphere radii by
 *    |cos φ|.  This makes the inner shell visibly "breathe" as the receiver
 *    orientation changes.
 *  • Three orthogonal great-circle rings (XY, XZ, YZ) rotate at different
 *    rates driven by |w|, conveying independent 4-D rotational degrees of
 *    freedom.
 *  • A faint wireframe-style transparent sphere at rInner anchors the dynamic
 *    radius in 3-D space so the orientation change is spatially readable.
 *  • A second, brighter inner ring set at rInner reinforces the dynamic sizing.
 */
function HyperBoundary({ amplitude, wComponent, currentTime, opacity }: {
  amplitude: number;
  wComponent: number;
  currentTime: number;
  opacity: number;
}) {
  // Base drift driven by |w|; rate factors chosen so rings stay visually distinct
  const baseDrift = currentTime * Math.abs(wComponent) * 0.4;
  // Outer (static) radius — the S³ envelope
  const r = amplitude;
  // Inner (dynamic) radius — tracks |w|, mimicking HypersphereVisualization |cos φ|
  const rInner = amplitude * Math.max(0.25, Math.abs(wComponent));

  // ── Outer great-circle rings ────────────────────────────────────────────
  const ring1 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI + baseDrift;
      pts.push([r * Math.cos(a), r * Math.sin(a), 0]);
    }
    return pts;
  }, [r, baseDrift]);

  const ring2 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI + baseDrift * 0.7;
      pts.push([r * Math.cos(a), 0, r * Math.sin(a)]);
    }
    return pts;
  }, [r, baseDrift]);

  const ring3 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI + baseDrift * 0.5;
      pts.push([0, r * Math.cos(a), r * Math.sin(a)]);
    }
    return pts;
  }, [r, baseDrift]);

  // ── Inner dynamic great-circle rings (track rInner) ────────────────────
  const innerRing1 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * 2 * Math.PI + baseDrift * 1.3;
      pts.push([rInner * Math.cos(a), rInner * Math.sin(a), 0]);
    }
    return pts;
  }, [rInner, baseDrift]);

  const innerRing2 = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * 2 * Math.PI + baseDrift * 0.9;
      pts.push([rInner * Math.cos(a), 0, rInner * Math.sin(a)]);
    }
    return pts;
  }, [rInner, baseDrift]);

  return (
    <group>
      {/* Outer great-circle rings — static envelope, three orientations */}
      {ring1.length >= 2 && (
        <Line points={ring1} color="#f59e0b" lineWidth={0.8} transparent opacity={0.18 * opacity} />
      )}
      {ring2.length >= 2 && (
        <Line points={ring2} color="#f59e0b" lineWidth={0.8} transparent opacity={0.14 * opacity} />
      )}
      {ring3.length >= 2 && (
        <Line points={ring3} color="#f59e0b" lineWidth={0.8} transparent opacity={0.14 * opacity} />
      )}

      {/* Dynamic inner rings — radius tracks |w| (like HypersphereVisualization |cos φ|) */}
      {innerRing1.length >= 2 && (
        <Line points={innerRing1} color="#fbbf24" lineWidth={1.2} transparent opacity={0.30 * opacity} />
      )}
      {innerRing2.length >= 2 && (
        <Line points={innerRing2} color="#fbbf24" lineWidth={1.2} transparent opacity={0.25 * opacity} />
      )}

      {/* Translucent dynamic sphere at rInner — the "breathing" hyperspherical shell.
          Radius changes with |w| to show the receiver's 4-D orientation state. */}
      <mesh>
        <sphereGeometry args={[rInner, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.25}
          transparent
          opacity={0.045 * opacity}
          depthWrite={false}
        />
      </mesh>

      {/* Faint outer sphere at amplitude — the static S³ envelope */}
      <mesh>
        <sphereGeometry args={[r, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.08}
          transparent
          opacity={0.018 * opacity}
          depthWrite={false}
        />
      </mesh>
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

/**
 * Small glowing ring at the current tip position on the hypersphere boundary surface.
 *
 * The ring lives in the plane perpendicular to the radial tip direction, so it always
 * wraps around the sphere surface at the contact point.  Its opacity pulses at the
 * signal frequency, giving the impression of a ripple or shockwave propagating across
 * the receiving boundary each time a field crest is captured.
 *
 * Visual intent: the hypersphere boundary is actively disturbed wherever the incoming
 * field makes contact — the ring makes that disturbance spatially explicit.
 */
function BoundaryRipplePulse({ tip, params, currentTime, opacity }: {
  tip: [number, number, number];
  params: SignalParams;
  currentTime: number;
  opacity: number;
}) {
  const tipLen = Math.sqrt(tip[0] ** 2 + tip[1] ** 2 + tip[2] ** 2);
  if (tipLen < 1e-10) return null;

  // Radial unit vector at the tip
  const tr: [number, number, number] = [tip[0] / tipLen, tip[1] / tipLen, tip[2] / tipLen];

  // Choose a reference vector not parallel to tr (use Y unless tr ≈ ±Y)
  const refVec: [number, number, number] = Math.abs(tr[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];

  // u1 = tr × refVec  (in the perpendicular plane)
  const u1raw: [number, number, number] = [
    tr[1] * refVec[2] - tr[2] * refVec[1],
    tr[2] * refVec[0] - tr[0] * refVec[2],
    tr[0] * refVec[1] - tr[1] * refVec[0],
  ];
  const u1len = Math.sqrt(u1raw[0] ** 2 + u1raw[1] ** 2 + u1raw[2] ** 2);
  const u1: [number, number, number] = [u1raw[0] / u1len, u1raw[1] / u1len, u1raw[2] / u1len];

  // u2 = tr × u1  (second basis vector of the perpendicular plane)
  const u2: [number, number, number] = [
    tr[1] * u1[2] - tr[2] * u1[1],
    tr[2] * u1[0] - tr[0] * u1[2],
    tr[0] * u1[1] - tr[1] * u1[0],
  ];

  // Ring radius — subtle, scales with amplitude
  const RING_R = params.amplitude * 0.20;
  const N = 28;
  const ringPts: [number, number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * 2 * Math.PI;
    ringPts.push([
      tip[0] + RING_R * (Math.cos(a) * u1[0] + Math.sin(a) * u2[0]),
      tip[1] + RING_R * (Math.cos(a) * u1[1] + Math.sin(a) * u2[1]),
      tip[2] + RING_R * (Math.cos(a) * u1[2] + Math.sin(a) * u2[2]),
    ]);
  }

  // Envelope pulses at signal frequency — peaks when field is at maximum
  const rawPhase = 2 * Math.PI * params.frequency * currentTime + params.phase;
  const env = 0.35 + 0.65 * Math.abs(Math.sin(rawPhase));

  return (
    <group>
      {/* Ripple ring around the tip on the sphere surface */}
      <Line
        points={ringPts}
        color="#fbbf24"
        lineWidth={2.2}
        transparent
        opacity={0.35 * env * opacity}
      />
      {/* Bright contact point at the tip itself */}
      <mesh position={tip}>
        <sphereGeometry args={[0.034, 8, 8]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={5 * env}
          transparent
          opacity={0.60 * env * opacity}
        />
      </mesh>
    </group>
  );
}

export function QuaternionicSignalDemo({
  params, currentTime, tip, showClassicalSplit,
  showTrailHistory, showFiber, showLocalFrame,
  showProjectionShadow, opacity = 1, couplingStrength = 1,
  receiverYaw = 0, receiverPitch = 0, showExcitation = false,
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

      {/* Boundary ripple pulse — receiver hypersphere manifold excited by incoming field */}
      {showExcitation && (
        <BoundaryRipplePulse
          tip={tip}
          params={params}
          currentTime={currentTime}
          opacity={structureOpacity}
        />
      )}
    </group>
  );
}
