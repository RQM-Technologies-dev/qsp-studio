import type { CSSProperties } from 'react';
import { DemoMode } from '../math/signal';

interface ModeSelectorProps {
  mode: DemoMode;
  onChange: (mode: DemoMode) => void;
}

// Note: 'quaternionic' mode is intentionally excluded from this navigation.
const modes: { key: DemoMode; label: string; sublabel: string; color: string }[] = [
  {
    key: 'complex',
    label: 'Classical I/Q',
    sublabel: 'I/Q phasor — planar EM signal rotation in the complex plane',
    color: '#00d4ff',
  },
  {
    key: 'polarized',
    label: 'Polarization',
    sublabel: 'EM wave polarization ellipse — spatial oscillation mode in 3D',
    color: '#8b5cf6',
  },
];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      {modes.map(({ key, label, sublabel, color }) => (
        <button
          key={key}
          className={`mode-btn ${mode === key ? 'active' : ''}`}
          style={{ '--accent': color } as CSSProperties}
          onClick={() => onChange(key)}
          title={sublabel}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
