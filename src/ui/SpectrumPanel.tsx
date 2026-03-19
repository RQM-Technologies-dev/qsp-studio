import { SignalParams, DemoMode } from '../math/signal';
import { SpectrumData, MIN_DFT_SAMPLES } from '../math/dft';
import { BUFFER_SIZE } from '../math/signalBuffer';

const MODE_LABEL: Record<DemoMode, string> = {
  complex:      'DFT Magnitude Spectrum',
  polarized:    'Spatial Channel Spectrum',
  quaternionic: 'QFT Quaternionic Coefficients',
};

/**
 * The three stages of the signal-transform pipeline.
 * The active stage is highlighted to show where the current mode sits.
 */
const PIPELINE_STAGES: { key: string; label: string; activeFor: DemoMode[] }[] = [
  { key: 'signal', label: 'Signal',      activeFor: ['complex'] },
  { key: 'basis',  label: 'Basis',       activeFor: ['polarized'] },
  { key: 'coeffs', label: 'Coefficients', activeFor: ['quaternionic'] },
];

/** Hover caption per mode — ties each view to its signal-processing meaning. */
const MODE_CAPTION: Record<DemoMode, string> = {
  complex:      'DFT: projection onto planar I/Q rotating modes',
  polarized:    'DFT: projection onto spatial oscillation modes',
  quaternionic: 'QFT: projection onto unified geometric (quaternionic) modes',
};

interface SpectrumBar {
  label: string;
  value: number;   // 0–1 normalised
  color: string;
  title: string;
}

// ── Bar colours ──────────────────────────────────────────────────────────────
const HARMONIC_COLORS = ['#4488aa', '#00d4ff', '#00aaff', '#0088cc', '#006699', '#004466'];
const SPATIAL_COLORS  = { x: '#ff6688', y: '#55ee88', z: '#5588ff' };
const QUAT_COLORS     = { w: '#f59e0b', i: '#ff6688', j: '#55ee88', k: '#5588ff' };

function buildBars(mode: DemoMode, data: SpectrumData): SpectrumBar[] {
  if (mode === 'complex') {
    const { labels, magnitudes } = data.classical;
    return labels.map((label, i) => ({
      label,
      value: magnitudes[i] ?? 0,
      color: HARMONIC_COLORS[i % HARMONIC_COLORS.length],
      title:
        i === 0
          ? 'DC component — mean signal level (zero for pure sinusoid)'
          : i === 1
          ? 'Fundamental frequency f — the carrier'
          : `${i}× harmonic — nonlinear distortion component`,
    }));
  }

  if (mode === 'polarized') {
    const { x, y, z } = data.polarized;
    return [
      { label: 'X(f)', value: x, color: SPATIAL_COLORS.x, title: 'EM field X-axis amplitude at carrier frequency' },
      { label: 'Y(f)', value: y, color: SPATIAL_COLORS.y, title: 'EM field Y-axis amplitude at carrier frequency' },
      { label: 'Z(f)', value: z, color: SPATIAL_COLORS.z, title: 'EM field Z-axis amplitude at carrier frequency' },
    ];
  }

  // Quaternionic
  const { w, i, j, k } = data.quaternionic;
  return [
    { label: 'w(f)', value: w, color: QUAT_COLORS.w, title: 'QFT scalar component at carrier frequency — rotation magnitude' },
    { label: 'i(f)', value: i, color: QUAT_COLORS.i, title: 'QFT i-component at carrier frequency — x-axis field orientation' },
    { label: 'j(f)', value: j, color: QUAT_COLORS.j, title: 'QFT j-component at carrier frequency — y-axis field orientation' },
    { label: 'k(f)', value: k, color: QUAT_COLORS.k, title: 'QFT k-component at carrier frequency — propagation axis' },
  ];
}

interface SpectrumPanelProps {
  params: SignalParams;
  spectrumData: SpectrumData | null;
}

export function SpectrumPanel({ params, spectrumData }: SpectrumPanelProps) {
  const mode = params.demoMode;

  const bars: SpectrumBar[] = spectrumData ? buildBars(mode, spectrumData) : [];
  const bufferFill = spectrumData?.bufferFill ?? 0;
  const isCollecting = bufferFill < MIN_DFT_SAMPLES;

  // Labels for the bottom note
  let note: string;
  if (isCollecting) {
    note = `Collecting samples… ${bufferFill}/${MIN_DFT_SAMPLES}`;
  } else if (mode === 'complex') {
    note = `DFT (${bufferFill}pts) -- spike at f = pure carrier`;
  } else if (mode === 'polarized') {
    note = `EM field projection at carrier f (${params.frequency.toFixed(1)} Hz)`;
  } else {
    note = `QFT i-axis (${bufferFill}pts) -- 4 components at carrier f`;
  }

  return (
    <div className="spectrum-panel">

      {/* ── Transform pipeline header ─────────────────────────────────────── */}
      <div className="pipeline-header" title={MODE_CAPTION[mode]}>
        {PIPELINE_STAGES.map((stage, idx) => {
          const isActive = stage.activeFor.includes(mode);
          return (
            <span key={stage.key} className="pipeline-stage-group">
              <span className={`pipeline-stage ${isActive ? 'active' : ''}`}>
                {stage.label}
              </span>
              {idx < PIPELINE_STAGES.length - 1 && (
                <span className="pipeline-arrow">→</span>
              )}
            </span>
          );
        })}
        {/* Buffer fill micro-indicator */}
        {!spectrumData?.isStable && (
          <span className="pipeline-fill" title={`Buffer: ${bufferFill}/${BUFFER_SIZE} samples`}>
            {Math.round((bufferFill / BUFFER_SIZE) * 100)}%
          </span>
        )}
      </div>

      {/* ── Spectrum label row ────────────────────────────────────────────── */}
      <div className="spectrum-header">
        <span className="spectrum-title">SPECTRUM</span>
        <span className="spectrum-mode-label">{MODE_LABEL[mode]}</span>
      </div>

      {/* ── Bars ──────────────────────────────────────────────────────────── */}
      <div className="spectrum-bars" style={{ minHeight: 72 }}>
        {isCollecting ? (
          <div className="spectrum-collecting">
            <div
              className="spectrum-collecting-bar"
              style={{ width: `${(bufferFill / MIN_DFT_SAMPLES) * 100}%` }}
            />
          </div>
        ) : (
          bars.map((bar, i) => (
            <div key={i} className="spectrum-bar-group" title={bar.title}>
              <div className="spectrum-bar-track">
                <div
                  className="spectrum-bar-fill"
                  style={{
                    height: `${Math.min(1, Math.max(0, bar.value)) * 100}%`,
                    background: bar.color,
                  }}
                />
              </div>
              <span className="spectrum-bar-label" style={{ color: bar.color }}>
                {bar.label}
              </span>
              <span className="spectrum-bar-value">{bar.value.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>

      <p className="spectrum-note">{note}</p>

      {/* Progress stripe: fills as buffer accumulates samples */}
      {!spectrumData?.isStable && !isCollecting && (
        <div className="spectrum-buffer-track">
          <div
            className="spectrum-buffer-fill"
            style={{ width: `${(bufferFill / BUFFER_SIZE) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

