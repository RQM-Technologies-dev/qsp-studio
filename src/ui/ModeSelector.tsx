import { DemoMode } from '../math/signal';

interface ModeSelectorProps {
  mode: DemoMode;
  onChange: (mode: DemoMode) => void;
}

const modes: { key: DemoMode; label: string; sublabel: string; color: string }[] = [
  { key: 'complex',       label: 'Classical Complex View',   sublabel: '2D phase reference',         color: '#00d4ff' },
  { key: 'polarized',     label: 'Polarization Geometry',    sublabel: 'tip trajectory in 2D',       color: '#8b5cf6' },
  { key: 'quaternionic',  label: 'Quaternionic Unified View', sublabel: 'one evolving geometric state', color: '#f59e0b' },
];

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      {modes.map(({ key, label, sublabel, color }) => (
        <button
          key={key}
          className={`mode-btn ${mode === key ? 'active' : ''}`}
          style={{ '--accent': color } as React.CSSProperties}
          onClick={() => onChange(key)}
          title={sublabel}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
