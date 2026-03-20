/**
 * BlochSphere — 2D SVG Bloch sphere visualization
 *
 * Depicts the same quantum state as HypersphereVisualization but from the
 * standard Bloch sphere perspective. The sphere surface is shaded green at |0⟩
 * (North Pole) and blue at |1⟩ (South Pole) to match the hypersphere colors.
 */

import { useRef, useEffect } from 'react';
import type { QuantumState } from './HypersphereVisualization';

// Color palette matching HypersphereVisualization — declared outside component
// so they are stable references and don't cause exhaustive-deps warnings.
const BG = '#0b0e13';
const GREEN = { r: 34, g: 197, b: 94 };  // |0⟩
const BLUE  = { r: 37,  g: 99,  b: 235 }; // |1⟩

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function stateColor(bz: number): string {
  // bz ∈ [-1, 1]: +1 = North Pole (|0⟩, green), -1 = South Pole (|1⟩, blue)
  const t = (bz + 1) / 2; // 0 at South Pole, 1 at North Pole
  const r = Math.round(lerp(BLUE.r, GREEN.r, t));
  const g = Math.round(lerp(BLUE.g, GREEN.g, t));
  const b = Math.round(lerp(BLUE.b, GREEN.b, t));
  return `rgb(${r},${g},${b})`;
}

interface BlochSphereProps {
  width?: number;
  height?: number;
  state: QuantumState | null;
}

export function BlochSphere({ width = 260, height = 280, state }: BlochSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2 + 8;   // slightly below center to leave room for title
    const R  = Math.min(W, H) * 0.36;

    ctx.clearRect(0, 0, W, H);

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // ── Sphere body gradient ─────────────────────────────────────────────────
    const grad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
    grad.addColorStop(0, 'rgba(80,80,120,0.22)');
    grad.addColorStop(1, 'rgba(10,10,20,0.10)');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Equator (dashed) ─────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = 'rgba(150,200,255,0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ── Sphere outline ───────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,160,255,0.30)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Z-axis (vertical) ────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(100,160,255,0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - R - 18);
    ctx.lineTo(cx, cy + R + 18);
    ctx.stroke();

    // ── X-axis (horizontal) ─────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(100,160,255,0.25)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(cx - R - 14, cy);
    ctx.lineTo(cx + R + 14, cy);
    ctx.stroke();

    // ── Pole labels ──────────────────────────────────────────────────────────
    ctx.font = 'bold 13px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgb(${GREEN.r},${GREEN.g},${GREEN.b})`;
    ctx.fillText('|0⟩', cx, cy - R - 22);

    ctx.fillStyle = `rgb(${BLUE.r},${BLUE.g},${BLUE.b})`;
    ctx.fillText('|1⟩', cx, cy + R + 30);

    // ── Bloch vector ─────────────────────────────────────────────────────────
    if (state) {
      const { x: bx, y: by, z: bz } = state.blochVector;

      // Project 3D Bloch vector to 2D (isometric-ish projection)
      // Screen x = bx (horizontal), screen y = -bz (up), by goes slightly diagonal
      const sx = cx + R * (bx * 0.8 + by * 0.3);
      const sy = cy - R * bz;

      const color = stateColor(bz);

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      // Bloch vector arrow body
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(sy - cy, sx - cx);
      const headLen = 11;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - headLen * Math.cos(angle - 0.4), sy - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(sx - headLen * Math.cos(angle + 0.4), sy - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Dot at tip
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // ── Gate name & state readout ─────────────────────────────────────────
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(203,213,225,0.9)';
      const pct0 = (((bz + 1) / 2) * 100).toFixed(0);
      const pct1 = (100 - parseFloat(pct0)).toFixed(0);
      ctx.fillText(`Gate: ${state.gateName}`, 10, H - 36);
      ctx.fillStyle = `rgb(${GREEN.r},${GREEN.g},${GREEN.b})`;
      ctx.fillText(`|0⟩: ${pct0}%`, 10, H - 20);
      ctx.fillStyle = `rgb(${BLUE.r},${BLUE.g},${BLUE.b})`;
      ctx.fillText(`|1⟩: ${pct1}%`, 10 + (W / 2 - 10), H - 20);
    }

    // ── Title ────────────────────────────────────────────────────────────────
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(203,213,225,0.85)';
    ctx.fillText('Bloch Sphere', cx, 18);
  }, [state, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', borderRadius: '8px' }}
    />
  );
}
