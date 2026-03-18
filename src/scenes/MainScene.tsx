import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { AxisFrame } from '../components/AxisFrame';
import { ComplexSignalDemo } from '../features/ComplexSignalDemo';
import { PolarizedSignalDemo } from '../features/PolarizedSignalDemo';
import { QuaternionicSignalDemo } from '../features/QuaternionicSignalDemo';
import { SignalParams, computeSignalTip } from '../math/signal';

interface MainSceneProps {
  params: SignalParams;
  currentTime: number;
}

export function MainScene({ params, currentTime }: MainSceneProps) {
  const tip = computeSignalTip(params, currentTime);

  return (
    <Canvas
      camera={{ position: [3, 2, 4], fov: 50 }}
      style={{ background: '#0a0a0f' }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <Stars radius={50} depth={10} count={3000} factor={3} fade />
      <AxisFrame />

      {params.demoMode === 'complex' && (
        <ComplexSignalDemo params={params} currentTime={currentTime} tip={tip} />
      )}
      {params.demoMode === 'polarized' && (
        <PolarizedSignalDemo params={params} currentTime={currentTime} tip={tip} />
      )}
      {params.demoMode === 'quaternionic' && (
        <QuaternionicSignalDemo params={params} currentTime={currentTime} tip={tip} />
      )}

      <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
    </Canvas>
  );
}
