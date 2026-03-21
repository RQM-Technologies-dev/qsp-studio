/**
 * QuaternionicModemDemo.tsx
 *
 * Quaternionic Modem visualizer — honest physics + honest failure modes.
 *
 * Visual story:
 *   world wave  →  rotated channel + receiver frame  →  quaternion alignment  →  recovered symbol
 *
 * Four visual layers:
 *   Amber  — world truth (transmitted polarization symbol, invariant under rotation)
 *   White  — canonical template ghost (ideal recovery target, faint behind green)
 *   Cyan   — measured  (projection onto the rotating receiver plane)
 *   Green  — recovered (symbol after inverse quaternion alignment)
 *
 * ── Recovery model — v1 (KNOWN q_eff) ───────────────────────────────────────
 * Recovery in this demo uses PERFECT KNOWLEDGE of the effective orientation:
 *   q_eff = q_channel × q_receiver
 *
 * Both quaternions are synthesised by the animation loop and passed directly
 * to the inversion stage — this is NOT adaptive estimation.  The recovered
 * ellipse degrades only with projection-energy loss (bad geometry), not with
 * orientation-estimation error.
 *
 * The next engineering milestone is to ESTIMATE q_eff from pilot symbols or
 * signal history, so the modem can operate without privileged orientation data.
 *
 * ── Pilot / Training mode ────────────────────────────────────────────────────
 * The symbol stream alternates between:
 *   PILOT phase  — a known calibration symbol (LIN_Y) is transmitted for a
 *                  short burst.  In a production system, the receiver would use
 *                  this to estimate q_eff.  Here it is labelled honestly.
 *   DATA phase   — normal data symbols decoded against the (known) q_eff.
 *                  Stats are accumulated only during the data phase.
 *
 * ── Jitter — estimation fragility, not a physical wave effect ────────────────
 * When confidence falls below CONF_WEAK, the recovered ellipse is rendered with
 * a time-varying perturbation.  This represents RECOVERY INSTABILITY caused by
 * low projection energy (underdetermined geometry) — NOT any physical jitter in
 * the EM wave.  The transmitted wave is always smooth and Maxwell-consistent.
 *
 * Honest failure modes:
 *   • At low confidence the recovered ellipse fades, collapses, and jitters
 *   • LOCK degrades: LOCKED → WEAK → UNLOCKED
 *   • RX decoded symbol becomes UNKNOWN when projection energy is insufficient
 *
 * Channel rotation:
 *   A separate slowly-drifting channel quaternion q_channel is composed with
 *   the receiver quaternion q_receiver to form q_eff = q_channel × q_receiver.
 *   The receiver senses through q_eff; recovery inverts q_eff.
 *   This demonstrates that the modem handles not only receiver tilt but also
 *   channel-induced polarization rotation.
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { Mesh } from 'three';

import { SignalParams } from '../math/signal';
import {
  Vec3,
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

/** Seconds each DATA polarization symbol is displayed before switching. */
const SYMBOL_DWELL = 4.0;

/** Seconds for each PILOT burst (shorter than data dwell). */
const PILOT_DWELL = 1.5;

/** Number of data symbols transmitted between pilot bursts. */
const DATA_PER_PILOT = 3;

/**
 * Index into MODEM_SYMBOLS used as the calibration / pilot symbol (LIN_Y).
 * A production receiver would observe this known symbol to estimate q_eff.
 */
const PILOT_SYMBOL_IDX = 0; // LIN_Y

/** Confidence ≥ this → LOCKED (green HUD). */
const CONF_LOCKED = 0.62;

/** Confidence ≥ this (but < LOCKED) → WEAK lock (yellow HUD, unreliable decode). */
const CONF_WEAK = 0.30;

/** Confidence < this → UNLOCKED, RX = UNKNOWN. */
const CONF_UNKNOWN = 0.18;

/** Receiver yaw accumulation rate (radians per second). */
const YAW_RATE = 0.22;

/** Channel quaternion precession rate (rad/s) — slower than receiver rotation. */
const CHANNEL_RATE = 0.07;

/**
 * Fixed rotation axis for the channel quaternion.
 * Exact normalization of [3, 1, 2]: magnitude = sqrt(14).
 *   [3/√14, 1/√14, 2/√14] ≈ [0.8018, 0.2673, 0.5345]
 * Different from all receiver rotation axes so channel adds independent distortion.
 */
const SQRT_14 = Math.sqrt(14);
const CHANNEL_AXIS: Vec3 = [3 / SQRT_14, 1 / SQRT_14, 2 / SQRT_14];

/**
 * Amplitude of jitter applied to each recovered-ellipse point when confidence is weak.
 *
 * CONCEPTUAL NOTE: jitter represents RECOVERY INSTABILITY (estimation fragility) —
 * the uncertainty in the recovered symbol shape when observation geometry is
 * underdetermined.  It is NOT a physical wave effect.
 */
const JITTER_AMP_SCALE = 0.18;

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

// ── Types ─────────────────────────────────────────────────────────────────────

type LockState = 'locked' | 'weak' | 'unlocked';

/** Current transmission phase: PILOT burst or DATA stream. */
type Phase = 'pilot' | 'data';

/**
 * Per-session modem statistics accumulated over data symbols only
 * (pilot bursts are excluded from the error counters).
 */
interface ModemStats {
  /** Total data symbols transmitted (excluding pilot bursts). */
  sent: number;
  /** Data symbols whose decoded name matched the transmitted name. */
  decoded: number;
  /** Data symbols decoded as UNKNOWN (projection energy too low). */
  unknowns: number;
  /** Data symbols decoded incorrectly (wrong name, but not UNKNOWN). */
  errors: number;
}

/**
 * Synthetic symbol representing an undecodable/unknown state.
 * Returned when projection energy is too low for reliable classification.
 */
const UNKNOWN_SYMBOL: PolarizationSymbol = { name: 'UNKNOWN', Ay: 0, Az: 0, delta: 0 };

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

// ── Helper: compute Symbol Error Rate % from modem stats ─────────────────────

/**
 * Returns the symbol error rate as a percentage integer [0, 100], or null
 * when no data symbols have been sent yet.
 *
 *   SER % = (errors + unknowns) / sent × 100
 */
function computeSER(stats: ModemStats): number | null {
  if (stats.sent === 0) return null;
  return Math.round((stats.errors + stats.unknowns) / stats.sent * 100);
}

/**
 * Compact HUD overlay rendered as HTML inside the Canvas via drei's Html.
 *
 * Lock states:
 *   LOCKED  — confidence ≥ CONF_LOCKED  (green)
 *   WEAK    — confidence ≥ CONF_WEAK    (yellow) — decode may be unreliable
 *   UNLOCKED— confidence < CONF_WEAK   (red)    — RX = UNKNOWN
 *
 * Phase:
 *   PILOT — known calibration burst; receiver would estimate q_eff here
 *   DATA  — data symbol decoding using (known) q_eff
 */
function ModemHud({
  txSymbol,
  rxSymbol,
  confidence,
  lockState,
  phase,
  stats,
  jitterActive,
}: {
  txSymbol: PolarizationSymbol;
  rxSymbol: PolarizationSymbol;
  confidence: number;
  lockState: LockState;
  phase: Phase;
  stats: ModemStats;
  jitterActive: boolean;
}) {
  const pct = Math.round(confidence * 100);
  const isUnknown = rxSymbol.name === 'UNKNOWN';
  const match = !isUnknown && txSymbol.name === rxSymbol.name;

  const barColor =
    lockState === 'locked'   ? '#4ade80' :
    lockState === 'weak'     ? '#facc15' :
    /* unlocked */             '#f87171';

  const lockLabel =
    lockState === 'locked'   ? '\u2713 LOCKED'   :
    lockState === 'weak'     ? '\u25b2 WEAK'     :
    /* unlocked */             '\u2717 UNLOCKED';

  const lockClass =
    lockState === 'locked'   ? 'modem-hud-lock-on'   :
    lockState === 'weak'     ? 'modem-hud-lock-weak' :
    /* unlocked */             'modem-hud-lock-off';

  const ser = computeSER(stats);
  const serColor = ser === null ? 'var(--text-dim)' : ser === 0 ? '#4ade80' : ser < 30 ? '#facc15' : '#f87171';

  return (
    <Html fullscreen zIndexRange={[10, 10]} style={{ pointerEvents: 'none' }}>
      <div className="modem-hud">
        <div className="modem-hud-title">Quaternionic Modem</div>

        {/* Phase indicator */}
        <div className="modem-hud-row">
          <span className="modem-hud-label">MODE</span>
          <span className={`modem-hud-value ${phase === 'pilot' ? 'modem-hud-phase-pilot' : 'modem-hud-phase-data'}`}>
            {phase === 'pilot' ? '\u25c6 PILOT' : '\u25b6 DATA'}
          </span>
        </div>

        <div className="modem-hud-row">
          <span className="modem-hud-label">TX</span>
          <span className="modem-hud-value modem-hud-tx">{txSymbol.name}</span>
        </div>

        <div className="modem-hud-row">
          <span className="modem-hud-label">RX</span>
          <span className={`modem-hud-value ${phase === 'pilot' ? 'modem-hud-phase-pilot' : isUnknown ? 'modem-hud-lock-off' : match ? 'modem-hud-match' : 'modem-hud-mismatch'}`}>
            {phase === 'pilot' ? 'CAL\u2026' : rxSymbol.name}
          </span>
        </div>

        <div className="modem-hud-row">
          <span className="modem-hud-label">LOCK</span>
          <span className={`modem-hud-value ${lockClass}`}>
            {lockLabel}
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

        {/* Threshold tick marks at CONF_WEAK and CONF_LOCKED positions */}
        <div className="modem-hud-thresh-guide">
          <span style={{ left: `${Math.round(CONF_WEAK * 100)}%` }} />
          <span style={{ left: `${Math.round(CONF_LOCKED * 100)}%` }} />
        </div>

        {/* Jitter warning — shown when recovery is unstable due to low energy */}
        {jitterActive && (
          <div className="modem-hud-unstable">
            &#9888; REC UNSTABLE
          </div>
        )}

        {/* ── Modem stats (data symbols only; pilot excluded) ── */}
        <div className="modem-hud-divider" />
        <div className="modem-hud-stats-title">LINK STATS</div>
        <div className="modem-hud-stats-grid">
          <span className="modem-hud-label">TX</span>
          <span className="modem-hud-value">{stats.sent}</span>
          <span className="modem-hud-label">OK</span>
          <span className="modem-hud-value modem-hud-match">{stats.decoded}</span>
          <span className="modem-hud-label">ERR</span>
          <span className="modem-hud-value modem-hud-mismatch">{stats.errors}</span>
          <span className="modem-hud-label">UNK</span>
          <span className="modem-hud-value modem-hud-lock-off">{stats.unknowns}</span>
          <span className="modem-hud-label">SER</span>
          <span className="modem-hud-value" style={{ color: serColor }}>
            {ser !== null ? `${ser}%` : '\u2014'}
          </span>
        </div>

        {/* Legend */}
        <div className="modem-hud-divider" />
        <div className="modem-hud-legend">
          <span className="modem-hud-dot" style={{ background: '#f59e0b' }} />
          <span>TX truth</span>
          <span className="modem-hud-dot" style={{ background: '#00d4ff' }} />
          <span>Measured</span>
          <span className="modem-hud-dot" style={{ background: '#4ade80' }} />
          <span>Recovered</span>
        </div>

        {/* Conceptual footnote — v1 uses known q_eff, not estimated */}
        <div className="modem-hud-note">q_eff: known (demo v1)</div>
      </div>
    </Html>
  );
}

// ── Helper: add confidence-proportional jitter to ellipse points ──────────────

/**
 * Apply a time-varying but deterministic per-point perturbation to ellipse points.
 *
 * CONCEPTUAL NOTE: This represents RECOVERY INSTABILITY (estimation fragility)
 * caused by low projection energy — the underdetermined observation geometry means
 * the recovered symbol shape is uncertain.  It does NOT model any physical jitter
 * in the electromagnetic wave, which remains perfectly smooth and transverse.
 *
 * @param pts - Input ellipse points
 * @param amplitude - Scene amplitude (sets jitter scale)
 * @param jitterFrac - [0, 1] fraction of max jitter (0 = no jitter)
 * @param currentTime - Used to make the instability time-varying
 */
function applyJitter(
  pts: [number, number, number][],
  amplitude: number,
  jitterFrac: number,
  currentTime: number,
): [number, number, number][] {
  if (jitterFrac < 0.001) return pts;
  const jAmp = jitterFrac * JITTER_AMP_SCALE * amplitude;
  return pts.map(([px, py, pz], i) => [
    px,
    py + jAmp * Math.sin(i * 13.7 + currentTime * 11.3),
    pz + jAmp * Math.cos(i * 7.9  + currentTime * 8.7),
  ]);
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
 *
 * Symbol stream:
 *   PILOT (LIN_Y, 1.5 s) → DATA × 3 (4 s each) → PILOT → …
 *
 * Recovery model: v1 — known q_eff (not estimated).
 * Jitter = estimation fragility, not a physical wave effect.
 */
export function QuaternionicModemDemo({
  params,
  currentTime,
  opacity = 1,
}: QuaternionicModemDemoProps) {
  const { amplitude, frequency, phase: signalPhase } = params;

  // ── Animation refs — mutated every frame without triggering re-renders ────
  const symbolIdxRef     = useRef(PILOT_SYMBOL_IDX);
  const symbolTimerRef   = useRef(0);
  const yawRef           = useRef(0);
  const qReceiverRef     = useRef<Quat>([1, 0, 0, 0]);
  const channelAngleRef  = useRef(0);
  const qChannelRef      = useRef<Quat>([1, 0, 0, 0]);
  const qEffRef          = useRef<Quat>([1, 0, 0, 0]);
  const hudTickRef       = useRef(0);

  // Phase-state refs
  const phaseRef         = useRef<Phase>('pilot');
  const dataCountRef     = useRef(0);   // data symbols sent in current cycle
  const nextDataIdxRef   = useRef(0);   // next data symbol index (advances across pilots)

  // Stats ref — mutated at symbol boundaries to avoid mid-frame state churn
  const statsRef  = useRef<ModemStats>({ sent: 0, decoded: 0, unknowns: 0, errors: 0 });
  // Last decoded RX symbol — used for stats counting at symbol boundary
  const lastRxRef = useRef<PolarizationSymbol>(MODEM_SYMBOLS[PILOT_SYMBOL_IDX]);

  // ── React state — drives 3D ellipses (every frame) and HUD (~10 Hz) ──────
  const [txSymbol,   setTxSymbol]   = useState<PolarizationSymbol>(MODEM_SYMBOLS[PILOT_SYMBOL_IDX]);
  const [rxSymbol,   setRxSymbol]   = useState<PolarizationSymbol>(MODEM_SYMBOLS[PILOT_SYMBOL_IDX]);
  const [confidence, setConfidence] = useState(1.0);
  const [lockState,  setLockState]  = useState<LockState>('locked');
  // Stored as [w, x, y, z]; converted to Three.js [x, y, z, w] for the group prop
  const [effectiveQ, setEffectiveQ] = useState<Quat>([1, 0, 0, 0]);
  const [txPhase,    setTxPhase]    = useState<Phase>('pilot');
  const [stats,      setStats]      = useState<ModemStats>({ sent: 0, decoded: 0, unknowns: 0, errors: 0 });

  // ── Per-frame animation loop ──────────────────────────────────────────────
  useFrame((_, delta) => {
    // 1. Symbol / phase stream
    symbolTimerRef.current += delta;
    const dwellTime = phaseRef.current === 'pilot' ? PILOT_DWELL : SYMBOL_DWELL;

    if (symbolTimerRef.current >= dwellTime) {
      symbolTimerRef.current -= dwellTime;

      if (phaseRef.current === 'pilot') {
        // Pilot burst complete → begin data phase
        phaseRef.current = 'data';
        dataCountRef.current = 0;
        symbolIdxRef.current = nextDataIdxRef.current;
        setTxPhase('data');
        setTxSymbol(MODEM_SYMBOLS[nextDataIdxRef.current]);
      } else {
        // Data symbol complete — count stats before advancing
        const tx = MODEM_SYMBOLS[symbolIdxRef.current];
        const rx = lastRxRef.current;
        statsRef.current.sent++;
        if (rx.name === 'UNKNOWN') {
          statsRef.current.unknowns++;
        } else if (rx.name !== tx.name) {
          statsRef.current.errors++;
        } else {
          statsRef.current.decoded++;
        }

        // Advance to next data symbol or return to pilot
        nextDataIdxRef.current = (nextDataIdxRef.current + 1) % MODEM_SYMBOLS.length;
        dataCountRef.current++;

        if (dataCountRef.current >= DATA_PER_PILOT) {
          // Data phase complete → return to pilot burst
          phaseRef.current = 'pilot';
          symbolIdxRef.current = PILOT_SYMBOL_IDX;
          setTxPhase('pilot');
          setTxSymbol(MODEM_SYMBOLS[PILOT_SYMBOL_IDX]);
        } else {
          // Next data symbol
          symbolIdxRef.current = nextDataIdxRef.current;
          setTxSymbol(MODEM_SYMBOLS[nextDataIdxRef.current]);
        }

        setStats({ ...statsRef.current });
      }
    }

    // 2. Receiver quaternion — smooth multi-axis tumble, gimbal-lock free
    yawRef.current += delta * YAW_RATE;
    const yaw   = yawRef.current;
    const pitch = Math.sin(yaw * 0.67) * 0.72;
    const roll  = Math.cos(yaw * 0.43) * 0.48;

    const qYaw   = quatFromAxisAngle([0, 1, 0], yaw);
    const qPitch = quatFromAxisAngle([1, 0, 0], pitch);
    const qRoll  = quatFromAxisAngle([0, 0, 1], roll);
    qReceiverRef.current = quatNormalize(quatMultiply(quatMultiply(qYaw, qPitch), qRoll));

    // 3. Channel quaternion — independent slow precession around a tilted axis
    //    Models channel-induced polarization rotation (e.g. waveguide birefringence).
    channelAngleRef.current += delta * CHANNEL_RATE;
    qChannelRef.current = quatNormalize(
      quatFromAxisAngle(CHANNEL_AXIS, channelAngleRef.current),
    );

    // 4. Effective quaternion: q_eff = q_channel × q_receiver
    //    Recovery inverts q_eff using PERFECT KNOWLEDGE (v1 demo — not estimated).
    qEffRef.current = quatNormalize(quatMultiply(qChannelRef.current, qReceiverRef.current));
    setEffectiveQ([...qEffRef.current] as Quat);

    // 5. Modem metrics — update HUD at ~10 Hz
    hudTickRef.current++;
    if (hudTickRef.current % HUD_UPDATE_INTERVAL === 0) {
      const sym = MODEM_SYMBOLS[symbolIdxRef.current];
      const { r1, r2 } = quaternionToBasis(qEffRef.current);
      const conf = computeConfidence(ELLIPSE_N, sym.Ay, sym.Az, sym.delta, r1, r2);

      const newLock: LockState =
        conf >= CONF_LOCKED ? 'locked' :
        conf >= CONF_WEAK   ? 'weak'   :
        /* below weak */      'unlocked';

      // Below CONF_UNKNOWN threshold the recovered symbol is unreliable — show UNKNOWN
      const recovered = conf >= CONF_UNKNOWN
        ? classifyRecoveredSymbol(ELLIPSE_N, sym.Ay, sym.Az, sym.delta, qEffRef.current, r1, r2)
        : UNKNOWN_SYMBOL;

      lastRxRef.current = recovered;
      setConfidence(conf);
      setLockState(newLock);
      setRxSymbol(recovered);
    }
  });

  // ── Derived rendering state ───────────────────────────────────────────────

  const sym = txSymbol;
  const { r1, r2 } = quaternionToBasis(effectiveQ);

  // World truth ellipse — fixed in the world YZ-plane
  const worldPts = sampleWorldEllipse(ELLIPSE_N, sym.Ay * amplitude, sym.Az * amplitude, sym.delta)
    .map(p => p as [number, number, number]);

  // Measured ellipse in receiver-LOCAL coordinates [0, v1, v2]
  // Placed inside the rotation group → appears as v1·r1 + v2·r2 in world space
  const measuredPts = sampleMeasuredEllipseLocal(
    ELLIPSE_N, sym.Ay * amplitude, sym.Az * amplitude, sym.delta, r1, r2,
  ).map(p => p as [number, number, number]);

  // Recovered ellipse in canonical world YZ-plane after inverse quaternion alignment.
  // Degrades with projection energy loss (geometry), not estimation error (v1 demo).
  const recoveredPtsRaw = sampleRecoveredEllipse(
    ELLIPSE_N, sym.Ay * amplitude, sym.Az * amplitude, sym.delta, effectiveQ, r1, r2,
  ).map(p => p as [number, number, number]);

  // Jitter fraction: 0 when confidence ≥ CONF_WEAK, increases below CONF_WEAK.
  // Represents estimation fragility, not physical wave instability.
  const jitterFrac = confidence < CONF_WEAK
    ? Math.min(1, (CONF_WEAK - confidence) / CONF_WEAK)
    : 0;
  const jitterActive = jitterFrac > 0.001;
  const recoveredPts = applyJitter(recoveredPtsRaw, amplitude, jitterFrac, currentTime);

  // Live dot positions at the current carrier phase θ
  const theta = 2 * Math.PI * frequency * currentTime + signalPhase;
  const worldDot = evaluateField(
    theta, sym.Ay * amplitude, sym.Az * amplitude, sym.delta,
  ) as [number, number, number];
  const { v1, v2, E_proj_world } = projectFieldToReceiver(worldDot, r1, r2);
  const recDot = recoverToCanonical(E_proj_world, effectiveQ) as [number, number, number];

  // Apply same jitter to live dot when confidence is low (estimation fragility)
  const recDotJittered: [number, number, number] = jitterActive ? [
    recDot[0],
    recDot[1] + jitterFrac * JITTER_AMP_SCALE * amplitude * Math.sin(currentTime * 11.3 + 99),
    recDot[2] + jitterFrac * JITTER_AMP_SCALE * amplitude * Math.cos(currentTime * 8.7  + 33),
  ] : recDot;

  // Confidence-driven visual weight for measured and recovered ellipses
  const measWidth   = 0.8 + 2.2 * confidence;
  const measOpacity = (0.25 + 0.75 * confidence) * opacity;
  const recWidth    = 0.8 + 2.0 * confidence;
  const recOpacity  = (0.12 + 0.88 * confidence) * opacity;

  // Convert effective quaternion [w, x, y, z] → Three.js group quaternion [x, y, z, w]
  const [qw, qx, qy, qz] = effectiveQ;

  return (
    <group>
      {/* ── 1. World truth ellipse (amber) — invariant polarization symbol ───── */}
      {/* Fixed in the world YZ-plane; does NOT rotate with receiver or channel.  */}
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

      {/* ── 2. Canonical template ghost (white) — ideal recovery target ────────── */}
      {/* Shows the ideal recovered shape behind the green ellipse.                */}
      {/* Both live in the canonical world YZ-plane; when lock is good they match. */}
      {worldPts.length >= 2 && (
        <Line
          points={worldPts}
          color="#e2e8f0"
          lineWidth={1.0}
          transparent
          opacity={0.18 * opacity}
        />
      )}

      {/* ── 3. Receiver rotation group — axes + measured ellipse tumble together ── */}
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

      {/* ── 4. Recovered ellipse (green) — canonical world YZ-plane ─────────── */}
      {/* R(q_eff)^{-1} · E_proj_world — matches amber when lock is good.        */}
      {/* Fades + jitters when confidence is low (estimation fragility, not       */}
      {/* physical wave noise).  The amplitude also collapses with projection     */}
      {/* energy loss — both effects are honest physics.                          */}
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
      <mesh position={recDotJittered}>
        <sphereGeometry args={[DOT_RADIUS, 8, 8]} />
        <meshStandardMaterial
          color="#4ade80"
          emissive="#4ade80"
          emissiveIntensity={2.5}
          transparent
          opacity={Math.max(0.08, confidence) * opacity}
        />
      </mesh>

      {/* ── 5. Compact modem HUD overlay ─────────────────────────────────────── */}
      <ModemHud
        txSymbol={txSymbol}
        rxSymbol={rxSymbol}
        confidence={confidence}
        lockState={lockState}
        phase={txPhase}
        stats={stats}
        jitterActive={jitterActive}
      />
    </group>
  );
}
