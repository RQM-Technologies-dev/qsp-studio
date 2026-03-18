import { SignalParams } from '../math/signal';
import { SweepMode } from './PresetBar';

interface StatusStripProps {
  params: SignalParams;
  currentTime: number;
  animSpeed: number;
  sweepMode: SweepMode;
}

const SWEEP_LABELS: Record<SweepMode, string | null> = {
  none: null,
  'phase-only': 'LOCK ORIENT · SWEEP PHASE',
  'geometry-only': 'HOLD PHASE · ROTATE GEOMETRY',
};

/** Compact numerical readout — gives the app a scientific instrument feel. */
export function StatusStrip({ params, currentTime, animSpeed, sweepMode }: StatusStripProps) {
  const phaseRad = ((2 * Math.PI * params.frequency * currentTime) % (2 * Math.PI)).toFixed(2);
  const phaseDeg = (((2 * Math.PI * params.frequency * currentTime) % (2 * Math.PI)) * (180 / Math.PI)).toFixed(1);
  const sweepLabel = SWEEP_LABELS[sweepMode];

  return (
    <div className="status-strip">
      {sweepLabel && (
        <span className="status-item">
          <span className="status-label">Sweep</span>
          <span className="status-value status-sweep">{sweepLabel}</span>
        </span>
      )}
      <span className="status-item">
        <span className="status-label">Phase Evolution</span>
        <span className="status-value">{phaseRad} rad / {phaseDeg}°</span>
      </span>
      <span className="status-item">
        <span className="status-label">Amplitude</span>
        <span className="status-value">{params.amplitude.toFixed(2)}</span>
      </span>
      <span className="status-item">
        <span className="status-label">Frequency / Rate</span>
        <span className="status-value">{params.frequency.toFixed(1)} Hz</span>
      </span>
      {params.demoMode === 'quaternionic' && (
        <span className="status-item">
          <span className="status-label">Q. Orientation</span>
          <span className="status-value">
            ({params.orientationX.toFixed(2)}, {params.orientationY.toFixed(2)}, {params.orientationZ.toFixed(2)})
          </span>
        </span>
      )}
      {params.demoMode !== 'complex' && (
        <span className="status-item">
          <span className="status-label">Polarization Ellipticity</span>
          <span className="status-value">{params.ellipticity.toFixed(2)}</span>
        </span>
      )}
      <span className="status-item">
        <span className="status-label">Speed</span>
        <span className="status-value">{animSpeed.toFixed(2)}×</span>
      </span>
      <span className="status-item">
        <span className="status-label">Geometric State</span>
        <span className="status-value status-mode">{params.demoMode.toUpperCase()}</span>
      </span>
    </div>
  );
}
