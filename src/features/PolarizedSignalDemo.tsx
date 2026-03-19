import { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import { SignalParams } from '../math/signal';
import { SignalVector } from '../components/SignalVector';
import { generatePolarizationPath, generateHelixTrail } from '../math/polarization';

interface PolarizedSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
}

export function PolarizedSignalDemo({ params, currentTime, tip }: PolarizedSignalDemoProps) {
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

  // Normal axis length (visual indicator only)
  const normalLen = 0.55;

  return (
    <>
      {/* 3D helix — the defining visual of polarization geometry */}
      {helixTrail.length >= 2 && (
        <Line points={helixTrail} color="#8b5cf6" lineWidth={2.5} transparent opacity={0.8} />
      )}

      {/* Polarization ellipse outline at z=0 — the "base plane" reference */}
      {ellipsePath.length >= 2 && (
        <Line points={ellipsePath} color="#8b5cf6" lineWidth={1} transparent opacity={0.22} />
      )}

      {/* Polarization frame — major axis (horizontal) */}
      <Line
        points={[[-majorA, 0, 0], [majorA, 0, 0]]}
        color="#e879f9"
        lineWidth={1.2}
        transparent
        opacity={0.45}
      />
      <Text position={[majorA + 0.12, 0, 0]} fontSize={0.12} color="#e879f9">a</Text>

      {/* Polarization frame — minor axis (vertical), only when non-zero */}
      {minorB > 0.01 && (
        <>
          <Line
            points={[[0, -minorB, 0], [0, minorB, 0]]}
            color="#a78bfa"
            lineWidth={1.2}
            transparent
            opacity={0.45}
          />
          <Text position={[0, minorB + 0.12, 0]} fontSize={0.12} color="#a78bfa">b</Text>
        </>
      )}

      {/* Polarization frame — normal vector (Z direction) */}
      <Line
        points={[[0, 0, -normalLen], [0, 0, normalLen]]}
        color="#c4b5fd"
        lineWidth={1.5}
        transparent
        opacity={0.55}
      />
      <Text position={[0, 0, normalLen + 0.12]} fontSize={0.12} color="#c4b5fd">n̂</Text>

      {/* Signal vector tip */}
      <SignalVector tip={tip} demoMode="polarized" />
    </>
  );
}
