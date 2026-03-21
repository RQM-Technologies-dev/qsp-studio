import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { MainScene } from '../scenes/MainScene';
import { ControlPanel } from '../ui/ControlPanel';
import { ModeSelector } from '../ui/ModeSelector';
import { InfoOverlay } from '../ui/InfoOverlay';
import { StatusStrip } from '../ui/StatusStrip';
import { PresetBar, SweepMode } from '../ui/PresetBar';
import { SpectrumPanel } from '../ui/SpectrumPanel';
import { ReceptionMeter } from '../ui/ReceptionMeter';
import { SignalParams, defaultSignalParams, DemoMode } from '../math/signal';
import { SignalBuffer, sampleSignal, BUFFER_SIZE, SAMPLE_INTERVAL_MS } from '../math/signalBuffer';
import { computeSpectrum, SpectrumData } from '../math/dft';
import { computeCouplingStrength } from '../math/receiverBasis';

/** How long (in wall-clock seconds) a mode morph transition lasts. */
const MORPH_DURATION = 1.5;

/** How often (wall-clock ms) the DFT is re-computed. 10 Hz = 100 ms. */
const DFT_INTERVAL_MS = 100;

/** Exponential lerp speed for coupling strength smoothing (units/second). */
const COUPLING_LERP_SPEED = 6;

export default function App() {
  const [params, setParams] = useState<SignalParams>(defaultSignalParams);
  const [currentTime, setCurrentTime] = useState(0);
  const [animSpeed, setAnimSpeed] = useState(0.2);
  const [showClassicalSplit, setShowClassicalSplit] = useState(false);
  const [showProjectionPlanes, setShowProjectionPlanes] = useState(false);
  const [sweepMode, setSweepMode] = useState<SweepMode>('none');

  // ── Layer visibility toggles ────────────────────────────────────────────
  const [showBasis, setShowBasis] = useState(true);
  const [showTrailHistory, setShowTrailHistory] = useState(true);
  const [showFiber, setShowFiber] = useState(true);
  const [showLocalFrame, setShowLocalFrame] = useState(true);
  const [showSpectrumPanel, setShowSpectrumPanel] = useState(true);
  const [showProjectionShadow, setShowProjectionShadow] = useState(false);
  const [showIncomingWave, setShowIncomingWave] = useState(true);

  // ── Quaternionic Modem layer visibility toggles ─────────────────────────
  const [showModemGimbalRings,     setShowModemGimbalRings]     = useState(true);
  const [showModemMeasuredEllipse, setShowModemMeasuredEllipse] = useState(true);
  const [showModemRecoveredEllipse, setShowModemRecoveredEllipse] = useState(true);
  const [showModemHud,             setShowModemHud]             = useState(true);

  // ── Receiver orientation (yaw = Y-axis rotation, pitch = X-axis rotation) ─
  const [receiverYaw,   setReceiverYaw]   = useState(0);
  const [receiverPitch, setReceiverPitch] = useState(0);

  // ── Field coupling — smoothed scalar [0,1] that drives geometry amplitude ──
  // Raw coupling is computed from orientation + mode; then lerped in the RAF loop
  // to avoid jitter from rapid slider interaction.
  const [couplingStrength, setCouplingStrength] = useState(1.0);
  const couplingTargetRef  = useRef(1.0);   // updated on orientation/mode change
  const couplingSmoothedRef = useRef(1.0);  // lerped in RAF
  // Accessible inside setInterval closure without stale captures:
  const couplingSmoothedForSamplingRef = useRef(1.0);
  const showIncomingWaveRef = useRef(false);

  const [morphProgress, setMorphProgress] = useState(1);
  const [prevMode, setPrevMode] = useState<DemoMode>(defaultSignalParams.demoMode);
  const morphProgressRef = useRef(1);
  const isMorphingRef = useRef(false);

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const animSpeedRef = useRef(animSpeed);
  const sweepModeRef = useRef<SweepMode>('none');
  const geometryAngleRef = useRef(0);

  // ── Signal time ref (mirrors currentTime state, accessible in RAF) ──────
  const currentTimeRef = useRef(0);

  // ── Time-series buffer + DFT state ───────────────────────────────────────
  // params must be readable inside the RAF loop without stale closure issues
  const paramsRef = useRef<SignalParams>(defaultSignalParams);
  const signalBufferRef = useRef(new SignalBuffer(BUFFER_SIZE));
  const [spectrumData, setSpectrumData] = useState<SpectrumData | null>(null);

  useEffect(() => {
    animSpeedRef.current = animSpeed;
  }, [animSpeed]);

  useEffect(() => {
    sweepModeRef.current = sweepMode;
  }, [sweepMode]);

  // Keep paramsRef in sync so the RAF loop can read current params
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  // Keep showIncomingWaveRef in sync for use inside setInterval
  useEffect(() => {
    showIncomingWaveRef.current = showIncomingWave;
  }, [showIncomingWave]);

  // Recompute the raw coupling target whenever orientation, mode, or wave toggle changes
  useEffect(() => {
    couplingTargetRef.current = showIncomingWave
      ? computeCouplingStrength(receiverYaw, receiverPitch, params.demoMode)
      : 1.0;
  }, [receiverYaw, receiverPitch, params.demoMode, showIncomingWave]);

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    const mode = sweepModeRef.current;

    if (mode !== 'geometry-only') {
      // Mutate ref synchronously so the sampling setInterval (below) reads
      // the current signal time immediately, not the previous frame's value.
      currentTimeRef.current += dt * animSpeedRef.current;
      setCurrentTime(currentTimeRef.current);
    }

    if (mode === 'geometry-only') {
      geometryAngleRef.current += dt * 0.55;
      const a = geometryAngleRef.current;
      setParams((prev) => {
        const next = {
          ...prev,
          demoMode: 'quaternionic' as DemoMode,
          orientationX: Math.sin(a * 1.3) * 0.7,
          orientationY: Math.cos(a * 0.8) * 0.5,
          orientationZ: Math.cos(a),
        };
        paramsRef.current = next;
        return next;
      });
    }

    // ── Morph progress ────────────────────────────────────────────────────
    if (isMorphingRef.current) {
      morphProgressRef.current = Math.min(1, morphProgressRef.current + dt / MORPH_DURATION);
      setMorphProgress(morphProgressRef.current);
      if (morphProgressRef.current >= 1) {
        isMorphingRef.current = false;
      }
    }

    // ── Coupling strength smooth lerp ─────────────────────────────────────
    const prevCoupling = couplingSmoothedRef.current;
    const couplingDelta = (couplingTargetRef.current - prevCoupling) * Math.min(1, dt * COUPLING_LERP_SPEED);
    if (Math.abs(couplingDelta) > 0.0005) {
      couplingSmoothedRef.current = prevCoupling + couplingDelta;
      couplingSmoothedForSamplingRef.current = couplingSmoothedRef.current;
      setCouplingStrength(couplingSmoothedRef.current);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // ── Signal sampling — setInterval at SAMPLE_RATE_HZ ─────────────────────
  // Runs independently of the RAF so it fires at a consistent rate regardless
  // of browser throttling (e.g. in headless test environments).
  useEffect(() => {
    const id = setInterval(() => {
      // Scale the sampled amplitude by the current coupling so the spectrum
      // also responds to receiver misalignment.
      const coupling = showIncomingWaveRef.current
        ? couplingSmoothedForSamplingRef.current
        : 1.0;
      signalBufferRef.current.push(
        sampleSignal(
          coupling < 0.999
            ? { ...paramsRef.current, amplitude: paramsRef.current.amplitude * coupling }
            : paramsRef.current,
          currentTimeRef.current,
        ),
      );
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ── DFT update — setInterval at ~10 Hz ───────────────────────────────────
  // flushSync guarantees React commits this state update synchronously,
  // bypassing the MessageChannel scheduler that can stall in headless/throttled
  // environments. At 10 Hz the synchronous flush cost is negligible.
  useEffect(() => {
    const id = setInterval(() => {
      const samples = signalBufferRef.current.getAll();
      const result = computeSpectrum(samples, paramsRef.current.frequency);
      if (result !== null) {
        flushSync(() => setSpectrumData(result));
      }
    }, DFT_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const handleParamsChange = (partial: Partial<SignalParams>) => {
    setParams((prev) => ({ ...prev, ...partial }));
  };

  const handleModeChange = (mode: DemoMode) => {
    setPrevMode(params.demoMode);
    morphProgressRef.current = 0;
    isMorphingRef.current = true;
    setMorphProgress(0);
    setParams((prev) => ({ ...prev, demoMode: mode }));
    if (mode !== 'quaternionic') setShowClassicalSplit(false);
    setSweepMode('none');
    // Clear buffer on mode change so the DFT reflects only the new mode
    signalBufferRef.current.clear();
    setSpectrumData(null);
  };

  const handleSweepModeChange = (mode: SweepMode) => {
    setSweepMode(mode);
    if (mode !== 'none') {
      setParams((prev) => ({ ...prev, demoMode: 'quaternionic' }));
      setShowClassicalSplit(false);
    }
    if (mode === 'geometry-only') {
      geometryAngleRef.current = 0;
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">QSP Studio</h1>
          <p className="app-subtitle">An interactive geometric lab for Quaternionic Signal Processing</p>
        </div>
      </header>
      <ModeSelector mode={params.demoMode} onChange={handleModeChange} />
      <PresetBar
        sweepMode={sweepMode}
        onSweepModeChange={handleSweepModeChange}
        onApplyPreset={(p) => { handleParamsChange(p); setSweepMode('none'); }}
      />
      <div className="scene-wrapper">
        <MainScene
          params={params}
          currentTime={currentTime}
          showClassicalSplit={showClassicalSplit}
          showProjectionPlanes={showProjectionPlanes}
          showBasis={showBasis}
          showTrailHistory={showTrailHistory}
          showFiber={showFiber}
          showLocalFrame={showLocalFrame}
          showProjectionShadow={showProjectionShadow}
          showIncomingWave={showIncomingWave}
          receiverYaw={receiverYaw}
          receiverPitch={receiverPitch}
          couplingStrength={couplingStrength}
          morphProgress={morphProgress}
          prevMode={prevMode}
          showModemGimbalRings={showModemGimbalRings}
          showModemMeasuredEllipse={showModemMeasuredEllipse}
          showModemRecoveredEllipse={showModemRecoveredEllipse}
          showModemHud={showModemHud}
        />
        <InfoOverlay demoMode={params.demoMode} showIncomingWave={showIncomingWave} />
        {showSpectrumPanel && (
          <SpectrumPanel params={params} spectrumData={spectrumData} />
        )}
        {showIncomingWave && (
          <ReceptionMeter strength={couplingStrength} demoMode={params.demoMode} />
        )}
        <StatusStrip params={params} currentTime={currentTime} animSpeed={animSpeed} sweepMode={sweepMode} />
      </div>
      <ControlPanel
        params={params}
        animSpeed={animSpeed}
        showClassicalSplit={showClassicalSplit}
        showProjectionPlanes={showProjectionPlanes}
        showBasis={showBasis}
        showTrailHistory={showTrailHistory}
        showFiber={showFiber}
        showLocalFrame={showLocalFrame}
        showSpectrumPanel={showSpectrumPanel}
        showProjectionShadow={showProjectionShadow}
        showIncomingWave={showIncomingWave}
        receiverYaw={receiverYaw}
        receiverPitch={receiverPitch}
        sweepMode={sweepMode}
        showModemGimbalRings={showModemGimbalRings}
        showModemMeasuredEllipse={showModemMeasuredEllipse}
        showModemRecoveredEllipse={showModemRecoveredEllipse}
        showModemHud={showModemHud}
        onParamsChange={handleParamsChange}
        onAnimSpeedChange={setAnimSpeed}
        onShowClassicalSplitChange={setShowClassicalSplit}
        onShowProjectionPlanesChange={setShowProjectionPlanes}
        onShowBasisChange={setShowBasis}
        onShowTrailHistoryChange={setShowTrailHistory}
        onShowFiberChange={setShowFiber}
        onShowLocalFrameChange={setShowLocalFrame}
        onShowSpectrumPanelChange={setShowSpectrumPanel}
        onShowProjectionShadowChange={setShowProjectionShadow}
        onShowIncomingWaveChange={setShowIncomingWave}
        onReceiverYawChange={setReceiverYaw}
        onReceiverPitchChange={setReceiverPitch}
        onShowModemGimbalRingsChange={setShowModemGimbalRings}
        onShowModemMeasuredEllipseChange={setShowModemMeasuredEllipse}
        onShowModemRecoveredEllipseChange={setShowModemRecoveredEllipse}
        onShowModemHudChange={setShowModemHud}
      />
    </div>
  );
}
