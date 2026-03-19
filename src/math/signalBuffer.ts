import { SignalParams } from './signal';
import { quatFromAxisAngle, Quat, Vec3 } from './quaternion';

/** Number of samples kept in the rolling buffer. */
export const BUFFER_SIZE = 256;

/**
 * Target wall-clock sample rate in Hz.
 * The RAF loop tries to push one sample per SAMPLE_INTERVAL_MS elapsed.
 * This rate is used when mapping DFT bin indices to physical frequencies.
 */
export const SAMPLE_RATE_HZ = 60;
export const SAMPLE_INTERVAL_MS = 1000 / SAMPLE_RATE_HZ;

/**
 * One signal sample captured across all three representation layers
 * simultaneously from the same underlying signal parameters.
 *
 * Storing all three at once means the DFT can be computed for any mode
 * without re-filling the buffer — the *same signal* is analysed through
 * progressively richer coordinate systems.
 */
export interface SignalSample {
  /** Classical I/Q complex phasor — [Re, Im] in the plane. */
  complex: [number, number];
  /** Polarized 3-D spatial vector — [x, y, z]. */
  spatial: [number, number, number];
  /** Quaternionic full state — [w, i, j, k] unit quaternion. */
  quaternion: Quat;
}

/**
 * Fixed-capacity circular buffer of SignalSample values.
 * Oldest samples are overwritten as new ones arrive.
 * `getAll()` always returns samples in chronological order.
 */
export class SignalBuffer {
  private readonly buf: (SignalSample | undefined)[];
  /** Index of the *next write slot* (also the oldest slot when full). */
  private head = 0;
  /** Total samples written so far, capped at capacity. */
  private count = 0;

  constructor(public readonly capacity: number = BUFFER_SIZE) {
    this.buf = new Array(capacity);
  }

  push(s: SignalSample): void {
    this.buf[this.head] = s;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /**
   * Returns all stored samples in chronological order (oldest first).
   * Returns a new array — safe to iterate while the buffer keeps filling.
   */
  getAll(): SignalSample[] {
    if (this.count === 0) return [];
    if (this.count < this.capacity) {
      // Buffer not yet full — elements 0..count-1 are all defined.
      return (this.buf.slice(0, this.count) as SignalSample[]).filter(
        (s): s is SignalSample => s !== undefined,
      );
    }
    // Full circular buffer: head points to the oldest slot.
    return [
      ...(this.buf.slice(this.head) as SignalSample[]).filter(
        (s): s is SignalSample => s !== undefined,
      ),
      ...(this.buf.slice(0, this.head) as SignalSample[]).filter(
        (s): s is SignalSample => s !== undefined,
      ),
    ];
  }

  get size(): number { return this.count; }

  /** Discard all samples (e.g. after a mode change). */
  clear(): void {
    this.buf.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}

/**
 * Sample the signal at signal-time `t` and record all three representations.
 *
 * The classical, polarized, and quaternionic fields all originate from the
 * *same* underlying phase angle `θ = 2π·f·t + φ`, making explicit that each
 * mode is a different *coordinate description* of one signal, not a different
 * signal.
 */
export function sampleSignal(params: SignalParams, t: number): SignalSample {
  const {
    amplitude, frequency, phase, ellipticity, polarization,
    orientationX, orientationY, orientationZ,
  } = params;

  const theta = 2 * Math.PI * frequency * t + phase;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // ── Classical I/Q (always circular — the fundamental I/Q basis) ────────
  const complex: [number, number] = [amplitude * cosT, amplitude * sinT];

  // ── Polarized 3-D spatial vector ───────────────────────────────────────
  let spatial: [number, number, number];
  if (polarization === 'linear') {
    spatial = [amplitude * cosT, 0, 0];
  } else if (polarization === 'circular') {
    spatial = [amplitude * cosT, amplitude * sinT, 0];
  } else {
    // elliptical
    spatial = [amplitude * cosT, amplitude * ellipticity * sinT, 0];
  }

  // ── Quaternionic state — same rotation logic as computeSignalTip ───────
  const axis: Vec3 = [orientationX, orientationY, orientationZ];
  const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const norm: Vec3 = len > 1e-10
    ? [axis[0] / len, axis[1] / len, axis[2] / len]
    : [0, 0, 1];
  const quaternion = quatFromAxisAngle(norm, theta * 0.3);

  return { complex, spatial, quaternion };
}
