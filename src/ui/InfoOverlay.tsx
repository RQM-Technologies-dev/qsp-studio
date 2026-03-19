import { useState } from 'react';
import { DemoMode } from '../math/signal';

/** Per-mode basis and conceptual description */
const modeInfo: Record<DemoMode, {
  title: string;
  basis: string;
  body: string;
  components: string[];
  transformQ: string;
}> = {
  complex: {
    title: 'Classical Complex View — Planar Rotation',
    basis: 'Basis: complex exponential  e^{iθ}  (flat XY rotation)',
    body:
      'A complex sinusoid traces a unit circle in the XY plane. ' +
      'Phase is a single scalar angle. The real part (Re) and imaginary part (Im) ' +
      'oscillate in quadrature — two separate projections of one planar rotation.',
    components: ['Re component (X)', 'Im component (Y)', 'Phase angle θ', '— (no orientation or polarization)'],
    transformQ:
      'Classical Fourier asks: what planar rotation frequencies are present? ' +
      'Each frequency bin is a single complex coefficient.',
  },
  polarized: {
    title: 'Polarization Geometry — Spatial Oscillation',
    basis: 'Basis: oriented 3D oscillation / elliptical polarization frame',
    body:
      'The signal tip traces a 3D helix — a polarization ellipse propagating through ' +
      'space. Ellipticity and orientation are now geometrically encoded, ' +
      'not just added on top. The helix reveals the spatial structure of the wave.',
    components: ['Major axis (a)', 'Minor axis (b)', 'Polarization tilt / ellipticity', 'Normal vector n̂'],
    transformQ:
      'A polarization-aware Fourier transform extracts ellipticity and orientation per frequency, ' +
      'yielding richer geometric coefficients than ordinary complex Fourier.',
  },
  quaternionic: {
    title: 'Quaternionic Unified View — Geometric State',
    basis: 'Basis: quaternionic rotation  q = w + xi + yj + zk',
    body:
      'Phase, orientation, and polarization merge into one evolving quaternionic state. ' +
      'The local frame at the tip encodes orientation; the pulsing halo hints at the scalar ' +
      'component w — the hidden 4th dimension projected into 3D. ' +
      'Fiber rings along the trail evoke the Hopf fibration.',
    components: ['Scalar / real w', 'Axis-i component x', 'Axis-j component y', 'Axis-k component z'],
    transformQ:
      'The Quaternionic Fourier Transform asks: what unified geometric modes are present — ' +
      'including phase, orientation, and polarization structure together? ' +
      'Each coefficient is a full quaternion, not just a complex number.',
  },
};

const AHA_SENTENCE =
  'In classical signal models, phase, polarization, and orientation are separate attributes. ' +
  'In QSP Studio, they are one evolving geometric state.';

interface InfoOverlayProps {
  demoMode: DemoMode;
}

export function InfoOverlay({ demoMode }: InfoOverlayProps) {
  const [open, setOpen] = useState(true);
  const [showTransform, setShowTransform] = useState(false);
  const { title, basis, body, components, transformQ } = modeInfo[demoMode];

  return (
    <div className={`info-overlay ${open ? 'open' : 'closed'}`}>
      <button className="info-toggle" onClick={() => setOpen(!open)}>
        {open ? '✕' : 'ℹ'}
      </button>
      {open && (
        <div className="info-content">
          <p className="info-aha">{AHA_SENTENCE}</p>
          <h3>{title}</h3>
          <p className="info-basis">{basis}</p>
          <p>{body}</p>

          {/* Component decomposition readout */}
          <div className="info-components">
            <span className="info-components-label">State Components</span>
            <ul>
              {components.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {/* QFT framing — toggled to keep the panel compact */}
          <button
            className="info-expand-btn"
            onClick={() => setShowTransform(!showTransform)}
          >
            {showTransform ? '▲ Hide Transform' : '▼ Transform Intuition'}
          </button>
          {showTransform && (
            <p className="info-transform">{transformQ}</p>
          )}
        </div>
      )}
    </div>
  );
}
