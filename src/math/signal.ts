import { quatFromAxisAngle, rotateVec3ByQuat, Vec3 } from './quaternion';

export type PolarizationMode = 'linear' | 'circular' | 'elliptical';
export type DemoMode = 'complex' | 'polarized' | 'quaternionic';

export interface SignalParams {
  phase: number;
  amplitude: number;
  frequency: number;
  orientationX: number;
  orientationY: number;
  orientationZ: number;
  polarization: PolarizationMode;
  demoMode: DemoMode;
  ellipticity: number;
}

export const defaultSignalParams: SignalParams = {
  phase: 0,
  amplitude: 0.8,
  frequency: 0.4,
  orientationX: 0,
  orientationY: 0,
  orientationZ: 1,
  polarization: 'circular',
  demoMode: 'complex',
  ellipticity: 0.5,
};

/**
 * Shared phase variable θ = 2π·f·t + φ.
 *
 * This is the single source of truth used by both the geometric receiver
 * (computeSignalTip) and the incoming EM wave.  Every visual that derives from
 * the signal — the phasor tip, the wave oscillation, the quaternion state — must
 * use the value returned here so that the wave and geometry are always two
 * parameterizations of the same evolving state.
 */
export function computeTheta(params: SignalParams, t: number): number {
  return 2 * Math.PI * params.frequency * t + params.phase;
}

export function computeSignalTip(params: SignalParams, t: number): [number, number, number] {
  const { amplitude, frequency, phase, orientationX, orientationY, orientationZ, polarization, demoMode, ellipticity } = params;
  const theta = 2 * Math.PI * frequency * t + phase;

  if (demoMode === 'complex') {
    return [amplitude * Math.cos(theta), amplitude * Math.sin(theta), 0];
  }

  if (demoMode === 'polarized') {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    if (polarization === 'linear') {
      return [amplitude * cosT, 0, 0];
    } else if (polarization === 'circular') {
      return [amplitude * cosT, amplitude * sinT, 0];
    } else {
      const a = amplitude;
      const b = amplitude * ellipticity;
      return [a * cosT, b * sinT, 0];
    }
  }

  // ── Quaternionic mode ─────────────────────────────────────────────────────
  // The signal state is the unit quaternion q(t) = cos(θ) + u·sin(θ) living on
  // the 3-sphere S³.  Using quatFromAxisAngle(u, 2θ) produces exactly this:
  //   w = cos(θ),  xyz = u·sin(θ)
  // The 3D contact point is q(t) acting on the reference vector [amplitude, 0, 0]:
  //   position = q(t) · amplitude·î · q̄(t)
  // This is a proper SU(2) rotation — no ad-hoc scaling factor.
  const axis: Vec3 = [orientationX, orientationY, orientationZ];
  const axisLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const normalizedAxis: Vec3 = axisLen > 1e-10
    ? [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen]
    : [0, 0, 1];

  const q = quatFromAxisAngle(normalizedAxis, 2 * theta);
  return rotateVec3ByQuat([amplitude, 0, 0], q);
}
