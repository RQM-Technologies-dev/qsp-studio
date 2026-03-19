/**
 * Discrete Fourier Transform engine for QSP Studio.
 *
 * Three analysis paths, sharing the same underlying sample buffer:
 *
 * Classical   — standard 1-D complex DFT over the I/Q phasor.
 * Polarized   — magnitude at fundamental for each spatial channel (X, Y, Z).
 * Quaternionic — left-sided 1-D QFT using the i-axis imaginary unit,
 *               producing 4-component spectral coefficients (w, i, j, k).
 *
 * All transforms share the same `SignalSample` buffer that records every
 * representation simultaneously, making the "same signal in richer coords"
 * relationship algebraically explicit.
 */

import type { SignalSample } from './signalBuffer';
import { SAMPLE_RATE_HZ } from './signalBuffer';

/** Minimum buffer size required before DFT results are displayed. */
export const MIN_DFT_SAMPLES = 8;

/** Number of harmonic bars shown in classical mode (DC + harmonics). */
export const NUM_HARMONICS = 6;

// ── Shared DFT primitives ───────────────────────────────────────────────────

/**
 * Convert a frequency in Hz to the nearest DFT bin index for a buffer of
 * length N sampled at SAMPLE_RATE_HZ. Guarantees a valid non-negative result.
 */
function freqToBin(hz: number, N: number): number {
  const maxBin = Math.max(0, Math.floor(N / 2) - 1);
  return Math.max(0, Math.min(Math.round((hz * N) / SAMPLE_RATE_HZ), maxBin));
}

/**
 * Compute one bin of the classical complex DFT over the I/Q phasor.
 *
 * For the standard complex DFT:
 *   X[k] = Σ_{n=0}^{N-1} (re[n] + i·im[n]) · e^{-i·2πkn/N}
 *
 * Expanding e^{-iθ} = cosθ − i·sinθ:
 *   Re{X[k]} = Σ (re·cosθ + im·sinθ)
 *   Im{X[k]} = Σ (im·cosθ − re·sinθ)
 *
 * We return the magnitude normalised by N/2 so a full-amplitude complex
 * sinusoid at bin k yields a value of ≈ 2·A (before peak normalisation).
 */
function classicalBinMag(samples: SignalSample[], k: number): number {
  const N = samples.length;
  let re = 0, im = 0;
  for (let n = 0; n < N; n++) {
    const angle = (2 * Math.PI * k * n) / N;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const [r, q] = samples[n].complex;
    re += cosA * r + sinA * q;
    im += cosA * q - sinA * r;
  }
  return Math.sqrt(re * re + im * im) / (N / 2);
}

/**
 * Compute one bin of a real-valued DFT over a single spatial channel.
 * Used for the X, Y, Z channels of the polarized signal.
 */
function spatialBinMag(samples: SignalSample[], k: number, ch: 0 | 1 | 2): number {
  const N = samples.length;
  let re = 0, im = 0;
  for (let n = 0; n < N; n++) {
    const angle = (2 * Math.PI * k * n) / N;
    const v = samples[n].spatial[ch];
    re += v * Math.cos(angle);
    im -= v * Math.sin(angle);
  }
  return Math.sqrt(re * re + im * im) / (N / 2);
}

/**
 * Compute one bin of the left-sided 1-D Quaternionic Fourier Transform.
 *
 * Uses the i-axis as the single imaginary unit:
 *   exp_i(−θ) = cos θ + i·(−sin θ)  →  quaternion [cos θ, −sin θ, 0, 0]
 *
 * Left multiplication [cos θ, −sin θ, 0, 0] ⊗ [qw, qi, qj, qk]:
 *   Q_w = cos θ · qw + sin θ · qi
 *   Q_i = cos θ · qi − sin θ · qw
 *   Q_j = cos θ · qj + sin θ · qk
 *   Q_k = cos θ · qk − sin θ · qj
 *
 * This is the *exact* quaternionic generalisation of the classical DFT:
 * the (w,i) sub-block is a complex DFT over the scalar-i plane, while the
 * (j,k) sub-block is an independent complex DFT over the j-k plane.
 *
 * Returns absolute-value magnitudes for each of the 4 components,
 * normalised by N/2.
 */
function quaternionicBinMags(samples: SignalSample[], k: number): [number, number, number, number] {
  const N = samples.length;
  let sw = 0, si = 0, sj = 0, sk = 0;
  for (let n = 0; n < N; n++) {
    const angle = (2 * Math.PI * k * n) / N;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const [qw, qi, qj, qk] = samples[n].quaternion;
    sw += cosA * qw + sinA * qi;
    si += cosA * qi - sinA * qw;
    sj += cosA * qj + sinA * qk;
    sk += cosA * qk - sinA * qj;
  }
  const norm = N / 2;
  return [Math.abs(sw) / norm, Math.abs(si) / norm, Math.abs(sj) / norm, Math.abs(sk) / norm];
}

// ── Public output types ─────────────────────────────────────────────────────

export interface ClassicalSpectrum {
  /** Frequency-bin labels (e.g. 'DC', 'f', '2f', …). */
  labels: string[];
  /** Peak-normalised magnitudes in [0, 1]. */
  magnitudes: number[];
  /** Raw (un-normalised) magnitudes — useful for absolute comparison. */
  raw: number[];
}

export interface PolarizedSpectrum {
  /**
   * X, Y, Z channel magnitudes at the fundamental frequency,
   * normalised so max(x,y,z) = 1.
   */
  x: number;
  y: number;
  z: number;
}

export interface QuaternionicSpectrum {
  /**
   * Left-sided QFT coefficient magnitudes at the fundamental frequency,
   * normalised so max(w,i,j,k) = 1.
   */
  w: number;
  i: number;
  j: number;
  k: number;
}

export interface SpectrumData {
  classical: ClassicalSpectrum;
  polarized: PolarizedSpectrum;
  quaternionic: QuaternionicSpectrum;
  /** Number of samples currently in the buffer (out of BUFFER_SIZE). */
  bufferFill: number;
  /** Buffer is full and DFT results have full frequency resolution. */
  isStable: boolean;
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Compute the full spectrum for all three modes from the current sample buffer.
 *
 * Returns `null` if there are too few samples for a meaningful transform.
 * Otherwise returns DFT-derived bars for each mode.
 *
 * All three modes share the same `samples` array — they are three different
 * transforms of the *same underlying signal record*.
 */
export function computeSpectrum(
  samples: SignalSample[],
  signalFreqHz: number,
): SpectrumData | null {
  const N = samples.length;
  if (N < MIN_DFT_SAMPLES) return null;

  // Bin index for the signal's fundamental frequency
  const fundamentalBin = Math.max(1, freqToBin(signalFreqHz, N));

  // ── Classical: DC + 5 harmonic bins ────────────────────────────────────
  const classicalRaw: number[] = [];
  const classicalLabels: string[] = ['DC'];

  // DC bin: magnitude of the mean (bin 0)
  classicalRaw.push(classicalBinMag(samples, 0));

  for (let h = 1; h < NUM_HARMONICS; h++) {
    const binIdx = Math.min(h * fundamentalBin, Math.floor(N / 2) - 1);
    classicalRaw.push(classicalBinMag(samples, binIdx));
    classicalLabels.push(h === 1 ? 'f' : `${h}f`);
  }

  const classicalPeak = Math.max(...classicalRaw, 1e-6);
  const classical: ClassicalSpectrum = {
    labels: classicalLabels,
    magnitudes: classicalRaw.map((m) => Math.min(1, m / classicalPeak)),
    raw: classicalRaw,
  };

  // ── Polarized: X, Y, Z magnitudes at fundamental ───────────────────────
  const px = spatialBinMag(samples, fundamentalBin, 0);
  const py = spatialBinMag(samples, fundamentalBin, 1);
  const pz = spatialBinMag(samples, fundamentalBin, 2);
  const pPeak = Math.max(px, py, pz, 1e-6);
  const polarized: PolarizedSpectrum = {
    x: px / pPeak,
    y: py / pPeak,
    z: pz / pPeak,
  };

  // ── Quaternionic: QFT coefficient at fundamental ────────────────────────
  const [qw, qi, qj, qk] = quaternionicBinMags(samples, fundamentalBin);
  const qPeak = Math.max(qw, qi, qj, qk, 1e-6);
  const quaternionic: QuaternionicSpectrum = {
    w: qw / qPeak,
    i: qi / qPeak,
    j: qj / qPeak,
    k: qk / qPeak,
  };

  return {
    classical,
    polarized,
    quaternionic,
    bufferFill: N,
    isStable: N >= 128,
  };
}
