import { Line } from '@react-three/drei';
import { SignalParams, DemoMode } from '../math/signal';
import {
  computeReceiverBasis,
  projectFieldOntoReceiver,
  E_FIELD_SCALE,
  B_FIELD_SCALE,
} from '../math/receiverBasis';
import { Vec3 } from '../math/quaternion';

interface SampledFieldGlyphProps {
  params:       SignalParams;
  currentTime:  number;
  position:     [number, number, number];
  demoMode:     DemoMode;
  receiverYaw?: number;
  receiverPitch?: number;
  opacity?:     number;
}

/** Scale from field units to compact glyph size. */
const GLYPH_SCALE = 0.46;

/** Dot product of two Vec3. */
const dot3 = (a: Vec3, b: Vec3) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

/**
 * Tiny mode-aware field projection overlay at the main representation.
 *
 * Shows how the incoming EM field is resolved directly into the sensing
 * basis of the main geometric structure (unit circle / polarization frame /
 * quaternionic local frame).
 *
 * 1. The incoming E-field vector (translucent white) at the geometry origin.
 * 2. The sensing frame's I-axis (j_r, red) and Q-axis (k_r, green) in world space.
 * 3. The projected component arrows along each sensing axis (brighter, coloured).
 * 4. Faint projection lines connecting the E-field tip to each projected point.
 *
 * Rotating the sensing frame via yaw/pitch changes which components are extracted,
 * making the encoding physically frame-dependent.
 */
export function SampledFieldGlyph({
  params,
  currentTime,
  position,
  demoMode,
  receiverYaw   = 0,
  receiverPitch = 0,
  opacity = 1,
}: SampledFieldGlyphProps) {
  const [px, py, pz] = position;

  // ── Incoming field at the main representation position (origin, x=0) ────
  // The wave phase at origin simplifies to: -2π * f * t + phase
  const phase = -2 * Math.PI * params.frequency * currentTime + params.phase;
  const eAmp = params.amplitude * E_FIELD_SCALE;
  const bAmp = params.amplitude * B_FIELD_SCALE;

  const eField: Vec3 = [0, eAmp * Math.sin(phase), 0];           // E oscillates in Y
  const bField: Vec3 = [0, 0, bAmp * Math.sin(phase)];           // B oscillates in Z

  // ── Sensing frame local basis in world space ────────────────────────────────
  const basis = computeReceiverBasis(receiverYaw, receiverPitch);
  const { jAxis, kAxis } = basis;

  // ── Project field onto receiver axes ──────────────────────────────────
  const proj = projectFieldOntoReceiver(eField, bField, basis);

  // Sampled I-channel: E projection onto j_r (plus B component for full EM)
  const I_sampled = proj.jE + proj.jB;
  // Sampled Q-channel: E projection onto k_r + B component
  const Q_sampled = proj.kE + proj.kB;

  // ── World-space points ─────────────────────────────────────────────────
  const origin: [number, number, number] = [px, py, pz];

  // Incoming E-field tip (world space)
  const eTip: [number, number, number] = [
    px + eField[0] * GLYPH_SCALE,
    py + eField[1] * GLYPH_SCALE,
    pz + eField[2] * GLYPH_SCALE,
  ];

  // Projected I point: along j_r axis with I_sampled magnitude
  const iPt: [number, number, number] = [
    px + jAxis[0] * I_sampled * GLYPH_SCALE,
    py + jAxis[1] * I_sampled * GLYPH_SCALE,
    pz + jAxis[2] * I_sampled * GLYPH_SCALE,
  ];

  // Projected Q point: along k_r axis with Q_sampled magnitude
  const qPt: [number, number, number] = [
    px + kAxis[0] * Q_sampled * GLYPH_SCALE,
    py + kAxis[1] * Q_sampled * GLYPH_SCALE,
    pz + kAxis[2] * Q_sampled * GLYPH_SCALE,
  ];

  // Axis endpoints (fixed length, orientation-dependent)
  const axisLen = GLYPH_SCALE * 1.05;
  const jEnd: [number, number, number] = [
    px + jAxis[0] * axisLen, py + jAxis[1] * axisLen, pz + jAxis[2] * axisLen,
  ];
  const kEnd: [number, number, number] = [
    px + kAxis[0] * axisLen, py + kAxis[1] * axisLen, pz + kAxis[2] * axisLen,
  ];

  // ── Mode-specific extra: B-field contribution for polarized ───────────
  const bTip: [number, number, number] = [
    px + bField[0] * GLYPH_SCALE,
    py + bField[1] * GLYPH_SCALE,
    pz + bField[2] * GLYPH_SCALE,
  ];

  // Quaternionic: also show the forward (i_r) axis sampled from total field
  const { iAxis } = basis;
  const totalField: Vec3 = [
    eField[0] + bField[0],
    eField[1] + bField[1],
    eField[2] + bField[2],
  ];
  const W_sampled = dot3(totalField, iAxis);
  const wPt: [number, number, number] = [
    px + iAxis[0] * W_sampled * GLYPH_SCALE,
    py + iAxis[1] * W_sampled * GLYPH_SCALE,
    pz + iAxis[2] * W_sampled * GLYPH_SCALE,
  ];
  const iEnd: [number, number, number] = [
    px + iAxis[0] * axisLen, py + iAxis[1] * axisLen, pz + iAxis[2] * axisLen,
  ];

  return (
    <group>
      {/* ── Incoming field vectors (world space, behind axes so subtler) ── */}
      {/* E-field — translucent white */}
      <Line points={[origin, eTip]} color="#ffffff" lineWidth={1.5} transparent opacity={0.28 * opacity} />
      <mesh position={eTip}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} transparent opacity={0.35 * opacity} />
      </mesh>

      {/* B-field — shown in polarized + quaternionic modes */}
      {demoMode !== 'complex' && (
        <Line points={[origin, bTip]} color="#ff44aa" lineWidth={1} transparent opacity={0.22 * opacity} />
      )}

      {/* ── Receiver sensing axes (ghost, shows orientation) ─────────────── */}
      {/* I-axis direction (j_r) — faint red */}
      <Line points={[origin, jEnd]} color="#ff5566" lineWidth={0.8} transparent opacity={0.25 * opacity} />
      {/* Q-axis direction (k_r) — faint green */}
      <Line points={[origin, kEnd]} color="#44ee88" lineWidth={0.8} transparent opacity={0.25 * opacity} />
      {demoMode === 'quaternionic' && (
        /* Forward axis (i_r) — faint blue */
        <Line points={[origin, iEnd]} color="#5588ff" lineWidth={0.8} transparent opacity={0.25 * opacity} />
      )}

      {/* ── Faint projection lines: field tip → projected point ────────── */}
      <Line points={[eTip, iPt]} color="#ff5566" lineWidth={0.7} transparent opacity={0.22 * opacity} />
      <Line points={[eTip, qPt]} color="#44ee88" lineWidth={0.7} transparent opacity={0.22 * opacity} />

      {/* ── Projected component arrows (bright — this is the "sampled" data) */}
      {/* I-channel */}
      <Line points={[origin, iPt]} color="#ff5566" lineWidth={2.2} transparent opacity={0.82 * opacity} />
      <mesh position={iPt}>
        <sphereGeometry args={[0.028, 8, 8]} />
        <meshStandardMaterial color="#ff5566" emissive="#ff5566" emissiveIntensity={2.5} transparent opacity={0.9 * opacity} />
      </mesh>

      {/* Q-channel */}
      <Line points={[origin, qPt]} color="#44ee88" lineWidth={2.2} transparent opacity={0.82 * opacity} />
      <mesh position={qPt}>
        <sphereGeometry args={[0.028, 8, 8]} />
        <meshStandardMaterial color="#44ee88" emissive="#44ee88" emissiveIntensity={2.5} transparent opacity={0.9 * opacity} />
      </mesh>

      {/* Quaternionic: forward-axis (w-like) component */}
      {demoMode === 'quaternionic' && (
        <>
          <Line points={[origin, wPt]} color="#5588ff" lineWidth={2.2} transparent opacity={0.82 * opacity} />
          <mesh position={wPt}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#5588ff" emissive="#5588ff" emissiveIntensity={2.5} transparent opacity={0.9 * opacity} />
          </mesh>
        </>
      )}

      {/* Central origin dot */}
      <mesh position={origin}>
        <sphereGeometry args={[0.024, 8, 8]} />
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

