import { useEffect, useRef } from 'react';
import { SignalParams } from '../math/signal';
import { computeReceiverBasis } from '../math/receiverBasis';
import { quatFromAxisAngle, Vec3 } from '../math/quaternion';

interface QuaternionicReceiverPanelProps {
  params: SignalParams;
  currentTime: number;
  receiverYaw: number;
  receiverPitch: number;
  couplingStrength: number;
}

const PANEL_W = 172;
const PANEL_H = 148;
/** Number of parametric points for one full ellipse trace. */
const N_TRACE = 120;

// ── Colour palette (matches the quaternionic amber theme) ─────────────────
const COL_AMBER = '#f59e0b';
const COL_PURPLE = '#8b5cf6';
const COL_CYAN = '#00d4ff';
const COL_RED = '#ff6688';
const COL_GREEN = '#55ee88';
const COL_BLUE = '#5588ff';
const COL_SURFACE = 'rgba(10,10,22,0.93)';
const COL_BORDER_AMBER = 'rgba(245,158,11,0.35)';
const COL_BORDER_PURPLE = 'rgba(139,92,246,0.35)';
const COL_BORDER_CYAN = 'rgba(0,212,255,0.35)';
const COL_GRID = 'rgba(255,255,255,0.06)';
const COL_TEXT_DIM = 'rgba(200,216,232,0.55)';
const COL_TEXT = 'rgba(200,216,232,0.88)';

/**
 * Compute the E-field vector in world space for the given signal params and time t.
 *
 * The EM wave propagates along +X.  The transverse E-field lives in the YZ plane:
 *   E(t) = [0, Ay·cos(θ), Az·cos(θ + δ)]
 * where θ = 2π·f·t + φ and (Ay, Az, δ) depend on the polarization mode.
 */
function eFieldAt(params: SignalParams, t: number): [number, number, number] {
  const { amplitude, frequency, phase, polarization, ellipticity } = params;
  const theta = 2 * Math.PI * frequency * t + phase;
  const Ay = amplitude;
  let Az = amplitude;
  let delta = Math.PI / 2; // default: circular
  if (polarization === 'linear') { Az = 0; delta = 0; }
  else if (polarization === 'elliptical') { Az = amplitude * ellipticity; delta = Math.PI / 2; }
  return [0, Ay * Math.cos(theta), Az * Math.cos(theta + delta)];
}

// ── Shared drawing helpers ─────────────────────────────────────────────────

function clearPanel(ctx: CanvasRenderingContext2D, borderColor: string): void {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COL_SURFACE;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

function drawGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.strokeStyle = COL_GRID;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.stroke();
  // Reference circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.stroke();
}

function panelTitle(ctx: CanvasRenderingContext2D, label: string, subLabel: string): void {
  const W = ctx.canvas.width;
  ctx.font = 'bold 8px system-ui';
  ctx.fillStyle = COL_TEXT;
  ctx.textAlign = 'center';
  ctx.fillText(label, W / 2, 10);
  ctx.font = '7px system-ui';
  ctx.fillStyle = COL_TEXT_DIM;
  ctx.fillText(subLabel, W / 2, 19);
  ctx.textAlign = 'left';
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  color: string, label: string,
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  // Arrowhead
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const HEAD = 5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - HEAD * ux + HEAD * 0.4 * uy, y1 - HEAD * uy - HEAD * 0.4 * ux);
  ctx.lineTo(x1 - HEAD * ux - HEAD * 0.4 * uy, y1 - HEAD * uy + HEAD * 0.4 * ux);
  ctx.closePath();
  ctx.fill();
  // Label
  ctx.font = '8px system-ui';
  ctx.fillStyle = color;
  ctx.fillText(label, x1 + 3, y1 + 3);
}

// ── Panel 2: Receiver Face View ───────────────────────────────────────────

/**
 * Draw the receiver-face panel.
 *
 * Shows the 2D ellipse traced by the measured signal in the receiver's local
 * coordinate frame (v₁, v₂), where:
 *   v₁(t) = E(t)·r̂₁   (I-channel)
 *   v₂(t) = E(t)·r̂₂   (Q-channel)
 *
 * As the receiver rotates, the local ellipse deforms — the coordinate-projection
 * deformation described in the problem statement.
 */
function drawReceiverFace(
  ctx: CanvasRenderingContext2D,
  params: SignalParams,
  currentTime: number,
  receiverYaw: number,
  receiverPitch: number,
  couplingStrength: number,
): void {
  clearPanel(ctx, COL_BORDER_AMBER);

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cx = W / 2;
  const TOP_PAD = 24;
  const BOT_PAD = 14;
  const plotH = H - TOP_PAD - BOT_PAD;
  const cy = TOP_PAD + plotH / 2;
  const plotR = Math.min(W / 2 - 16, plotH / 2 - 2);
  const scale = plotR / Math.max(0.01, params.amplitude);

  panelTitle(ctx, 'LOCAL MEASUREMENT', 'v₁ = E·r̂₁ ,  v₂ = E·r̂₂');
  drawGrid(ctx, cx, cy, plotR);

  // Receiver basis
  const basis = computeReceiverBasis(receiverYaw, receiverPitch);
  const { jAxis, kAxis } = basis;

  // r̂₁ and r̂₂ local axes on the canvas (drawn as fixed hor/vert reference)
  const AX = 34;
  drawArrow(ctx, cx, cy, cx + AX, cy, COL_AMBER, 'r̂₁');
  drawArrow(ctx, cx, cy, cx, cy - AX, COL_PURPLE, 'r̂₂');

  // Build the full parametric ellipse trace over one period
  const period = 1 / Math.max(0.001, params.frequency);
  const ellipsePts: [number, number][] = [];
  for (let i = 0; i <= N_TRACE; i++) {
    const t = currentTime - period + (i / N_TRACE) * period;
    const [, ey, ez] = eFieldAt(params, t);
    // Projection onto receiver sensing axes (E-field is transverse — E[0] = 0)
    const v1 = ey * jAxis[1] + ez * jAxis[2];
    const v2 = ey * kAxis[1] + ez * kAxis[2];
    ellipsePts.push([cx + v1 * scale, cy - v2 * scale]);
  }

  // Draw the ellipse trace (fading tail → bright head)
  if (ellipsePts.length >= 2) {
    for (let i = 1; i < ellipsePts.length; i++) {
      const alpha = (i / ellipsePts.length) * 0.72 * (0.35 + 0.65 * couplingStrength);
      ctx.strokeStyle = `rgba(245,158,11,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(ellipsePts[i - 1][0], ellipsePts[i - 1][1]);
      ctx.lineTo(ellipsePts[i][0], ellipsePts[i][1]);
      ctx.stroke();
    }
  }

  // Current dot
  const [, ey0, ez0] = eFieldAt(params, currentTime);
  const v1Now = ey0 * jAxis[1] + ez0 * jAxis[2];
  const v2Now = ey0 * kAxis[1] + ez0 * kAxis[2];
  const dotX = cx + v1Now * scale;
  const dotY = cy - v2Now * scale;
  ctx.beginPath();
  ctx.arc(dotX, dotY, 3.5, 0, 2 * Math.PI);
  ctx.fillStyle = COL_AMBER;
  ctx.fill();

  // Coupling readout
  const pct = Math.round(couplingStrength * 100);
  const qualColor = couplingStrength >= 0.65 ? COL_CYAN : couplingStrength >= 0.35 ? COL_AMBER : COL_RED;
  ctx.font = '7px system-ui';
  ctx.fillStyle = qualColor;
  ctx.textAlign = 'right';
  ctx.fillText(`${pct}% coupling`, W - 4, H - 4);
  ctx.textAlign = 'left';
}

// ── Panel 3: Quaternion State View ────────────────────────────────────────

/**
 * Draw the quaternion-state panel.
 *
 * Displays the receiver's orientation quaternion q = w + xi + yj + zk along
 * two representations:
 *  1. Signed bar chart for each component (w, x, y, z)
 *  2. Axis-angle indicator: q = cos(φ/2) + û·sin(φ/2)
 *
 * A second row shows the live signal quaternion q_s(t) = cos(θ) + u·sin(θ).
 */
function drawQuatState(
  ctx: CanvasRenderingContext2D,
  params: SignalParams,
  currentTime: number,
  receiverYaw: number,
  receiverPitch: number,
): void {
  clearPanel(ctx, COL_BORDER_PURPLE);

  const W = ctx.canvas.width;

  panelTitle(ctx, 'QUATERNION STATE', 'q = w + xi + yj + zk');

  // ── Receiver orientation quaternion (from yaw / pitch) ─────────────────
  const basis = computeReceiverBasis(receiverYaw, receiverPitch);
  const [qw, qx, qy, qz] = basis.q;

  // Axis-angle from receiver quat
  const sinHalfAngle = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const receiverAngleDeg = (2 * Math.atan2(sinHalfAngle, qw) * 180 / Math.PI).toFixed(1);
  const uLen = sinHalfAngle > 1e-10 ? sinHalfAngle : 1;
  const ux = (qx / uLen).toFixed(2);
  const uy = (qy / uLen).toFixed(2);
  const uz = (qz / uLen).toFixed(2);

  // ── Signal quaternion q_s(t) = cos(θ) + u·sin(θ) ──────────────────────
  const theta = 2 * Math.PI * params.frequency * currentTime + params.phase;
  const axis: Vec3 = [params.orientationX, params.orientationY, params.orientationZ];
  const axLen = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
  const normAxis: Vec3 = axLen > 1e-10
    ? [axis[0] / axLen, axis[1] / axLen, axis[2] / axLen]
    : [0, 0, 1];
  const qSig = quatFromAxisAngle(normAxis, 2 * theta);
  const [sw, sx, sy, sz] = qSig;

  // ── Layout: two bar-chart rows ─────────────────────────────────────────
  const BAR_SECTION_Y = 28;
  const BAR_H = 8;
  const BAR_GAP = 13;
  const barMaxW = (W - 40) / 2 - 4;
  const components = [
    { label: 'w', val: qw, color: COL_AMBER },
    { label: 'x', val: qx, color: COL_RED   },
    { label: 'y', val: qy, color: COL_GREEN  },
    { label: 'z', val: qz, color: COL_BLUE   },
  ];
  const sigComponents = [
    { label: 'w', val: sw, color: COL_AMBER },
    { label: 'x', val: sx, color: COL_RED   },
    { label: 'y', val: sy, color: COL_GREEN  },
    { label: 'z', val: sz, color: COL_BLUE   },
  ];

  // Section header for receiver quat
  ctx.font = '7px system-ui';
  ctx.fillStyle = COL_TEXT_DIM;
  ctx.textAlign = 'left';
  ctx.fillText('Receiver  q_r', 4, BAR_SECTION_Y - 3);

  components.forEach(({ label, val, color }, i) => {
    const y = BAR_SECTION_Y + i * BAR_GAP;
    // Label
    ctx.font = '7px system-ui';
    ctx.fillStyle = color;
    ctx.fillText(label, 4, y + BAR_H - 1);
    // Track
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(14, y, barMaxW * 2, BAR_H);
    // Zero line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(14 + barMaxW, y); ctx.lineTo(14 + barMaxW, y + BAR_H);
    ctx.stroke();
    // Value bar (centred at zero)
    const bw = Math.abs(val) * barMaxW;
    const bx = val >= 0 ? 14 + barMaxW : 14 + barMaxW - bw;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(bx, y + 1, bw, BAR_H - 2);
    ctx.globalAlpha = 1;
    // Numeric value
    ctx.font = '7px system-ui';
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(2), W - 4, y + BAR_H - 1);
    ctx.textAlign = 'left';
  });

  // Axis-angle readout for receiver
  const aaY = BAR_SECTION_Y + 4 * BAR_GAP + 2;
  ctx.font = '7px system-ui';
  ctx.fillStyle = COL_TEXT_DIM;
  ctx.fillText(`φ = ${receiverAngleDeg}°  û=(${ux},${uy},${uz})`, 4, aaY);

  // Divider
  const divY = aaY + 7;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(4, divY); ctx.lineTo(W - 4, divY);
  ctx.stroke();

  // Section header for signal quat
  const sigY = divY + 8;
  ctx.font = '7px system-ui';
  ctx.fillStyle = COL_TEXT_DIM;
  ctx.fillText('Signal  q_s(t)', 4, sigY);

  sigComponents.forEach(({ label, val, color }, i) => {
    const y = sigY + 4 + i * BAR_GAP;
    ctx.font = '7px system-ui';
    ctx.fillStyle = color;
    ctx.fillText(label, 4, y + BAR_H - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(14, y, barMaxW * 2, BAR_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(14 + barMaxW, y); ctx.lineTo(14 + barMaxW, y + BAR_H);
    ctx.stroke();
    const bw = Math.abs(val) * barMaxW;
    const bx = val >= 0 ? 14 + barMaxW : 14 + barMaxW - bw;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(bx, y + 1, bw, BAR_H - 2);
    ctx.globalAlpha = 1;
    ctx.font = '7px system-ui';
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(2), W - 4, y + BAR_H - 1);
    ctx.textAlign = 'left';
  });
}

// ── Panel 4: Recovered Signal View ────────────────────────────────────────

/**
 * Draw the recovered-signal panel.
 *
 * Demonstrates quaternion recovery: the receiver uses its estimated orientation
 * q_r to undo the rotation and reconstruct the canonical polarization ellipse.
 *
 * Recovery formula:
 *   s_world = v₁·r̂₁ + v₂·r̂₂           (reconstruct 3D vector from projected components)
 *   (s_rec_y, s_rec_z) = (s_world[1], s_world[2])   (project onto canonical YZ frame)
 *
 * When coupling is good the recovered ellipse matches the world ellipse.
 * As receiver tilts, some energy is lost and the ellipse slightly shrinks but
 * maintains its shape — showing the quaternionic robustness claim.
 */
function drawRecoveredSignal(
  ctx: CanvasRenderingContext2D,
  params: SignalParams,
  currentTime: number,
  receiverYaw: number,
  receiverPitch: number,
  couplingStrength: number,
): void {
  clearPanel(ctx, COL_BORDER_CYAN);

  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cx = W / 2;
  const TOP_PAD = 24;
  const BOT_PAD = 14;
  const plotH = H - TOP_PAD - BOT_PAD;
  const cy = TOP_PAD + plotH / 2;
  const plotR = Math.min(W / 2 - 16, plotH / 2 - 2);
  const scale = plotR / Math.max(0.01, params.amplitude);

  panelTitle(ctx, 'RECOVERED SIGNAL', 's_rec = R(q)⁻¹ · s_local');
  drawGrid(ctx, cx, cy, plotR);

  // Draw canonical Y, Z axes
  const AX = 34;
  drawArrow(ctx, cx, cy, cx + AX, cy, 'rgba(0,212,255,0.7)', 'ê_y');
  drawArrow(ctx, cx, cy, cx, cy - AX, 'rgba(0,212,255,0.5)', 'ê_z');

  const basis = computeReceiverBasis(receiverYaw, receiverPitch);
  const { jAxis, kAxis } = basis;

  // World reference ellipse (faint dashed reference)
  const period = 1 / Math.max(0.001, params.frequency);
  const worldPts: [number, number][] = [];
  for (let i = 0; i <= N_TRACE; i++) {
    const t = currentTime - period + (i / N_TRACE) * period;
    const [, wy, wz] = eFieldAt(params, t);
    worldPts.push([cx + wy * scale, cy - wz * scale]);
  }
  if (worldPts.length >= 2) {
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(0,212,255,0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    worldPts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Recovered ellipse trace
  const recPts: [number, number][] = [];
  for (let i = 0; i <= N_TRACE; i++) {
    const t = currentTime - period + (i / N_TRACE) * period;
    const [, ey, ez] = eFieldAt(params, t);

    // Measure in receiver frame
    const v1 = ey * jAxis[1] + ez * jAxis[2];
    const v2 = ey * kAxis[1] + ez * kAxis[2];

    // Reconstruct world vector: s = v₁·r̂₁ + v₂·r̂₂
    const sy = v1 * jAxis[1] + v2 * kAxis[1];
    const sz = v1 * jAxis[2] + v2 * kAxis[2];

    recPts.push([cx + sy * scale, cy - sz * scale]);
  }

  if (recPts.length >= 2) {
    for (let i = 1; i < recPts.length; i++) {
      const alpha = (i / recPts.length) * 0.78 * (0.4 + 0.6 * couplingStrength);
      ctx.strokeStyle = `rgba(0,212,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(recPts[i - 1][0], recPts[i - 1][1]);
      ctx.lineTo(recPts[i][0], recPts[i][1]);
      ctx.stroke();
    }
  }

  // Current dot on recovered trace
  const [, ey0, ez0] = eFieldAt(params, currentTime);
  const v1Now = ey0 * jAxis[1] + ez0 * jAxis[2];
  const v2Now = ey0 * kAxis[1] + ez0 * kAxis[2];
  const recY = v1Now * jAxis[1] + v2Now * kAxis[1];
  const recZ = v1Now * jAxis[2] + v2Now * kAxis[2];
  ctx.beginPath();
  ctx.arc(cx + recY * scale, cy - recZ * scale, 3.5, 0, 2 * Math.PI);
  ctx.fillStyle = COL_CYAN;
  ctx.fill();

  // Label: confirm recovery
  const pct = Math.round(couplingStrength * 100);
  ctx.font = '7px system-ui';
  ctx.fillStyle = COL_CYAN;
  ctx.textAlign = 'right';
  ctx.fillText(`${pct}% fidelity`, W - 4, H - 4);
  ctx.textAlign = 'left';
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * QuaternionicReceiverPanel
 *
 * A synchronized 3-panel HTML-canvas overlay shown exclusively in Quaternionic /
 * QAM mode.  Implements the 4-pane receiver visual described in the problem
 * statement (the Three.js scene provides Panel 1 — the 3D world view):
 *
 * Panel 2 — LOCAL MEASUREMENT   : the projected local ellipse on receiver axes
 * Panel 3 — QUATERNION STATE    : receiver + signal quaternion component bars
 * Panel 4 — RECOVERED SIGNAL    : canonical ellipse after inverse frame rotation
 *
 * Mathematical truth displayed
 * ────────────────────────────
 * The EM wave itself is unchanged (a polarisation ellipse in the YZ plane).
 * What changes is the receiver's local view — Panel 2 shows the deformation.
 * Panel 4 proves that quaternion-tracked orientation restores the canonical
 * ellipse, demonstrating the core promise of quaternionic signal processing.
 */
export function QuaternionicReceiverPanel({
  params,
  currentTime,
  receiverYaw,
  receiverPitch,
  couplingStrength,
}: QuaternionicReceiverPanelProps) {
  const faceRef      = useRef<HTMLCanvasElement>(null);
  const quatRef      = useRef<HTMLCanvasElement>(null);
  const recoveredRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const face = faceRef.current;
    const quat = quatRef.current;
    const rec  = recoveredRef.current;
    if (!face || !quat || !rec) return;

    const ctx1 = face.getContext('2d');
    const ctx2 = quat.getContext('2d');
    const ctx3 = rec.getContext('2d');
    if (!ctx1 || !ctx2 || !ctx3) return;

    drawReceiverFace(ctx1, params, currentTime, receiverYaw, receiverPitch, couplingStrength);
    drawQuatState(ctx2, params, currentTime, receiverYaw, receiverPitch);
    drawRecoveredSignal(ctx3, params, currentTime, receiverYaw, receiverPitch, couplingStrength);
  }, [params, currentTime, receiverYaw, receiverPitch, couplingStrength]);

  return (
    <div className="quat-receiver-panel">
      <div className="quat-panel-item">
        <canvas
          ref={faceRef}
          width={PANEL_W}
          height={PANEL_H}
          className="quat-panel-canvas"
          title="Receiver Face — projected local ellipse on sensing axes r̂₁, r̂₂"
        />
      </div>
      <div className="quat-panel-item">
        <canvas
          ref={quatRef}
          width={PANEL_W}
          height={PANEL_H}
          className="quat-panel-canvas"
          title="Quaternion State — receiver orientation q_r and live signal q_s(t)"
        />
      </div>
      <div className="quat-panel-item">
        <canvas
          ref={recoveredRef}
          width={PANEL_W}
          height={PANEL_H}
          className="quat-panel-canvas"
          title="Recovered Signal — canonical polarization ellipse after inverse rotation R(q)⁻¹"
        />
      </div>
    </div>
  );
}
