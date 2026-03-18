import { useState } from 'react';
import { DemoMode } from '../math/signal';

const infoText: Record<DemoMode, { title: string; body: string }> = {
  complex: {
    title: 'Complex Signal',
    body:
      'A classical complex sinusoid e^{iθ} traces a circle in the XY plane. ' +
      'The real and imaginary parts oscillate in quadrature. ' +
      'Phase and amplitude fully describe the signal.',
  },
  polarized: {
    title: 'Polarized Signal',
    body:
      'EM waves exhibit polarization: linear, circular, or elliptical. ' +
      'The tip traces an ellipse in 2D space. Ellipticity controls the axis ratio. ' +
      'This extends complex signals to include a second transverse dimension.',
  },
  quaternionic: {
    title: 'Quaternionic Signal',
    body:
      'A quaternionic signal lives in 3D space. The signal axis itself precesses ' +
      'while the phase evolves, creating a path through all three spatial dimensions. ' +
      'Quaternions encode both rotation and phase simultaneously — this is QSP.',
  },
};

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
          <h3>{title}</h3>
          <p>{body}</p>
        </div>
      )}
    </div>
  );
}
