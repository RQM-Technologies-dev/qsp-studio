import { Line } from '@react-three/drei';
import { SignalParams, DemoMode } from '../math/signal';
import {
  computeReceiverBasis,
  projectFieldOntoReceiver,
  E_FIELD_SCALE,
  B_FIELD_SCALE,
  WAVE_K,
} from '../math/receiverBasis';
import { Vec3 } from '../math/quaternion';

interface SampledFieldGlyphProps {
  params:            SignalParams;
  currentTime:       number;
  /**
   * World-space position of the live circumference/trace contact point.
   * The glyph is now centred HERE so all field vectors and projections
   * radiate from the active rim, not from the geometry centre.
   */
  position:          [number, number, number];
  demoMode:          DemoMode;
  receiverYaw?:      number;
  receiverPitch?:    number;
  /**
   * Normalized coupling strength [0,1].
   * Used so the contact-dot radius matches the demo geometry's coupled amplitude.
   */
  couplingStrength?: number;
  opacity?:          number;
}

/** Scale from field units to compact glyph size. */
const GLYPH_SCALE = 0.46;

/**
 * Mode-specific wave-basis contact visual.
 *
 * Shows how the incoming EM wave resolves directly into each mode's geometric
 * sensing basis AT THE LIVE CIRCUMFERENCE CONTACT POINT.
 *
 * The component is positioned at the world-space live rim/trace point
 * (supplied by the parent via the `position` prop) so that origin = contact.
 *
 * Classical  — E resolves onto the unit circle's Re (I) and Im (Q) axes.
 *              A hero contact dot glows at the live circle-rim position.
 * Polarized  — E resolves onto the minor b-axis; B onto the normal n̂-axis.
 *              A hero contact dot glows at the current ellipse-tip position.
 * Quaternionic — E and B each resolve into their respective quaternionic-basis
 *              channels. A hero contact dot + faint boundary rings mark
 *              the projected hyperspherical receiving boundary point.
 */
export function SampledFieldGlyph({
  params,
  currentTime,
  position,
  demoMode,
  receiverYaw      = 0,
  receiverPitch    = 0,
  couplingStrength = 1,
  opacity          = 1,
}: SampledFieldGlyphProps) {
  const [px, py, pz] = position;

  // ── Incoming field at the contact point ───────────────────────────────
  // Phase at the contact position x = px using the traveling-wave formula:
  //   phase = k·x − ω·t + signal_phase
  const phase = WAVE_K * px - 2 * Math.PI * params.frequency * currentTime + params.phase;
  const eAmp = params.amplitude * E_FIELD_SCALE;
  const bAmp = params.amplitude * B_FIELD_SCALE;

  const eField: Vec3 = [0, eAmp * Math.sin(phase), 0];  // E oscillates in Y
  const bField: Vec3 = [0, 0, bAmp * Math.sin(phase)];  // B oscillates in Z

  // ── Sensing basis — same rotation as the demo group ───────────────────
  const basis = computeReceiverBasis(receiverYaw, receiverPitch);
  const { iAxis, jAxis, kAxis } = basis;

  // ── Project fields onto sensing axes ──────────────────────────────────
  const proj = projectFieldOntoReceiver(eField, bField, basis);

  // ── World-space geometry points — all relative to the live contact point ─
  // `origin` IS the contact point on the live circumference / trace.
  const origin: [number, number, number] = [px, py, pz];

  const eTip: [number, number, number] = [
    px + eField[0] * GLYPH_SCALE,
    py + eField[1] * GLYPH_SCALE,
    pz + eField[2] * GLYPH_SCALE,
  ];
  const bTip: [number, number, number] = [
    px + bField[0] * GLYPH_SCALE,
    py + bField[1] * GLYPH_SCALE,
    pz + bField[2] * GLYPH_SCALE,
  ];

  // Instantaneous field strength for contact-glow modulation.
  // Coupling further dims the glow when receiver alignment is poor.
  const fieldStrength = Math.abs(Math.sin(phase));
  const coupledGlow = 0.55 + 0.45 * couplingStrength;
  const contactGlowIntensity = (1.8 + fieldStrength * 4.0) * coupledGlow;

  // ── Classical I/Q mode ─────────────────────────────────────────────────
  if (demoMode === 'complex') {
    // The unit circle's axes in world space:
    //   Re (I) axis = iAxis (rotated local X)
    //   Im (Q) axis = jAxis (rotated local Y)
    // At rest: E (Y direction) projects entirely onto Im/Q (jAxis); Re is zero.
    // When the frame is rotated, both channels become active.
    const e_Re = proj.iE;  // E onto Re axis (visible after rotation)
    const e_Im = proj.jE;  // E onto Im/Q axis (dominant at rest)

    const rePt: [number, number, number] = [
      px + iAxis[0] * e_Re * GLYPH_SCALE,
      py + iAxis[1] * e_Re * GLYPH_SCALE,
      pz + iAxis[2] * e_Re * GLYPH_SCALE,
    ];
    const imPt: [number, number, number] = [
      px + jAxis[0] * e_Im * GLYPH_SCALE,
      py + jAxis[1] * e_Im * GLYPH_SCALE,
      pz + jAxis[2] * e_Im * GLYPH_SCALE,
    ];

    return (
      <group>
        {/* Arriving E-field vector at the live rim point */}
        <Line points={[origin, eTip]} color="#ffffff" lineWidth={1.5} transparent opacity={0.30 * opacity} />
        <mesh position={eTip}>
          <sphereGeometry args={[0.016, 6, 6]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} transparent opacity={0.40 * opacity} />
        </mesh>

        {/* Im / Q-axis component — E resolves into the circle's vertical Q-direction */}
        {Math.abs(e_Im) > 0.005 && (
          <>
            <Line points={[eTip, imPt]} color="#44ee88" lineWidth={0.8} transparent opacity={0.28 * opacity} />
            <Line points={[origin, imPt]} color="#44ee88" lineWidth={2.0} transparent opacity={0.72 * opacity} />
            <mesh position={imPt}>
              <sphereGeometry args={[0.026, 8, 8]} />
              <meshStandardMaterial color="#44ee88" emissive="#44ee88" emissiveIntensity={2.5} transparent opacity={0.88 * opacity} />
            </mesh>
          </>
        )}

        {/* Re / I-axis component — only visible when the frame is rotated off-axis */}
        {Math.abs(e_Re) > 0.005 && (
          <>
            <Line points={[eTip, rePt]} color="#ff5566" lineWidth={0.8} transparent opacity={0.28 * opacity} />
            <Line points={[origin, rePt]} color="#ff5566" lineWidth={2.0} transparent opacity={0.72 * opacity} />
            <mesh position={rePt}>
              <sphereGeometry args={[0.026, 8, 8]} />
              <meshStandardMaterial color="#ff5566" emissive="#ff5566" emissiveIntensity={2.5} transparent opacity={0.88 * opacity} />
            </mesh>
          </>
        )}

        {/* Field-collapse guide: faint line from E-tip back to the contact point */}
        <Line
          points={[eTip, origin]}
          color="#00d4ff"
          lineWidth={0.7}
          transparent
          opacity={0.22 * opacity * fieldStrength}
        />

        {/* ── HERO: contact dot on the unit-circle rim ──────────────────── */}
        {/* This IS the reception event — the live phasor tip where the wave lands */}
        <mesh position={origin}>
          <sphereGeometry args={[0.042, 10, 10]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={contactGlowIntensity}
            transparent
            opacity={0.85 * opacity}
          />
        </mesh>
        {/* Soft outer halo reinforcing the perimeter contact */}
        <mesh position={origin}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={0.6}
            transparent
            opacity={0.12 * fieldStrength * opacity}
          />
        </mesh>
      </group>
    );
  }

  // ── Polarized mode ─────────────────────────────────────────────────────
  if (demoMode === 'polarized') {
    // Polarization frame axes in world space:
    //   major a-axis = iAxis (rotated local X)
    //   minor b-axis = jAxis (rotated local Y) — E resolves here at rest
    //   normal n̂    = kAxis (rotated local Z) — B resolves here at rest
    const e_major  = proj.iE;   // E → major a-axis (magenta, dominant after rotation)
    const e_minor  = proj.jE;   // E → minor b-axis (purple, dominant at rest)
    const b_normal = proj.kB;   // B → normal n̂-axis (lavender)

    const majorPt: [number, number, number] = [
      px + iAxis[0] * e_major * GLYPH_SCALE,
      py + iAxis[1] * e_major * GLYPH_SCALE,
      pz + iAxis[2] * e_major * GLYPH_SCALE,
    ];
    const minorPt: [number, number, number] = [
      px + jAxis[0] * e_minor * GLYPH_SCALE,
      py + jAxis[1] * e_minor * GLYPH_SCALE,
      pz + jAxis[2] * e_minor * GLYPH_SCALE,
    ];
    const normalPt: [number, number, number] = [
      px + kAxis[0] * b_normal * GLYPH_SCALE,
      py + kAxis[1] * b_normal * GLYPH_SCALE,
      pz + kAxis[2] * b_normal * GLYPH_SCALE,
    ];

    return (
      <group>
        {/* Arriving E-field vector at the live ellipse/helix contact point */}
        <Line points={[origin, eTip]} color="#ffffff" lineWidth={1.5} transparent opacity={0.28 * opacity} />
        <mesh position={eTip}>
          <sphereGeometry args={[0.016, 6, 6]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} transparent opacity={0.35 * opacity} />
        </mesh>

        {/* Arriving B-field vector */}
        <Line points={[origin, bTip]} color="#ff44aa" lineWidth={1.0} transparent opacity={0.22 * opacity} />

        {/* E → major a-axis (magenta) — visible when frame is rotated */}
        {Math.abs(e_major) > 0.005 && (
          <>
            <Line points={[eTip, majorPt]} color="#e879f9" lineWidth={0.8} transparent opacity={0.28 * opacity} />
            <Line points={[origin, majorPt]} color="#e879f9" lineWidth={2.0} transparent opacity={0.70 * opacity} />
            <mesh position={majorPt}>
              <sphereGeometry args={[0.026, 8, 8]} />
              <meshStandardMaterial color="#e879f9" emissive="#e879f9" emissiveIntensity={2.5} transparent opacity={0.88 * opacity} />
            </mesh>
          </>
        )}

        {/* E → minor b-axis (purple) — primary at rest */}
        {Math.abs(e_minor) > 0.005 && (
          <>
            <Line points={[eTip, minorPt]} color="#a78bfa" lineWidth={0.8} transparent opacity={0.28 * opacity} />
            <Line points={[origin, minorPt]} color="#a78bfa" lineWidth={2.0} transparent opacity={0.70 * opacity} />
            <mesh position={minorPt}>
              <sphereGeometry args={[0.026, 8, 8]} />
              <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={2.5} transparent opacity={0.88 * opacity} />
            </mesh>
          </>
        )}

        {/* B → normal n̂-axis (lavender) */}
        {Math.abs(b_normal) > 0.005 && (
          <>
            <Line points={[bTip, normalPt]} color="#c4b5fd" lineWidth={0.8} transparent opacity={0.25 * opacity} />
            <Line points={[origin, normalPt]} color="#c4b5fd" lineWidth={2.0} transparent opacity={0.65 * opacity} />
            <mesh position={normalPt}>
              <sphereGeometry args={[0.022, 8, 8]} />
              <meshStandardMaterial color="#c4b5fd" emissive="#c4b5fd" emissiveIntensity={2.0} transparent opacity={0.82 * opacity} />
            </mesh>
          </>
        )}

        {/* Field-collapse guide: from E-tip back to the live ellipse/helix contact point */}
        <Line
          points={[eTip, origin]}
          color="#8b5cf6"
          lineWidth={0.7}
          transparent
          opacity={0.20 * opacity * fieldStrength}
        />

        {/* ── HERO: contact dot on the live ellipse/helix trace ─────────── */}
        <mesh position={origin}>
          <sphereGeometry args={[0.042, 10, 10]} />
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#8b5cf6"
            emissiveIntensity={contactGlowIntensity}
            transparent
            opacity={0.85 * opacity}
          />
        </mesh>
        {/* Soft outer halo */}
        <mesh position={origin}>
          <sphereGeometry args={[0.085, 12, 12]} />
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#8b5cf6"
            emissiveIntensity={0.6}
            transparent
            opacity={0.12 * fieldStrength * opacity}
          />
        </mesh>
      </group>
    );
  }

  // ── Quaternionic mode ──────────────────────────────────────────────────
  // The total field (E + B) is resolved into all three quaternionic basis channels.
  // At rest: E (Y) → I-channel (jAxis), B (Z) → K-channel (kAxis), forward is zero.
  // When rotated, all three channels become active — the richest capture.
  const e_i = proj.jE;   // E → I-channel (jAxis = local Y), rose (#ff6688)
  const b_k = proj.kB;   // B → K-channel (kAxis = local Z), blue (#5588ff)
  // Forward (w-like) channel: non-zero when the frame is rotated
  const eFwd = proj.iE;  // E → forward iAxis (amber #f59e0b)
  const bFwd = proj.iB;  // B → forward iAxis
  const w_fwd = eFwd + bFwd;

  const iPt: [number, number, number] = [
    px + jAxis[0] * e_i * GLYPH_SCALE,
    py + jAxis[1] * e_i * GLYPH_SCALE,
    pz + jAxis[2] * e_i * GLYPH_SCALE,
  ];
  const kPt: [number, number, number] = [
    px + kAxis[0] * b_k * GLYPH_SCALE,
    py + kAxis[1] * b_k * GLYPH_SCALE,
    pz + kAxis[2] * b_k * GLYPH_SCALE,
  ];
  const wPt: [number, number, number] = [
    px + iAxis[0] * w_fwd * GLYPH_SCALE,
    py + iAxis[1] * w_fwd * GLYPH_SCALE,
    pz + iAxis[2] * w_fwd * GLYPH_SCALE,
  ];

  // Faint great-circle rings centred at the contact point — evoke the projected
  // hyperspherical receiving boundary (inspired by the HypersphereVisualization).
  // Each ring traces a circle of radius `boundaryR` in a different great-circle plane:
  //   XY plane (equatorial), XZ plane (meridional), YZ plane (lateral).
  const boundaryR = 0.16;

  /** Build a ring in the specified great-circle plane centred at the contact point.
   *  `xAxisCoeff`/`yAxisCoeff` select which world axes form the ring plane;
   *  `rotAngle` offsets the starting angle for visual variety. */
  const generateBoundaryRing = (xAxisCoeff: number, yAxisCoeff: number, zAxisCoeff: number, rotAngle = 0): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * 2 * Math.PI + rotAngle;
      pts.push([
        px + xAxisCoeff * boundaryR * Math.cos(a),
        py + yAxisCoeff * boundaryR * Math.sin(a),
        pz + zAxisCoeff * boundaryR * Math.sin(a),
      ]);
    }
    return pts;
  };

  return (
    <group>
      {/* Arriving E-field vector at the live quaternionic boundary point */}
      <Line points={[origin, eTip]} color="#ffffff" lineWidth={1.5} transparent opacity={0.28 * opacity} />
      <mesh position={eTip}>
        <sphereGeometry args={[0.016, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} transparent opacity={0.35 * opacity} />
      </mesh>

      {/* Arriving B-field vector */}
      <Line points={[origin, bTip]} color="#ff44aa" lineWidth={1.0} transparent opacity={0.22 * opacity} />

      {/* E → I-channel (jAxis, rose — matches QuaternionFrame X/i-axis colour) */}
      {Math.abs(e_i) > 0.005 && (
        <>
          <Line points={[eTip, iPt]} color="#ff6688" lineWidth={0.8} transparent opacity={0.28 * opacity} />
          <Line points={[origin, iPt]} color="#ff6688" lineWidth={2.0} transparent opacity={0.70 * opacity} />
          <mesh position={iPt}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshStandardMaterial color="#ff6688" emissive="#ff6688" emissiveIntensity={2.5} transparent opacity={0.88 * opacity} />
          </mesh>
        </>
      )}

      {/* B → K-channel (kAxis, blue — matches QuaternionFrame Z/k-axis colour) */}
      {Math.abs(b_k) > 0.005 && (
        <>
          <Line points={[bTip, kPt]} color="#5588ff" lineWidth={0.8} transparent opacity={0.28 * opacity} />
          <Line points={[origin, kPt]} color="#5588ff" lineWidth={2.0} transparent opacity={0.70 * opacity} />
          <mesh position={kPt}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshStandardMaterial color="#5588ff" emissive="#5588ff" emissiveIntensity={2.5} transparent opacity={0.88 * opacity} />
          </mesh>
        </>
      )}

      {/* Forward/w channel (iAxis, amber) — visible when the frame is rotated off-axis */}
      {Math.abs(w_fwd) > 0.005 && (
        <>
          <Line points={[eTip, wPt]} color="#f59e0b" lineWidth={0.8} transparent opacity={0.28 * opacity} />
          <Line points={[origin, wPt]} color="#f59e0b" lineWidth={2.0} transparent opacity={0.70 * opacity} />
          <mesh position={wPt}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2.5} transparent opacity={0.88 * opacity} />
          </mesh>
        </>
      )}

      {/* ── Projected hyperspherical boundary rings ────────────────────── */}
      {/* Three faint great-circle-like rings centred at the contact point  */}
      {/* evoke the idea of a 4D hypersphere projected down to this boundary */}
      {/* point — inspired by the HypersphereVisualization reference design. */}
      {/* XY-plane equatorial ring (X cos, Y sin, Z=0) */}
      <Line points={generateBoundaryRing(1, 1, 0, 0)}            color="#f59e0b" lineWidth={0.6} transparent opacity={0.13 * opacity} />
      {/* XZ-plane meridional ring (X cos, Y=0, Z sin) */}
      <Line points={generateBoundaryRing(1, 0, 1, Math.PI / 4)} color="#f59e0b" lineWidth={0.6} transparent opacity={0.10 * opacity} />
      {/* YZ-plane lateral ring (X=0, Y cos, Z sin) */}
      <Line points={generateBoundaryRing(0, 1, 1, Math.PI / 3)} color="#f59e0b" lineWidth={0.6} transparent opacity={0.10 * opacity} />

      {/* ── HERO: contact dot on the projected quaternionic boundary ──── */}
      <mesh position={origin}>
        <sphereGeometry args={[0.046, 10, 10]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={contactGlowIntensity}
          transparent
          opacity={0.90 * opacity}
        />
      </mesh>
      {/* Outer halo — the unified quaternionic reception event */}
      <mesh position={origin}>
        <sphereGeometry args={[0.10, 12, 12]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#f59e0b"
          emissiveIntensity={0.8}
          transparent
          opacity={0.15 * fieldStrength * opacity}
        />
      </mesh>
    </group>
  );
}

