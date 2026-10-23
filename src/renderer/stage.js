import * as THREE from 'three';
import { createXiaoshen } from './character/xiaoshen.js';

const CAMERA_FOV = 24;
const CAMERA_DISTANCE = 9.4;
const LOOK_Y = 1.65;

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  let quality = 'high';
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 60);
  camera.position.set(0, 1.84, CAMERA_DISTANCE);
  camera.lookAt(0, LOOK_Y, 0);

  const hemisphere = new THREE.HemisphereLight(0xfff4ea, 0x6d5a51, 1.0);
  scene.add(hemisphere);
  const ambient = new THREE.AmbientLight(0xffede1, 0.28);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.55);
  keyLight.position.set(3.2, 6.5, 7);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xc9dbff, 0.72);
  fillLight.position.set(-4.5, 3.8, 4.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffcfb5, 1.05);
  rimLight.position.set(-1.5, 4.8, -5.5);
  scene.add(rimLight);

  const character = createXiaoshen(renderer);
  scene.add(character.root);
  character.setView('front');

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerInside = false;
  let className = 'stretch';

  const size = { width: 1, height: 1 };
  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    size.width = width;
    size.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  function pointerToNdc(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    return pointer;
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return { hit: false, zone: null };
    }
    raycaster.setFromCamera(pointerToNdc(clientX, clientY), camera);
    const intersections = raycaster.intersectObject(character.root, true);
    const visible = (object) => {
      let node = object;
      while (node) {
        if (node.visible === false) return false;
        node = node.parent;
      }
      return true;
    };
    const found = intersections.find((item) => item.object.userData.zone && !item.object.userData.noHit && visible(item.object));
    if (!found) return { hit: false, zone: null };
    return { hit: true, zone: found.object.userData.zone, point: found.point };
  }

  function updatePointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      pointerInside = false;
      return;
    }
    pointerInside = true;
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    character.lookAtPointer(nx, ny, true);
  }

  let lastFrame = performance.now();
  let elapsed = 0;
  let running = true;
  let raf = 0;
  const perf = {
    fps: 0,
    frameCount: 0,
    fpsWindowStart: performance.now(),
    drawCalls: 0,
    triangles: 0,
    textures: 0
  };

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const rawDt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (document.hidden) return;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    elapsed += dt;
    character.update(dt, elapsed);

    // A tiny parallax keeps the figure feeling alive without compromising framing.
    const targetX = pointerInside ? (pointer.x * 0.07) : 0;
    const targetY = pointerInside ? (pointer.y * 0.035) : 0;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 2.5);
    camera.position.y += (1.84 + targetY - camera.position.y) * Math.min(1, dt * 2.5);
    camera.lookAt(0, LOOK_Y, 0);

    renderer.render(scene, camera);

    perf.frameCount += 1;
    const since = now - perf.fpsWindowStart;
    if (since >= 1000) {
      perf.fps = Math.round((perf.frameCount * 1000) / since);
      perf.frameCount = 0;
      perf.fpsWindowStart = now;
      perf.drawCalls = renderer.info.render.calls;
      perf.triangles = renderer.info.render.triangles;
      perf.textures = renderer.info.memory.textures;
    }
  }

  raf = requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      lastFrame = performance.now();
    }
  });

  function setQuality(next) {
    quality = next === 'power' ? 'power' : 'high';
    renderer.setPixelRatio(quality === 'power' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    resize();
    return quality;
  }

  function renderPortrait({ withBackground = true } = {}) {
    const previous = {
      view: character.state.view,
      targetView: character.state.targetView,
      autoRotate: character.state.autoRotate,
      scale: character.state.baseScale
    };
    character.setAutoRotate(false);
    character.setScale(1.03);
    character.setView('front');
    character.state.view = 0;
    character.state.targetView = 0;
    character.update(0.016, performance.now() / 1000);
    camera.position.x = 0;
    camera.position.y = 1.84;
    camera.lookAt(0, LOOK_Y, 0);
    renderer.render(scene, camera);
    const source = renderer.domElement;
    if (!withBackground) {
      character.setScale(previous.scale);
      return source.toDataURL('image/png');
    }

    const out = document.createElement('canvas');
    out.width = 1080;
    out.height = 1350;
    const ctx = out.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, out.height);
    gradient.addColorStop(0, '#fdf7f0');
    gradient.addColorStop(0.55, '#f8ece1');
    gradient.addColorStop(1, '#f1e2d5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, out.width, out.height);

    // Soft studio arch behind the figure.
    ctx.save();
    ctx.fillStyle = 'rgba(255, 252, 247, 0.55)';
    ctx.beginPath();
    ctx.roundRect(210, 250, 660, 930, 330);
    ctx.fill();
    ctx.restore();

    const glow = ctx.createRadialGradient(out.width / 2, 650, 30, out.width / 2, 650, 600);
    glow.addColorStop(0, 'rgba(255,255,255,0.88)');
    glow.addColorStop(0.67, 'rgba(255,248,240,0.25)');
    glow.addColorStop(1, 'rgba(255,248,240,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, out.width, out.height);

    // Crop the transparent stage to the character so the portrait feels intentional.
    const cropX = Math.round(source.width * 0.25);
    const cropY = 0;
    const cropW = Math.round(source.width * 0.5);
    const cropH = Math.round(source.height * 0.99);
    const drawH = 1070;
    const drawW = (cropW / cropH) * drawH;
    ctx.drawImage(source, cropX, cropY, cropW, cropH, (out.width - drawW) / 2, 90, drawW, drawH);

    // Small warm accents that echo the desktop UI.
    ctx.fillStyle = 'rgba(200, 162, 104, 0.5)';
    ctx.beginPath();
    ctx.arc(250, 420, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(850, 560, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(215, 137, 125, 0.42)';
    ctx.beginPath();
    ctx.arc(814, 330, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5d4238';
    ctx.textAlign = 'center';
    ctx.font = '600 62px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText('小 申', out.width / 2, 1248);
    ctx.font = '500 22px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(93,66,56,0.62)';
    ctx.fillText('XIAO SHEN · 今天也在这里陪你', out.width / 2, 1295);

    character.setView(previous.targetView);
    character.state.view = previous.view;
    character.state.targetView = previous.targetView;
    character.setAutoRotate(previous.autoRotate);
    character.setScale(previous.scale);
    return out.toDataURL('image/png');
  }

  return {
    renderer,
    scene,
    camera,
    character,
    hitTest,
    updatePointer,
    setQuality,
    renderPortrait,
    get canvas() { return canvas; },
    get perf() {
      return {
        ...perf,
        pixelRatio: renderer.getPixelRatio(),
        quality,
        elapsed,
        rendererInfo: {
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          programs: renderer.info.programs?.length ?? 0
        }
      };
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      character.dispose();
      renderer.dispose();
    }
  };
}
