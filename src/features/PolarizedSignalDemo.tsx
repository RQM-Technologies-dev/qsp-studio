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
}

export function PolarizedSignalDemo({ params, currentTime, tip, showBasis, showTrailHistory, opacity = 1 }: PolarizedSignalDemoProps) {
  const { amplitude, frequency, ellipticity, polarization } = params;

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
    <>
      {/* 3D helix trail — toggled by showTrailHistory */}
      {showTrailHistory && helixTrail.length >= 2 && (
        <Line points={helixTrail} color="#8b5cf6" lineWidth={2.5} transparent opacity={0.8 * opacity} />
      )}

      {/* Polarization ellipse outline at z=0 — always shown as the base reference */}
      {ellipsePath.length >= 2 && (
        <Line points={ellipsePath} color="#8b5cf6" lineWidth={1} transparent opacity={0.22 * opacity} />
      )}

      {/* Polarization frame — toggled by showBasis */}
      {showBasis && (
        <>
          {/* Major axis */}
          <Line points={[[-majorA, 0, 0], [majorA, 0, 0]]} color="#e879f9" lineWidth={1.2} transparent opacity={0.45 * opacity} />
          <Text position={[majorA + 0.12, 0, 0]} fontSize={0.12} color="#e879f9" fillOpacity={opacity}>a</Text>

          {/* Minor axis — only when non-zero */}
          {minorB > 0.01 && (
            <>
              <Line points={[[0, -minorB, 0], [0, minorB, 0]]} color="#a78bfa" lineWidth={1.2} transparent opacity={0.45 * opacity} />
              <Text position={[0, minorB + 0.12, 0]} fontSize={0.12} color="#a78bfa" fillOpacity={opacity}>b</Text>
            </>
          )}

          {/* Normal vector (Z direction) */}
          <Line points={[[0, 0, -normalLen], [0, 0, normalLen]]} color="#c4b5fd" lineWidth={1.5} transparent opacity={0.55 * opacity} />
          <Text position={[0, 0, normalLen + 0.12]} fontSize={0.12} color="#c4b5fd" fillOpacity={opacity}>n̂</Text>
        </>
      )}

      {/* Signal vector tip */}
      <SignalVector tip={tip} demoMode="polarized" opacity={opacity} />
    </>
  );
}
