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
  frequency: 1.0,
  orientationX: 0,
  orientationY: 0,
  orientationZ: 1,
  polarization: 'circular',
  demoMode: 'quaternionic',
  ellipticity: 0.5,
};

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

  // quaternionic mode
  const axis: Vec3 = [orientationX, orientationY, orientationZ];
  const axisLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const normalizedAxis: Vec3 = axisLen > 1e-10
    ? [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen]
    : [0, 0, 1];

  let baseVec: Vec3 = [amplitude * Math.cos(theta), amplitude * Math.sin(theta), 0];

  const rotQ = quatFromAxisAngle(normalizedAxis, theta * 0.3);
  baseVec = rotateVec3ByQuat(baseVec, rotQ);

  return baseVec;
}
