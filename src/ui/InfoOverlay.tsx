import { useState } from 'react';
import { DemoMode } from '../math/signal';

/** Per-mode explanatory text */
const infoText: Record<DemoMode, { title: string; body: string }> = {
  complex: {
    title: 'Classical Complex View',
    body:
      'A classical complex sinusoid e^{iθ} traces a circle in the XY plane. ' +
      'The real and imaginary parts oscillate in quadrature. ' +
      'In this model, phase is a scalar angle — fully separate from any notion of geometry or orientation.',
  },
  polarized: {
    title: 'Polarization Geometry',
    body:
      'Electromagnetic waves exhibit polarization: linear, circular, or elliptical. ' +
      'The signal tip traces a polarization ellipse in the transverse plane. ' +
      'Ellipticity and orientation are added on top of phase — still treated as separate attributes.',
  },
  quaternionic: {
    title: 'Quaternionic Unified View — Geometric State',
    body:
      'A quaternionic signal carries phase, orientation, and polarization as one unified geometric object. ' +
      'The signal axis precesses in 3D as the phase evolves. There is no separation — they are all aspects of one rotating state. ' +
      'Use "Show Classical Split" to see how the classical view would decompose this into fragments.',
  },
};

/** The single central "aha" framing sentence shown regardless of mode */
const AHA_SENTENCE =
  'In classical signal models, phase, polarization, and orientation are treated as separate attributes. ' +
  'In QSP Studio, they appear as one evolving geometric state.';

interface InfoOverlayProps {
  demoMode: DemoMode;
}

export function InfoOverlay({ demoMode }: InfoOverlayProps) {
  const [open, setOpen] = useState(true);
  const { title, body } = infoText[demoMode];
  return (
    <div className={`info-overlay ${open ? 'open' : 'closed'}`}>
      <button className="info-toggle" onClick={() => setOpen(!open)}>
        {open ? '✕' : 'ℹ'}
      </button>
      {open && (
        <div className="info-content">
          <p className="info-aha">{AHA_SENTENCE}</p>
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
      )}
    </div>
  );
}
