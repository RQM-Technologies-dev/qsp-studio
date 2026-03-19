import { Vec3, Quat, quatFromAxisAngle, quatMultiply, rotateVec3ByQuat } from './quaternion';

export interface ReceiverBasis {
  /** Forward axis — points into the incoming wave (+X at rest). */
  iAxis: Vec3;
  /** "I-channel" sensing axis — local Y at rest; primary sensing direction for both E and B fields. */
  jAxis: Vec3;
  /** "Q-channel" sensing axis — local Z at rest; orthogonal sensing direction for both E and B fields. */
  kAxis: Vec3;
  /** The combined rotation quaternion for exporting to Three.js if needed. */
  q: Quat;
}

/**
 * Compute the receiver's world-space basis axes from yaw and pitch angles.
 *
 * Rotation order: pitch around X first, then yaw around Y — matching
 * Three.js Euler 'XYZ' order so the Three.js group rotation and the math
 * stay in sync.
 *
 * At yaw=0, pitch=0 the axes are:
 *   iAxis = [1, 0, 0]  (forward, facing the incoming wave)
 *   jAxis = [0, 1, 0]  (I-channel sensing — projects both E and B fields)
 *   kAxis = [0, 0, 1]  (Q-channel sensing — projects both E and B fields orthogonally)
 */
export function computeReceiverBasis(yaw: number, pitch: number): ReceiverBasis {
  const qPitch = quatFromAxisAngle([1, 0, 0], pitch);
  const qYaw   = quatFromAxisAngle([0, 1, 0], yaw);
  // Apply pitch first, then yaw  (q = qYaw * qPitch)
  const q = quatMultiply(qYaw, qPitch);

  const iAxis = rotateVec3ByQuat([1, 0, 0], q);
  const jAxis = rotateVec3ByQuat([0, 1, 0], q);
  const kAxis = rotateVec3ByQuat([0, 0, 1], q);

  return { iAxis, jAxis, kAxis, q };
}

/**
 * Project the incoming EM field vectors onto the receiver's sensing axes.
 *
 * @param eField  E-field vector in world space at the receiver position
 * @param bField  B-field vector in world space at the receiver position
 * @param basis   Receiver basis returned by computeReceiverBasis
 * @returns { iE, jE, kE, iB, jB, kB } — components along each receiver axis
 */
export function projectFieldOntoReceiver(
  eField: Vec3,
  bField: Vec3,
  basis: ReceiverBasis,
): {
  /** E-field projected onto i-axis (forward — minimal for a transverse EM wave) */
  iE: number;
  /** E-field projected onto j-axis (I-channel) */
  jE: number;
  /** E-field projected onto k-axis (Q-channel) */
  kE: number;
  /** B-field projected onto i-axis */
  iB: number;
  /** B-field projected onto j-axis */
  jB: number;
  /** B-field projected onto k-axis */
  kB: number;
} {
  const dot = (a: Vec3, b: Vec3) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  return {
    iE: dot(eField, basis.iAxis),
    jE: dot(eField, basis.jAxis),
    kE: dot(eField, basis.kAxis),
    iB: dot(bField, basis.iAxis),
    jB: dot(bField, basis.jAxis),
    kB: dot(bField, basis.kAxis),
  };
}

/**
 * X-coordinate of the receiver node in world space.
 * Exported here so both SampledFieldGlyph and MainScene share a single source.
 */
export const RECEIVER_X = -2.8;

/** Spatial wavenumber for the traveling wave — matches IncomingWave.tsx. */
export const WAVE_K = 1.6;

/**
 * Compute the traveling-wave phase at the receiver face.
 * Matches the formula used in IncomingWave.tsx so the glyph is synchronized
 * with the visible wave animation.
 */
export function computeWavePhaseAtReceiver(
  frequency: number,
  currentTime: number,
  phase: number,
): number {
  return WAVE_K * RECEIVER_X - 2 * Math.PI * frequency * currentTime + phase;
}
