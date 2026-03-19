/**
 * Hypersphere Visualization - Export-Ready Component
 * 
 * Interactive 3D visualization of quaternionic wavefunction on a hypersphere.
 * Shows the quaternion q = cos φ + u sin φ with dynamic sphere sizing based on |cos φ|.
 * 
 * DEPENDENCIES (install these in your project):
 *   npm install react
 * 
 * USAGE:
 *   import HypersphereVisualization from './HypersphereVisualization';
 *   
 *   function App() {
 *     return <HypersphereVisualization width={900} height={700} />;
 *   }
 */

import { useState, useEffect, useRef } from 'react';

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
}

export default function HypersphereVisualization({
  width = 900,
  height = 700,
  className = '',
  showControls = true
}: HypersphereVisualizationProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [, setStarTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const [pathHistory, setPathHistory] = useState<Array<{x: number, y: number, z: number}>>([]);
  const [showPath, setShowPath] = useState(true);

  const W = width;
  const H = height;
  const FOV = 600;

  const viewQuatRef = useRef<[number, number, number, number]>([0.404, 0.058, 0.905, 0.128]);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const starsRef = useRef<Array<{ x: number; y: number; radius: number; opacity: number; vx: number; vy: number }>>([]);
  const phaseStartTimeRef = useRef(performance.now());
  
  const currentStateIndexRef = useRef(currentStateIndex);
  const isAnimatingRef = useRef(isAnimating);
  const transitionProgressRef = useRef(transitionProgress);
  const spinorsRef = useRef<SpinorConfig[]>([]);
  const visualScaleRef = useRef(1.0);
  const isPlayingRef = useRef(isPlaying);

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

  const defaultSpinors: SpinorConfig[] = [
    { name: "I", u: { x: 0, y: 0, z: 1 }, omega: 0, color: "#a8d4f0", phi0: 0, radiusScale: 0.609 },
    { name: "X₀", u: { x: 1, y: 0, z: 0 }, omega: 0, color: "#a8f0b8", phi0: 2 * Math.PI / 5, radiusScale: 0.696 },
    { name: "X₁", u: { x: 1, y: 0, z: 0 }, omega: 0, color: "#a8d4f0", phi0: 2 * Math.PI / 3, radiusScale: 0.928 },
    { name: "Y₂", u: { x: 0, y: 1, z: 0 }, omega: 0, color: "#a8f0b8", phi0: Math.PI / 6, radiusScale: 0.696 },
    { name: "Z₃", u: { x: 0, y: 0, z: 1 }, omega: 0, color: "#a8d4f0", phi0: Math.PI / 4, radiusScale: 0.928 },
    { name: "H₄", u: { x: 0.707107, y: 0, z: 0.707107 }, omega: 0, color: "#a8f0b8", phi0: 3 * Math.PI / 4, radiusScale: 0.928 },
    { name: "T₅", u: { x: 0, y: 0, z: 1 }, omega: 0, color: "#a8d4f0", phi0: Math.PI / 5, radiusScale: 0.861 },
    { name: "Y₆", u: { x: 0, y: 1, z: 0 }, omega: 0, color: "#a8f0b8", phi0: Math.PI / 3, radiusScale: 0.861 },
    { name: "Xπ", u: { x: 1, y: 0, z: 0 }, omega: 0, color: "#a8d4f0", phi0: 5 * Math.PI / 6, radiusScale: 0.928 },
  ];

  const spinors = defaultSpinors;

  useEffect(() => {
    spinorsRef.current = spinors;
  }, [spinors]);

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

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
        vy: 0
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
        
        starsRef.current.forEach(star => {
          star.x += star.vx;
          star.y += star.vy;
          
          if (star.x < 0) star.x += W;
          if (star.x > W) star.x -= W;
          if (star.y < 0) star.y += H;
          if (star.y > H) star.y -= H;
        });
        
        setStarTick(tick => tick + 1);
      }
      
      animationId = requestAnimationFrame(updateStars);
    };
    
    animationId = requestAnimationFrame(updateStars);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [W, H]);

  useEffect(() => {
    if (!isPlaying) return;
    
    let animationId: number;
    const STATIC_DURATION = 3125;
    const TRANSITION_DURATION = 6250;
    
    const animate = () => {
      if (!isPlayingRef.current) return;
      
      const now = performance.now();
      const elapsed = now - phaseStartTimeRef.current;
      const currentPhaseDuration = isAnimating ? TRANSITION_DURATION : STATIC_DURATION;
      
      if (elapsed >= currentPhaseDuration) {
        if (isAnimating) {
          setCurrentStateIndex(prev => (prev + 1) % spinors.length);
          setIsAnimating(false);
          setTransitionProgress(0);
        } else {
          setIsAnimating(true);
          setTransitionProgress(0);
        }
        phaseStartTimeRef.current = now;
      } else if (isAnimating) {
        setTransitionProgress(elapsed / TRANSITION_DURATION);
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [spinors.length, isAnimating, isPlaying]);

  useEffect(() => {
    if (!showPath) return;
    
    let animationId: number;
    const MAX_PATH_LENGTH = 80;
    
    const updatePath = () => {
      const stateIndex = currentStateIndexRef.current;
      const activeSpinors = spinorsRef.current;
      if (!activeSpinors.length) return;
      
      const currentState = activeSpinors[stateIndex % activeSpinors.length];
      let u = { x: currentState.u.x, y: currentState.u.y, z: currentState.u.z };
      let phi = currentState.phi0;
      let visualScale = currentState.radiusScale ?? 1.0;
      
      if (isAnimatingRef.current) {
        const nextState = activeSpinors[(stateIndex + 1) % activeSpinors.length];
        const easedProgress = easeInOutCubic(transitionProgressRef.current);
        u = {
          x: currentState.u.x * (1 - easedProgress) + nextState.u.x * easedProgress,
          y: currentState.u.y * (1 - easedProgress) + nextState.u.y * easedProgress,
          z: currentState.u.z * (1 - easedProgress) + nextState.u.z * easedProgress,
        };
        phi = currentState.phi0 * (1 - easedProgress) + nextState.phi0 * easedProgress;
        
        const nextScale = nextState.radiusScale ?? 1.0;
        visualScale = visualScale * (1 - easedProgress) + nextScale * easedProgress;
        
        const uLen = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
        u.x /= uLen; u.y /= uLen; u.z /= uLen;
      }
      
      visualScaleRef.current = visualScale;
      
      const pathRadius = Math.abs(Math.cos(phi)) * 1.953125 * visualScale;
      const tipPos = { 
        x: u.x * pathRadius, 
        y: u.y * pathRadius, 
        z: u.z * pathRadius 
      };
      
      setPathHistory(prev => {
        const lastPos = prev[prev.length - 1];
        if (lastPos) {
          const dx = tipPos.x - lastPos.x;
          const dy = tipPos.y - lastPos.y;
          const dz = tipPos.z - lastPos.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist < 0.01) return prev;
        }
        
        const newPath = [...prev, tipPos];
        return newPath.length > MAX_PATH_LENGTH ? newPath.slice(-MAX_PATH_LENGTH) : newPath;
      });
      
      animationId = requestAnimationFrame(updatePath);
    };
    
    animationId = requestAnimationFrame(updatePath);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [showPath]);

  const quatMul = (a: number[], b: number[]): number[] => {
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ];
  };

  const quatSlerp = (q1: number[], q2: number[], t: number): number[] => {
    let dot = q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3];
    
    let q2adj = [...q2];
    if (dot < 0) {
      dot = -dot;
      q2adj = [-q2[0], -q2[1], -q2[2], -q2[3]];
    }
    
    if (dot > 0.9995) {
      const result = [
        q1[0] + t * (q2adj[0] - q1[0]),
        q1[1] + t * (q2adj[1] - q1[1]),
        q1[2] + t * (q2adj[2] - q1[2]),
        q1[3] + t * (q2adj[3] - q1[3]),
      ];
      const len = Math.sqrt(result[0] * result[0] + result[1] * result[1] + result[2] * result[2] + result[3] * result[3]);
      return [result[0] / len, result[1] / len, result[2] / len, result[3] / len];
    }
    
    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const w1 = Math.sin((1 - t) * theta) / sinTheta;
    const w2 = Math.sin(t * theta) / sinTheta;
    
    return [
      w1 * q1[0] + w2 * q2adj[0],
      w1 * q1[1] + w2 * q2adj[1],
      w1 * q1[2] + w2 * q2adj[2],
      w1 * q1[3] + w2 * q2adj[3],
    ];
  };

  const rotateVecByQuat = (v: [number, number, number], q: number[]): [number, number, number] => {
    const qConj = [q[0], -q[1], -q[2], -q[3]];
    const vq = [0, v[0], v[1], v[2]];
    const tmp = quatMul(q, vq);
    const res = quatMul(tmp, qConj);
    return [res[1], res[2], res[3]];
  };

  const project3D = (p: [number, number, number], extraQuat?: number[]): { x: number; y: number; z: number } => {
    let v3 = p;
    if (extraQuat) {
      v3 = rotateVecByQuat(p, extraQuat);
    }
    v3 = rotateVecByQuat(v3, viewQuatRef.current);
    const scale = 280;
    const v = [v3[0] * scale, v3[1] * scale, v3[2] * scale + 300];
    const persp = FOV / (FOV + v[2]);
    return {
      x: v[0] * persp + W / 2,
      y: -v[1] * persp + H / 2,
      z: v[2]
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lastMouseRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    const sensitivity = 0.01;
    const axis: [number, number, number] = [dy, dx, 0];
    const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
    
    if (len > 0) {
      const normAxis: [number, number, number] = [axis[0] / len, axis[1] / len, axis[2] / len];
      const angle = len * sensitivity;
      const s = Math.sin(angle / 2);
      const dq = [Math.cos(angle / 2), normAxis[0] * s, normAxis[1] * s, normAxis[2] * s];
      viewQuatRef.current = quatMul(dq, viewQuatRef.current) as [number, number, number, number];
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    lastMouseRef.current = null;
  };

  const renderSphere = (extraQuat: number[] | null, opacity: number, strokeColor: string, strokeWidth: number, fillNorthern?: boolean, scale: number = 1.0) => {
    const sphereElements: JSX.Element[] = [];
    const latitudes = 24;
    const longitudes = 32;

    for (let i = 0; i <= latitudes; i++) {
      const theta = (i / latitudes) * Math.PI;
      const r = Math.sin(theta) * scale;
      const z = Math.cos(theta) * scale;
      
      const pts: Array<{ x: number; y: number; z: number }> = [];
      for (let j = 0; j <= longitudes; j++) {
        const phi = (j / longitudes) * Math.PI * 2;
        const x = r * Math.cos(phi);
        const y = r * Math.sin(phi);
        pts.push(project3D([x, y, z], extraQuat || undefined));
      }
      
      const d = pts.map((pt, pidx) => `${pidx === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`).join(' ');
      sphereElements.push(<path key={`lat-${i}`} d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" opacity={opacity} />);
    }

    for (let j = 0; j < longitudes; j++) {
      const phi = (j / longitudes) * Math.PI * 2;
      const pts: Array<{ x: number; y: number; z: number }> = [];
      
      for (let i = 0; i <= latitudes; i++) {
        const theta = (i / latitudes) * Math.PI;
        const r = Math.sin(theta) * scale;
        const z = Math.cos(theta) * scale;
        const x = r * Math.cos(phi);
        const y = r * Math.sin(phi);
        pts.push(project3D([x, y, z], extraQuat || undefined));
      }
      
      const d = pts.map((pt, pidx) => `${pidx === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`).join(' ');
      sphereElements.push(<path key={`lon-${j}`} d={d} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" opacity={opacity} />);
    }

    if (fillNorthern && extraQuat) {
      const northernCap: JSX.Element[] = [];
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
          
          const path = `M ${p1.x},${p1.y} L ${p2.x},${p2.y} L ${p3.x},${p3.y} L ${p4.x},${p4.y} Z`;
          northernCap.push(<path key={`cap-${i}-${j}`} d={path} fill={strokeColor} opacity={0.15} stroke="none" />);
        }
      }
      sphereElements.push(...northernCap);
    }

    return sphereElements;
  };

  const renderStars = () => {
    return starsRef.current.map((star, i) => (
      <circle
        key={`star-${i}`}
        cx={star.x}
        cy={star.y}
        r={star.radius}
        fill="white"
        opacity={star.opacity}
      />
    ));
  };

  const renderPath = () => {
    if (!showPath || pathHistory.length < 2) return null;
    
    const pathElements: JSX.Element[] = [];
    
    for (let i = 0; i < pathHistory.length - 1; i++) {
      const p1 = pathHistory[i];
      const p2 = pathHistory[i + 1];
      
      const proj1 = project3D([p1.x, p1.y, p1.z]);
      const proj2 = project3D([p2.x, p2.y, p2.z]);
      
      const t = i / (pathHistory.length - 1);
      const opacity = 0.3 + t * 0.7;
      const strokeWidth = 3 + t * 5;
      
      pathElements.push(
        <line
          key={`path-${i}`}
          x1={proj1.x}
          y1={proj1.y}
          x2={proj2.x}
          y2={proj2.y}
          stroke="#ffffff"
          strokeWidth={strokeWidth}
          opacity={opacity}
          strokeLinecap="round"
        />
      );
    }
    
    return pathElements;
  };

  const makeQuatFromState = (state: SpinorConfig) => {
    const u = { x: state.u.x, y: state.u.y, z: state.u.z };
    const len = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
    u.x /= len; u.y /= len; u.z /= len;
    const halfPhi = state.phi0 / 2;
    const w = Math.cos(halfPhi);
    const sinp = Math.sin(halfPhi);
    return [w, u.x * sinp, u.y * sinp, u.z * sinp];
  };

  const getCurrentQuaternion = (): number[] => {
    const currentState = spinors[currentStateIndex];
    const nextState = spinors[(currentStateIndex + 1) % spinors.length];
    const currentQuat = makeQuatFromState(currentState);
    const nextQuat = makeQuatFromState(nextState);
    const easedProgress = easeInOutCubic(transitionProgress);
    return isAnimating ? quatSlerp(currentQuat, nextQuat, easedProgress) : currentQuat;
  };

  const renderVisualization = () => {
    const spinorQuat = getCurrentQuaternion();
    const currentState = spinors[currentStateIndex];

    const xAxisRot = [project3D([1.4, 0, 0], spinorQuat), project3D([-1.4, 0, 0], spinorQuat)];
    const yAxisRot = [project3D([0, 1.4, 0], spinorQuat), project3D([0, -1.4, 0], spinorQuat)];
    const zAxisRot = [project3D([0, 0, 1.4], spinorQuat), project3D([0, 0, -1.4], spinorQuat)];

    let u = { x: currentState.u.x, y: currentState.u.y, z: currentState.u.z };
    let arrowPhi = currentState.phi0;
    let visualScale = currentState.radiusScale ?? 1.0;
    
    if (isAnimating) {
      const nextState = spinors[(currentStateIndex + 1) % spinors.length];
      const easedProgress = easeInOutCubic(transitionProgress);
      u = {
        x: currentState.u.x * (1 - easedProgress) + nextState.u.x * easedProgress,
        y: currentState.u.y * (1 - easedProgress) + nextState.u.y * easedProgress,
        z: currentState.u.z * (1 - easedProgress) + nextState.u.z * easedProgress
      };
      arrowPhi = currentState.phi0 * (1 - easedProgress) + nextState.phi0 * easedProgress;
      const nextScale = nextState.radiusScale ?? 1.0;
      visualScale = visualScale * (1 - easedProgress) + nextScale * easedProgress;
    }
    
    const uLen = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
    u.x /= uLen; u.y /= uLen; u.z /= uLen;
    
    const sphereColor = (() => {
      const cosPhi = Math.cos(arrowPhi);
      const t = (cosPhi + 1) / 2;
      let r, g, b;
      if (t >= 0.5) {
        const s = (t - 0.5) * 2;
        r = Math.round(147 + (91 - 147) * s);
        g = Math.round(112 + (155 - 112) * s);
        b = Math.round(219 + (213 - 219) * s);
      } else {
        const s = t * 2;
        r = Math.round(214 + (147 - 214) * s);
        g = Math.round(140 + (112 - 140) * s);
        b = Math.round(69 + (219 - 69) * s);
      }
      return `rgb(${r}, ${g}, ${b})`;
    })();

    const rotAxisStart = project3D([0, 0, 0]);

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
        
        {renderSphere(spinorQuat, 0.95, sphereColor, 2.0, true, Math.abs(Math.cos(arrowPhi)) * 1.953125 * visualScale)}
        
        <line x1={xAxisRot[0].x} y1={xAxisRot[0].y} x2={xAxisRot[1].x} y2={xAxisRot[1].y} stroke="#ef4444" strokeWidth="2.5" opacity="0.9" />
        <line x1={yAxisRot[0].x} y1={yAxisRot[0].y} x2={yAxisRot[1].x} y2={yAxisRot[1].y} stroke="#22c55e" strokeWidth="2.5" opacity="0.9" />
        <line x1={zAxisRot[0].x} y1={zAxisRot[0].y} x2={zAxisRot[1].x} y2={zAxisRot[1].y} stroke="#3b82f6" strokeWidth="2.5" opacity="0.9" />

        {(() => {
          const sphereRadius = Math.abs(Math.cos(arrowPhi)) * 1.953125 * visualScale;
          const arrowHeadScale = Math.abs(Math.cos(arrowPhi));
          const markerSize = 7.5 * Math.max(0.4, arrowHeadScale);
          const refY = 2.25 * Math.max(0.4, arrowHeadScale);
          const arrowheadOffset = markerSize * 0.012;
          
          const goldArrowLength = Math.max(0, sphereRadius - arrowheadOffset);
          const goldArrowEnd = project3D([u.x * goldArrowLength, u.y * goldArrowLength, u.z * goldArrowLength]);
          
          const refX = 0;
          
          return (
            <>
              <defs>
                <marker 
                  id="arrowhead-dynamic" 
                  markerWidth={markerSize} 
                  markerHeight={markerSize} 
                  refX={refX} 
                  refY={refY} 
                  orient="auto"
                >
                  <polygon points={`0 0, ${markerSize} ${refY}, 0 ${markerSize * 0.6}`} fill="#ffe066" />
                </marker>
              </defs>
              <line 
                x1={rotAxisStart.x} 
                y1={rotAxisStart.y} 
                x2={goldArrowEnd.x} 
                y2={goldArrowEnd.y} 
                stroke="#ffe066" 
                strokeWidth={7.5 * Math.max(0.5, arrowHeadScale)} 
                opacity="0.9"
                markerEnd="url(#arrowhead-dynamic)"
              />
            </>
          );
        })()}

        <text x={W / 2} y={25} textAnchor="middle" fontSize={28} fill="#ffffff" fontFamily="serif">
          Quaternionic Wavefunction
        </text>
        <text x={W / 2} y={70} textAnchor="middle" fontSize={34} fill="#cbd5e1" fontWeight="700" fontFamily="serif" fontStyle="italic">
          q = α₀ + α₁i + β₀j + β₁k
        </text>
        
        <text x={20} y={H - 42} textAnchor="start" fontSize={18} fill="#ffffff">
          <tspan fontWeight="600">cos φ</tspan> = <tspan fill="#60a5fa">sphere size</tspan>
        </text>
        <text x={20} y={H - 18} textAnchor="start" fontSize={18} fill="#ffffff">
          <tspan fontWeight="600">u sin φ</tspan> = <tspan fill={sphereColor}>orientation</tspan>
        </text>
        <text x={W - 20} y={H - 30} textAnchor="end" fontSize={24} fill="#ffffff" fontFamily="serif">
          q = cos φ + <tspan fontWeight="600">u</tspan> sin φ
        </text>
      </svg>
    );
  };

  const buttonStyle = (active: boolean) => ({
    padding: '8px 16px',
    borderRadius: '6px',
    border: active ? '1px solid #22d3ee' : '1px solid #475569',
    background: active ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
    color: active ? '#22d3ee' : '#94a3b8',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500
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
                if (!isPlaying) {
                  phaseStartTimeRef.current = performance.now();
                }
              }}
              style={buttonStyle(isPlaying)}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            
            <button
              onClick={() => {
                setShowPath(!showPath);
                if (!showPath) {
                  setPathHistory([]);
                }
              }}
              style={buttonStyle(showPath)}
            >
              Path Tracing
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>State:</span>
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
