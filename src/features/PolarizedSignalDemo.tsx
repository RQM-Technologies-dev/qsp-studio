import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { SignalParams } from '../math/signal';
import { SignalVector } from '../components/SignalVector';
import { TrailPath } from '../components/TrailPath';
import { generatePolarizationPath, generateTrail } from '../math/polarization';

interface PolarizedSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
}

export function PolarizedSignalDemo({ params, currentTime, tip }: PolarizedSignalDemoProps) {
  const trail = generateTrail(params, currentTime, 1.0 / params.frequency, 80);
  const { amplitude, frequency, polarization, ellipticity, demoMode } = params;
  const ellipsePath = useMemo(
    () => generatePolarizationPath(params, 128),
    // params is used inside but we only re-run when the fields that affect the ellipse shape change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amplitude, frequency, polarization, ellipticity, demoMode]
  );

  return (
    <>
      {ellipsePath.length >= 2 && (
        <Line points={ellipsePath} color="#8b5cf6" lineWidth={1} transparent opacity={0.35} />
      )}
      <TrailPath points={trail} demoMode="polarized" />
      <SignalVector tip={tip} demoMode="polarized" />
    </>
  );
}
