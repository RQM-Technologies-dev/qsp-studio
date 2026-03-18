import { Line } from '@react-three/drei';
import { SignalParams } from '../math/signal';
import { generateTrail } from '../math/polarization';

interface ProjectionPlanesProps {
  params: SignalParams;
  currentTime: number;
}

/**
 * Renders the current signal trajectory projected onto the XY and XZ planes.
 * Each projection shows what a classical 2D analysis of one dimension would see —
 * reinforcing that classical views are slices of a higher-dimensional geometric state.
 */
export function ProjectionPlanes({ params, currentTime }: ProjectionPlanesProps) {
  const trailLength = 2.0 / params.frequency;
  const trail = generateTrail(params, currentTime, trailLength, 150);
  if (trail.length < 2) return null;

  // XY projection — the complex-plane slice (phase view)
  const xyProjection: [number, number, number][] = trail.map(([x, y]) => [x, y, 0]);
  // XZ projection — a second perpendicular slice
  const xzProjection: [number, number, number][] = trail.map(([x, , z]) => [x, 0, z]);

  return (
    <group>
      {/* XY plane — "what classical complex analysis would see" */}
      <Line points={xyProjection} color="#00d4ff" lineWidth={1.2} transparent opacity={0.3} />

      {/* XZ plane — another 2D slice of the same state */}
      <Line points={xzProjection} color="#44ff88" lineWidth={1.2} transparent opacity={0.3} />

      {/* Faint XY floor plane to anchor the projection spatially */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[3.5, 3.5]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.025} />
      </mesh>

      {/* Faint XZ wall plane */}
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[3.5, 3.5]} />
        <meshBasicMaterial color="#44ff88" transparent opacity={0.025} side={2} />
      </mesh>
    </group>
  );
}
