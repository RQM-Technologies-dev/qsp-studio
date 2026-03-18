import { useState, useEffect, useRef, useCallback } from 'react';
import { MainScene } from '../scenes/MainScene';
import { ControlPanel } from '../ui/ControlPanel';
import { ModeSelector } from '../ui/ModeSelector';
import { InfoOverlay } from '../ui/InfoOverlay';
import { StatusStrip } from '../ui/StatusStrip';
import { SignalParams, defaultSignalParams, DemoMode } from '../math/signal';

export default function App() {
  const [params, setParams] = useState<SignalParams>(defaultSignalParams);
  const [currentTime, setCurrentTime] = useState(0);
  const [animSpeed, setAnimSpeed] = useState(1.0);
  const [showClassicalSplit, setShowClassicalSplit] = useState(false);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const animSpeedRef = useRef(animSpeed);

  useEffect(() => {
    animSpeedRef.current = animSpeed;
  }, [animSpeed]);

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const dt = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;
    setCurrentTime((t) => t + dt * animSpeedRef.current);
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
    // Reset classical split when leaving quaternionic mode
    if (mode !== 'quaternionic') setShowClassicalSplit(false);
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
      <div className="scene-wrapper">
        <MainScene
          params={params}
          currentTime={currentTime}
          showClassicalSplit={showClassicalSplit}
        />
        <InfoOverlay demoMode={params.demoMode} />
        <StatusStrip params={params} currentTime={currentTime} animSpeed={animSpeed} />
      </div>
      <ControlPanel
        params={params}
        animSpeed={animSpeed}
        showClassicalSplit={showClassicalSplit}
        onParamsChange={handleParamsChange}
        onAnimSpeedChange={setAnimSpeed}
        onShowClassicalSplitChange={setShowClassicalSplit}
      />
    </div>
  );
}
