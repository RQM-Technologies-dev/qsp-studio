import { useState, useEffect, useRef, useCallback } from 'react';
import { MainScene } from '../scenes/MainScene';
import { ControlPanel } from '../ui/ControlPanel';
import { ModeSelector } from '../ui/ModeSelector';
import { InfoOverlay } from '../ui/InfoOverlay';
import { StatusStrip } from '../ui/StatusStrip';
import { PresetBar, SweepMode } from '../ui/PresetBar';
import { SpectrumPanel } from '../ui/SpectrumPanel';
import { SignalParams, defaultSignalParams, DemoMode } from '../math/signal';

/** How long (in wall-clock seconds) a mode morph transition lasts. */
const MORPH_DURATION = 1.5;

export default function App() {
  const [params, setParams] = useState<SignalParams>(defaultSignalParams);
  const [currentTime, setCurrentTime] = useState(0);
  const [animSpeed, setAnimSpeed] = useState(1.0);
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

  // ── Mode morph state ─────────────────────────────────────────────────────
  const [morphProgress, setMorphProgress] = useState(1);
  const [prevMode, setPrevMode] = useState<DemoMode>(defaultSignalParams.demoMode);
  const morphProgressRef = useRef(1);
  const isMorphingRef = useRef(false);

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const animSpeedRef = useRef(animSpeed);
  const sweepModeRef = useRef<SweepMode>('none');
  const geometryAngleRef = useRef(0);

  useEffect(() => {
    animSpeedRef.current = animSpeed;
  }, [animSpeed]);

  useEffect(() => {
    sweepModeRef.current = sweepMode;
  }, [sweepMode]);

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;

    const mode = sweepModeRef.current;

    if (mode !== 'geometry-only') {
      setCurrentTime((t) => t + dt * animSpeedRef.current);
    }

    if (mode === 'geometry-only') {
      geometryAngleRef.current += dt * 0.55;
      const a = geometryAngleRef.current;
      setParams((prev) => ({
        ...prev,
        demoMode: 'quaternionic',
        orientationX: Math.sin(a * 1.3) * 0.7,
        orientationY: Math.cos(a * 0.8) * 0.5,
        orientationZ: Math.cos(a),
      }));
    }

    // Advance morph progress using wall-clock dt (independent of animSpeed)
    if (isMorphingRef.current) {
      morphProgressRef.current = Math.min(1, morphProgressRef.current + dt / MORPH_DURATION);
      setMorphProgress(morphProgressRef.current);
      if (morphProgressRef.current >= 1) {
        isMorphingRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

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
          morphProgress={morphProgress}
          prevMode={prevMode}
        />
        <InfoOverlay demoMode={params.demoMode} />
        {showSpectrumPanel && (
          <SpectrumPanel params={params} currentTime={currentTime} />
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
        sweepMode={sweepMode}
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
      />
    </div>
  );
}
