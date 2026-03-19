import { Line } from '@react-three/drei';
import { DemoMode } from '../math/signal';

interface SignalVectorProps {
  tip: [number, number, number];
  demoMode: DemoMode;
  /** When true, uses stronger glow and larger tip sphere for quaternionic emphasis. */
  enhanced?: boolean;
  /** Opacity multiplier applied during mode-morph fade transitions (0–1). */
  opacity?: number;
}

const modeColors: Record<DemoMode, string> = {
  complex: '#00d4ff',
  polarized: '#8b5cf6',
  quaternionic: '#f59e0b',
};

export function SignalVector({ tip, demoMode, enhanced = false, opacity = 1 }: SignalVectorProps) {
  const color = modeColors[demoMode];
  const [tx, ty, tz] = tip;
  const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (len < 1e-10) return null;

  const tipRadius = enhanced ? 0.09 : 0.06;
  const emissiveIntensity = enhanced ? 4 : 2;
  const lineWidth = enhanced ? 4 : 3;

  return (
    <group>
      <Line
        points={[[0, 0, 0], tip]}
        color={color}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
      />
      <mesh position={tip}>
        <sphereGeometry args={[tipRadius, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}
