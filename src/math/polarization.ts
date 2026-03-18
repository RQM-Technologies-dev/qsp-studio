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
