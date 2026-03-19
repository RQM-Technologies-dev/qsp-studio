import { DemoMode } from '../math/signal';

interface ReceptionMeterProps {
  /** Normalized coupling strength — 0 (no capture) to 1 (perfect alignment). */
  strength: number;
  demoMode: DemoMode;
}

/** Short encoding label per mode shown alongside the percentage. */
const MODE_LABEL: Record<DemoMode, string> = {
  complex:      'I/Q',
  polarized:    'POL',
  quaternionic: 'QAM',
};

/** Color grades from weak (red) through amber to strong (cyan). */
function strengthColor(s: number): string {
  if (s >= 0.65) return '#00d4ff';  // cyan   — good coupling
  if (s >= 0.35) return '#f59e0b';  // amber  — partial coupling
  return '#ef4444';                  // red    — weak / near null
}

/**
 * Compact reception-strength bar displayed near the receiver controls.
 *
 * Connects the dots for the user:
 *   Receiver orientation → coupling fraction → geometry amplitude
 *
 * Color-coded:
 *   cyan  (≥ 65%) — strong, well-aligned
 *   amber (35–64%) — partial, visible degradation
 *   red   (< 35%) — weak; geometry near-collapse
 */
export function ReceptionMeter({ strength, demoMode }: ReceptionMeterProps) {
  const pct = Math.round(Math.min(1, Math.max(0, strength)) * 100);
  const color = strengthColor(strength);

  // Qualitative label so the user gets the sense without needing to read the %
  const qualLabel =
    pct >= 65 ? 'Strong' :
    pct >= 35 ? 'Partial' :
                'Weak';

  return (
    <div className="reception-meter" title={`Field coupling: ${pct}% — ${qualLabel}`}>
      <span className="reception-meter-label">Field Coupling</span>
      <div className="reception-meter-bar-track">
        <div
          className="reception-meter-bar-fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="reception-meter-readout">
        <span className="reception-meter-value" style={{ color }}>{pct}%</span>
        <span className="reception-meter-qual" style={{ color }}>{qualLabel}</span>
        <span className="reception-meter-mode">{MODE_LABEL[demoMode]}</span>
      </div>
    </div>
  );
}
