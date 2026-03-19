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
}

export function ComplexSignalDemo({ params, tip, showBasis }: ComplexSignalDemoProps) {
  const { amplitude } = params;

  // Static unit circle in the XY plane — the defining geometry of a complex exponential
  const circlePoints = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * 2 * Math.PI;
      pts.push([amplitude * Math.cos(a), amplitude * Math.sin(a), 0]);
    }
    return pts;
  }, [amplitude]);

  // Projection of the tip onto the Re (X) axis
  const rePoint: [number, number, number] = [tip[0], 0, 0];
  // Projection of the tip onto the Im (Y) axis
  const imPoint: [number, number, number] = [0, tip[1], 0];

  return (
    <>
      {/* Full unit circle outline — always visible; this is the fundamental basis manifold */}
      <Line points={circlePoints} color="#00d4ff" lineWidth={1.8} transparent opacity={0.45} />

      {/* Basis decomposition: Re / Im projection lines — toggled by showBasis */}
      {showBasis && (
        <>
          <Line points={[tip, rePoint]} color="#ff5566" lineWidth={1} transparent opacity={0.35} />
          <Line points={[tip, imPoint]} color="#44ee88" lineWidth={1} transparent opacity={0.35} />

          {/* Re intercept dot */}
          <mesh position={rePoint}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#ff5566" emissive="#ff5566" emissiveIntensity={2} transparent opacity={0.75} />
          </mesh>
          {/* Im intercept dot */}
          <mesh position={imPoint}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshStandardMaterial color="#44ee88" emissive="#44ee88" emissiveIntensity={2} transparent opacity={0.75} />
          </mesh>
        </>
      )}

      {/* Phasor: the rotating arm from origin to the unit-circle point */}
      <SignalVector tip={tip} demoMode="complex" />
    </>
  );
}
