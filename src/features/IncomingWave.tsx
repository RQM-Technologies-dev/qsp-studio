import { Line, Text } from '@react-three/drei';
import { SignalParams } from '../math/signal';
import { WAVE_K, E_FIELD_SCALE, B_FIELD_SCALE } from '../math/receiverBasis';

interface IncomingWaveProps {
  params: SignalParams;
  currentTime: number;
  receiverX: number;
  opacity?: number;
}

const WAVE_START_X = -8.5;
/** Number of sample points along the wave axis. */
const NUM_POINTS = 90;

/** Generate points for the E-field (Y) and B-field (Z) ribbons. */
function buildWavePoints(
  amplitude: number,
  frequency: number,
  currentTime: number,
  receiverX: number,
): {
  ePoints: [number, number, number][];
  bPoints: [number, number, number][];
} {
  const ePoints: [number, number, number][] = [];
  const bPoints: [number, number, number][] = [];
  const eAmp = amplitude * E_FIELD_SCALE;
  const bAmp = amplitude * B_FIELD_SCALE;

  for (let i = 0; i <= NUM_POINTS; i++) {
    const t = i / NUM_POINTS;
    const x = WAVE_START_X + t * (receiverX - WAVE_START_X);
    // Traveling wave: phase = k·x − ω·t  (propagates in +X direction)
    const phase = WAVE_K * x - 2 * Math.PI * frequency * currentTime;
    ePoints.push([x, eAmp * Math.sin(phase), 0]);
    // B-field is in-phase with E but oscillates in Z (orthogonal to E and propagation)
    bPoints.push([x, 0, bAmp * Math.sin(phase)]);
  }
  return { ePoints, bPoints };
}

/**
 * Traveling electromagnetic wave approaching the receiver from the left.
 *
 * Shows:
 * - E-field (cyan):  sinusoidal ribbon in the XY plane
 * - B-field (rose):  sinusoidal ribbon in the XZ plane
 * - Propagation axis: faint backbone with directional dots
 */
export function IncomingWave({ params, currentTime, receiverX, opacity = 1 }: IncomingWaveProps) {
  const { amplitude, frequency } = params;

  const { ePoints, bPoints } = buildWavePoints(amplitude, frequency, currentTime, receiverX);

  // Directional dots along the propagation axis (evenly spaced)
  const dotXs: number[] = [-8, -6.5, -5.2, -4.0];

  // Label positions — just past the wave endpoints at receiver edge
  const labelX = receiverX - 0.45;
  const eAmp = amplitude * E_FIELD_SCALE;
  const bAmp = amplitude * B_FIELD_SCALE;

  return (
    <group>
      {/* E-field ribbon — XY plane, cyan */}
      {ePoints.length >= 2 && (
        <Line
          points={ePoints}
          color="#00d4ff"
          lineWidth={2}
          transparent
          opacity={0.72 * opacity}
        />
      )}

      {/* B-field ribbon — XZ plane, rose/magenta */}
      {bPoints.length >= 2 && (
        <Line
          points={bPoints}
          color="#ff44aa"
          lineWidth={1.5}
          transparent
          opacity={0.52 * opacity}
        />
      )}

      {/* Propagation backbone — very faint */}
      <Line
        points={[[WAVE_START_X, 0, 0], [receiverX, 0, 0]]}
        color="#ffffff"
        lineWidth={0.5}
        transparent
        opacity={0.07 * opacity}
      />

      {/* Directional dots along the propagation axis */}
      {dotXs.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={1.5}
            transparent
            opacity={0.28 * opacity}
          />
        </mesh>
      ))}

      {/* E-field label */}
      <Text
        position={[labelX, eAmp + 0.14, 0]}
        fontSize={0.12}
        color="#00d4ff"
        fillOpacity={0.75 * opacity}
        anchorX="center"
      >
        E
      </Text>

      {/* B-field label */}
      <Text
        position={[labelX, 0, bAmp + 0.16]}
        fontSize={0.12}
        color="#ff44aa"
        fillOpacity={0.65 * opacity}
        anchorX="center"
      >
        B
      </Text>
    </group>
  );
}
