import { SignalParams, DemoMode } from '../math/signal';
import { quatFromAxisAngle, Vec3 } from '../math/quaternion';

interface SpectrumBar {
  label: string;
  /** Normalised value 0–1. */
  value: number;
  color: string;
  description: string;
}

function computeBars(params: SignalParams, currentTime: number): SpectrumBar[] {
  const {
    amplitude, frequency, phase, ellipticity, polarization, demoMode,
    orientationX, orientationY, orientationZ,
  } = params;
  const theta = 2 * Math.PI * frequency * currentTime + phase;

  if (demoMode === 'complex') {
    // The complex sinusoid A·e^{iθ} — only one frequency bin is non-zero.
    // Show magnitude (static) + live I/Q (Re/Im) projections.
    const reNorm = Math.abs(Math.cos(theta));
    const imNorm = Math.abs(Math.sin(theta));
    return [
      { label: 'Magnitude', value: amplitude, color: '#00d4ff',  description: 'Signal amplitude A — EM carrier envelope' },
      { label: 'I (Re)',     value: reNorm,    color: '#ff5566',  description: 'In-phase component |cos θ| — I channel' },
      { label: 'Q (Im)',     value: imNorm,    color: '#44ee88',  description: 'Quadrature component |sin θ| — Q channel' },
    ];
  }

  if (demoMode === 'polarized') {
    // Three geometric coefficients describe the polarization ellipse.
    const minorB =
      polarization === 'linear'    ? 0 :
      polarization === 'circular'  ? amplitude :
      amplitude * ellipticity;
    const bNorm = amplitude > 0 ? minorB / amplitude : 0;
    return [
      { label: 'Major a',     value: amplitude,   color: '#e879f9', description: 'Semi-major axis — primary EM field amplitude' },
      { label: 'Minor b',     value: bNorm,       color: '#a78bfa', description: 'Semi-minor axis fraction b/a — cross-pol component' },
      { label: 'Ellipticity', value: ellipticity, color: '#c4b5fd', description: 'Ellipticity ratio (0 = linear, 1 = circular polarization)' },
    ];
  }

  // Quaternionic mode — four component bars.
  // q = quatFromAxisAngle(n̂, θ·0.3) = [cos(θ·0.15), sin(θ·0.15)·n̂]
  const axis: Vec3 = [orientationX, orientationY, orientationZ];
  const axisLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const normAxis: Vec3 = axisLen > 1e-10
    ? [axis[0] / axisLen, axis[1] / axisLen, axis[2] / axisLen]
    : [0, 0, 1];
  const q = quatFromAxisAngle(normAxis, theta * 0.3);
  // Note: |w|²+|x|²+|y|²+|z|² = 1 always for a unit quaternion.
  return [
    { label: 'w (scalar)', value: Math.abs(q[0]), color: '#f59e0b', description: 'Scalar part — encodes rotation angle cos(θ·0.15)' },
    { label: 'i (axis-x)', value: Math.abs(q[1]), color: '#ff6688', description: 'x-vector part: nx · sin(θ·0.15) — EM field x-axis' },
    { label: 'j (axis-y)', value: Math.abs(q[2]), color: '#55ee88', description: 'y-vector part: ny · sin(θ·0.15) — EM field y-axis' },
    { label: 'k (axis-z)', value: Math.abs(q[3]), color: '#5588ff', description: 'z-vector part: nz · sin(θ·0.15) — propagation axis' },
  ];
}

const MODE_LABEL: Record<string, string> = {
  complex:      'I/Q Decomposition',
  polarized:    'Polarization State',
  quaternionic: 'Quaternionic Coefficients',
};

/**
 * The three conceptual stages of the signal transform pipeline.
 * Active stage is highlighted per mode.
 */
const PIPELINE_STAGES: { key: string; label: string; activeFor: DemoMode[] }[] = [
  { key: 'signal', label: 'Signal',      activeFor: ['complex'] },
  { key: 'basis',  label: 'Basis',       activeFor: ['polarized'] },
  { key: 'coeffs', label: 'Coefficients', activeFor: ['quaternionic'] },
];

/** Compact hover captions per mode — tie the scene to signal-processing concepts. */
const MODE_CAPTION: Record<DemoMode, string> = {
  complex:      'Projection onto planar I/Q rotating modes',
  polarized:    'Projection onto spatial oscillation modes',
  quaternionic: 'Projection onto unified geometric (QAM) modes',
};

interface SpectrumPanelProps {
  params: SignalParams;
  currentTime: number;
}

export function SpectrumPanel({ params, currentTime }: SpectrumPanelProps) {
  const bars = computeBars(params, currentTime);
  const mode = params.demoMode;

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
      </div>

      {/* ── Spectrum label row ────────────────────────────────────────────── */}
      <div className="spectrum-header">
        <span className="spectrum-title">SPECTRUM</span>
        <span className="spectrum-mode-label">{MODE_LABEL[mode]}</span>
      </div>

      <div className="spectrum-bars">
        {bars.map((bar, i) => (
          <div key={i} className="spectrum-bar-group" title={bar.description}>
            <div className="spectrum-bar-track">
              <div
                className="spectrum-bar-fill"
                style={{ height: `${Math.min(1, Math.max(0, bar.value)) * 100}%`, background: bar.color }}
              />
            </div>
            <span className="spectrum-bar-label" style={{ color: bar.color }}>{bar.label}</span>
            <span className="spectrum-bar-value">{bar.value.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {mode === 'quaternionic' && (
        <p className="spectrum-note">|w|² + |i|² + |j|² + |k|² = 1</p>
      )}
      {mode === 'complex' && (
        <p className="spectrum-note">I + jQ — single frequency complex coefficient</p>
      )}
      {mode === 'polarized' && (
        <p className="spectrum-note">Geometric coefficients of the EM polarization ellipse</p>
      )}
    </div>
  );
}
