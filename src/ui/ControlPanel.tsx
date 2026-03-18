import { SignalParams, PolarizationMode } from '../math/signal';
import { SweepMode } from './PresetBar';

interface ControlPanelProps {
  params: SignalParams;
  animSpeed: number;
  showClassicalSplit: boolean;
  showProjectionPlanes: boolean;
  sweepMode: SweepMode;
  onParamsChange: (p: Partial<SignalParams>) => void;
  onAnimSpeedChange: (v: number) => void;
  onShowClassicalSplitChange: (v: boolean) => void;
  onShowProjectionPlanesChange: (v: boolean) => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, disabled = false, onChange }: SliderProps) {
  return (
    <div className={`slider-row ${disabled ? 'disabled' : ''}`}>
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span>{value.toFixed(2)}</span>
    </div>
  );
}

export function ControlPanel({
  params,
  animSpeed,
  showClassicalSplit,
  showProjectionPlanes,
  sweepMode,
  onParamsChange,
  onAnimSpeedChange,
  onShowClassicalSplitChange,
  onShowProjectionPlanesChange,
}: ControlPanelProps) {
  const orientationLocked = sweepMode === 'phase-only' || sweepMode === 'geometry-only';
  const phaseLocked = sweepMode === 'geometry-only';

  return (
    <div className="control-panel">
      <div className="control-section">
        <h4>Geometric State — Signal Parameters</h4>
        <Slider label="Amplitude" value={params.amplitude} min={0.1} max={1.0} step={0.01} onChange={(v) => onParamsChange({ amplitude: v })} />
        <Slider
          label="Phase Evolution"
          value={animSpeed}
          min={0}
          max={3}
          step={0.05}
          disabled={phaseLocked}
          onChange={onAnimSpeedChange}
        />
        <Slider label="Frequency / Rate" value={params.frequency} min={0.1} max={5.0} step={0.1} onChange={(v) => onParamsChange({ frequency: v })} />
        <Slider label="Polarization Ellipticity" value={params.ellipticity} min={0} max={1} step={0.01} onChange={(v) => onParamsChange({ ellipticity: v })} />
      </div>

      {params.demoMode === 'quaternionic' && (
        <div className="control-section">
          <h4>Quaternionic Orientation{orientationLocked ? ' — auto-swept' : ''}</h4>
          <Slider
            label="Q. Orientation X"
            value={params.orientationX}
            min={-1}
            max={1}
            step={0.01}
            disabled={orientationLocked}
            onChange={(v) => onParamsChange({ orientationX: v })}
          />
          <Slider
            label="Q. Orientation Y"
            value={params.orientationY}
            min={-1}
            max={1}
            step={0.01}
            disabled={orientationLocked}
            onChange={(v) => onParamsChange({ orientationY: v })}
          />
          <Slider
            label="Q. Orientation Z"
            value={params.orientationZ}
            min={-1}
            max={1}
            step={0.01}
            disabled={orientationLocked}
            onChange={(v) => onParamsChange({ orientationZ: v })}
          />
          <div className="slider-row">
            <label>Classical Split</label>
            <button
              className={`toggle-btn ${showClassicalSplit ? 'active' : ''}`}
              onClick={() => onShowClassicalSplitChange(!showClassicalSplit)}
            >
              {showClassicalSplit ? 'Split ON' : 'Show Classical Split'}
            </button>
          </div>
        </div>
      )}

      {params.demoMode === 'polarized' && (
        <div className="control-section">
          <h4>Polarization Geometry</h4>
          <div className="slider-row">
            <label>Mode</label>
            <select
              value={params.polarization}
              onChange={(e) => onParamsChange({ polarization: e.target.value as PolarizationMode })}
            >
              <option value="linear">Linear</option>
              <option value="circular">Circular</option>
              <option value="elliptical">Elliptical</option>
            </select>
          </div>
        </div>
      )}

      <div className="control-section">
        <h4>View Options</h4>
        <div className="slider-row">
          <label>Projection Planes</label>
          <button
            className={`toggle-btn ${showProjectionPlanes ? 'active' : ''}`}
            onClick={() => onShowProjectionPlanesChange(!showProjectionPlanes)}
            title="Show XY and XZ projections — classical views are slices of the full geometric state"
          >
            {showProjectionPlanes ? 'Planes ON' : 'Show Projections'}
          </button>
        </div>
      </div>
    </div>
  );
}
