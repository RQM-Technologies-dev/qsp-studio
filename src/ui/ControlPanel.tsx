import { SignalParams, PolarizationMode, DemoMode } from '../math/signal';
import { SweepMode } from './PresetBar';

interface ControlPanelProps {
  params: SignalParams;
  animSpeed: number;
  showClassicalSplit: boolean;
  showProjectionPlanes: boolean;
  showBasis: boolean;
  showTrailHistory: boolean;
  showFiber: boolean;
  showLocalFrame: boolean;
  showSpectrumPanel: boolean;
  showProjectionShadow: boolean;
  showIncomingWave: boolean;
  receiverYaw: number;
  receiverPitch: number;
  sweepMode: SweepMode;
  // ── Modem layer toggles (quaternionic mode) ─────────────────────────────
  showModemGimbalRings: boolean;
  showModemMeasuredEllipse: boolean;
  showModemRecoveredEllipse: boolean;
  showModemHud: boolean;
  onParamsChange: (p: Partial<SignalParams>) => void;
  onAnimSpeedChange: (v: number) => void;
  onShowClassicalSplitChange: (v: boolean) => void;
  onShowProjectionPlanesChange: (v: boolean) => void;
  onShowBasisChange: (v: boolean) => void;
  onShowTrailHistoryChange: (v: boolean) => void;
  onShowFiberChange: (v: boolean) => void;
  onShowLocalFrameChange: (v: boolean) => void;
  onShowSpectrumPanelChange: (v: boolean) => void;
  onShowProjectionShadowChange: (v: boolean) => void;
  onShowIncomingWaveChange: (v: boolean) => void;
  onReceiverYawChange: (v: number) => void;
  onReceiverPitchChange: (v: number) => void;
  onShowModemGimbalRingsChange: (v: boolean) => void;
  onShowModemMeasuredEllipseChange: (v: boolean) => void;
  onShowModemRecoveredEllipseChange: (v: boolean) => void;
  onShowModemHudChange: (v: boolean) => void;
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

interface LayerToggleProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  title?: string;
}

function LayerToggle({ label, active, onToggle, title }: LayerToggleProps) {
  return (
    <div className="slider-row">
      <label>{label}</label>
      <button
        className={`toggle-btn ${active ? 'active' : ''}`}
        onClick={onToggle}
        title={title}
      >
        {active ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

/** Compact grid-cell button used in the 4×2 layers grid. */
function LayerGridBtn({ label, active, onToggle, title }: LayerToggleProps) {
  return (
    <button
      className={`layer-grid-btn ${active ? 'active' : ''}`}
      onClick={onToggle}
      title={title}
    >
      {label}
    </button>
  );
}

/** Labels shown per mode in the basis toggle tooltip. */
const BASIS_TITLES: Record<DemoMode, string> = {
  complex:      'Show Re/Im projection lines onto the real and imaginary axes',
  polarized:    'Show the polarization frame: major axis a, minor axis b, normal n̂',
  quaternionic: 'Show the polarization frame axes (not available in this mode)',
};

export function ControlPanel({
  params,
  animSpeed,
  showClassicalSplit,
  showProjectionPlanes,
  showBasis,
  showTrailHistory,
  showSpectrumPanel,
  showIncomingWave,
  receiverYaw,
  receiverPitch,
  sweepMode,
  showModemGimbalRings,
  showModemMeasuredEllipse,
  showModemRecoveredEllipse,
  showModemHud,
  onParamsChange,
  onAnimSpeedChange,
  onShowClassicalSplitChange,
  onShowProjectionPlanesChange,
  onShowBasisChange,
  onShowTrailHistoryChange,
  onShowSpectrumPanelChange,
  onShowIncomingWaveChange,
  onReceiverYawChange,
  onReceiverPitchChange,
  onShowModemGimbalRingsChange,
  onShowModemMeasuredEllipseChange,
  onShowModemRecoveredEllipseChange,
  onShowModemHudChange,
}: ControlPanelProps) {
  const orientationLocked = sweepMode === 'phase-only' || sweepMode === 'geometry-only';
  const phaseLocked = sweepMode === 'geometry-only';

  return (
    <div className="control-panel">
      {/* ── Signal parameters ── */}
      <div className="control-section">
        <h4>Signal Parameters</h4>
        <Slider label="Amplitude" value={params.amplitude} min={0.1} max={1.0} step={0.01} onChange={(v) => onParamsChange({ amplitude: v })} />
        <Slider
          label="Phase Speed"
          value={animSpeed}
          min={0}
          max={3}
          step={0.05}
          disabled={phaseLocked}
          onChange={onAnimSpeedChange}
        />
        <Slider label="Frequency" value={params.frequency} min={0.1} max={5.0} step={0.1} onChange={(v) => onParamsChange({ frequency: v })} />
        <Slider label="Ellipticity" value={params.ellipticity} min={0} max={1} step={0.01} onChange={(v) => onParamsChange({ ellipticity: v })} />
      </div>

      {/* ── Mode-specific controls ── */}
      {params.demoMode === 'quaternionic' && (
        <div className="control-section">
          <h4>Quaternionic Orientation{orientationLocked ? ' — auto-swept' : ''}</h4>
          <Slider label="Axis X" value={params.orientationX} min={-1} max={1} step={0.01} disabled={orientationLocked} onChange={(v) => onParamsChange({ orientationX: v })} />
          <Slider label="Axis Y" value={params.orientationY} min={-1} max={1} step={0.01} disabled={orientationLocked} onChange={(v) => onParamsChange({ orientationY: v })} />
          <Slider label="Axis Z" value={params.orientationZ} min={-1} max={1} step={0.01} disabled={orientationLocked} onChange={(v) => onParamsChange({ orientationZ: v })} />
          <LayerToggle
            label="Classical Split"
            active={showClassicalSplit}
            onToggle={() => onShowClassicalSplitChange(!showClassicalSplit)}
            title="Show the classical 2D complex orbit as a ghost, so you can compare it to the quaternionic path"
          />
        </div>
      )}

      {params.demoMode === 'polarized' && (
        <div className="control-section">
          <h4>Polarization Type</h4>
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

      {/* ── Layer visibility — scene elements can be isolated for focused study ── */}
      <div className="control-section">
        <h4>Layers</h4>
        {params.demoMode === 'quaternionic' ? (
          /* Modem-specific 4×2 grid — one button per visual component */
          <div className="layers-grid">
            <LayerGridBtn
              label="Gimbal"
              active={showModemGimbalRings}
              onToggle={() => onShowModemGimbalRingsChange(!showModemGimbalRings)}
              title="Show the three gyroscopic gimbal rings (YZ / XZ / XY planes)"
            />
            <LayerGridBtn
              label="Measured"
              active={showModemMeasuredEllipse}
              onToggle={() => onShowModemMeasuredEllipseChange(!showModemMeasuredEllipse)}
              title="Show the cyan measured ellipse (receiver-local projection of transmitted signal)"
            />
            <LayerGridBtn
              label="Recovered"
              active={showModemRecoveredEllipse}
              onToggle={() => onShowModemRecoveredEllipseChange(!showModemRecoveredEllipse)}
              title="Show the green recovered ellipse (symbol after inverse quaternion alignment)"
            />
            <LayerGridBtn
              label="HUD"
              active={showModemHud}
              onToggle={() => onShowModemHudChange(!showModemHud)}
              title="Show the compact modem readout / status HUD"
            />
          </div>
        ) : (
          /* Non-modem modes: generic layer toggles in a 4×2 grid */
          <div className="layers-grid">
            <LayerGridBtn
              label="Basis"
              active={showBasis}
              onToggle={() => onShowBasisChange(!showBasis)}
              title={BASIS_TITLES[params.demoMode]}
            />
            {params.demoMode !== 'complex' ? (
              <LayerGridBtn
                label="Trail"
                active={showTrailHistory}
                onToggle={() => onShowTrailHistoryChange(!showTrailHistory)}
                title="Show the temporal trail / 3D helix path of the signal"
              />
            ) : <span />}
            <LayerGridBtn
              label="Projections"
              active={showProjectionPlanes}
              onToggle={() => onShowProjectionPlanesChange(!showProjectionPlanes)}
              title="Show XY and XZ projection planes — classical 2D slices of the full geometric state"
            />
            <LayerGridBtn
              label="Spectrum"
              active={showSpectrumPanel}
              onToggle={() => onShowSpectrumPanelChange(!showSpectrumPanel)}
              title="Show the coefficient / spectrum panel"
            />
            <LayerGridBtn
              label="Wave"
              active={showIncomingWave}
              onToggle={() => onShowIncomingWaveChange(!showIncomingWave)}
              title="Show the incoming electromagnetic wave arriving directly at the geometric representation"
            />
          </div>
        )}
      </div>

      {/* ── Sensing Frame Orientation — shown only when the incoming wave layer is active ── */}
      {showIncomingWave && (
        <div className="control-section">
          <h4>Sensing Frame Orientation</h4>
          <Slider
            label="Yaw (°)"
            value={Math.round(receiverYaw * (180 / Math.PI))}
            min={-90}
            max={90}
            step={1}
            onChange={(v) => onReceiverYawChange(v * (Math.PI / 180))}
          />
          <Slider
            label="Pitch (°)"
            value={Math.round(receiverPitch * (180 / Math.PI))}
            min={-90}
            max={90}
            step={1}
            onChange={(v) => onReceiverPitchChange(v * (Math.PI / 180))}
          />
        </div>
      )}
    </div>
  );
}
