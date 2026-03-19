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
}

/** Target camera positions per mode — emphasise the conceptual geometry of each. */
const MODE_CAMERA: Record<DemoMode, [number, number, number]> = {
  // Front-on → flatness of the XY plane is immediately obvious
  complex:      [0, 0.3, 5.5],
  // Angled to reveal the Z-depth of the helix
  polarized:    [4.0, 2.2, 4.0],
  // Elevated and angled — shows 3D precession of the quaternionic state
  quaternionic: [3.2, 2.8, 4.5],
};

/** Smoothly lerps the camera toward the per-mode target position. */
function CameraController({ demoMode }: { demoMode: DemoMode }) {
  const { camera } = useThree();
  const targetRef = useRef<Vector3>(new Vector3(...MODE_CAMERA[demoMode]));

  useEffect(() => {
    targetRef.current.set(...MODE_CAMERA[demoMode]);
  }, [demoMode]);

  useFrame(() => {
    camera.position.lerp(targetRef.current, 0.04);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function SceneContent({ params, currentTime, showClassicalSplit, showProjectionPlanes }: MainSceneProps) {
  const tip = computeSignalTip(params, currentTime);

  return (
    <>
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 5, 5]} intensity={0.9} />

      {/* Dimmed starfield — atmospheric but subordinate to the geometry */}
      <Stars radius={80} depth={25} count={1200} factor={1.8} saturation={0} fade />

      {/* Faint reference grid */}
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

      {params.demoMode === 'complex' && (
        <ComplexSignalDemo params={params} currentTime={currentTime} tip={tip} />
      )}
      {params.demoMode === 'polarized' && (
        <PolarizedSignalDemo params={params} currentTime={currentTime} tip={tip} />
      )}
      {params.demoMode === 'quaternionic' && (
        <QuaternionicSignalDemo
          params={params}
          currentTime={currentTime}
          tip={tip}
          showClassicalSplit={showClassicalSplit}
        />
      )}

      <CameraController demoMode={params.demoMode} />
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
