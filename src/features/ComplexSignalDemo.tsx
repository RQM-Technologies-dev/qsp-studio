import { SignalParams } from '../math/signal';
import { SignalVector } from '../components/SignalVector';
import { TrailPath } from '../components/TrailPath';
import { PhaseWheel } from '../components/PhaseWheel';
import { generateTrail } from '../math/polarization';

interface ComplexSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
}

export function ComplexSignalDemo({ params, currentTime, tip }: ComplexSignalDemoProps) {
  const trail = generateTrail(params, currentTime, 1.5 / params.frequency, 80);
  return (
    <>
      <TrailPath points={trail} demoMode="complex" />
      <SignalVector tip={tip} demoMode="complex" />
      <PhaseWheel phase={params.phase} radius={0.25} position={[0, 0, -1.2]} />
    </>
  );
}
