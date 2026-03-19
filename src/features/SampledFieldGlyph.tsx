import { Line } from '@react-three/drei';
import { SignalParams, computeSignalTip, DemoMode } from '../math/signal';

interface SampledFieldGlyphProps {
  params:      SignalParams;
  currentTime: number;
  position:    [number, number, number];
  demoMode:    DemoMode;
  opacity?:    number;
}

/** Scale down from scene units to a compact glyph so it doesn't crowd the receiver. */
const GLYPH_SCALE = 0.38;

/**
 * Tiny mode-aware field indicator displayed at the receiver, bridging:
 *   physical wave in space → local measurement → abstract representation
 *
 * - Complex  mode: shows I (Re) and Q (Im) components of the sampled phasor
 * - Polarized mode: shows the raw E-field (cyan) and B-field (rose) vectors
 * - Quaternionic: shows the three i/j/k local basis axes
 */
export function SampledFieldGlyph({
  params,
  currentTime,
  position,
  demoMode,
  opacity = 1,
}: SampledFieldGlyphProps) {
  const [px, py, pz] = position;

  if (demoMode === 'complex') {
    // Sample the I/Q phasor at current time
    const tip = computeSignalTip({ ...params, demoMode: 'complex' }, currentTime);
    const ix: [number, number, number] = [px + tip[0] * GLYPH_SCALE, py, pz];
    const qy: [number, number, number] = [px, py + tip[1] * GLYPH_SCALE, pz];
    const scaled: [number, number, number] = [
      px + tip[0] * GLYPH_SCALE,
      py + tip[1] * GLYPH_SCALE,
      pz,
    ];

    return (
      <group>
        {/* I component — red */}
        <Line
          points={[[px, py, pz], ix]}
          color="#ff5566"
          lineWidth={2}
          transparent
          opacity={0.75 * opacity}
        />
        {/* Q component — green */}
        <Line
          points={[[px, py, pz], qy]}
          color="#44ee88"
          lineWidth={2}
          transparent
          opacity={0.75 * opacity}
        />
        {/* Phasor tip dot */}
        <mesh position={scaled}>
          <sphereGeometry args={[0.026, 8, 8]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={2}
            transparent
            opacity={0.9 * opacity}
          />
        </mesh>
      </group>
    );
  }

  if (demoMode === 'polarized') {
    // Raw sinusoidal E and B field vectors at the receiver
    const theta = 2 * Math.PI * params.frequency * currentTime + params.phase;
    const ey = params.amplitude * Math.sin(theta);
    const bz = params.amplitude * 0.6 * Math.sin(theta);

    const eTip: [number, number, number] = [px, py + ey * GLYPH_SCALE, pz];
    const bTip: [number, number, number] = [px, py, pz + bz * GLYPH_SCALE];

    return (
      <group>
        {/* E-field vector — cyan */}
        <Line
          points={[[px, py, pz], eTip]}
          color="#00d4ff"
          lineWidth={2}
          transparent
          opacity={0.75 * opacity}
        />
        {/* B-field vector — rose */}
        <Line
          points={[[px, py, pz], bTip]}
          color="#ff44aa"
          lineWidth={1.5}
          transparent
          opacity={0.65 * opacity}
        />
        {/* E-tip dot */}
        <mesh position={eTip}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={2}
            transparent
            opacity={0.9 * opacity}
          />
        </mesh>
      </group>
    );
  }

  // Quaternionic mode — show the three local basis axes (i, j, k) at the receiver
  const s = GLYPH_SCALE * 0.82;
  const iDot: [number, number, number] = [px + s, py, pz];
  const jDot: [number, number, number] = [px, py + s, pz];
  const kDot: [number, number, number] = [px, py, pz + s];

  return (
    <group>
      <Line
        points={[[px, py, pz], iDot]}
        color="#ff6688"
        lineWidth={2}
        transparent
        opacity={0.75 * opacity}
      />
      <Line
        points={[[px, py, pz], jDot]}
        color="#55ee88"
        lineWidth={2}
        transparent
        opacity={0.75 * opacity}
      />
      <Line
        points={[[px, py, pz], kDot]}
        color="#5588ff"
        lineWidth={2}
        transparent
        opacity={0.75 * opacity}
      />
      {/* Central origin dot */}
      <mesh position={[px, py, pz]}>
        <sphereGeometry args={[0.026, 8, 8]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={2}
          transparent
          opacity={0.85 * opacity}
        />
      </mesh>
    </group>
  );
}
