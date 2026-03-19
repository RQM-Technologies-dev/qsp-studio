import { useState } from 'react';
import { DemoMode } from '../math/signal';

/** Per-mode teaching content — wording follows the product framing exactly. */
const modeInfo: Record<DemoMode, {
  title: string;
  basis: string;
  body: string;
  components: { label: string; note: string }[];
  transformQ: string;
  receptionNote: string;
}> = {
  complex: {
    title: 'Classical Complex View — Planar Rotation',
    basis: 'Basis: e^{iθ} · planar rotation on the unit circle',
    body:
      'A complex sinusoid traces a circle in the XY plane. ' +
      'Phase is one scalar angle. Real and imaginary parts are two separate ' +
      'projections of a single planar rotation — nothing more.',
    components: [
      { label: 'Re (X)',    note: 'real projection — cos θ' },
      { label: 'Im (Y)',    note: 'imaginary projection — sin θ' },
      { label: 'Phase θ', note: 'one scalar angle' },
      { label: '—',        note: 'no orientation, no polarization' },
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
    basis: 'Basis: oriented elliptical oscillation in 3D space',
    body:
      'The signal tip traces a corkscrew helix — a polarization ellipse propagating ' +
      'through space. Ellipticity and orientation are now geometrically encoded, ' +
      'not just parameters bolted on top. The helix makes the spatial structure visible.',
    components: [
      { label: 'Major a',      note: 'semi-major axis length' },
      { label: 'Minor b',      note: 'semi-minor axis (= a · ellipticity)' },
      { label: 'Ellipticity',  note: 'shape ratio b/a' },
      { label: 'Normal n̂',    note: 'propagation direction' },
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
  quaternionic: {
    title: 'Quaternionic Unified View — Unified Geometric State',
    basis: 'Basis: quaternion q = w + xi + yj + zk (one four-component object)',
    body:
      'Phase, orientation, and polarization merge into one evolving quaternionic state. ' +
      'The local frame at the tip encodes 3D orientation. The pulsing halo encodes the ' +
      'scalar component w — the hidden 4th dimension projected into 3D space. ' +
      'Fiber rings along the trail evoke the Hopf fibration: each visible point carries ' +
      'a hidden rotating circle.',
    components: [
      { label: 'w (scalar)', note: 'real part — drives halo pulse rate' },
      { label: 'i (axis-x)', note: 'orientation along x' },
      { label: 'j (axis-y)', note: 'orientation along y' },
      { label: 'k (axis-z)', note: 'orientation along z' },
    ],
    transformQ:
      'Quaternionic Fourier asks: which unified geometric modes are present — ' +
      'including phase, orientation, and polarization structure together? ' +
      'Each coefficient is a full quaternion, not a complex number. ' +
      'One transform extracts what classical methods need three separate analyses to see.',
    receptionNote:
      'The quaternionic structure IS the receiving unified frame. ' +
      'When the frame tilts, the orbit shrinks, the halo dims, and fiber rings fade — ' +
      'but the quaternionic geometry uses all three axes simultaneously, so it maintains ' +
      'partial coupling (≥ 57%) even at extreme single-axis misalignment. ' +
      'This robustness is not accidental: richer geometric encoding captures more of the ' +
      'incoming field under imperfect conditions. ' +
      'Rotate the sensing frame to see the quaternionic structure degrade more gracefully than ' +
      'the classical phasor.',
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
  const { title, basis, body, components, transformQ, receptionNote } = modeInfo[demoMode];

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
                <li key={i}>
                  <span className="info-comp-label">{c.label}</span>
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

          {/* Direct reception panel — shown when incoming wave layer is active */}
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
