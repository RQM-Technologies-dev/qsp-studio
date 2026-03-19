import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import { SignalParams } from '../math/signal';
import { SignalVector } from '../components/SignalVector';
import { generatePolarizationPath, generateHelixTrail } from '../math/polarization';

interface PolarizedSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
  /** When true, show the polarization frame axes (a, b, n̂). */
  showBasis: boolean;
  /** When true, show the 3D helix trail. */
  showTrailHistory: boolean;
  /** Opacity multiplier (0–1) used during mode-morph fade. */
  opacity?: number;
  /**
   * Normalized field-coupling strength [0,1].
   * Dims the trail and frame axes as coupling weakens, reinforcing that poor
   * receiver alignment reduces the captured polarization structure.
   */
  couplingStrength?: number;
  /**
   * Yaw rotation (radians, around Y-axis) of the sensing frame.
   * Rotates the entire polarization geometry so it visibly acts as the receiving structure.
   */
  receiverYaw?: number;
  /**
   * Pitch rotation (radians, around X-axis) of the sensing frame.
   */
  receiverPitch?: number;
}

export function PolarizedSignalDemo({ params, currentTime, tip, showBasis, showTrailHistory, opacity = 1, couplingStrength = 1, receiverYaw = 0, receiverPitch = 0 }: PolarizedSignalDemoProps) {
  const { amplitude, frequency, ellipticity, polarization } = params;

  // Trail dims and frame axes fade as coupling decreases — minimum 0.5 so
  // the helix structure remains readable even at worst misalignment.
  const trailOpacity = opacity * (0.5 + 0.5 * couplingStrength);
  const frameOpacity = opacity * (0.55 + 0.45 * couplingStrength);

  // 3D helix trail — XY traces the polarization ellipse; Z encodes temporal depth
  const helixTrail = generateHelixTrail(params, currentTime, 2.0 / frequency, 140, 2.0);

  // Outline of the polarization ellipse at Z=0 (the "current" reference plane)
  const ellipsePath = useMemo(
    () => generatePolarizationPath(params, 128),
    [params]
  );

  // Major and minor semi-axis lengths
  const majorA = amplitude;
  const minorB =
    polarization === 'elliptical' ? amplitude * ellipticity :
    polarization === 'circular'   ? amplitude : 0;

  const normalLen = 0.55;

  return (
    <group rotation={[receiverPitch, receiverYaw, 0]}>
      {/* 3D helix trail — toggled by showTrailHistory */}
      {showTrailHistory && helixTrail.length >= 2 && (
        <Line points={helixTrail} color="#8b5cf6" lineWidth={2.5} transparent opacity={0.8 * trailOpacity} />
      )}

      {/* Polarization ellipse outline at z=0 — always shown as the base reference */}
      {ellipsePath.length >= 2 && (
        <Line points={ellipsePath} color="#8b5cf6" lineWidth={1} transparent opacity={0.22 * frameOpacity} />
      )}

      {/* Polarization frame — toggled by showBasis */}
      {showBasis && (
        <>
          {/* Major axis */}
          <Line points={[[-majorA, 0, 0], [majorA, 0, 0]]} color="#e879f9" lineWidth={1.2} transparent opacity={0.45 * frameOpacity} />
          <Text position={[majorA + 0.12, 0, 0]} fontSize={0.12} color="#e879f9" fillOpacity={frameOpacity}>a</Text>

          {/* Minor axis — only when non-zero */}
          {minorB > 0.01 && (
            <>
              <Line points={[[0, -minorB, 0], [0, minorB, 0]]} color="#a78bfa" lineWidth={1.2} transparent opacity={0.45 * frameOpacity} />
              <Text position={[0, minorB + 0.12, 0]} fontSize={0.12} color="#a78bfa" fillOpacity={frameOpacity}>b</Text>
            </>
          )}

          {/* Normal vector (Z direction) */}
          <Line points={[[0, 0, -normalLen], [0, 0, normalLen]]} color="#c4b5fd" lineWidth={1.5} transparent opacity={0.55 * frameOpacity} />
          <Text position={[0, 0, normalLen + 0.12]} fontSize={0.12} color="#c4b5fd" fillOpacity={frameOpacity}>n̂</Text>
        </>
      )}

      {/* Signal vector tip */}
      <SignalVector tip={tip} demoMode="polarized" opacity={frameOpacity} />
    </group>
  );
}
