import { Line } from '@react-three/drei';
import { DemoMode } from '../math/signal';

interface TrailPathProps {
  points: [number, number, number][];
  demoMode: DemoMode;
}

const modeColors: Record<DemoMode, string> = {
  complex: '#00d4ff',
  polarized: '#8b5cf6',
  quaternionic: '#f59e0b',
};

export function TrailPath({ points, demoMode }: TrailPathProps) {
  if (points.length < 2) return null;
  const color = modeColors[demoMode];
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.5}
      transparent
      opacity={0.6}
    />
  );
}
