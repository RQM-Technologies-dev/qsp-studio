import { SignalParams, computeSignalTip } from './signal';

export function generatePolarizationPath(
  params: SignalParams,
  numSamples: number
): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples / params.frequency;
    points.push(computeSignalTip(params, t));
  }
  return points;
}

export function generateTrail(
  params: SignalParams,
  currentTime: number,
  trailLength: number,
  numSamples: number
): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let i = numSamples; i >= 0; i--) {
    const t = currentTime - (i / numSamples) * trailLength;
    points.push(computeSignalTip(params, t));
  }
  return points;
}

/**
 * Helix trail for polarized mode: XY traces the polarization ellipse while
 * Z encodes temporal depth (newest point → z = 0, oldest → z = -scrollDepth).
 * This creates a corkscrew / helix that makes the 3D spatial nature obvious.
 */
export function generateHelixTrail(
  params: SignalParams,
  currentTime: number,
  trailLength: number,
  numSamples: number,
  scrollDepth = 1.8
): [number, number, number][] {
  const { amplitude, frequency, phase, ellipticity, polarization } = params;
  const points: [number, number, number][] = [];
  for (let i = numSamples; i >= 0; i--) {
    const t = currentTime - (i / numSamples) * trailLength;
    const theta = 2 * Math.PI * frequency * t + phase;
    let x: number, y: number;
    if (polarization === 'linear') {
      x = amplitude * Math.cos(theta);
      y = 0;
    } else if (polarization === 'circular') {
      x = amplitude * Math.cos(theta);
      y = amplitude * Math.sin(theta);
    } else {
      x = amplitude * Math.cos(theta);
      y = amplitude * ellipticity * Math.sin(theta);
    }
    // Oldest point sits furthest back in Z; newest (i=0) sits at z=0
    const z = -(i / numSamples) * scrollDepth;
    points.push([x, y, z]);
  }
  return points;
}
