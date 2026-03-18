export type Quat = [number, number, number, number];
export type Vec3 = [number, number, number];

export function quatFromAxisAngle(axis: Vec3, angleRad: number): Quat {
  const [ax, ay, az] = axis;
  const len = Math.sqrt(ax * ax + ay * ay + az * az);
  if (len < 1e-10) return [1, 0, 0, 0];
  const s = Math.sin(angleRad / 2) / len;
  return [Math.cos(angleRad / 2), ax * s, ay * s, az * s];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function rotateVec3ByQuat(v: Vec3, q: Quat): Vec3 {
  const [vx, vy, vz] = v;
  const [qw, qx, qy, qz] = q;
  const vq: Quat = [0, vx, vy, vz];
  const qConj: Quat = [qw, -qx, -qy, -qz];
  const result = quatMultiply(quatMultiply(q, vq), qConj);
  return [result[1], result[2], result[3]];
}

export function quatNormalize(q: Quat): Quat {
  const [w, x, y, z] = q;
  const len = Math.sqrt(w * w + x * x + y * y + z * z);
  if (len < 1e-10) return [1, 0, 0, 0];
  return [w / len, x / len, y / len, z / len];
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  let dot = aw * bw + ax * bx + ay * by + az * bz;
  if (dot < 0) {
    aw = -aw; ax = -ax; ay = -ay; az = -az;
    dot = -dot;
  }
  if (dot > 0.9995) {
    const result: Quat = [
      aw + t * (bw - aw),
      ax + t * (bx - ax),
      ay + t * (by - ay),
      az + t * (bz - az),
    ];
    return quatNormalize(result);
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return quatNormalize([
    s0 * aw + s1 * bw,
    s0 * ax + s1 * bx,
    s0 * ay + s1 * by,
    s0 * az + s1 * bz,
  ]);
}
