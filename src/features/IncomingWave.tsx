import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import { SignalParams, DemoMode, computeTheta } from '../math/signal';
import { WAVE_K } from '../math/receiverBasis';

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
   *
   * Falls back to `params.demoMode` if omitted, so callers may omit this
   * when the wave params already carry the correct mode.  Prefer passing it
   * explicitly (as MainScene does) to avoid ambiguity.
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
 * Quaternion scalar component w = cos(θ), derived from q(t) = cos(θ) + u·sin(θ).
 *
 * This matches computeCurrentQuat in QuaternionicSignalDemo which uses
 * quatFromAxisAngle(u, 2θ) → w = cos(θ).  The factor 1.0 is explicit so it is
 * clear there is no independent scaling: the wave maps directly into θ.
 */
const QUAT_W_PHASE_FACTOR = 1.0;  // w = cos(θ) directly — not an approximation

/** Minimum inner ring radius as a fraction of amplitude when |w| → 0. */
const INNER_RING_MIN_RADIUS_FACTOR = 0.25;

/** Generate points for the E-field (Y) and B-field (Z) ribbons.
 *
 * The wave is constructed so that at x = contactX the phase equals the shared
 * geometry phase θ (= ωt + φ).  Points further left (later phases) carry the
 * phase θ + k·(contactX − x), giving a physically correct rightward-traveling
 * wave that approaches the receiver and arrives in phase with the geometric tip.
 *
 * E-field and B-field amplitudes are equal so the two ribbons are visually
 * symmetric and both scale with the geometry amplitude.
 */
function buildWavePoints(
  amplitude: number,
  theta: number,
  contactX: number,
): {
  ePoints: [number, number, number][];
  bPoints: [number, number, number][];
} {
  const ePoints: [number, number, number][] = [];
  const bPoints: [number, number, number][] = [];
  // E and B amplitudes are equal — both match the geometry radius.
  const eAmp = amplitude;
  const bAmp = amplitude;

  for (let i = 0; i <= NUM_POINTS; i++) {
    const t = i / NUM_POINTS;
    const x = WAVE_START_X + t * (contactX - WAVE_START_X);
    // Rightward-traveling wave: at x = contactX the phase equals θ.
    // Positions further left (smaller x) carry a later phase because the wave
    // has not yet reached them — they will oscillate with phase θ in the future.
    const phase = theta + WAVE_K * (contactX - x);
    // E-field oscillates purely in Y; B-field purely in Z.
    ePoints.push([x, eAmp * Math.sin(phase), 0]);
    bPoints.push([x, 0, bAmp * Math.sin(phase)]);
  }
  return { ePoints, bPoints };
}

/**
 * Generate helical wave points for the polarized mode.
 *
 * A circularly (or elliptically) polarized EM wave has its E and B field
 * vectors rotating in the YZ plane as the wave travels along X.  This
 * produces a corkscrew / helix that visually represents the polar signal.
 *
 * The E-field helix uses a 90° phase offset between its Y and Z components
 * so the combined field vector sweeps a circle (or ellipse) in the YZ plane:
 *   E_y = A · eFactor · sin(phase)
 *   E_z = −A · cos(phase)          ← 90° ahead in phase, -sign matches receiver disc
 *
 * The B-field is the cross product of the propagation direction (+X̂) with E:
 *   B_y = A · cos(phase)
 *   B_z = A · eFactor · sin(phase)
 *
 * For linear polarization (eFactor = 0) both helices degenerate to flat
 * sinusoidal ribbons matching the classical E/B view.
 */
function buildHelixPoints(
  params: SignalParams,
  theta: number,
  contactX: number,
): {
  ePoints: [number, number, number][];
  bPoints: [number, number, number][];
  waveY: number;
  waveZ: number;
} {
  const { amplitude, polarization, ellipticity } = params;
  const eFactor = polarization === 'linear' ? 0 : polarization === 'circular' ? 1 : ellipticity;

  const ePoints: [number, number, number][] = [];
  const bPoints: [number, number, number][] = [];

  for (let i = 0; i <= NUM_POINTS; i++) {
    const t = i / NUM_POINTS;
    const x = WAVE_START_X + t * (contactX - WAVE_START_X);
    const phase = theta + WAVE_K * (contactX - x);
    // E-field: helix in YZ with eFactor scaling the transverse Z component
    ePoints.push([x, amplitude * eFactor * Math.sin(phase), -amplitude * Math.cos(phase)]);
    // B-field: cross product X̂ × E (perpendicular to E in YZ plane)
    bPoints.push([x, amplitude * Math.cos(phase), amplitude * eFactor * Math.sin(phase)]);
  }

  // Values at the contact point (x = contactX, phase = theta) for the tilt capture
  const waveY = amplitude * eFactor * Math.sin(theta);
  const waveZ = -amplitude * Math.cos(theta);

  return { ePoints, bPoints, waveY, waveZ };
}

/** Build all wave points and face values for the current mode.
 *
 * Returns ePoints, bPoints, waveY, and waveZ in a single call.  For flat modes
 * (complex, quaternionic) the flat ribbon geometry is used.  For polarized mode
 * the helical geometry is used.  This avoids repeated conditional branches and
 * non-null assertions in the render function.
 */
function buildAllWaveData(
  params: SignalParams,
  theta: number,
  contactX: number,
  isHelical: boolean,
): {
  ePoints: [number, number, number][];
  bPoints: [number, number, number][];
  waveY: number;
  waveZ: number;
} {
  if (isHelical) {
    return buildHelixPoints(params, theta, contactX);
  }
  const { ePoints, bPoints } = buildWavePoints(params.amplitude, theta, contactX);
  return { ePoints, bPoints, waveY: params.amplitude * Math.sin(theta), waveZ: params.amplitude * Math.sin(theta) };
}

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
 * YZ plane at the receiver face.  The outer ring radius matches the wave
 * amplitude exactly (same as the Complex circle and Polar ellipse radii) so
 * the three modes are visually consistent.  An inner ring tracks |wComponent|
 * to show the dynamic 4-D orientation state.
 */
function QuaternionicBoundaryCapture({
  waveEndX, amplitude, waveValue, wComponent, opacity,
}: {
  waveEndX: number;
  amplitude: number;
  waveValue: number;   // sin of wave phase at face, ∈ [–1, 1]
  wComponent: number;  // quaternion scalar w, drives inner ring radius
  opacity: number;
}) {
  // Outer ring fixed at amplitude — matches the incoming wave peak and mirrors
  // the outer S³ envelope in HyperBoundary (QuaternionicSignalDemo).
  const outerRadius = amplitude;
  // Inner ring tracks |w| (like HypersphereVisualization |cos φ|), minimum INNER_RING_MIN_RADIUS_FACTOR.
  const innerRadius = amplitude * Math.max(INNER_RING_MIN_RADIUS_FACTOR, Math.abs(wComponent));

  const outerRing = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI;
      pts.push([waveEndX, outerRadius * Math.cos(a), outerRadius * Math.sin(a)]);
    }
    return pts;
  }, [waveEndX, outerRadius]);

  const innerRing = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * 2 * Math.PI;
      pts.push([waveEndX, innerRadius * Math.cos(a), innerRadius * Math.sin(a)]);
    }
    return pts;
  }, [waveEndX, innerRadius]);

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
 * For complex and quaternionic modes shows:
 * - E-field (cyan):  sinusoidal ribbon in the XY plane
 * - B-field (rose):  sinusoidal ribbon in the XZ plane
 *
 * For polarized mode shows a helical (circularly/elliptically polarized) wave:
 * - E-helix (cyan):  E-field vector rotating in the YZ plane as it propagates
 * - B-helix (rose):  B-field vector (cross product of propagation with E) also helical
 *
 * In all modes the wave terminates at the fixed receiver face so the wave body
 * has a steady length.  The phase at the terminus equals the shared phase θ,
 * ensuring the wave and geometry are always two parameterizations of the same
 * evolving state.
 */
export function IncomingWave({ params, currentTime, receiverX, demoMode, contactPoint, opacity = 1 }: IncomingWaveProps) {
  const mode = demoMode ?? params.demoMode;

  // ── Shared phase θ = ωt + φ — single source of truth for both the wave
  // and the receiver geometry (computeSignalTip uses the identical formula).
  const theta = computeTheta(params, currentTime);

  // ── Wave termination: always the fixed receiver face (waveEndX is constant so
  // the wave body has a steady length and travels smoothly without sawing).
  const waveEndX = receiverX;

  // ── Choose flat or helical wave geometry depending on the active mode.
  const isHelical = mode === 'polarized';
  const { ePoints, bPoints, waveY, waveZ } = buildAllWaveData(params, theta, waveEndX, isHelical);
  const waveValueNorm = Math.sin(theta); // ∈ [–1, 1]

  // ── Quaternion scalar w = cos(θ) — scalar part of q(t) = cos(θ) + u·sin(θ).
  // Matches the w computed in QuaternionicSignalDemo via quatFromAxisAngle(u, 2θ).
  const wComponent = Math.cos(theta * QUAT_W_PHASE_FACTOR);

  const dotXs: number[] = [-8, -6.5, -5.2, -4.0];
  const labelX = waveEndX - 0.45;
  const { amplitude } = params;

  // ── Label positions differ for helical vs flat wave.
  // Flat:    E peaks at +Y, B peaks at +Z (classical ribbon view).
  // Helical: E helix peaks at −Z, B helix peaks at +Y (polarized rotated disc view).
  const eLabelPos: [number, number, number] = isHelical
    ? [labelX, 0, -(amplitude + 0.14)]
    : [labelX, amplitude + 0.14, 0];
  const bLabelPos: [number, number, number] = isHelical
    ? [labelX, amplitude + 0.14, 0]
    : [labelX, 0, amplitude + 0.16];

  return (
    <group>
      {/* E-field ribbon / helix — cyan */}
      {ePoints.length >= 2 && (
        <Line
          points={ePoints}
          color="#00d4ff"
          lineWidth={2}
          transparent
          opacity={0.72 * opacity}
        />
      )}

      {/* B-field ribbon / helix — rose/magenta */}
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
        position={eLabelPos}
        fontSize={0.12}
        color="#00d4ff"
        fillOpacity={0.75 * opacity}
        anchorX="center"
      >
        E
      </Text>

      {/* B-field label */}
      <Text
        position={bLabelPos}
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
