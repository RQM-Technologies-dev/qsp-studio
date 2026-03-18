import { Line } from '@react-three/drei';
import { DemoMode } from '../math/signal';

interface SignalVectorProps {
  tip: [number, number, number];
  demoMode: DemoMode;
}

const modeColors: Record<DemoMode, string> = {
  complex: '#00d4ff',
  polarized: '#8b5cf6',
  quaternionic: '#f59e0b',
};

export function SignalVector({ tip, demoMode }: SignalVectorProps) {
  const color = modeColors[demoMode];
  const [tx, ty, tz] = tip;
  const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (len < 1e-10) return null;

  return (
    <group>
      <Line
        points={[[0, 0, 0], tip]}
        color={color}
        lineWidth={3}
      />
      <mesh position={tip}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
}
