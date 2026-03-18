import { SignalParams, PolarizationMode } from '../math/signal';

interface ControlPanelProps {
  params: SignalParams;
  animSpeed: number;
  showClassicalSplit: boolean;
  onParamsChange: (p: Partial<SignalParams>) => void;
  onAnimSpeedChange: (v: number) => void;
  onShowClassicalSplitChange: (v: boolean) => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="slider-row">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
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
  onParamsChange,
  onAnimSpeedChange,
  onShowClassicalSplitChange,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      <h4>Geometric State — Signal Parameters</h4>
      <Slider label="Amplitude" value={params.amplitude} min={0.1} max={1.0} step={0.01} onChange={(v) => onParamsChange({ amplitude: v })} />
      <Slider label="Phase Evolution" value={animSpeed} min={0} max={3} step={0.05} onChange={onAnimSpeedChange} />
      <Slider label="Frequency / Rate" value={params.frequency} min={0.1} max={5.0} step={0.1} onChange={(v) => onParamsChange({ frequency: v })} />
      <Slider label="Polarization Ellipticity" value={params.ellipticity} min={0} max={1} step={0.01} onChange={(v) => onParamsChange({ ellipticity: v })} />

      {params.demoMode === 'quaternionic' && (
        <>
          <Slider label="Q. Orientation X" value={params.orientationX} min={-1} max={1} step={0.01} onChange={(v) => onParamsChange({ orientationX: v })} />
          <Slider label="Q. Orientation Y" value={params.orientationY} min={-1} max={1} step={0.01} onChange={(v) => onParamsChange({ orientationY: v })} />
          <Slider label="Q. Orientation Z" value={params.orientationZ} min={-1} max={1} step={0.01} onChange={(v) => onParamsChange({ orientationZ: v })} />
          <div className="slider-row">
            <label>Classical Split</label>
            <button
              className={`toggle-btn ${showClassicalSplit ? 'active' : ''}`}
              onClick={() => onShowClassicalSplitChange(!showClassicalSplit)}
            >
              {showClassicalSplit ? 'Split ON' : 'Show Classical Split'}
            </button>
          </div>
        </>
      )}

      {params.demoMode === 'polarized' && (
        <div className="slider-row">
          <label>Polarization Geometry</label>
          <select
            value={params.polarization}
            onChange={(e) => onParamsChange({ polarization: e.target.value as PolarizationMode })}
          >
            <option value="linear">Linear</option>
            <option value="circular">Circular</option>
            <option value="elliptical">Elliptical</option>
          </select>
        </div>
      )}
    </div>
  );
}
