import { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { DemoMode } from '../math/signal';

/** Render a LaTeX string inline with KaTeX. */
function KatexInline({ tex }: { tex: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, { throwOnError: false, displayMode: false });
    } catch {
      if (ref.current) ref.current.textContent = tex;
    }
  }, [tex]);
  return <span ref={ref} />;
}

/** Render a LaTeX string as a display-mode block with KaTeX. */
function KatexDisplay({ tex }: { tex: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, { throwOnError: false, displayMode: true });
    } catch {
      if (ref.current) ref.current.textContent = tex;
    }
  }, [tex]);
  return <span ref={ref} />;
}

/** Per-mode teaching content (quaternionic mode excluded from nav). */
const modeInfo: Partial<Record<DemoMode, {
  title: string;
  basisTex: string;
  body: string;
  components: { labelTex: string; note: string }[];
  transformQ: string;
  receptionNote: string;
}>> = {
  complex: {
    title: 'Classical Complex View — Planar Rotation',
    basisTex: 'e^{i\\theta} \\cdot \\text{planar rotation on the unit circle}',
    body:
      'A complex sinusoid traces a circle in the XY plane. ' +
      'Phase is one scalar angle. Real and imaginary parts are two separate ' +
      'projections of a single planar rotation — nothing more.',
    components: [
      { labelTex: '\\operatorname{Re}(x)',  note: 'real projection' },
      { labelTex: '\\cos\\theta',           note: 'in-phase component' },
      { labelTex: '\\operatorname{Im}(y)',  note: 'imaginary projection' },
      { labelTex: '\\sin\\theta',           note: 'quadrature component' },
    ],
    transformQ:
      'Classical Fourier asks: which planar rotations are present? ' +
      'Each frequency bin is a single complex number — one magnitude, one phase.',
    receptionNote:
      'The unit circle IS the receiving phase frame. ' +
      'When the frame tilts away from the incoming wave, I/Q coupling drops — ' +
      'the circle shrinks and the phasor shortens visibly. ' +
      'At broadside (90° off-axis), the planar frame captures nothing and the phasor collapses. ' +
      'This is the most fragile encoding — a single planar projection of a spatial wave.',
  },
  polarized: {
    title: 'Polarization Geometry — Spatial Oscillation',
    basisTex: '\\text{Oriented elliptical oscillation in 3D space}',
    body:
      'The signal tip traces a corkscrew helix — a polarization ellipse propagating ' +
      'through space. Ellipticity and orientation are now geometrically encoded, ' +
      'not just parameters bolted on top. The helix makes the spatial structure visible.',
    components: [
      { labelTex: 'a',              note: 'semi-major axis length' },
      { labelTex: 'b = a\\epsilon', note: 'semi-minor axis' },
      { labelTex: '\\epsilon',      note: 'ellipticity ratio b/a' },
      { labelTex: '\\hat{n}',       note: 'propagation normal' },
    ],
    transformQ:
      'A polarization-aware transform extracts orientation and ellipticity per frequency — ' +
      'richer than complex Fourier, but still one geometric object per bin.',
    receptionNote:
      'The polarization frame IS the receiving spatial structure. ' +
      'As the frame tilts away from optimal alignment, the helix radius shrinks ' +
      'and the trail dims — the encoded polarization ellipse contracts. ' +
      'Spatial geometry gives some robustness: coupling degrades more gradually than ' +
      'the classical I/Q case, but a severe misalignment still collapses the helix.',
  },
};

const AHA_SENTENCE =
  'In classical signal models, phase, polarization, and orientation are separate attributes. ' +
  'In QSP Studio, they appear as one evolving geometric state.';

interface InfoOverlayProps {
  demoMode: DemoMode;
  showIncomingWave?: boolean;
}

export function InfoOverlay({ demoMode, showIncomingWave = false }: InfoOverlayProps) {
  const [open, setOpen] = useState(true);
  const [showTransform, setShowTransform] = useState(false);
  const info = modeInfo[demoMode];

  // If the current mode has no info (e.g., quaternionic is not in the nav),
  // show a minimal placeholder so the overlay still opens/closes.
  if (!info) {
    return (
      <div className={`info-overlay ${open ? 'open' : 'closed'}`}>
        <button className="info-toggle" onClick={() => setOpen(!open)}>
          {open ? '✕' : 'ℹ'}
        </button>
      </div>
    );
  }

  const { title, basisTex, body, components, transformQ, receptionNote } = info;

  return (
    <div className={`info-overlay ${open ? 'open' : 'closed'}`}>
      <button className="info-toggle" onClick={() => setOpen(!open)}>
        {open ? '✕' : 'ℹ'}
      </button>
      {open && (
        <div className="info-content">
          <p className="info-aha">{AHA_SENTENCE}</p>
          <h3>{title}</h3>
          <p className="info-basis">
            <KatexDisplay tex={basisTex} />
          </p>
          <p>{body}</p>

          {/* Component decomposition readout */}
          <div className="info-components">
            <span className="info-components-label">State Components</span>
            <ul>
              {components.map((c, i) => (
                <li key={i}>
                  <span className="info-comp-label">
                    <KatexInline tex={c.labelTex} />
                  </span>
                  <span className="info-comp-note">{c.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* QFT framing — collapsible */}
          <button
            className="info-expand-btn"
            onClick={() => setShowTransform(!showTransform)}
          >
            {showTransform ? '▲ Hide Transform Intuition' : '▼ Transform Intuition'}
          </button>
          {showTransform && (
            <p className="info-transform">{transformQ}</p>
          )}

          {/* Direct reception panel */}
          {showIncomingWave && (
            <div className="info-pipeline">
              <span className="info-pipeline-label">Direct Geometric Reception</span>
              <p className="info-pipeline-flow">Incoming EM Wave → Direct Geometric Reception / Encoding</p>
              <p className="info-pipeline-note">{receptionNote}</p>
              <p className="info-pipeline-coupling">
                The geometric structure IS the sensing frame — the incoming field is captured
                directly into this basis. Rotate the sensing frame to see coupling strength
                drive the geometry amplitude directly.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
