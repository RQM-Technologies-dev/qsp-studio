/**
 * QuaternionicModemDemo.tsx
 *
 * Quaternionic Modem visualizer — the bridge from "receiver measuring a wave"
 * to "receiver recovering a symbol despite rotation."
 *
 * Visual story:
 *   world wave  →  rotated receiver frame  →  quaternion alignment  →  recovered symbol
 *
 * Three ellipses are always visible:
 *   Amber  — world truth (transmitted polarization symbol, invariant under rotation)
 *   Cyan   — measured    (projection onto the rotating receiver plane)
 *   Green  — recovered   (symbol after inverse quaternion alignment)
 *
 * The receiver continuously tumbles (yaw + pitch + roll composition) so the measured
 * ellipse deforms while the recovered ellipse stays stable in the canonical frame —
 * the core commercial statement of the Quaternionic Modem.
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { Mesh } from 'three';

import { SignalParams } from '../math/signal';
import {
  Quat,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
} from '../math/quaternion';
import {
  PolarizationSymbol,
  MODEM_SYMBOLS,
  evaluateField,
  quaternionToBasis,
  projectFieldToReceiver,
  recoverToCanonical,
  sampleWorldEllipse,
  sampleMeasuredEllipseLocal,
  sampleRecoveredEllipse,
  computeConfidence,
  classifyRecoveredSymbol,
} from '../math/modemPolarization';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Number of parametric sample points for each ellipse. */
const ELLIPSE_N = 64;

/** Seconds each polarization symbol is displayed before switching. */
const SYMBOL_DWELL = 4.0;

/** Confidence threshold above which "LOCK" is considered acquired. */
const CONF_THRESHOLD = 0.62;

/** Receiver yaw accumulation rate (radians per second). */
const YAW_RATE = 0.22;

/**
 * HUD metrics are recomputed once every this many frames.
 * At 60 fps, 6 frames ≈ 10 Hz — enough for smooth readout without
 * flooding the React scheduler with frequent state updates.
 */
const HUD_UPDATE_INTERVAL = 6;

/** Arrow length as a multiple of amplitude. */
const AXIS_SCALE = 1.3;

/** Radius of the live-dot spheres. */
const DOT_RADIUS = 0.045;

// ── Receiver body sub-components ─────────────────────────────────────────────

/** Gold icosahedron + sensing-plane ring at the receiver origin. */
function ReceiverBody({ amplitude, opacity }: { amplitude: number; opacity: number }) {
  const bodyRef = useRef<Mesh>(null);
  const scale = amplitude * 0.17;

  const N = 48;
  const r = amplitude * 0.52;
  const ringPts: [number, number, number][] = Array.from({ length: N + 1 }, (_, i) => {
    const a = (i / N) * 2 * Math.PI;
    return [0, r * Math.cos(a), r * Math.sin(a)] as [number, number, number];
  });

  return (
    <group>
      <mesh ref={bodyRef} scale={[scale, scale, scale]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.7}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Sensing-plane indicator ring in local YZ-plane */}
      <Line
        points={ringPts}
        color="#f59e0b"
        lineWidth={0.8}
        transparent
        opacity={0.22 * opacity}
      />
    </group>
  );
}

/**
 * Dual-pole sensing axes rendered in receiver-local coordinates.
 *   r1  — amber, I-channel (+Y local)
 *   r2  — purple, Q-channel (+Z local)
 *   n   — blue-green, propagation direction (+X local, shorter)
 */
function ReceiverAxes({ amplitude, opacity }: { amplitude: number; opacity: number }) {
  const len  = amplitude * AXIS_SCALE;
  const nLen = len * 0.45;

  const r1pts: [number, number, number][] = [[0, 0, 0], [0, len, 0]];
  const r2pts: [number, number, number][] = [[0, 0, 0], [0, 0, len]];
  const npts:  [number, number, number][] = [[0, 0, 0], [nLen, 0, 0]];

  return (
    <group>
      <Line points={r1pts} color="#f59e0b" lineWidth={3.0} transparent opacity={0.90 * opacity} />
      <mesh position={[0, len, 0]}>
        <coneGeometry args={[0.032, 0.11, 8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} transparent opacity={opacity} />
      </mesh>

      <Line points={r2pts} color="#8b5cf6" lineWidth={3.0} transparent opacity={0.90 * opacity} />
      <mesh position={[0, 0, len]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.032, 0.11, 8]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={2} transparent opacity={opacity} />
      </mesh>

      <Line points={npts} color="#22d3ee" lineWidth={1.2} transparent opacity={0.30 * opacity} />
    </group>
  );
}

/**
 * Compact HUD overlay rendered as HTML inside the Canvas via drei's Html.
 * Displays TX symbol name, decoded RX symbol, lock status and confidence.
 */
function ModemHud({
  txSymbol,
  rxSymbol,
  confidence,
  lock,
}: {
  txSymbol: PolarizationSymbol;
  rxSymbol: PolarizationSymbol;
  confidence: number;
  lock: boolean;
}) {
  const pct   = Math.round(confidence * 100);
  const match = txSymbol.name === rxSymbol.name;
  const barColor = confidence > 0.75 ? '#4ade80' : confidence > 0.50 ? '#facc15' : '#f87171';

  return (
    <Html fullscreen zIndexRange={[10, 10]} style={{ pointerEvents: 'none' }}>
      <div className="modem-hud">
        <div className="modem-hud-title">Quaternionic Modem</div>

        <div className="modem-hud-row">
          <span className="modem-hud-label">TX</span>
          <span className="modem-hud-value modem-hud-tx">{txSymbol.name}</span>
        </div>

        <div className="modem-hud-row">
          <span className="modem-hud-label">RX</span>
          <span className={`modem-hud-value ${match ? 'modem-hud-match' : 'modem-hud-mismatch'}`}>
            {rxSymbol.name}
          </span>
        </div>

        <div className="modem-hud-row">
          <span className="modem-hud-label">LOCK</span>
          <span className={`modem-hud-value ${lock ? 'modem-hud-lock-on' : 'modem-hud-lock-off'}`}>
            {lock ? '\u2713 LOCKED' : '\u2717 SEEKING'}
          </span>
        </div>

        <div className="modem-hud-row">
          <span className="modem-hud-label">CONF</span>
          <span className="modem-hud-value" style={{ color: barColor }}>
            {pct}%
          </span>
        </div>

        <div className="modem-hud-bar-track">
          <div
            className="modem-hud-bar-fill"
            style={{ width: `${pct}%`, background: barColor }}
          />
        </div>

        <div className="modem-hud-legend">
          <span className="modem-hud-dot" style={{ background: '#f59e0b' }} />
          <span>TX truth</span>
          <span className="modem-hud-dot" style={{ background: '#00d4ff' }} />
          <span>Measured</span>
          <span className="modem-hud-dot" style={{ background: '#4ade80' }} />
          <span>Recovered</span>
        </div>
      </div>
    </Html>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface QuaternionicModemDemoProps {
  params: SignalParams;
  currentTime: number;
  /** Opacity multiplier [0, 1] used during mode-morph fade transitions. */
  opacity?: number;
}

/**
 * QuaternionicModemDemo — full modem visualization in a single self-animating
 * Three.js group.  Insert directly into an R3F Canvas (wrapped by MainScene).
 */
export function QuaternionicModemDemo({
  params,
  currentTime,
  opacity = 1,
}: QuaternionicModemDemoProps) {
  const { amplitude, frequency, phase } = params;

  // ── Animation refs — mutated every frame without triggering re-renders ────
  const symbolIdxRef   = useRef(0);
  const symbolTimerRef = useRef(0);
  const yawRef         = useRef(0);
  const qRef           = useRef<Quat>([1, 0, 0, 0]);
  const hudTickRef     = useRef(0);

  // ── React state — drives 3D ellipses (every frame) and HUD (~10 Hz) ──────
  const [txSymbol,   setTxSymbol]   = useState<PolarizationSymbol>(MODEM_SYMBOLS[0]);
  const [rxSymbol,   setRxSymbol]   = useState<PolarizationSymbol>(MODEM_SYMBOLS[0]);
  const [confidence, setConfidence] = useState(1.0);
  // Stored as [w, x, y, z]; converted to Three.js [x, y, z, w] for the group prop
  const [receiverQ,  setReceiverQ]  = useState<Quat>([1, 0, 0, 0]);

  // ── Per-frame animation loop ──────────────────────────────────────────────
  useFrame((_, delta) => {
    // 1. Symbol stream
    symbolTimerRef.current += delta;
    if (symbolTimerRef.current >= SYMBOL_DWELL) {
      symbolTimerRef.current -= SYMBOL_DWELL;
      symbolIdxRef.current = (symbolIdxRef.current + 1) % MODEM_SYMBOLS.length;
      setTxSymbol(MODEM_SYMBOLS[symbolIdxRef.current]);
    }

    // 2. Receiver quaternion — smooth multi-axis tumble, gimbal-lock free
    yawRef.current += delta * YAW_RATE;
    const yaw   = yawRef.current;
    const pitch = Math.sin(yaw * 0.67) * 0.72;
    const roll  = Math.cos(yaw * 0.43) * 0.48;

    const qYaw   = quatFromAxisAngle([0, 1, 0], yaw);
    const qPitch = quatFromAxisAngle([1, 0, 0], pitch);
    const qRoll  = quatFromAxisAngle([0, 0, 1], roll);
    qRef.current = quatNormalize(quatMultiply(quatMultiply(qYaw, qPitch), qRoll));
    setReceiverQ([...qRef.current] as Quat);

    // 3. Modem metrics — update HUD at ~10 Hz
    hudTickRef.current++;
    if (hudTickRef.current % HUD_UPDATE_INTERVAL === 0) {
      const sym = MODEM_SYMBOLS[symbolIdxRef.current];
      const { r1, r2 } = quaternionToBasis(qRef.current);
      const conf = computeConfidence(ELLIPSE_N, sym.Ay, sym.Az, sym.delta, r1, r2);
      const recovered = classifyRecoveredSymbol(
        ELLIPSE_N, sym.Ay, sym.Az, sym.delta, qRef.current, r1, r2,
      );
      setConfidence(conf);
      setRxSymbol(recovered);
    }
  });

  // ── Derived rendering state ───────────────────────────────────────────────

  const sym = txSymbol;
  const { r1, r2 } = quaternionToBasis(receiverQ);

  // World truth ellipse — fixed in the world YZ-plane
  const worldPts = sampleWorldEllipse(ELLIPSE_N, sym.Ay * amplitude, sym.Az * amplitude, sym.delta)
    .map(p => p as [number, number, number]);

  // Measured ellipse in receiver-LOCAL coordinates [0, v1, v2]
  // Placed inside the rotation group → appears as v1·r1 + v2·r2 in world space
  const measuredPts = sampleMeasuredEllipseLocal(
    ELLIPSE_N, sym.Ay * amplitude, sym.Az * amplitude, sym.delta, r1, r2,
  ).map(p => p as [number, number, number]);

  // Recovered ellipse in canonical world YZ-plane after inverse quaternion alignment
  const recoveredPts = sampleRecoveredEllipse(
    ELLIPSE_N, sym.Ay * amplitude, sym.Az * amplitude, sym.delta, receiverQ, r1, r2,
  ).map(p => p as [number, number, number]);

  // Live dot positions at the current carrier phase θ
  const theta = 2 * Math.PI * frequency * currentTime + phase;
  const worldDot = evaluateField(
    theta, sym.Ay * amplitude, sym.Az * amplitude, sym.delta,
  ) as [number, number, number];
  const { v1, v2, E_proj_world } = projectFieldToReceiver(worldDot, r1, r2);
  const recDot = recoverToCanonical(E_proj_world, receiverQ) as [number, number, number];

  // Confidence-driven visual weight
  const measWidth   = 0.8 + 2.2 * confidence;
  const measOpacity = (0.25 + 0.75 * confidence) * opacity;
  const recWidth    = 0.8 + 2.0 * confidence;
  const recOpacity  = (0.20 + 0.80 * confidence) * opacity;

  // Convert receiver quaternion [w, x, y, z] → Three.js group quaternion [x, y, z, w]
  const [qw, qx, qy, qz] = receiverQ;
  const lock = confidence >= CONF_THRESHOLD;

  return (
    <group>
      {/* ── 1. World truth ellipse (amber) — invariant polarization symbol ───── */}
      {/* Fixed in the world YZ-plane; does NOT rotate with the receiver.         */}
      {worldPts.length >= 2 && (
        <Line
          points={worldPts}
          color="#f59e0b"
          lineWidth={2.2}
          transparent
          opacity={0.70 * opacity}
        />
      )}

      {/* Live amber dot — tracks wave front at the current carrier phase */}
      <mesh position={worldDot}>
        <sphereGeometry args={[DOT_RADIUS, 8, 8]} />
        <meshStandardMaterial
          color="#f59e0b"
          emissive="#fbbf24"
          emissiveIntensity={3}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* ── 2. Receiver rotation group — axes + measured ellipse tumble together ── */}
      {/* Three.js group.quaternion: [x, y, z, w]                                   */}
      <group quaternion={[qx, qy, qz, qw]}>

        {/* Gold dual-pole receiver body */}
        <ReceiverBody amplitude={amplitude} opacity={opacity} />

        {/* Sensing axes: r1 amber (I-ch), r2 purple (Q-ch), n blue-green (fwd) */}
        <ReceiverAxes amplitude={amplitude} opacity={opacity} />

        {/* Cyan measured ellipse — drawn as [0, v1, v2] in local frame.         */}
        {/* The rotation group maps this to v1·r1 + v2·r2 in world space.        */}
        {measuredPts.length >= 2 && (
          <Line
            points={measuredPts}
            color="#00d4ff"
            lineWidth={measWidth}
            transparent
            opacity={measOpacity}
          />
        )}

        {/* Live cyan dot at current carrier phase — in receiver-local coords */}
        <mesh position={[0, v1, v2]}>
          <sphereGeometry args={[DOT_RADIUS, 8, 8]} />
          <meshStandardMaterial
            color="#00d4ff"
            emissive="#00d4ff"
            emissiveIntensity={2}
            transparent
            opacity={Math.max(0.10, confidence) * opacity}
          />
        </mesh>
      </group>

      {/* ── 3. Recovered ellipse (green) — canonical world YZ-plane ─────────── */}
      {/* R(q)^{-1} · E_proj_world — matches amber when lock is good.            */}
      {recoveredPts.length >= 2 && (
        <Line
          points={recoveredPts}
          color="#4ade80"
          lineWidth={recWidth}
          transparent
          opacity={recOpacity}
        />
      )}

      {/* Live green dot on the recovered ellipse */}
      <mesh position={recDot}>
        <sphereGeometry args={[DOT_RADIUS, 8, 8]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#4ade80"
          emissiveIntensity={2.5}
          transparent
          opacity={Math.max(0.15, confidence) * opacity}
        />
      </mesh>

      {/* ── 4. Compact modem HUD overlay ─────────────────────────────────────── */}
      <ModemHud
        txSymbol={txSymbol}
        rxSymbol={rxSymbol}
        confidence={confidence}
        lock={lock}
      />
    </group>
  );
}
