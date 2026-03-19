import { Line } from '@react-three/drei';
import { DemoMode } from '../math/signal';

interface TrailPathProps {
  points: [number, number, number][];
  demoMode: DemoMode;
  /** When true, uses bolder styling for the quaternionic "main event" presentation. */
  enhanced?: boolean;
  /** Opacity multiplier (0–1) applied during mode-morph fade. */
  opacity?: number;
}

const modeColors: Record<DemoMode, string> = {
  complex: '#00d4ff',
  polarized: '#8b5cf6',
  quaternionic: '#f59e0b',
};

export function TrailPath({ points, demoMode, enhanced = false, opacity = 1 }: TrailPathProps) {
  if (points.length < 2) return null;
  const color = modeColors[demoMode];
  const lineWidth = enhanced ? 3.5 : 1.5;
  const baseOpacity = enhanced ? 0.88 : 0.6;
  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={baseOpacity * opacity}
    />
  );
}
