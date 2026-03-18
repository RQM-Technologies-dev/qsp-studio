import { SignalParams, DemoMode, PolarizationMode, defaultSignalParams } from '../math/signal';

export type SweepMode = 'none' | 'phase-only' | 'geometry-only';

interface CanonicalPreset {
  label: string;
  description: string;
  params: Partial<SignalParams> & { demoMode: DemoMode };
}

const CANONICAL_PRESETS: CanonicalPreset[] = [
  {
    label: 'Circular',
    description: 'Classical complex rotation in XY plane',
    params: {
      demoMode: 'complex',
      amplitude: 0.8,
      frequency: 1.0,
      ellipticity: 0.5,
      polarization: 'circular' as PolarizationMode,
    },
  },
  {
    label: 'Elliptical',
    description: 'Polarized elliptical tip trajectory',
    params: {
      demoMode: 'polarized',
      polarization: 'elliptical' as PolarizationMode,
      ellipticity: 0.35,
      amplitude: 0.8,
      frequency: 1.2,
    },
  },
  {
    label: 'Q. Spin',
    description: 'Full quaternionic precession — unified geometric state',
    params: {
      demoMode: 'quaternionic',
      orientationX: 0,
      orientationY: 0,
      orientationZ: 1,
      amplitude: 0.8,
      frequency: 1.0,
    },
  },
];

interface PresetBarProps {
  sweepMode: SweepMode;
  onSweepModeChange: (mode: SweepMode) => void;
  onApplyPreset: (params: Partial<SignalParams> & { demoMode: DemoMode }) => void;
}

export function PresetBar({ sweepMode, onSweepModeChange, onApplyPreset }: PresetBarProps) {
  const handleSweepToggle = (mode: SweepMode) => {
    // Toggle: clicking active mode goes back to 'none'
    onSweepModeChange(sweepMode === mode ? 'none' : mode);
  };

  const handlePreset = (preset: CanonicalPreset) => {
    // Applying a snap preset always clears sweep mode
    onSweepModeChange('none');
    onApplyPreset({ ...defaultSignalParams, ...preset.params });
  };

  return (
    <div className="preset-bar">
      <span className="preset-bar-label">Signal Design</span>

      <div className="preset-group">
        <span className="preset-group-label">Snap to</span>
        {CANONICAL_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="preset-btn"
            title={preset.description}
            onClick={() => handlePreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="preset-divider" />

      <div className="preset-group">
        <span className="preset-group-label">Sweep</span>
        <button
          className={`sweep-btn ${sweepMode === 'phase-only' ? 'active' : ''}`}
          title="Lock orientation axis, animate phase continuously"
          onClick={() => handleSweepToggle('phase-only')}
        >
          Lock Orient · Sweep Phase
        </button>
        <button
          className={`sweep-btn ${sweepMode === 'geometry-only' ? 'active' : ''}`}
          title="Hold phase fixed, slowly rotate the geometry axis"
          onClick={() => handleSweepToggle('geometry-only')}
        >
          Hold Phase · Rotate Geometry
        </button>
      </div>
    </div>
  );
}
