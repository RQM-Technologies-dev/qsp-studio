import { SignalParams } from '../math/signal';
import { SignalVector } from '../components/SignalVector';
import { TrailPath } from '../components/TrailPath';
import { PhaseWheel } from '../components/PhaseWheel';
import { generateTrail } from '../math/polarization';

interface QuaternionicSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
}

export function QuaternionicSignalDemo({ params, currentTime, tip }: QuaternionicSignalDemoProps) {
  const trail = generateTrail(params, currentTime, 2.0 / params.frequency, 120);
  return (
    <>
      <TrailPath points={trail} demoMode="quaternionic" />
      <SignalVector tip={tip} demoMode="quaternionic" />
      <PhaseWheel phase={params.phase} radius={0.2} position={[-1.5, -1.2, 0]} />
    </>
  );
}
