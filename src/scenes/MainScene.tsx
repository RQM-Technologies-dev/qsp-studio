import { useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid } from '@react-three/drei';
import { Vector3 } from 'three';
import { AxisFrame } from '../components/AxisFrame';
import { ComplexSignalDemo } from '../features/ComplexSignalDemo';
import { PolarizedSignalDemo } from '../features/PolarizedSignalDemo';
import { QuaternionicSignalDemo } from '../features/QuaternionicSignalDemo';
import { ProjectionPlanes } from '../components/ProjectionPlanes';
import { SignalParams, computeSignalTip, DemoMode } from '../math/signal';

interface MainSceneProps {
  params: SignalParams;
  currentTime: number;
  showClassicalSplit: boolean;
  showProjectionPlanes: boolean;
  showBasis: boolean;
  showTrailHistory: boolean;
  showFiber: boolean;
  showLocalFrame: boolean;
  showProjectionShadow: boolean;
  /** 0 = transition just started, 1 = fully transitioned. */
  morphProgress: number;
  /** The mode we are transitioning away from. */
  prevMode: DemoMode;
}

/** Target camera positions per mode — emphasise the conceptual geometry of each. */
const MODE_CAMERA: Record<DemoMode, [number, number, number]> = {
  complex:      [0, 0.3, 5.5],
  polarized:    [4.0, 2.2, 4.0],
  quaternionic: [3.2, 2.8, 4.5],
};

/** Fraction of the remaining distance to travel per frame — controls camera smoothness. */
const CAMERA_LERP_SPEED = 0.06;

/**
 * Smoothly lerps the camera toward the per-mode target position only while a
 * mode transition is in progress (morphProgress < 1).  Once the transition
 * completes the camera is released and OrbitControls owns it freely.
 */
function CameraController({ demoMode, morphProgress }: { demoMode: DemoMode; morphProgress: number }) {
  const { camera } = useThree();
  const targetRef = useRef<Vector3>(new Vector3(...MODE_CAMERA[demoMode]));
  const morphProgressRef = useRef(morphProgress);

  useEffect(() => {
    targetRef.current.set(...MODE_CAMERA[demoMode]);
  }, [demoMode]);

  // Keep an always-current ref so useFrame can read it without re-subscribing
  morphProgressRef.current = morphProgress;

  useFrame(() => {
    // Once the transition is complete, stop fighting OrbitControls
    if (morphProgressRef.current >= 1) return;
    camera.position.lerp(targetRef.current, CAMERA_LERP_SPEED);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SceneContent({
  params, currentTime, showClassicalSplit, showProjectionPlanes,
  showBasis, showTrailHistory, showFiber, showLocalFrame,
  showProjectionShadow, morphProgress, prevMode,
}: MainSceneProps) {
  const tip = computeSignalTip(params, currentTime);
  const currentMode = params.demoMode;

  // Opacity for the incoming (current) mode: fade in from 0 → 1
  const inOpacity = morphProgress;
  // Opacity for the outgoing (previous) mode: fade out from 1 → 0
  const outOpacity = 1 - morphProgress;

  // Is a transition actively in progress?
  const isTransitioning = morphProgress < 1 && prevMode !== currentMode;

  // Params snapshot for the outgoing mode — keep demoMode = prevMode so that
  // internal geometry (trails, tips) is computed with the old mode's math.
  const prevParams = { ...params, demoMode: prevMode };

  // For Classical → Polarization morph: pass helixMorphProgress so the
  // departing circle lifts off into a helix shape as it fades out.
  const helixMorphForPrev =
    isTransitioning && prevMode === 'complex' && currentMode === 'polarized'
      ? morphProgress
      : 0;

  const prevTip = computeSignalTip(prevParams, currentTime);

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 5, 5]} intensity={0.9} />

      <Stars radius={80} depth={25} count={1200} factor={1.8} saturation={0} fade />

      <Grid
        args={[8, 8]}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#1a2535"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#1e3050"
        fadeDistance={10}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      <AxisFrame />

      {showProjectionPlanes && (
        <ProjectionPlanes params={params} currentTime={currentTime} />
      )}

      {/* ── Outgoing mode — fades out during transition ─────────────────── */}
      {isTransitioning && prevMode === 'complex' && (
        <ComplexSignalDemo
          params={prevParams}
          currentTime={currentTime}
          tip={prevTip}
          showBasis={false}
          helixMorphProgress={helixMorphForPrev}
          opacity={outOpacity}
        />
      )}
      {isTransitioning && prevMode === 'polarized' && (
        <PolarizedSignalDemo
          params={prevParams}
          currentTime={currentTime}
          tip={prevTip}
          showBasis={false}
          showTrailHistory={showTrailHistory}
          opacity={outOpacity}
        />
      )}
      {isTransitioning && prevMode === 'quaternionic' && (
        <QuaternionicSignalDemo
          params={prevParams}
          currentTime={currentTime}
          tip={prevTip}
          showClassicalSplit={false}
          showTrailHistory={showTrailHistory}
          showFiber={showFiber}
          showLocalFrame={showLocalFrame}
          showProjectionShadow={false}
          opacity={outOpacity}
        />
      )}

      {/* ── Current mode — fades in during transition ───────────────────── */}
      {currentMode === 'complex' && (
        <ComplexSignalDemo
          params={params}
          currentTime={currentTime}
          tip={tip}
          showBasis={showBasis}
          opacity={isTransitioning ? inOpacity : 1}
        />
      )}
      {currentMode === 'polarized' && (
        <PolarizedSignalDemo
          params={params}
          currentTime={currentTime}
          tip={tip}
          showBasis={showBasis}
          showTrailHistory={showTrailHistory}
          opacity={isTransitioning ? inOpacity : 1}
        />
      )}
      {currentMode === 'quaternionic' && (
        <QuaternionicSignalDemo
          params={params}
          currentTime={currentTime}
          tip={tip}
          showClassicalSplit={showClassicalSplit}
          showTrailHistory={showTrailHistory}
          showFiber={showFiber}
          showLocalFrame={showLocalFrame}
          showProjectionShadow={showProjectionShadow}
          opacity={isTransitioning ? inOpacity : 1}
        />
      )}

      <CameraController demoMode={params.demoMode} morphProgress={morphProgress} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
    </>
  );
}

export function MainScene(props: MainSceneProps) {
  return (
    <Canvas
      camera={{ position: MODE_CAMERA[props.params.demoMode], fov: 50 }}
      style={{ background: '#0a0a0f' }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
