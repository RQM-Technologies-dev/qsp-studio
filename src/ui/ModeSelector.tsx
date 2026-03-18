import { DemoMode } from '../math/signal';

interface ModeSelectorProps {
  mode: DemoMode;
  onChange: (mode: DemoMode) => void;
}

const modes: { key: DemoMode; label: string; color: string }[] = [
  { key: 'complex', label: 'Complex Signal', color: '#00d4ff' },
  { key: 'polarized', label: 'Polarized Signal', color: '#8b5cf6' },
  { key: 'quaternionic', label: 'Quaternionic Signal', color: '#f59e0b' },
];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      {modes.map(({ key, label, color }) => (
        <button
          key={key}
          className={`mode-btn ${mode === key ? 'active' : ''}`}
          style={{ '--accent': color } as React.CSSProperties}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
