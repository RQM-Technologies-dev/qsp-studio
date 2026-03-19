import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import { SignalParams, DemoMode } from '../math/signal';
import { WAVE_K, E_FIELD_SCALE, B_FIELD_SCALE } from '../math/receiverBasis';

interface IncomingWaveProps {
  params: SignalParams;
  currentTime: number;
  receiverX: number;
  /**
   * The display mode of the active receiver.  Controls the visual style of
   * boundary capture at the receiver face:
   *   complex      → flat planar rim capture (XY-plane only)
   *   polarized    → 3-D tilt preserved (E- and B-field connectors shown)
   *   quaternionic → hyperspherical boundary ring (wave meets a ring, not a point)
   */
  demoMode?: DemoMode;
  /**
   * World-space position of the live circumference / trace contact point.
   * Used by the Classical and Polarized arrival overlays to draw the connector
   * from the wave face to the actual rim / ellipse contact.
   * Quaternionic mode uses a ring instead of a single point.
   */
  contactPoint?: [number, number, number];
  opacity?: number;
}

const WAVE_START_X = -8.5;
/** Number of sample points along the wave axis. */
const NUM_POINTS = 90;

/**
 * Phase offset so that at x = 0 (receiver face) the wave is in-phase with the
 * receiver tip:
 *   wave at x=0 → sin(–ωt + π) = sin(ωt)  ✓ matches tip angle ωt.
 */
const PHASE_ALIGN = Math.PI;

/**
 * The quaternion scalar w = cos(θ_rot / 2) where θ_rot = θ · QUAT_AXIS_ANGLE_SCALE
 * (see computeCurrentQuat in QuaternionicSignalDemo).  Halving that gives the
 * half-angle factor used for w: w = cos(θ · QUAT_AXIS_ANGLE_SCALE / 2).
 */
const QUAT_AXIS_ANGLE_SCALE = 0.3;            // matches quatFromAxisAngle(…, θ·0.3) in QuaternionicSignalDemo
const QUAT_W_PHASE_FACTOR = QUAT_AXIS_ANGLE_SCALE / 2; // = 0.15 — produces cos(θ·0.15) = w

/** Ring radius lower bound (as fraction of amplitude) when |w| → 0. */
const RING_MIN_RADIUS_FACTOR = 0.5;
/** Weight of |w| on top of the lower bound — radius = amplitude × (MIN + W_INFLUENCE × |w|). */
const RING_W_INFLUENCE = 0.5;

/** Generate points for the E-field (Y) and B-field (Z) ribbons.
 *  The wave always ends at the fixed receiver face (waveEndX) with no spatial
 *  deformation — the sinusoidal shape is preserved to the very last sample. */
function buildWavePoints(
  amplitude: number,
  frequency: number,
  currentTime: number,
  waveEndX: number,
): {
  ePoints: [number, number, number][];
  bPoints: [number, number, number][];
} {
  const ePoints: [number, number, number][] = [];
  const bPoints: [number, number, number][] = [];
  const eAmp = amplitude * E_FIELD_SCALE;
  const bAmp = amplitude * B_FIELD_SCALE;

  for (let i = 0; i <= NUM_POINTS; i++) {
    const t = i / NUM_POINTS;
    const x = WAVE_START_X + t * (waveEndX - WAVE_START_X);
    // Traveling wave with phase alignment: at x=0 the wave is in-phase with the receiver tip
    const phase = WAVE_K * x - 2 * Math.PI * frequency * currentTime + PHASE_ALIGN;
    // E-field oscillates purely in Y; B-field purely in Z — no spatial deformation
    ePoints.push([x, eAmp * Math.sin(phase), 0]);
    bPoints.push([x, 0, bAmp * Math.sin(phase)]);
  }
  return { ePoints, bPoints };
}

// ─── Mode-specific arrival overlays ────────────────────────────────────────

/**
 * Classical I/Q — planar rim capture.
 * The wave arrives flat in the XY plane.  A thin connector in the Z=0 plane
 * bridges the wave face to the unit-circle rim, and a glow marks the capture
 * point.  The entirely planar geometry reinforces the I/Q manifold concept.
 */
function ClassicalRimCapture({
  contactPoint, waveEndX, waveY, opacity,
}: {
  contactPoint: [number, number, number];
  waveEndX: number;
  waveY: number;
  opacity: number;
}) {
  // Project the contact onto the XY plane (Z=0) so capture is strictly planar
  const rimPt: [number, number, number] = [contactPoint[0], contactPoint[1], 0];
  const waveFacePt: [number, number, number] = [waveEndX, waveY, 0];

  return (
    <group>
      {/* Flat planar connector from wave face to rim — stays in Z=0 plane */}
      <Line
        points={[waveFacePt, rimPt]}
        color="#00d4ff"
        lineWidth={1.2}
        transparent
        opacity={0.45 * opacity}
      />
      {/* Rim contact dot */}
      <mesh position={rimPt}>
        <sphereGeometry args={[0.048, 10, 10]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={3.5}
          transparent
          opacity={0.88 * opacity}
        />
      </mesh>
      {/* Soft outer halo */}
      <mesh position={rimPt}>
        <sphereGeometry args={[0.10, 12, 12]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={1.0}
          transparent
          opacity={0.14 * opacity}
        />
      </mesh>
      {/* Short planar acceptance fan at the rim — evokes the wave spreading flat */}
      <Line
        points={[
          [rimPt[0] - 0.07, rimPt[1] - 0.07, 0] as [number, number, number],
          rimPt,
          [rimPt[0] + 0.07, rimPt[1] - 0.07, 0] as [number, number, number],
        ]}
        color="#00d4ff"
        lineWidth={0.8}
        transparent
        opacity={0.28 * opacity}
      />
    </group>
  );
}

/**
 * Polarization — 3-D tilt capture.
 * The wave preserves its E-field (Y) and B-field (Z) components all the way to
 * the contact.  Two separate connectors — one for E, one for B — bridge the
 * wave face to the actual 3-D ellipse contact point, giving a spatial sense of
 * capture that the flat classical view does not have.
 */
function PolarizedTiltCapture({
  contactPoint, waveEndX, waveY, waveZ, opacity,
}: {
  contactPoint: [number, number, number];
  waveEndX: number;
  waveY: number;
  waveZ: number;
  opacity: number;
}) {
  const eFacePt: [number, number, number] = [waveEndX, waveY, 0];
  const bFacePt: [number, number, number] = [waveEndX, 0, waveZ];

  return (
    <group>
      {/* E-field connector — preserves Y component through to the contact */}
      <Line
        points={[eFacePt, contactPoint]}
        color="#8b5cf6"
        lineWidth={1.2}
        transparent
        opacity={0.42 * opacity}
      />
      {/* B-field connector — preserves Z tilt, reinforcing 3-D spatial nature */}
      <Line
        points={[bFacePt, contactPoint]}
        color="#ff44aa"
        lineWidth={0.9}
        transparent
        opacity={0.30 * opacity}
      />
      {/* Contact dot: full 3-D world position on the ellipse/helix trace */}
      <mesh position={contactPoint}>
        <sphereGeometry args={[0.048, 10, 10]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={3.5}
          transparent
          opacity={0.88 * opacity}
        />
      </mesh>
      {/* Slightly larger halo to suggest the 3-D spatial envelope */}
      <mesh position={contactPoint}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#8b5cf6"
          emissiveIntensity={0.8}
          transparent
          opacity={0.12 * opacity}
        />
      </mesh>
    </group>
  );
}

/**
 * Quaternionic — hyperspherical boundary capture.
 * Instead of a single contact point the wave meets a full ring living in the
 * YZ plane at the receiver face.  The ring radius tracks |wComponent| — the
 * quaternion scalar — mirroring the dynamic sphere sizing in the
 * HypersphereVisualization reference.  A second inner ring and a central glow
 * complete the "surface / boundary acquisition" feeling.
 */
function QuaternionicBoundaryCapture({
  waveEndX, amplitude, waveValue, wComponent, opacity,
}: {
  waveEndX: number;
  amplitude: number;
  waveValue: number;   // sin of wave phase at face, ∈ [–1, 1]
  wComponent: number;  // quaternion scalar w, drives ring radius
  opacity: number;
}) {
  // Ring radius grows linearly with |w| between RING_MIN_RADIUS_FACTOR and 1.0,
  // mirroring the HypersphereVisualization approach of scaling sphere radii by |cos φ|.
  // Here w = cos(θ · QUAT_W_PHASE_FACTOR) so |w| plays the same role as |cos φ|.
  const ringRadius = amplitude * (RING_MIN_RADIUS_FACTOR + RING_W_INFLUENCE * Math.abs(wComponent));

  const outerRing = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI;
      pts.push([waveEndX, ringRadius * Math.cos(a), ringRadius * Math.sin(a)]);
    }
    return pts;
  }, [waveEndX, ringRadius]);

  const innerRing = useMemo<[number, number, number][]>(() => {
    const r = ringRadius * 0.55;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * 2 * Math.PI;
      pts.push([waveEndX, r * Math.cos(a), r * Math.sin(a)]);
    }
    return pts;
  }, [waveEndX, ringRadius]);

  // Glow intensity pulses with the instantaneous wave amplitude
  const glowFactor = 0.55 + 0.45 * Math.abs(waveValue);

  return (
    <group>
      {/* YZ-plane boundary ring — the hyperspherical receiving surface */}
      <Line
        points={outerRing}
        color="#f59e0b"
        lineWidth={1.8}
        transparent
        opacity={0.45 * glowFactor * opacity}
      />
      {/* Inner ring — adds depth, evokes nested 4-D shells */}
      <Line
        points={innerRing}
        color="#f59e0b"
        lineWidth={0.9}
        transparent
        opacity={0.28 * glowFactor * opacity}
      />
      {/* Central wave-arrival glow at the boundary origin */}
      <mesh position={[waveEndX, 0, 0]}>
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={2.5 * glowFactor}
          transparent
          opacity={0.40 * glowFactor * opacity}
        />
      </mesh>
    </group>
  );
}

/**
 * Traveling electromagnetic wave approaching the receiver from the left.
 *
 * Shows:
 * - E-field (cyan):  sinusoidal ribbon in the XY plane
 * - B-field (rose):  sinusoidal ribbon in the XZ plane
 * - Propagation axis: faint backbone with directional dots
 * - Mode-specific boundary capture overlay at the receiver face
 *
 * The wave is drawn as a pure traveling wave (no spatial deformation) all the
 * way to the fixed receiver face.  Phase is offset by π so the wave crest
 * arriving at x = 0 is in-phase with the receiver tip.
 */
export function IncomingWave({ params, currentTime, receiverX, demoMode, contactPoint, opacity = 1 }: IncomingWaveProps) {
  const { amplitude, frequency } = params;
  const mode = demoMode ?? params.demoMode;

  // Wave always ends at the fixed receiver face (no stretching to the rotating tip)
  const waveEndX = receiverX;

  const { ePoints, bPoints } = buildWavePoints(amplitude, frequency, currentTime, waveEndX);

  // Wave field values at the receiver face — used by arrival overlays
  const phaseAtFace = WAVE_K * waveEndX - 2 * Math.PI * frequency * currentTime + PHASE_ALIGN;
  const waveY = amplitude * E_FIELD_SCALE * Math.sin(phaseAtFace);
  const waveZ = amplitude * B_FIELD_SCALE * Math.sin(phaseAtFace);
  const waveValueNorm = Math.sin(phaseAtFace); // ∈ [–1, 1]

  // Quaternion scalar w = cos(θ · QUAT_W_PHASE_FACTOR) — consistent with
  // computeCurrentQuat in QuaternionicSignalDemo (quatFromAxisAngle uses θ·0.3, so w=cos(θ·0.15))
  const theta = 2 * Math.PI * frequency * currentTime + params.phase;
  const wComponent = Math.cos(theta * QUAT_W_PHASE_FACTOR);

  const dotXs: number[] = [-8, -6.5, -5.2, -4.0];
  const labelX = waveEndX - 0.45;
  const eAmp = amplitude * E_FIELD_SCALE;
  const bAmp = amplitude * B_FIELD_SCALE;

  return (
    <group>
      {/* E-field ribbon — XY plane, cyan */}
      {ePoints.length >= 2 && (
        <Line
          points={ePoints}
          color="#00d4ff"
          lineWidth={2}
          transparent
          opacity={0.72 * opacity}
        />
      )}

      {/* B-field ribbon — XZ plane, rose/magenta */}
      {bPoints.length >= 2 && (
        <Line
          points={bPoints}
          color="#ff44aa"
          lineWidth={1.5}
          transparent
          opacity={0.52 * opacity}
        />
      )}

      {/* Propagation backbone — very faint */}
      <Line
        points={[[WAVE_START_X, 0, 0], [waveEndX, 0, 0]]}
        color="#ffffff"
        lineWidth={0.5}
        transparent
        opacity={0.07 * opacity}
      />

      {/* Directional dots along the propagation axis */}
      {dotXs.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={1.5}
            transparent
            opacity={0.28 * opacity}
          />
        </mesh>
      ))}

      {/* ── Mode-specific arrival geometry ─────────────────────────────── */}

      {/* Classical I/Q: planar rim capture — flat, Z=0 only */}
      {contactPoint && mode === 'complex' && (
        <ClassicalRimCapture
          contactPoint={contactPoint}
          waveEndX={waveEndX}
          waveY={waveY}
          opacity={opacity}
        />
      )}

      {/* Polarization: 3-D tilt capture — E and B connectors preserved */}
      {contactPoint && mode === 'polarized' && (
        <PolarizedTiltCapture
          contactPoint={contactPoint}
          waveEndX={waveEndX}
          waveY={waveY}
          waveZ={waveZ}
          opacity={opacity}
        />
      )}

      {/* Quaternionic: hyperspherical boundary ring — surface acquisition */}
      {mode === 'quaternionic' && (
        <QuaternionicBoundaryCapture
          waveEndX={waveEndX}
          amplitude={amplitude}
          waveValue={waveValueNorm}
          wComponent={wComponent}
          opacity={opacity}
        />
      )}

      {/* E-field label */}
      <Text
        position={[labelX, eAmp + 0.14, 0]}
        fontSize={0.12}
        color="#00d4ff"
        fillOpacity={0.75 * opacity}
        anchorX="center"
      >
        E
      </Text>

      {/* B-field label */}
      <Text
        position={[labelX, 0, bAmp + 0.16]}
        fontSize={0.12}
        color="#ff44aa"
        fillOpacity={0.65 * opacity}
        anchorX="center"
      >
        B
      </Text>
    </group>
  );
}
