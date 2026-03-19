import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { DemoMode } from '../math/signal';

/** Per-mode accent colour for the signal flow line. */
const LINK_COLORS: Record<DemoMode, string> = {
  complex:      '#00d4ff',
  polarized:    '#8b5cf6',
  quaternionic: '#f59e0b',
};

interface ReceptionLinkProps {
  receiverPos: [number, number, number];
  targetPos:   [number, number, number];
  demoMode:    DemoMode;
  currentTime: number;
  opacity?:    number;
}

/**
 * Animated signal-flow link from the receiver to the geometric representation.
 *
 * Renders:
 * - A faint static line indicating the pipeline path
 * - A small glowing sphere that travels from receiver → target, symbolising
 *   the extracted geometric state moving downstream.
 */
export function ReceptionLink({
  receiverPos,
  targetPos,
  demoMode,
  currentTime,
  opacity = 1,
}: ReceptionLinkProps) {
  const color = LINK_COLORS[demoMode];

  // Build the static line points once (receiver and target rarely change position)
  const linePoints = useMemo<[number, number, number][]>(
    () => [receiverPos, targetPos],
    [receiverPos, targetPos],
  );

  // Pulse fraction: 0 → 1 cycling at ~0.8 pulses per second
  const pulseFrac = (currentTime * 0.8) % 1;

  const pulsePt: [number, number, number] = [
    receiverPos[0] + pulseFrac * (targetPos[0] - receiverPos[0]),
    receiverPos[1] + pulseFrac * (targetPos[1] - receiverPos[1]),
    receiverPos[2] + pulseFrac * (targetPos[2] - receiverPos[2]),
  ];

  return (
    <group>
      {/* Faint pipeline path */}
      <Line
        points={linePoints}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.2 * opacity}
      />

      {/* Flowing signal pulse */}
      <mesh position={pulsePt}>
        <sphereGeometry args={[0.038, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          transparent
          opacity={0.75 * opacity}
        />
      </mesh>
    </group>
  );
}
