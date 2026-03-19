import { Line, Text } from '@react-three/drei';
import { SignalParams } from '../math/signal';
import { WAVE_K, E_FIELD_SCALE, B_FIELD_SCALE } from '../math/receiverBasis';

interface IncomingWaveProps {
  params: SignalParams;
  currentTime: number;
  receiverX: number;
  /**
   * World-space position of the live circumference/trace contact point.
   * When provided the wave terminates at this point, making the incoming
   * field and the receiving geometry visually meet at the same moving point.
   */
  contactPoint?: [number, number, number];
  opacity?: number;
}

const WAVE_START_X = -8.5;
/** Number of sample points along the wave axis. */
const NUM_POINTS = 90;
/** Fraction along the wave at which the final segment begins blending toward the contact point.
 *  The last 20% of the wave ribbon smoothly converges from the sinusoidal oscillation
 *  onto the live rim position, giving a visually continuous "arrival" gesture. */
const BLEND_START = 0.80;

/** Generate points for the E-field (Y) and B-field (Z) ribbons. */
function buildWavePoints(
  amplitude: number,
  frequency: number,
  currentTime: number,
  receiverX: number,
  contactPoint?: [number, number, number],
): {
  ePoints: [number, number, number][];
  bPoints: [number, number, number][];
} {
  const ePoints: [number, number, number][] = [];
  const bPoints: [number, number, number][] = [];
  const eAmp = amplitude * E_FIELD_SCALE;
  const bAmp = amplitude * B_FIELD_SCALE;

  // Use the contact point's X as the wave terminus so the ribbon physically
  // reaches the live rim point (tip X may be slightly past the geometry center).
  const endX = contactPoint ? contactPoint[0] : receiverX;
  const endY = contactPoint ? contactPoint[1] : 0;
  const endZ = contactPoint ? contactPoint[2] : 0;

  for (let i = 0; i <= NUM_POINTS; i++) {
    const t = i / NUM_POINTS;
    const x = WAVE_START_X + t * (endX - WAVE_START_X);
    // Traveling wave: phase = k·x − ω·t  (propagates in +X direction)
    const phase = WAVE_K * x - 2 * Math.PI * frequency * currentTime;

    // Smooth blend factor: 0 for the first BLEND_START fraction, then ramps to 1
    // at the final point so the wave converges onto the live contact position.
    const blend = t < BLEND_START ? 0 : (t - BLEND_START) / (1 - BLEND_START);

    // E-field oscillates in Y; near the end, blend toward the contact point's Y/Z
    const eY = eAmp * Math.sin(phase) * (1 - blend) + endY * blend;
    const eZ = endZ * blend;
    ePoints.push([x, eY, eZ]);

    // B-field oscillates in Z; blend toward contact point similarly
    const bZ = bAmp * Math.sin(phase) * (1 - blend) + endZ * blend;
    const bY = endY * blend;
    bPoints.push([x, bY, bZ]);
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
 *
 * When `contactPoint` is provided the wave's final segment converges onto the
 * live circumference/trace point of the active representation so that the
 * incoming wave visually meets the geometry at the same moving point.
 */
export function IncomingWave({ params, currentTime, receiverX, contactPoint, opacity = 1 }: IncomingWaveProps) {
  const { amplitude, frequency } = params;

  const { ePoints, bPoints } = buildWavePoints(amplitude, frequency, currentTime, receiverX, contactPoint);

  // Directional dots along the propagation axis (evenly spaced)
  const dotXs: number[] = [-8, -6.5, -5.2, -4.0];

  // Backbone and labels end at the contact point (or fallback to receiverX)
  const endX = contactPoint ? contactPoint[0] : receiverX;
  const labelX = endX - 0.45;
  const eAmp = amplitude * E_FIELD_SCALE;
  const bAmp = amplitude * B_FIELD_SCALE;

  // Label Y/Z anchored near the contact point when available
  const labelEY = contactPoint ? contactPoint[1] + eAmp + 0.14 : eAmp + 0.14;
  const labelBZ = contactPoint ? contactPoint[2] + bAmp + 0.16 : bAmp + 0.16;

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

      {/* Propagation backbone — very faint; ends at the live contact X */}
      <Line
        points={[[WAVE_START_X, 0, 0], [endX, 0, 0]]}
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

      {/* Live contact point glow — bright cyan dot at the exact rim contact */}
      {contactPoint && (
        <>
          {/* Faint guide: backbone axis to contact point */}
          <Line
            points={[[endX, 0, 0], contactPoint]}
            color="#00d4ff"
            lineWidth={0.6}
            transparent
            opacity={0.18 * opacity}
          />
          {/* Hero contact dot on the live circumference */}
          <mesh position={contactPoint}>
            <sphereGeometry args={[0.048, 10, 10]} />
            <meshStandardMaterial
              color="#00d4ff"
              emissive="#00d4ff"
              emissiveIntensity={3.5}
              transparent
              opacity={0.88 * opacity}
            />
          </mesh>
          {/* Soft outer halo around the contact point */}
          <mesh position={contactPoint}>
            <sphereGeometry args={[0.10, 12, 12]} />
            <meshStandardMaterial
              color="#00d4ff"
              emissive="#00d4ff"
              emissiveIntensity={1.0}
              transparent
              opacity={0.14 * opacity}
            />
          </mesh>
        </>
      )}

      {/* E-field label */}
      <Text
        position={[labelX, labelEY, 0]}
        fontSize={0.12}
        color="#00d4ff"
        fillOpacity={0.75 * opacity}
        anchorX="center"
      >
        E
      </Text>

      {/* B-field label */}
      <Text
        position={[labelX, 0, labelBZ]}
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
