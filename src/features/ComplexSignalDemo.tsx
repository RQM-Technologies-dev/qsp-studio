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
}

export function ComplexSignalDemo({ params, tip, showBasis, helixMorphProgress = 0, opacity = 1 }: ComplexSignalDemoProps) {
  const { amplitude } = params;

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
    <>
      {/* Full unit circle outline — I/Q reference plane (the basis manifold) */}
      <Line points={circlePoints} color="#00d4ff" lineWidth={1.8} transparent opacity={0.45 * opacity} />

      {/* Basis decomposition: I (Re) / Q (Im) projection lines — toggled by showBasis */}
      {showBasis && (
        <>
          <Line points={[tip, rePoint]} color="#ff5566" lineWidth={1} transparent opacity={0.35 * opacity} />
          <Line points={[tip, imPoint]} color="#44ee88" lineWidth={1} transparent opacity={0.35 * opacity} />

          {/* I (Re) intercept dot */}
          <mesh position={rePoint}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#ff5566" emissive="#ff5566" emissiveIntensity={2} transparent opacity={0.75 * opacity} />
          </mesh>
          {/* Q (Im) intercept dot */}
          <mesh position={imPoint}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#44ee88" emissive="#44ee88" emissiveIntensity={2} transparent opacity={0.75 * opacity} />
          </mesh>
        </>
      )}

      {/* Phasor: the rotating arm from origin to the I/Q unit-circle point */}
      <SignalVector tip={tip} demoMode="complex" opacity={opacity} />
    </>
  );
}
