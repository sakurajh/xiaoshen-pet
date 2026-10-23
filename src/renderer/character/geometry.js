import * as THREE from 'three';

export function ellipsoid(rx, ry, rz, material, widthSegments = 48, heightSegments = 32) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, widthSegments, heightSegments), material);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

export function capsule(radius, length, material, capSegments = 8, radialSegments = 20) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments), material);
}

export function toonSphere(rx, ry, rz, material, sculpt = null) {
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  if (sculpt) {
    const pos = geometry.attributes.position;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      vertex.fromBufferAttribute(pos, i);
      sculpt(vertex);
      pos.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geometry.computeVertexNormals();
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

export function taperedStrand({
  points,
  radius = () => 0.05,
  flatten = 0.65,
  segments = 30,
  radialSegments = 8,
  material,
  closedTip = true
}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), false, 'centripetal');
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    const r = Math.max(0.0005, radius(t));
    for (let j = 0; j < radialSegments; j += 1) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const nx = Math.cos(angle) * r;
      const ny = Math.sin(angle) * r * flatten;
      positions.push(
        p.x + n.x * nx + b.x * ny,
        p.y + n.y * nx + b.y * ny,
        p.z + n.z * nx + b.z * ny
      );
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * radialSegments + j;
      const bb = i * radialSegments + ((j + 1) % radialSegments);
      const c = (i + 1) * radialSegments + j;
      const d = (i + 1) * radialSegments + ((j + 1) % radialSegments);
      indices.push(a, c, bb, bb, c, d);
    }
  }
  if (closedTip) {
    // tiny fan caps keep the silhouette solid when viewed from the back
    const rootIndex = positions.length / 3;
    const root = curve.getPointAt(0);
    positions.push(root.x, root.y, root.z);
    for (let j = 0; j < radialSegments; j += 1) {
      indices.push(rootIndex, (j + 1) % radialSegments, j);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

export function tubeAlong(points, radius, material, segments = 40, radialSegments = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), false, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
  return new THREE.Mesh(geometry, material);
}

export function arcTube(radius, tubeRadius, arc, material, segments = 24, radialSegments = 6) {
  const curve = new THREE.Curve();
  curve.getPoint = (t) => {
    const angle = -Math.PI / 2 + t * arc;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  };
  curve.getPointAt = curve.getPoint;
  const geometry = new THREE.TubeGeometry(curve, segments, tubeRadius, radialSegments, false);
  return new THREE.Mesh(geometry, material);
}

export function addOutline(mesh, material, thickness = 1.022) {
  const outline = new THREE.Mesh(mesh.geometry, material);
  outline.scale.setScalar(thickness);
  outline.renderOrder = -1;
  mesh.add(outline);
  return outline;
}

export function createHairShellGeometry({
  widthSegments = 96,
  heightSegments = 64,
  faceWidth = 0.76,
  faceHeight = 0.96,
  hairline = 0.60,
  bottom = -0.63,
  sideBottom = null
} = {}) {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const positions = geometry.attributes.position;
  const index = geometry.index.array;
  const kept = [];
  const v = (i) => new THREE.Vector3().fromBufferAttribute(positions, index[i]);
  for (let i = 0; i < index.length; i += 3) {
    const a = v(i);
    const b = v(i + 1);
    const c = v(i + 2);
    const cx = (a.x + b.x + c.x) / 3;
    const cy = (a.y + b.y + c.y) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    const side = sideBottom ?? bottom;
    const backness = Math.min(1, Math.max(0, (-cz - 0.04) / 0.64));
    const eased = backness * backness * (3 - 2 * backness);
    const cutoff = side + (bottom - side) * eased;
    if (cy < cutoff) continue;
    const insideFace = cz > 0.10
      && cy < hairline
      && (cx * cx) / (faceWidth * faceWidth) + (cy * cy) / (faceHeight * faceHeight) < 1;
    if (insideFace) continue;
    kept.push(index[i], index[i + 1], index[i + 2]);
  }
  geometry.setIndex(kept);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createHairLeafGeometry({
  width = 0.12,
  height = 0.24,
  bend = 0,
  forward = 0.10,
  depth = 0.016
} = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.43, 0);
  shape.bezierCurveTo(-width * 0.62, -height * 0.30, bend - width * 0.46, -height * 0.63, bend, -height);
  shape.bezierCurveTo(bend + width * 0.52, -height * 0.54, width * 0.60, -height * 0.27, width * 0.43, 0);
  shape.quadraticCurveTo(0, 0.035, -width * 0.43, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: Math.min(0.008, depth * 0.5),
    bevelThickness: Math.min(0.006, depth * 0.4),
    bevelSegments: 2,
    curveSegments: 8
  });
  geometry.translate(0, 0, -depth / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = Math.min(1, Math.max(0, -y / height));
    const nx = Math.min(1, Math.abs(x) / (width * 0.62));
    const curvature = forward * Math.pow(t, 1.28) + 0.026 * (1 - nx * nx) * Math.sin(t * Math.PI);
    position.setZ(i, z + curvature);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function hairSurfaceZ(x, y, { rx = 0.725, ry = 0.69, rz = 0.665, centerY = 0.56 } = {}) {
  const nx = x / rx;
  const ny = (y - centerY) / ry;
  const inside = Math.max(0, 1 - nx * nx - ny * ny);
  return rz * Math.sqrt(inside);
}



// A rectangular panel wrapped onto the elliptical torso surface. Used for
// color-blocked jacket panels, pockets and the cutout neckline.
export function curvedPanelGeometry({
  width = 0.4,
  height = 0.3,
  yCenter = 1.1,
  xCenter = 0,
  radiusAt,
  zScale = 0.78,
  offset = 0.012,
  segmentsX = 24,
  segmentsY = 16
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= segmentsY; j += 1) {
    const v = j / segmentsY;
    const y = yCenter - height / 2 + height * v;
    const r = Math.max(0.035, radiusAt(y));
    for (let i = 0; i <= segmentsX; i += 1) {
      const u = i / segmentsX;
      const x = xCenter + (u - 0.5) * width;
      const ratio = Math.min(0.985, Math.abs(x) / r);
      const z = zScale * r * Math.sqrt(Math.max(0, 1 - ratio * ratio)) + offset;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < segmentsY; j += 1) {
    for (let i = 0; i < segmentsX; i += 1) {
      const a = j * (segmentsX + 1) + i;
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
