import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { SignalParams } from '../math/signal';
import { SignalVector } from '../components/SignalVector';

interface ComplexSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
  /** When true, show Re/Im projection lines — the explicit basis decomposition. */
  showBasis: boolean;
  /**
   * 0 = flat unit circle (pure classical / I-Q plane view).
   * 1 = circle lifted into a helix (morphing toward the polarized spatial view).
   * Drives the smooth Classical → Polarization transition.
   */
  helixMorphProgress?: number;
  /** Opacity multiplier (0–1) used during mode-morph fade. */
  opacity?: number;
  /**
   * Normalized field-coupling strength [0,1].
   * Drives glow intensity: when coupling weakens, the phasor and circle dim
   * to reinforce that poor alignment reduces the encoded signal amplitude.
   */
  couplingStrength?: number;
  /**
   * Yaw rotation (radians, around Y-axis) of the sensing frame.
   * Rotates the entire unit-circle geometry so it visibly acts as the receiving aperture.
   */
  receiverYaw?: number;
  /**
   * Pitch rotation (radians, around X-axis) of the sensing frame.
   */
  receiverPitch?: number;
  /**
   * When true, render a short excitation arc on the unit-circle rim at the
   * current phasor contact point — shows the receiver manifold responding to
   * the incoming field.
   */
  showExcitation?: boolean;
}

/**
 * Short glowing arc on the unit-circle rim centered on the current phasor tip.
 *
 * Visual intent: the rim lights up briefly at the capture point, giving a sense
 * of the I/Q plane being actively energised by the incoming field.  The arc is
 * narrow (±32°) and faint so it reads as a "hot spot" rather than a duplicate
 * of the base circle.
 *
 * Opacity is modulated by |sin θ| (the Q-channel amplitude) — this peaks when
 * the field is at its imaginary maximum, linking the glow to the field strength.
 */
function RimExcitationArc({ tip, amplitude, params, currentTime, opacity }: {
  tip: [number, number, number];
  amplitude: number;
  params: SignalParams;
  currentTime: number;
  opacity: number;
}) {
  const tipAngle = Math.atan2(tip[1], tip[0]);
  const ARC_HALF = Math.PI / 5.5; // ≈ 32.7° each side → ~65° total

  // Short arc segment centered at the current phasor angle
  const arcPts: [number, number, number][] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const a = tipAngle - ARC_HALF + (i / N) * ARC_HALF * 2;
    arcPts.push([amplitude * Math.cos(a), amplitude * Math.sin(a), 0]);
  }

  // Envelope: signal phase drives a smooth pulse (0.35 – 1.0)
  const rawPhase = 2 * Math.PI * params.frequency * currentTime + params.phase;
  const env = 0.35 + 0.65 * Math.abs(Math.sin(rawPhase));

  return (
    <group>
      {/* Bright narrow arc — the primary excitation band */}
      <Line
        points={arcPts}
        color="#40e0ff"
        lineWidth={3.0}
        transparent
        opacity={0.30 * env * opacity}
      />
      {/* Glowing dot at the phasor contact point — "field just landed here" */}
      <mesh position={tip}>
        <sphereGeometry args={[0.034, 8, 8]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={5 * env}
          transparent
          opacity={0.55 * env * opacity}
        />
      </mesh>
    </group>
  );
}

export function ComplexSignalDemo({ params, currentTime, tip, showBasis, helixMorphProgress = 0, opacity = 1, couplingStrength = 1, receiverYaw = 0, receiverPitch = 0, showExcitation = false }: ComplexSignalDemoProps) {
  const { amplitude } = params;

  // Reduce circle/phasor brightness when coupling weakens — minimum 0.55 so geometry
  // is still recognisable even at worst misalignment.
  const glowOpacity = opacity * (0.55 + 0.45 * couplingStrength);

  // Static unit circle in the XY plane — morphs toward a helix as helixMorphProgress grows.
  // Z offset is proportional to phase angle * helixMorphProgress, matching the helix that
  // PolarizedSignalDemo shows, so the viewer sees a continuous shape evolution.
  const circlePoints = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    const scrollDepth = 2.0; // matches generateHelixTrail scrollDepth
    for (let i = 0; i <= 128; i++) {
      const frac = i / 128;
      const a = frac * 2 * Math.PI;
      // As helixMorphProgress increases, oldest point drops further back in Z
      const z = -frac * scrollDepth * helixMorphProgress;
      pts.push([amplitude * Math.cos(a), amplitude * Math.sin(a), z]);
    }
    return pts;
  }, [amplitude, helixMorphProgress]);

  // Projection of the tip onto the Re (X) axis
  const rePoint: [number, number, number] = [tip[0], 0, 0];
  // Projection of the tip onto the Im (Y) axis
  const imPoint: [number, number, number] = [0, tip[1], 0];

  return (
    <group rotation={[receiverPitch, receiverYaw, 0]}>
      {/* Full unit circle outline — I/Q reference plane (the basis manifold) */}
      <Line points={circlePoints} color="#00d4ff" lineWidth={1.8} transparent opacity={0.45 * glowOpacity} />

      {/* Basis decomposition: I (Re) / Q (Im) projection lines — toggled by showBasis */}
      {showBasis && (
        <>
          <Line points={[tip, rePoint]} color="#ff5566" lineWidth={1} transparent opacity={0.35 * glowOpacity} />
          <Line points={[tip, imPoint]} color="#44ee88" lineWidth={1} transparent opacity={0.35 * glowOpacity} />

          {/* I (Re) intercept dot */}
          <mesh position={rePoint}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#ff5566" emissive="#ff5566" emissiveIntensity={2 * couplingStrength} transparent opacity={0.75 * glowOpacity} />
          </mesh>
          {/* Q (Im) intercept dot */}
          <mesh position={imPoint}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#44ee88" emissive="#44ee88" emissiveIntensity={2 * couplingStrength} transparent opacity={0.75 * glowOpacity} />
          </mesh>
        </>
      )}

      {/* Phasor: the rotating arm from origin to the I/Q unit-circle point */}
      <SignalVector tip={tip} demoMode="complex" opacity={glowOpacity} />

      {/* Rim excitation arc — receiver manifold responding to incoming field */}
      {showExcitation && (
        <RimExcitationArc
          tip={tip}
          amplitude={amplitude}
          params={params}
          currentTime={currentTime}
          opacity={glowOpacity}
        />
      )}
    </group>
  );
}
