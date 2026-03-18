import { Line, Text } from '@react-three/drei';

export function AxisFrame() {
  const axisLength = 1.5;
  return (
    <group>
      <Line
        points={[[0, 0, 0], [axisLength, 0, 0]]}
        color="#ff4444"
        lineWidth={2}
      />
      <Text position={[axisLength + 0.15, 0, 0]} fontSize={0.12} color="#ff4444">
        X
      </Text>
      <Line
        points={[[0, 0, 0], [0, axisLength, 0]]}
        color="#44ff44"
        lineWidth={2}
      />
      <Text position={[0, axisLength + 0.15, 0]} fontSize={0.12} color="#44ff44">
        Y
      </Text>
      <Line
        points={[[0, 0, 0], [0, 0, axisLength]]}
        color="#4488ff"
        lineWidth={2}
      />
      <Text position={[0, 0, axisLength + 0.15]} fontSize={0.12} color="#4488ff">
        Z
      </Text>
    </group>
  );
}
