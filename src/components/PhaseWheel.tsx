import { useMemo } from 'react';
import { Line } from '@react-three/drei';

interface PhaseWheelProps {
  phase: number;
  radius?: number;
  position?: [number, number, number];
}

export function PhaseWheel({ phase, radius = 0.3, position = [0, 0, 0] }: PhaseWheelProps) {
  const circlePoints = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * 2 * Math.PI;
      pts.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
    }
    return pts;
  }, [radius]);

  const markerPos: [number, number, number] = [
    Math.cos(phase) * radius,
    Math.sin(phase) * radius,
    0,
  ];

  return (
    <group position={position}>
      <Line points={circlePoints} color="#444466" lineWidth={1} />
      <mesh position={markerPos}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={2} />
      </mesh>
      <Line points={[[0, 0, 0], markerPos]} color="#00d4ff" lineWidth={1.5} />
    </group>
  );
}
