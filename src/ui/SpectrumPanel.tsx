import { SignalParams } from '../math/signal';
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
    // Show magnitude (static) + live Re/Im projections.
    const reNorm = Math.abs(Math.cos(theta));
    const imNorm = Math.abs(Math.sin(theta));
    return [
      { label: 'Magnitude', value: amplitude, color: '#00d4ff',  description: 'Signal amplitude A' },
      { label: '|Re|',      value: reNorm,    color: '#ff5566',  description: 'Real part |cos θ|' },
      { label: '|Im|',      value: imNorm,    color: '#44ee88',  description: 'Imaginary part |sin θ|' },
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
      { label: 'Major a',     value: amplitude,   color: '#e879f9', description: 'Semi-major axis length' },
      { label: 'Minor b',     value: bNorm,       color: '#a78bfa', description: 'Semi-minor axis fraction b/a' },
      { label: 'Ellipticity', value: ellipticity, color: '#c4b5fd', description: 'Ratio b/a (0 = linear, 1 = circular)' },
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
    { label: 'w (scalar)', value: Math.abs(q[0]), color: '#f59e0b', description: 'Scalar / real component of q = cos(θ·0.15)' },
    { label: 'i (axis-x)', value: Math.abs(q[1]), color: '#ff6688', description: 'x-component of vector part: nx · sin(θ·0.15)' },
    { label: 'j (axis-y)', value: Math.abs(q[2]), color: '#55ee88', description: 'y-component of vector part: ny · sin(θ·0.15)' },
    { label: 'k (axis-z)', value: Math.abs(q[3]), color: '#5588ff', description: 'z-component of vector part: nz · sin(θ·0.15)' },
  ];
}

const MODE_LABEL: Record<string, string> = {
  complex:      'Planar Frequency',
  polarized:    'Polarization State',
  quaternionic: 'Quaternionic Coefficients',
};

interface SpectrumPanelProps {
  params: SignalParams;
  currentTime: number;
}

export function SpectrumPanel({ params, currentTime }: SpectrumPanelProps) {
  const bars = computeBars(params, currentTime);

  return (
    <div className="spectrum-panel">
      <div className="spectrum-header">
        <span className="spectrum-title">SPECTRUM</span>
        <span className="spectrum-mode-label">{MODE_LABEL[params.demoMode]}</span>
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

      {params.demoMode === 'quaternionic' && (
        <p className="spectrum-note">|w|² + |i|² + |j|² + |k|² = 1</p>
      )}
      {params.demoMode === 'complex' && (
        <p className="spectrum-note">One frequency, one complex coefficient</p>
      )}
      {params.demoMode === 'polarized' && (
        <p className="spectrum-note">Geometric coefficients of the ellipse</p>
      )}
    </div>
  );
}
