import { useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Grid } from '@react-three/drei';
import { Vector3 } from 'three';
import { AxisFrame } from '../components/AxisFrame';
import { ComplexSignalDemo } from '../features/ComplexSignalDemo';
import { PolarizedSignalDemo } from '../features/PolarizedSignalDemo';
import { QuaternionicModemDemo } from '../features/QuaternionicModemDemo';
import { IncomingWave } from '../features/IncomingWave';
import { SampledFieldGlyph } from '../features/SampledFieldGlyph';
import { ProjectionPlanes } from '../components/ProjectionPlanes';
import { SignalParams, computeSignalTip, DemoMode } from '../math/signal';
import { computeReceiverBasis } from '../math/receiverBasis';
import { rotateVec3ByQuat } from '../math/quaternion';

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
  showIncomingWave: boolean;
  receiverYaw: number;
  receiverPitch: number;
  /** Normalized coupling strength [0,1]; scales geometry amplitude when wave layer active. */
  couplingStrength: number;
  /** 0 = transition just started, 1 = fully transitioned. */
  morphProgress: number;
  /** The mode we are transitioning away from. */
  prevMode: DemoMode;
  // ── Modem layer visibility toggles (quaternionic mode only) ──────────────
  showModemGimbalRings: boolean;
  showModemMeasuredEllipse: boolean;
  showModemRecoveredEllipse: boolean;
  showModemHud: boolean;
}

/** Target camera positions per mode — emphasise the conceptual geometry of each. */
const MODE_CAMERA: Record<DemoMode, [number, number, number]> = {
  complex:      [0, 0.3, 5.5],
  polarized:    [4.0, 2.2, 4.0],
  quaternionic: [1.8, 1.5, 2.5],
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
    // Transition complete — release camera to OrbitControls (user can rotate freely)
    if (morphProgressRef.current >= 1) return;
    camera.position.lerp(targetRef.current, CAMERA_LERP_SPEED);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SceneContent({
  params, currentTime, showProjectionPlanes,
  showBasis, showIncomingWave, receiverYaw, receiverPitch,
  couplingStrength, morphProgress, prevMode,
  showModemGimbalRings, showModemMeasuredEllipse,
  showModemRecoveredEllipse, showModemHud,
}: MainSceneProps) {
  // When the incoming wave layer is active, scale the signal amplitude by the
  // coupling metric so the main geometry visibly weakens with misalignment.
  const effectiveParams: SignalParams = showIncomingWave && couplingStrength < 0.999
    ? { ...params, amplitude: params.amplitude * couplingStrength }
    : params;

  const tip = computeSignalTip(effectiveParams, currentTime);
  const currentMode = params.demoMode;

  // ── World-space live contact point ────────────────────────────────────
  // The demo group applies rotation={[receiverPitch, receiverYaw(+offset), 0]} so we
  // rotate the local tip by the same receiver quaternion to get the exact
  // world-space position where the incoming wave should meet the geometry.
  // Polarized mode adds a fixed π/2 Y-axis offset so the receiver disc faces
  // the incoming wave (disc normal = +X = wave propagation direction).
  const polarizedYawOffset = currentMode === 'polarized' ? Math.PI / 2 : 0;
  const receiverBasis = computeReceiverBasis(receiverYaw + polarizedYawOffset, receiverPitch);
  const worldTipRaw = rotateVec3ByQuat(tip, receiverBasis.q);
  const worldTip: [number, number, number] = [worldTipRaw[0], worldTipRaw[1], worldTipRaw[2]];

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
          opacity={outOpacity}
        />
      )}
      {isTransitioning && prevMode === 'quaternionic' && (
        <QuaternionicModemDemo
          params={prevParams}
          currentTime={currentTime}
          opacity={outOpacity}
        />
      )}

      {/* ── Current mode — fades in during transition ───────────────────── */}
      {currentMode === 'complex' && (
        <ComplexSignalDemo
          params={effectiveParams}
          currentTime={currentTime}
          tip={tip}
          showBasis={showBasis}
          couplingStrength={couplingStrength}
          opacity={isTransitioning ? inOpacity : 1}
          receiverYaw={receiverYaw}
          receiverPitch={receiverPitch}
          showExcitation={showIncomingWave}
        />
      )}
      {currentMode === 'polarized' && (
        <PolarizedSignalDemo
          params={effectiveParams}
          currentTime={currentTime}
          tip={tip}
          showBasis={showBasis}
          couplingStrength={couplingStrength}
          opacity={isTransitioning ? inOpacity : 1}
          receiverYaw={receiverYaw}
          receiverPitch={receiverPitch}
          showExcitation={showIncomingWave}
        />
      )}
      {currentMode === 'quaternionic' && (
        <QuaternionicModemDemo
          params={effectiveParams}
          currentTime={currentTime}
          opacity={isTransitioning ? inOpacity : 1}
          showGimbalRings={showModemGimbalRings}
          showMeasuredEllipse={showModemMeasuredEllipse}
          showRecoveredEllipse={showModemRecoveredEllipse}
          showHud={showModemHud}
        />
      )}

      {/* ── Incoming wave direct-reception layer — toggled by showIncomingWave ── */}
      {/* The wave now converges onto the live circumference/trace contact point.  */}
      {/* Signal and receiver geometry are co-located at the same moving point.   */}
      {showIncomingWave && (
        <>
          {/* Wave and glyph both receive effectiveParams (coupling-scaled amplitude)
              so the wave amplitude is always identical to the geometry amplitude. */}
          <IncomingWave
            params={effectiveParams}
            currentTime={currentTime}
            receiverX={0}
            demoMode={currentMode}
            contactPoint={worldTip}
          />
          {/* Field projection overlay positioned AT the live rim contact point.  */}
          {/* All glyph visuals radiate from and collapse back to the rim point.  */}
          <SampledFieldGlyph
            params={effectiveParams}
            currentTime={currentTime}
            position={worldTip}
            demoMode={currentMode}
            receiverYaw={receiverYaw}
            receiverPitch={receiverPitch}
            couplingStrength={couplingStrength}
          />
        </>
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
