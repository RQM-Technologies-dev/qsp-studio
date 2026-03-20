/**
 * Hypersphere Visualization
 *
 * Interactive 3D visualization of quaternionic wavefunction on a hypersphere.
 * Shows q = cos φ + u sin φ with dynamic sphere sizing based on |cos φ|.
 *
 * Colors: green when near |0⟩ (φ≈0), blue when near |1⟩ (φ≈π/2).
 * Animation runs as a continuous loop with no static pauses.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface QuantumState {
  phi: number;
  u: { x: number; y: number; z: number };
  blochVector: { x: number; y: number; z: number };
  gateName: string;
}

interface SpinorConfig {
  name: string;
  u: { x: number; y: number; z: number };
  omega: number;
  color: string;
  phi0: number;
  radiusScale?: number;
}

interface HypersphereVisualizationProps {
  width?: number;
  height?: number;
  className?: string;
  showControls?: boolean;
  onStateChange?: (state: QuantumState) => void;
}

export default function HypersphereVisualization({
  width = 900,
  height = 700,
  className = '',
  showControls = true,
  onStateChange,
}: HypersphereVisualizationProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [, setStarTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const [pathHistory, setPathHistory] = useState<Array<{ x: number; y: number; z: number }>>([]);
  const [showPath, setShowPath] = useState(true);

  const W = width;
  const H = height;
  const FOV = 600;

  // Slower transition: 10 s per gate rotation
  const TRANSITION_DURATION = 10000;

  const viewQuatRef = useRef<[number, number, number, number]>([0.404, 0.058, 0.905, 0.128]);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const starsRef = useRef<
    Array<{ x: number; y: number; radius: number; opacity: number; vx: number; vy: number }>
  >([]);
  const phaseStartTimeRef = useRef(performance.now());

  const currentStateIndexRef = useRef(currentStateIndex);
  const isAnimatingRef = useRef(isAnimating);
  const transitionProgressRef = useRef(transitionProgress);
  const spinorsRef = useRef<SpinorConfig[]>([]);
  const visualScaleRef = useRef(1.0);
  const isPlayingRef = useRef(isPlaying);

  // Quantum gate spinors (excludes Quaternion and EigenSpinor mode categories)
  const defaultSpinors: SpinorConfig[] = [
    { name: 'I',  u: { x: 0, y: 0, z: 1 },            omega: 0, color: '#a8d4f0', phi0: 0,                  radiusScale: 0.609 },
    { name: 'X₀', u: { x: 1, y: 0, z: 0 },            omega: 0, color: '#a8f0b8', phi0: 2 * Math.PI / 5,   radiusScale: 0.696 },
    { name: 'X₁', u: { x: 1, y: 0, z: 0 },            omega: 0, color: '#a8d4f0', phi0: 2 * Math.PI / 3,   radiusScale: 0.928 },
    { name: 'Y₂', u: { x: 0, y: 1, z: 0 },            omega: 0, color: '#a8f0b8', phi0: Math.PI / 6,       radiusScale: 0.696 },
    { name: 'Z₃', u: { x: 0, y: 0, z: 1 },            omega: 0, color: '#a8d4f0', phi0: Math.PI / 4,       radiusScale: 0.928 },
    { name: 'H₄', u: { x: 0.707107, y: 0, z: 0.707107 }, omega: 0, color: '#a8f0b8', phi0: 3 * Math.PI / 4, radiusScale: 0.928 },
    { name: 'T₅', u: { x: 0, y: 0, z: 1 },            omega: 0, color: '#a8d4f0', phi0: Math.PI / 5,       radiusScale: 0.861 },
    { name: 'Y₆', u: { x: 0, y: 1, z: 0 },            omega: 0, color: '#a8f0b8', phi0: Math.PI / 3,       radiusScale: 0.861 },
    { name: 'Xπ', u: { x: 1, y: 0, z: 0 },            omega: 0, color: '#a8d4f0', phi0: 5 * Math.PI / 6,   radiusScale: 0.928 },
  ];

  const spinors = defaultSpinors;

  useEffect(() => {
    spinorsRef.current = spinors;
  }, [spinors]);

  useEffect(() => {
    currentStateIndexRef.current = currentStateIndex;
    isAnimatingRef.current = isAnimating;
    transitionProgressRef.current = transitionProgress;
    isPlayingRef.current = isPlaying;
  }, [currentStateIndex, isAnimating, transitionProgress, isPlaying]);

  const normalizeAxis = (axis: { x: number; y: number; z: number }) => {
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    return { x: axis.x / len, y: axis.y / len, z: axis.z / len };
  };

  const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ── Stars setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const numStars = 200;
    const stars = [];
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.6 + 0.2,
        vx: -0.35,
        vy: 0,
      });
    }
    starsRef.current = stars;
  }, [W, H]);

  useEffect(() => {
    let animationId: number;
    let lastUpdateTime = 0;
    const FRAME_INTERVAL = 25;

    const updateStars = (currentTime: number) => {
      if (currentTime - lastUpdateTime >= FRAME_INTERVAL) {
        lastUpdateTime = currentTime;
        starsRef.current.forEach((star) => {
          star.x += star.vx;
          star.y += star.vy;
          if (star.x < 0) star.x += W;
          if (star.x > W) star.x -= W;
          if (star.y < 0) star.y += H;
          if (star.y > H) star.y -= H;
        });
        setStarTick((tick) => tick + 1);
      }
      animationId = requestAnimationFrame(updateStars);
    };

    animationId = requestAnimationFrame(updateStars);
    return () => cancelAnimationFrame(animationId);
  }, [W, H]);

  // ── Continuous gate animation loop — no static pauses ─────────────────
  useEffect(() => {
    if (!isPlaying) return;

    let animationId: number;

    const animate = () => {
      if (!isPlayingRef.current) return;

      const now = performance.now();
      const elapsed = now - phaseStartTimeRef.current;

      // Always animating — advance progress and cycle states
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
      setTransitionProgress(progress);
      setIsAnimating(true);

      if (progress >= 1) {
        // Move to next state and restart
        setCurrentStateIndex((prev) => (prev + 1) % spinorsRef.current.length);
        setTransitionProgress(0);
        phaseStartTimeRef.current = now;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, TRANSITION_DURATION]);

  // ── Path tracing ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showPath) return;

    let animationId: number;
    const MAX_PATH_LENGTH = 80;

    const updatePath = () => {
      const stateIndex = currentStateIndexRef.current;
      const activeSpinors = spinorsRef.current;
      if (!activeSpinors.length) return;

      const currentState = activeSpinors[stateIndex % activeSpinors.length];
      let u = { ...currentState.u };

      if (isAnimatingRef.current) {
        const nextState = activeSpinors[(stateIndex + 1) % activeSpinors.length];
        const easedProgress = easeInOutCubic(transitionProgressRef.current);
        u = {
          x: currentState.u.x * (1 - easedProgress) + nextState.u.x * easedProgress,
          y: currentState.u.y * (1 - easedProgress) + nextState.u.y * easedProgress,
          z: currentState.u.z * (1 - easedProgress) + nextState.u.z * easedProgress,
        };
      }

      visualScaleRef.current = currentState.radiusScale ?? 1.0;

      const phi =
        isAnimatingRef.current
          ? currentState.phi0 * (1 - easeInOutCubic(transitionProgressRef.current)) +
            (activeSpinors[(stateIndex + 1) % activeSpinors.length]?.phi0 ?? currentState.phi0) *
              easeInOutCubic(transitionProgressRef.current)
          : currentState.phi0;

      const pathRadius = Math.abs(Math.cos(phi)) * 1.953125 * visualScaleRef.current;
      const tipPos = { x: u.x * pathRadius, y: u.y * pathRadius, z: u.z * pathRadius };

      setPathHistory((prev) => {
        const lastPos = prev[prev.length - 1];
        if (lastPos) {
          const dx = tipPos.x - lastPos.x;
          const dy = tipPos.y - lastPos.y;
          const dz = tipPos.z - lastPos.z;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.01) return prev;
        }
        const newPath = [...prev, tipPos];
        return newPath.length > MAX_PATH_LENGTH ? newPath.slice(-MAX_PATH_LENGTH) : newPath;
      });

      animationId = requestAnimationFrame(updatePath);
    };

    animationId = requestAnimationFrame(updatePath);
    return () => cancelAnimationFrame(animationId);
  }, [showPath]);

  // ── Quaternion math helpers ──────────────────────────────────────────────
  const quatMul = (a: number[], b: number[]): number[] => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];

  const quatSlerp = (q1: number[], q2: number[], t: number): number[] => {
    let dot = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];
    let q2adj = [...q2];
    if (dot < 0) { dot = -dot; q2adj = [-q2[0], -q2[1], -q2[2], -q2[3]]; }
    if (dot > 0.9995) {
      const res = [q1[0] + t * (q2adj[0] - q1[0]), q1[1] + t * (q2adj[1] - q1[1]),
                   q1[2] + t * (q2adj[2] - q1[2]), q1[3] + t * (q2adj[3] - q1[3])];
      const len = Math.sqrt(res[0] ** 2 + res[1] ** 2 + res[2] ** 2 + res[3] ** 2);
      return res.map((v) => v / len);
    }
    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const w1 = Math.sin((1 - t) * theta) / sinTheta;
    const w2 = Math.sin(t * theta) / sinTheta;
    return [w1 * q1[0] + w2 * q2adj[0], w1 * q1[1] + w2 * q2adj[1],
            w1 * q1[2] + w2 * q2adj[2], w1 * q1[3] + w2 * q2adj[3]];
  };

  const rotateVecByQuat = (v: [number, number, number], q: number[]): [number, number, number] => {
    const qConj = [q[0], -q[1], -q[2], -q[3]];
    const vq = [0, v[0], v[1], v[2]];
    const tmp = quatMul(q, vq);
    const res = quatMul(tmp, qConj);
    return [res[1], res[2], res[3]];
  };

  const project3D = (
    p: [number, number, number],
    extraQuat?: number[],
  ): { x: number; y: number; z: number } => {
    let v3 = p;
    if (extraQuat) v3 = rotateVecByQuat(p, extraQuat);
    v3 = rotateVecByQuat(v3, viewQuatRef.current);
    const scale = 280;
    const v = [v3[0] * scale, v3[1] * scale, v3[2] * scale + 300];
    const persp = FOV / (FOV + v[2]);
    return { x: v[0] * persp + W / 2, y: -v[1] * persp + H / 2, z: v[2] };
  };

  // ── Mouse drag rotation ──────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastMouseRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    const axis: [number, number, number] = [dy, dx, 0];
    const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
    if (len > 0) {
      const normAxis: [number, number, number] = [axis[0] / len, axis[1] / len, axis[2] / len];
      const angle = len * 0.01;
      const s = Math.sin(angle / 2);
      const dq = [Math.cos(angle / 2), normAxis[0] * s, normAxis[1] * s, normAxis[2] * s];
      viewQuatRef.current = quatMul(dq, viewQuatRef.current) as [number, number, number, number];
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    lastMouseRef.current = null;
  };

  // ── Sphere rendering ─────────────────────────────────────────────────────
  const renderSphere = (
    extraQuat: number[] | null,
    opacity: number,
    strokeColor: string,
    strokeWidth: number,
    fillNorthern?: boolean,
    scale: number = 1.0,
  ) => {
    const elements: JSX.Element[] = [];
    const latitudes = 24;
    const longitudes = 32;

    for (let i = 0; i <= latitudes; i++) {
      const theta = (i / latitudes) * Math.PI;
      const r = Math.sin(theta) * scale;
      const z = Math.cos(theta) * scale;
      const pts = Array.from({ length: longitudes + 1 }, (_, j) => {
        const phi = (j / longitudes) * Math.PI * 2;
        return project3D([r * Math.cos(phi), r * Math.sin(phi), z], extraQuat || undefined);
      });
      const d = pts.map((pt, j) => `${j === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`).join(' ');
      elements.push(<path key={`lat-${i}`} d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" opacity={opacity} />);
    }

    for (let j = 0; j < longitudes; j++) {
      const phi = (j / longitudes) * Math.PI * 2;
      const pts = Array.from({ length: latitudes + 1 }, (_, i) => {
        const theta = (i / latitudes) * Math.PI;
        const r = Math.sin(theta) * scale;
        const z = Math.cos(theta) * scale;
        return project3D([r * Math.cos(phi), r * Math.sin(phi), z], extraQuat || undefined);
      });
      const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`).join(' ');
      elements.push(<path key={`lon-${j}`} d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" opacity={opacity} />);
    }

    if (fillNorthern && extraQuat) {
      for (let i = 0; i < latitudes / 2; i++) {
        const theta1 = (i / latitudes) * Math.PI;
        const theta2 = ((i + 1) / latitudes) * Math.PI;
        for (let j = 0; j < longitudes; j++) {
          const phi1 = (j / longitudes) * Math.PI * 2;
          const phi2 = ((j + 1) / longitudes) * Math.PI * 2;
          const p1 = project3D([Math.sin(theta1) * Math.cos(phi1) * scale, Math.sin(theta1) * Math.sin(phi1) * scale, Math.cos(theta1) * scale], extraQuat);
          const p2 = project3D([Math.sin(theta1) * Math.cos(phi2) * scale, Math.sin(theta1) * Math.sin(phi2) * scale, Math.cos(theta1) * scale], extraQuat);
          const p3 = project3D([Math.sin(theta2) * Math.cos(phi2) * scale, Math.sin(theta2) * Math.sin(phi2) * scale, Math.cos(theta2) * scale], extraQuat);
          const p4 = project3D([Math.sin(theta2) * Math.cos(phi1) * scale, Math.sin(theta2) * Math.sin(phi1) * scale, Math.cos(theta2) * scale], extraQuat);
          elements.push(
            <path
              key={`cap-${i}-${j}`}
              d={`M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`}
              fill={strokeColor}
              opacity={0.15}
              stroke="none"
            />,
          );
        }
      }
    }

    return elements;
  };

  const renderStars = () =>
    starsRef.current.map((star, i) => (
      <circle key={`star-${i}`} cx={star.x} cy={star.y} r={star.radius} fill="white" opacity={star.opacity} />
    ));

  const renderPath = () => {
    if (!showPath || pathHistory.length < 2) return null;
    return pathHistory.slice(0, -1).map((p1, i) => {
      const p2 = pathHistory[i + 1];
      const proj1 = project3D([p1.x, p1.y, p1.z]);
      const proj2 = project3D([p2.x, p2.y, p2.z]);
      const t = i / (pathHistory.length - 1);
      return (
        <line
          key={`path-${i}`}
          x1={proj1.x} y1={proj1.y} x2={proj2.x} y2={proj2.y}
          stroke="#ffffff" strokeWidth={3 + t * 5} opacity={0.3 + t * 0.7} strokeLinecap="round"
        />
      );
    });
  };

  const makeQuatFromState = (state: SpinorConfig) => {
    const u = normalizeAxis(state.u);
    const halfPhi = state.phi0 / 2;
    const sinp = Math.sin(halfPhi);
    return [Math.cos(halfPhi), u.x * sinp, u.y * sinp, u.z * sinp];
  };

  const getCurrentQuaternion = (): number[] => {
    const currentState = spinors[currentStateIndex];
    const nextState = spinors[(currentStateIndex + 1) % spinors.length];
    const currentQuat = makeQuatFromState(currentState);
    const nextQuat = makeQuatFromState(nextState);
    const easedProgress = easeInOutCubic(transitionProgress);
    return isAnimating ? quatSlerp(currentQuat, nextQuat, easedProgress) : currentQuat;
  };

  // ── Compute Bloch vector from current (phi, u) ──────────────────────────
  // The state is |ψ⟩ = R(u, 2φ)|0⟩. The Bloch vector is obtained by
  // rotating the North Pole (0,0,1) by R(u, 2φ).
  const computeBlochVector = useCallback(
    (phi: number, u: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
      const un = normalizeAxis(u);
      const alpha = 2 * phi;
      const cosA = Math.cos(alpha);
      const sinA = Math.sin(alpha);
      // r' = cosA*(0,0,1) + sinA*(un × (0,0,1)) + (1-cosA)*(un·(0,0,1))*un
      // un × (0,0,1) = (un.y, -un.x, 0)
      const cross = { x: un.y, y: -un.x, z: 0 };
      const dot = un.z; // un · (0,0,1)
      return {
        x: cosA * 0 + sinA * cross.x + (1 - cosA) * dot * un.x,
        y: cosA * 0 + sinA * cross.y + (1 - cosA) * dot * un.y,
        z: cosA * 1 + sinA * cross.z + (1 - cosA) * dot * un.z,
      };
    },
    [],
  );

  // ── Derive the current interpolated (phi, u) for external consumers ──────
  const currentState = spinors[currentStateIndex];
  let currentU = { ...currentState.u };
  let currentArrowPhi = currentState.phi0;

  if (isAnimating) {
    const nextState = spinors[(currentStateIndex + 1) % spinors.length];
    const easedProgress = easeInOutCubic(transitionProgress);
    currentU = {
      x: currentState.u.x * (1 - easedProgress) + nextState.u.x * easedProgress,
      y: currentState.u.y * (1 - easedProgress) + nextState.u.y * easedProgress,
      z: currentState.u.z * (1 - easedProgress) + nextState.u.z * easedProgress,
    };
    currentArrowPhi = currentState.phi0 * (1 - easedProgress) + nextState.phi0 * easedProgress;
    const uLen = Math.sqrt(currentU.x ** 2 + currentU.y ** 2 + currentU.z ** 2);
    if (uLen > 0) { currentU.x /= uLen; currentU.y /= uLen; currentU.z /= uLen; }
  }

  // ── Notify parent of quantum state (after render, via useEffect) ─────────
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => { onStateChangeRef.current = onStateChange; }, [onStateChange]);

  useEffect(() => {
    if (!onStateChangeRef.current) return;
    const bloch = computeBlochVector(currentArrowPhi, currentU);
    onStateChangeRef.current({
      phi: currentArrowPhi,
      u: currentU,
      blochVector: bloch,
      gateName: currentState.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStateIndex, transitionProgress, isAnimating, computeBlochVector]);


  // ── Main visualization renderer ──────────────────────────────────────────
  const renderVisualization = () => {
    const spinorQuat = getCurrentQuaternion();

    const xAxisRot = [project3D([1.4, 0, 0], spinorQuat), project3D([-1.4, 0, 0], spinorQuat)];
    const yAxisRot = [project3D([0, 1.4, 0], spinorQuat), project3D([0, -1.4, 0], spinorQuat)];
    const zAxisRot = [project3D([0, 0, 1.4], spinorQuat), project3D([0, 0, -1.4], spinorQuat)];

    // Use the pre-computed interpolated state
    const u = currentU;
    const arrowPhi = currentArrowPhi;
    let visualScale = currentState.radiusScale ?? 1.0;
    if (isAnimating) {
      const nextState = spinors[(currentStateIndex + 1) % spinors.length];
      const easedProgress = easeInOutCubic(transitionProgress);
      const nextScale = nextState.radiusScale ?? 1.0;
      visualScale = visualScale * (1 - easedProgress) + nextScale * easedProgress;
    }

    // ── Green = |0⟩ (φ ≈ 0), Blue = |1⟩ (φ ≈ π/2) ───────────────────────
    // t = 1 at φ=0 (pure |0⟩), t = 0 at φ=π (equivalent to |0⟩ with global phase −1)
    // Use |cos φ| so states near |1⟩ (φ ≈ π/2) map to t ≈ 0 → blue.
    const sphereColor = (() => {
      const t = Math.abs(Math.cos(arrowPhi)); // 1 at |0⟩, 0 at |1⟩
      const r = Math.round(37  + (34  - 37)  * t); // blue(37)  → green(34)
      const g = Math.round(99  + (197 - 99)  * t); // blue(99)  → green(197)
      const b = Math.round(235 + (94  - 235) * t); // blue(235) → green(94)
      return `rgb(${r}, ${g}, ${b})`;
    })();

    const sphereScale = Math.abs(Math.cos(arrowPhi)) * 1.953125 * visualScale;
    const rotAxisStart = project3D([0, 0, 0]);

    const arrowheadOffset = 0.3;
    const goldArrowLength = Math.max(0, sphereScale - arrowheadOffset);
    const goldArrowEnd = project3D([u.x * goldArrowLength, u.y * goldArrowLength, u.z * goldArrowLength]);
    const arrowHeadScale = Math.abs(Math.cos(arrowPhi));
    const markerSize = 7.5 * Math.max(0.4, arrowHeadScale);
    const refY = 2.25 * Math.max(0.4, arrowHeadScale);

    return (
      <svg
        width={W}
        height={H}
        className="cursor-grab active:cursor-grabbing"
        style={{ display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <rect width={W} height={H} fill="#0b0e13" />
        {renderStars()}
        {renderPath()}
        {renderSphere(spinorQuat, 0.95, sphereColor, 2.0, true, sphereScale)}

        {/* Rotation axes */}
        <line x1={xAxisRot[0].x} y1={xAxisRot[0].y} x2={xAxisRot[1].x} y2={xAxisRot[1].y} stroke="#ef4444" strokeWidth="2.5" opacity="0.9" />
        <line x1={yAxisRot[0].x} y1={yAxisRot[0].y} x2={yAxisRot[1].x} y2={yAxisRot[1].y} stroke="#22c55e" strokeWidth="2.5" opacity="0.9" />
        <line x1={zAxisRot[0].x} y1={zAxisRot[0].y} x2={zAxisRot[1].x} y2={zAxisRot[1].y} stroke="#3b82f6" strokeWidth="2.5" opacity="0.9" />

        {/* Orientation arrow */}
        <defs>
          <marker id="arrowhead-dynamic" markerWidth={markerSize} markerHeight={markerSize}
            refX={0} refY={refY} orient="auto">
            <polygon points={`0 0, ${markerSize} ${refY}, 0 ${markerSize * 0.6}`} fill="#ffe066" />
          </marker>
        </defs>
        <line
          x1={rotAxisStart.x} y1={rotAxisStart.y} x2={goldArrowEnd.x} y2={goldArrowEnd.y}
          stroke="#ffe066" strokeWidth={7.5 * Math.max(0.5, arrowHeadScale)} opacity="0.9"
          markerEnd="url(#arrowhead-dynamic)"
        />

        {/* Title + formula using SVG text (KaTeX not available in SVG) */}
        <text x={W / 2} y={25} textAnchor="middle" fontSize={28} fill="#ffffff" fontFamily="serif">
          Quaternionic Wavefunction
        </text>
        <text x={W / 2} y={65} textAnchor="middle" fontSize={30} fill="#cbd5e1" fontWeight="700" fontFamily="serif" fontStyle="italic">
          q = cos φ + <tspan fontWeight="800">u</tspan> sin φ
        </text>

        {/* Legend */}
        <text x={20} y={H - 42} textAnchor="start" fontSize={18} fill="#ffffff">
          <tspan fontWeight="600">cos φ</tspan> = <tspan fill="#60a5fa">sphere size</tspan>
        </text>
        <text x={20} y={H - 18} textAnchor="start" fontSize={18} fill="#ffffff">
          <tspan fontWeight="600">u sin φ</tspan> = <tspan fill={sphereColor}>orientation</tspan>
        </text>
        <text x={W - 20} y={H - 18} textAnchor="end" fontSize={18} fill="#ffffff" fontFamily="serif">
          Gate: <tspan fill={sphereColor} fontWeight="700">{currentState.name}</tspan>
        </text>
      </svg>
    );
  };

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '6px',
    border: active ? '1px solid #22d3ee' : '1px solid #475569',
    background: active ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
    color: active ? '#22d3ee' : '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  });

  return (
    <div className={className} style={{ background: '#0b0e13', borderRadius: '12px', overflow: 'hidden' }}>
      {renderVisualization()}

      {showControls && (
        <div style={{ padding: '16px', background: '#111827', borderTop: '2px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <button
              onClick={() => {
                setIsPlaying(!isPlaying);
                if (!isPlaying) phaseStartTimeRef.current = performance.now();
              }}
              style={buttonStyle(isPlaying)}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>

            <button
              onClick={() => {
                setShowPath(!showPath);
                if (!showPath) setPathHistory([]);
              }}
              style={buttonStyle(showPath)}
            >
              Path Tracing
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Gate:</span>
              <span style={{ color: '#22d3ee', fontSize: '14px', fontWeight: 600 }}>
                {spinors[currentStateIndex].name}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>φ:</span>
              <span style={{ color: '#ffffff', fontSize: '14px', fontFamily: 'monospace' }}>
                {spinors[currentStateIndex].phi0.toFixed(3)} rad
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
