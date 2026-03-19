import { Vec3, Quat, quatFromAxisAngle, quatMultiply, rotateVec3ByQuat } from './quaternion';
import { DemoMode } from './signal';

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

/** Spatial wavenumber for the traveling wave. Single source for IncomingWave + receiverBasis. */
export const WAVE_K = 1.6;

/** E-field peak amplitude as a fraction of signal amplitude. Shared with IncomingWave + SampledFieldGlyph. */
export const E_FIELD_SCALE = 0.5;
/** B-field peak amplitude as a fraction of signal amplitude. Shared with IncomingWave + SampledFieldGlyph. */
export const B_FIELD_SCALE = 0.32;

/**
 * Phase of the traveling wave at the receiver contact point.
 *
 * Under the shared-phase model the wave is constructed so that it arrives with
 * phase θ = 2π·f·t + φ exactly at the contact point on the receiver boundary.
 * No spatial correction (k·x) is needed here; that term is only used when
 * building the wave body at positions *before* the contact point.
 */
export function computeWavePhaseAtReceiver(
  frequency: number,
  currentTime: number,
  phase: number,
): number {
  return 2 * Math.PI * frequency * currentTime + phase;
}

/**
 * Compute a physically meaningful coupling strength scalar ∈ [0, 1] that
 * describes how much of the incoming EM field the receiver captures given its
 * orientation.
 *
 * Physical interpretation
 * ───────────────────────
 * The incoming wave propagates in +X with:
 *   E-field oscillating in Y  →  E_hat = [0, 1, 0]
 *   B-field oscillating in Z  →  B_hat = [0, 0, 1]
 *
 * Coupling depends on:
 *   aperture  = |iAxis · X̂|  — how much the receiver faces the incoming wave
 *   I_c       = jAxis[1]     — I-channel alignment with E-field (Y)
 *   Q_c       = kAxis[2]     — Q-channel alignment with B-field (Z)
 *
 * Mode-differentiated formulas
 * ────────────────────────────
 * Classical  : aperture × √((I_c² + Q_c²) / 2)
 *              Strictest coupling; complete nulls at 90° yaw or pitch.
 *              Teaching: "Poor alignment yields weaker planar encoding."
 *
 * Polarized  : ∛aperture × √((I_c² + Q_c²) / 2)
 *              More gradual degradation — spatial polarization structure gives
 *              partial robustness to aperture tilt.
 *              Teaching: "Spatial capture degrades more gracefully but still weakens."
 *
 * Quaternionic: √((aperture² + I_c² + Q_c²) / 3)
 *               All three receiver axes contribute; maintains ≥ 1/√3 ≈ 0.577
 *               coupling at any single-axis 90° rotation.
 *               Teaching: "Richer geometric capture is inherently more robust."
 *
 * Reference values at rest (yaw=0, pitch=0): all modes → 1.0
 * Reference at yaw=90°: classical=0, polarized=0, quaternionic≈0.577
 * Reference at pitch=90°: classical=0, polarized=0, quaternionic≈0.577
 */
export function computeCouplingStrength(
  yaw: number,
  pitch: number,
  demoMode: DemoMode,
): number {
  const basis = computeReceiverBasis(yaw, pitch);
  const { iAxis, jAxis, kAxis } = basis;

  // Aperture factor: how much the receiver faces the incoming wave (+X)
  const aperture = Math.abs(iAxis[0]);
  // I-channel: alignment of j_r with E-field direction (Y)
  const I_c = jAxis[1];
  // Q-channel: alignment of k_r with B-field direction (Z)
  const Q_c = kAxis[2];
  const IQ = (I_c * I_c + Q_c * Q_c) / 2;

  if (demoMode === 'complex') {
    // Strictest: aperture gate × I/Q field coupling
    return Math.min(1, aperture * Math.sqrt(IQ));
  }
  if (demoMode === 'polarized') {
    // Softer aperture roll-off: spatial polarization gives partial robustness
    return Math.min(1, Math.cbrt(aperture) * Math.sqrt(IQ));
  }
  // Quaternionic: full 3-axis formula — most robust
  return Math.min(1, Math.sqrt((aperture * aperture + I_c * I_c + Q_c * Q_c) / 3));
}

