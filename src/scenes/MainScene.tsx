import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Grid } from '@react-three/drei';
import { AxisFrame } from '../components/AxisFrame';
import { ComplexSignalDemo } from '../features/ComplexSignalDemo';
import { PolarizedSignalDemo } from '../features/PolarizedSignalDemo';
import { QuaternionicSignalDemo } from '../features/QuaternionicSignalDemo';
import { SignalParams, computeSignalTip } from '../math/signal';

interface MainSceneProps {
  params: SignalParams;
  currentTime: number;
  showClassicalSplit: boolean;
}

export function MainScene({ params, currentTime, showClassicalSplit }: MainSceneProps) {
  const tip = computeSignalTip(params, currentTime);

  return (
    <Canvas
      camera={{ position: [3, 2, 4], fov: 50 }}
      style={{ background: '#0a0a0f' }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <Stars radius={50} depth={10} count={3000} factor={3} fade />

      {/* Faint reference plane to anchor spatial reasoning */}
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

      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
    </Canvas>
  );
}
