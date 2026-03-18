import { useState, useEffect, useRef, useCallback } from 'react';
import { MainScene } from '../scenes/MainScene';
import { ControlPanel } from '../ui/ControlPanel';
import { ModeSelector } from '../ui/ModeSelector';
import { InfoOverlay } from '../ui/InfoOverlay';
import { StatusStrip } from '../ui/StatusStrip';
import { PresetBar, SweepMode } from '../ui/PresetBar';
import { SignalParams, defaultSignalParams, DemoMode } from '../math/signal';

export default function App() {
  const [params, setParams] = useState<SignalParams>(defaultSignalParams);
  const [currentTime, setCurrentTime] = useState(0);
  const [animSpeed, setAnimSpeed] = useState(1.0);
  const [showClassicalSplit, setShowClassicalSplit] = useState(false);
  const [showProjectionPlanes, setShowProjectionPlanes] = useState(false);
  const [sweepMode, setSweepMode] = useState<SweepMode>('none');

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

    // Advance phase unless geometry-only sweep is active
    if (mode !== 'geometry-only') {
      setCurrentTime((t) => t + dt * animSpeedRef.current);
    }

    // In geometry-only sweep: slowly precess the orientation axis while phase stays fixed
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
    setParams((prev) => ({ ...prev, demoMode: mode }));
    if (mode !== 'quaternionic') setShowClassicalSplit(false);
    setSweepMode('none');
  };

  const handleSweepModeChange = (mode: SweepMode) => {
    setSweepMode(mode);
    // Entering either sweep mode forces quaternionic
    if (mode !== 'none') {
      setParams((prev) => ({ ...prev, demoMode: 'quaternionic' }));
      setShowClassicalSplit(false);
    }
    // Reset geometry angle when starting geometry sweep
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
        />
        <InfoOverlay demoMode={params.demoMode} />
        <StatusStrip params={params} currentTime={currentTime} animSpeed={animSpeed} sweepMode={sweepMode} />
      </div>
      <ControlPanel
        params={params}
        animSpeed={animSpeed}
        showClassicalSplit={showClassicalSplit}
        showProjectionPlanes={showProjectionPlanes}
        sweepMode={sweepMode}
        onParamsChange={handleParamsChange}
        onAnimSpeedChange={setAnimSpeed}
        onShowClassicalSplitChange={setShowClassicalSplit}
        onShowProjectionPlanesChange={setShowProjectionPlanes}
      />
    </div>
  );
}
