/**
 * modemPolarization.ts
 *
 * Pure math functions for the Quaternionic Modem visualizer.
 *
 * Physical model:
 *   A monochromatic plane wave propagates along +X.
 *   The transverse E-field in the YZ-plane is:
 *     E(θ) = [0, Ay·cos(θ), Az·cos(θ + δ)]
 *
 *   δ = φz − φy encodes the polarization state:
 *     linear Y  : Ay=1, Az=0, δ=0
 *     linear Z  : Ay=0, Az=1, δ=0
 *     right circ: Ay=1, Az=1, δ=−π/2
 *     left  circ: Ay=1, Az=1, δ=+π/2
 *
 * The receiver is a dual-pole structure described by a unit quaternion q_r:
 *     r1 = R(q_r)·ê_y   (I-channel sensing axis)
 *     r2 = R(q_r)·ê_z   (Q-channel sensing axis)
 *
 * Measurement:  v1 = E·r1,  v2 = E·r2
 * Recovery:     E_rec = R(q_r)^{-1} · (v1·r1 + v2·r2)
 */

import { Vec3, Quat, rotateVec3ByQuat } from './quaternion';

// ── Symbol alphabet ───────────────────────────────────────────────────────────

export interface PolarizationSymbol {
  /** Human-readable symbol name shown in the HUD. */
  name: string;
  /** Amplitude along world Y axis (normalized; multiply by scene amplitude). */
  Ay: number;
  /** Amplitude along world Z axis (normalized). */
  Az: number;
  /** Phase offset δ = φz − φy (radians). */
  delta: number;
}

/** Canonical 4-symbol QMC polarization alphabet. */
export const MODEM_SYMBOLS: PolarizationSymbol[] = [
  { name: 'LIN_Y',  Ay: 1, Az: 0, delta: 0              },
  { name: 'LIN_Z',  Ay: 0, Az: 1, delta: 0              },
  { name: 'R_CIRC', Ay: 1, Az: 1, delta: -Math.PI / 2   },
  { name: 'L_CIRC', Ay: 1, Az: 1, delta: +Math.PI / 2   },
];

// ── Core field functions ──────────────────────────────────────────────────────

/**
 * Evaluate the transverse E-field at carrier phase θ.
 *   E(θ) = [0, Ay·cos(θ), Az·cos(θ + δ)]
 */
export function evaluateField(theta: number, Ay: number, Az: number, delta: number): Vec3 {
  return [0, Ay * Math.cos(theta), Az * Math.cos(theta + delta)];
}

/**
 * Derive the dual-pole receiver basis vectors from a unit quaternion.
 *   r1 = R(q)·ê_y   — I-channel sensing axis
 *   r2 = R(q)·ê_z   — Q-channel sensing axis
 *   n  = R(q)·ê_x   — receiver forward / propagation direction
 */
export function quaternionToBasis(q: Quat): { r1: Vec3; r2: Vec3; n: Vec3 } {
  return {
    r1: rotateVec3ByQuat([0, 1, 0], q),
    r2: rotateVec3ByQuat([0, 0, 1], q),
    n:  rotateVec3ByQuat([1, 0, 0], q),
  };
}

/**
 * Project E onto the dual-pole receiver and return scalar measurements plus
 * the world-space projection.
 *
 *   v1 = E·r1,  v2 = E·r2
 *   E_proj_world = v1·r1 + v2·r2
 *
 * This is the physically measured signal at the dual-pole receiver.
 * When the receiver is orthogonal to the wave's polarization, E_proj_world → 0.
 */
export function projectFieldToReceiver(
  E: Vec3,
  r1: Vec3,
  r2: Vec3,
): { v1: number; v2: number; E_proj_world: Vec3 } {
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const v1 = dot(E, r1);
  const v2 = dot(E, r2);
  return {
    v1,
    v2,
    E_proj_world: [
      v1 * r1[0] + v2 * r2[0],
      v1 * r1[1] + v2 * r2[1],
      v1 * r1[2] + v2 * r2[2],
    ],
  };
}

/**
 * Apply the inverse quaternion rotation to recover the signal in the canonical
 * world frame.
 *
 *   E_rec = R(q)^{-1} · E_proj_world
 *         = R(q̄) · E_proj_world   (since q is unit, q̄ = q^{-1})
 *
 * When receiver alignment is perfect (q_r = identity), E_rec ≡ E (the original field).
 * Under arbitrary orientation, E_rec still reconstructs the canonical symbol shape
 * because we invert the receiver rotation before decoding.
 */
export function recoverToCanonical(E_proj_world: Vec3, q: Quat): Vec3 {
  const qConj: Quat = [q[0], -q[1], -q[2], -q[3]];
  return rotateVec3ByQuat(E_proj_world, qConj);
}

// ── Ellipse sampling ──────────────────────────────────────────────────────────

/**
 * Sample the world (transmitted) polarization ellipse over one full carrier cycle.
 * Returns N+1 points in world-space YZ-plane: [0, Ay·cos(θ), Az·cos(θ+δ)].
 */
export function sampleWorldEllipse(N: number, Ay: number, Az: number, delta: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    pts.push(evaluateField(theta, Ay, Az, delta));
  }
  return pts;
}

/**
 * Sample the measured ellipse in RECEIVER-LOCAL coordinates: [0, v1(θ), v2(θ)].
 *
 * This representation is suitable for rendering inside the receiver rotation group:
 * the rotation group transform converts [0, v1, v2] → v1·r1 + v2·r2 in world space,
 * which is physically correct — the cyan ellipse lives on the receiver plane.
 */
export function sampleMeasuredEllipseLocal(
  N: number,
  Ay: number,
  Az: number,
  delta: number,
  r1: Vec3,
  r2: Vec3,
): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    const E = evaluateField(theta, Ay, Az, delta);
    const { v1, v2 } = projectFieldToReceiver(E, r1, r2);
    pts.push([0, v1, v2]);
  }
  return pts;
}

/**
 * Sample the recovered ellipse in the canonical world YZ-plane.
 *
 * Points = R(q)^{-1} · (v1·r1 + v2·r2) for each θ.
 * When receiver orientation is well-known and alignment is adequate,
 * this should match the transmitted world ellipse.
 */
export function sampleRecoveredEllipse(
  N: number,
  Ay: number,
  Az: number,
  delta: number,
  q: Quat,
  r1: Vec3,
  r2: Vec3,
): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    const E = evaluateField(theta, Ay, Az, delta);
    const { E_proj_world } = projectFieldToReceiver(E, r1, r2);
    pts.push(recoverToCanonical(E_proj_world, q));
  }
  return pts;
}

// ── Modem metrics ─────────────────────────────────────────────────────────────

/**
 * Compute cycle-averaged confidence as the RMS projection ratio.
 *
 *   conf = sqrt( RMS(‖E_proj‖²) / RMS(‖E‖²) )
 *        = sqrt( Σ‖E_proj‖² / Σ‖E‖² )
 *
 * Equals 1.0 when the receiver plane spans the full polarization ellipse;
 * drops toward 0 when the receiver is nearly orthogonal to the E-field.
 */
export function computeConfidence(
  N: number,
  Ay: number,
  Az: number,
  delta: number,
  r1: Vec3,
  r2: Vec3,
): number {
  let projEnergy = 0;
  let trueEnergy = 0;
  for (let i = 0; i < N; i++) {
    const theta = (i / N) * 2 * Math.PI;
    const E = evaluateField(theta, Ay, Az, delta);
    const { E_proj_world } = projectFieldToReceiver(E, r1, r2);
    projEnergy += E_proj_world[0] ** 2 + E_proj_world[1] ** 2 + E_proj_world[2] ** 2;
    trueEnergy += E[1] ** 2 + E[2] ** 2; // only transverse components carry energy
  }
  if (trueEnergy < 1e-10) return 0;
  return Math.sqrt(projEnergy / trueEnergy);
}

/**
 * Classify the recovered symbol by nearest-neighbor matching.
 *
 * Derives two diagnostic values from the recovered ellipse:
 *   rmsY, rmsZ  — cycle-RMS amplitudes along canonical Y and Z
 *   handedness  — signed area of the YZ locus (positive = right-hand winding)
 *
 * Decision rules mirror the physical symbol definitions:
 *   LIN_Y   :  rmsZ ≪ rmsY  (Az ≈ 0)
 *   LIN_Z   :  rmsY ≪ rmsZ  (Ay ≈ 0)
 *   R_CIRC  :  rmsY ≈ rmsZ, signed area < 0
 *   L_CIRC  :  rmsY ≈ rmsZ, signed area > 0
 */
export function classifyRecoveredSymbol(
  N: number,
  Ay: number,
  Az: number,
  delta: number,
  q: Quat,
  r1: Vec3,
  r2: Vec3,
): PolarizationSymbol {
  const samples = sampleRecoveredEllipse(N, Ay, Az, delta, q, r1, r2);

  // Cycle-RMS amplitudes along world Y and Z
  let sumY2 = 0;
  let sumZ2 = 0;
  for (const [, ry, rz] of samples) {
    sumY2 += ry * ry;
    sumZ2 += rz * rz;
  }
  const rmsY = Math.sqrt(sumY2 / samples.length);
  const rmsZ = Math.sqrt(sumZ2 / samples.length);
  const total = rmsY + rmsZ;

  const [LIN_Y, LIN_Z, R_CIRC, L_CIRC] = MODEM_SYMBOLS;

  if (total < 1e-6) return LIN_Y; // degenerate: default to LIN_Y

  // Linear discrimination: one axis dominates
  if (rmsZ / total < 0.18) return LIN_Y;
  if (rmsY / total < 0.18) return LIN_Z;

  // Circular: determine handedness from signed area of YZ locus
  // Signed area = (1/2) Σ (y[i]·z[i+1] − y[i+1]·z[i])
  let signedArea = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    signedArea += samples[i][1] * samples[i + 1][2] - samples[i + 1][1] * samples[i][2];
  }
  // R_CIRC traces clockwise in YZ (z leads y by π/2), L_CIRC traces counter-clockwise
  return signedArea < 0 ? R_CIRC : L_CIRC;
}
