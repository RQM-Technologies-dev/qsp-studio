import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { SignalParams, computeSignalTip } from '../math/signal';
import { SignalVector } from '../components/SignalVector';
import { TrailPath } from '../components/TrailPath';
import { PhaseWheel } from '../components/PhaseWheel';
import { generateTrail } from '../math/polarization';

interface QuaternionicSignalDemoProps {
  params: SignalParams;
  currentTime: number;
  tip: [number, number, number];
  showClassicalSplit: boolean;
}

/** Ghost circle showing where the classical complex signal would sit (XY plane only). */
function ClassicalSplitGhost({ params, currentTime }: { params: SignalParams; currentTime: number }) {
  const ghostPoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    const steps = 80;
    const a = params.amplitude;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      pts.push([a * Math.cos(t), a * Math.sin(t), 0]);
    }
    return pts;
  }, [params.amplitude]);

  // Ghost tip — classical 2D position at current time
  const classicParams = { ...params, demoMode: 'complex' as const };
  const classicTip = computeSignalTip(classicParams, currentTime);

  return (
    <group>
      {/* Ghost circle in XY plane */}
      <Line points={ghostPoints} color="#00d4ff" lineWidth={1} transparent opacity={0.18} />
      {/* Ghost tip sphere */}
      <mesh position={classicTip}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1} transparent opacity={0.45} />
      </mesh>
      {/* Ghost vector line */}
      <Line points={[[0, 0, 0], classicTip]} color="#00d4ff" lineWidth={1.5} transparent opacity={0.25} />
    </group>
  );
}

export function QuaternionicSignalDemo({ params, currentTime, tip, showClassicalSplit }: QuaternionicSignalDemoProps) {
  const trail = generateTrail(params, currentTime, 2.0 / params.frequency, 150);
  return (
    <>
      {showClassicalSplit && <ClassicalSplitGhost params={params} currentTime={currentTime} />}
      {/* Wider, brighter trail for the quaternionic mode */}
      <TrailPath points={trail} demoMode="quaternionic" enhanced />
      <SignalVector tip={tip} demoMode="quaternionic" enhanced />
      <PhaseWheel phase={params.phase} radius={0.2} position={[-1.5, -1.2, 0]} />
    </>
  );
}
