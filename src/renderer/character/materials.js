import * as THREE from 'three';

const anisotropy = () => 4;

export function createGradientMap() {
  const data = new Uint8Array([132, 184, 224, 255]);
  const texture = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function canvasTexture(size, draw, { repeatX = 1, repeatY = 1, transparent = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = anisotropy();
  texture.needsUpdate = true;
  if (transparent) texture.premultiplyAlpha = false;
  return texture;
}

function seededRandom(seed = 1987) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function makeHeatherTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#d7d2ca';
    ctx.fillRect(0, 0, size, size);
    const random = seededRandom(33);
    for (let i = 0; i < 2200; i += 1) {
      const x = random() * size;
      const y = random() * size;
      const tone = random();
      ctx.fillStyle = tone > 0.55 ? 'rgba(71,66,61,0.13)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, random() > 0.8 ? 2 : 1, 1);
    }
    ctx.strokeStyle = 'rgba(112,106,99,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < size; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  }, { repeatX: 2.2, repeatY: 2.2 });
}

export function makePlaidTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#33476a';
    ctx.fillRect(0, 0, size, size);
    const random = seededRandom(87);
    for (let i = 0; i < 1600; i += 1) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(10,20,38,0.05)';
      ctx.fillRect(random() * size, random() * size, 1, 1);
    }
    const vertical = [
      { x: 26, w: 18, color: 'rgba(213,140,158,0.72)' },
      { x: 47, w: 2, color: 'rgba(255,245,239,0.75)' },
      { x: 142, w: 16, color: 'rgba(213,140,158,0.58)' },
      { x: 162, w: 2, color: 'rgba(255,245,239,0.68)' },
      { x: 204, w: 5, color: 'rgba(14,27,49,0.5)' }
    ];
    for (const line of vertical) {
      ctx.fillStyle = line.color;
      ctx.fillRect(line.x, 0, line.w, size);
    }
    const horizontal = [
      { y: 42, h: 3, color: 'rgba(238,180,190,0.55)' },
      { y: 72, h: 13, color: 'rgba(213,140,158,0.48)' },
      { y: 97, h: 2, color: 'rgba(255,245,239,0.66)' },
      { y: 183, h: 15, color: 'rgba(213,140,158,0.58)' },
      { y: 201, h: 2, color: 'rgba(255,245,239,0.7)' },
      { y: 226, h: 4, color: 'rgba(14,27,49,0.5)' }
    ];
    for (const line of horizontal) {
      ctx.fillStyle = line.color;
      ctx.fillRect(0, line.y, size, line.h);
    }
    ctx.strokeStyle = 'rgba(10,18,36,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < size; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y < size; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  }, { repeatX: 2.4, repeatY: 2.4 });
}

export function makePatchTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-0.1);
    ctx.fillStyle = '#f9f5e9';
    ctx.strokeStyle = '#d8cbb7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-92, -82, 184, 164, 38);
    ctx.fill();
    ctx.stroke();
    // dachshund body
    ctx.fillStyle = '#c58a51';
    ctx.beginPath();
    ctx.ellipse(-10, 6, 56, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(48, -20, 28, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#70462f';
    ctx.beginPath();
    ctx.ellipse(30, -28, 11, 24, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#70462f';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-32, 23);
    ctx.lineTo(-38, 42);
    ctx.moveTo(6, 24);
    ctx.lineTo(3, 44);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-62, 0);
    ctx.bezierCurveTo(-86, -12, -86, 4, -62, 10);
    ctx.strokeStyle = '#c58a51';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.fillStyle = '#2d2a26';
    ctx.beginPath();
    ctx.arc(64, -23, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b3524f';
    ctx.fillRect(32, 2, 30, 7);
    ctx.fillStyle = '#4f4840';
    ctx.font = 'italic 23px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('dog 1987', 0, 70);
    ctx.restore();
  }, { repeatX: 1, repeatY: 1, transparent: true });
}

export function makeBlushTexture() {
  return canvasTexture(128, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(231,120,126,0.5)');
    gradient.addColorStop(0.45, 'rgba(236,139,141,0.27)');
    gradient.addColorStop(1, 'rgba(236,139,141,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }, { transparent: true });
}

export function makeShadowTexture() {
  return canvasTexture(128, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(57,38,30,0.34)');
    gradient.addColorStop(0.55, 'rgba(57,38,30,0.16)');
    gradient.addColorStop(1, 'rgba(57,38,30,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }, { transparent: true });
}

export function makeHairTexture() {
  return canvasTexture(512, (ctx, size) => {
    ctx.fillStyle = '#3d281f';
    ctx.fillRect(0, 0, size, size);
    const random = seededRandom(641);
    for (let i = 0; i < 190; i += 1) {
      const x = random() * size;
      const alpha = 0.035 + random() * 0.08;
      ctx.strokeStyle = random() > 0.5 ? `rgba(141,88,54,${alpha})` : `rgba(24,14,10,${alpha})`;
      ctx.lineWidth = 1 + random() * 2.6;
      ctx.beginPath();
      const y = random() * size;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + random() * 30 - 15, y + 80, x + random() * 46 - 23, y + 160, x + random() * 55 - 27, y + 250);
      ctx.stroke();
    }
    // soft crown sheen
    for (let i = 0; i < 3; i += 1) {
      const gradient = ctx.createLinearGradient(0, 54 + i * 30, 0, 190 + i * 30);
      gradient.addColorStop(0, 'rgba(155,105,66,0)');
      gradient.addColorStop(0.45, 'rgba(155,105,66,0.13)');
      gradient.addColorStop(1, 'rgba(155,105,66,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 40 + i * 28, size, 180);
    }
  }, { repeatX: 1, repeatY: 1 });
}

export function makeCrabTexture() {
  return canvasTexture(512, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2 + 10);
    // soft paper label behind the print
    ctx.fillStyle = 'rgba(250, 242, 233, 0.9)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 198, 218, -0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(205, 189, 171, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // pink ribbon bow
    ctx.fillStyle = '#e9a9b5';
    ctx.beginPath();
    ctx.ellipse(-62, -150, 42, 25, -0.45, 0, Math.PI * 2);
    ctx.ellipse(58, -154, 42, 25, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d98597';
    ctx.beginPath();
    ctx.ellipse(0, -144, 20, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d98597';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-24, -126);
    ctx.lineTo(-48, -74);
    ctx.moveTo(25, -126);
    ctx.lineTo(48, -74);
    ctx.stroke();
    // crab body
    ctx.fillStyle = '#c94f47';
    ctx.beginPath();
    ctx.ellipse(0, 22, 118, 86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e06c61';
    ctx.beginPath();
    ctx.ellipse(0, -4, 94, 54, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs
    ctx.strokeStyle = '#b53f39';
    ctx.lineWidth = 16;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(side * 78, 20 + i * 24);
        ctx.bezierCurveTo(side * 130, 8 + i * 24, side * 160, 40 + i * 30, side * 174, 26 + i * 38);
        ctx.stroke();
      }
    }
    // claws
    ctx.fillStyle = '#c94f47';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 138, -68);
      ctx.rotate(side * -0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, 46, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(side * 28, 10);
      ctx.quadraticCurveTo(side * 80, -4, side * 88, -40);
      ctx.quadraticCurveTo(side * 40, -20, side * 24, 4);
      ctx.fill();
      ctx.restore();
    }
    // eyes
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#f8eee4';
      ctx.beginPath();
      ctx.arc(side * 34, -42, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#35251e';
      ctx.beginPath();
      ctx.arc(side * 34, -40, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(side * 30, -45, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // cheeks + smile
    ctx.fillStyle = 'rgba(255, 169, 164, 0.7)';
    ctx.beginPath();
    ctx.ellipse(-66, 22, 18, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(66, 22, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c2c29';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 32, 30, 0.25, Math.PI - 0.25);
    ctx.stroke();
    // type
    ctx.fillStyle = '#c05e55';
    ctx.textAlign = 'center';
    ctx.font = 'italic 600 34px "Georgia", serif';
    ctx.fillText('SEAFOOD CLUB', 0, 154);
    ctx.font = '500 21px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(137, 89, 76, 0.75)';
    ctx.fillText('今天也要好好吃饭', 0, 186);
    ctx.restore();
  }, { transparent: true });
}

export function makeLogoTexture(text = 'CAMEL', dark = false) {
  return canvasTexture(256, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = dark ? '#2b2621' : '#fffdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 34px "Arial Narrow", "Microsoft YaHei", sans-serif';
    ctx.fillText(text, size / 2, size / 2);
  }, { transparent: true });
}

export function makeTortoiseTexture() {
  return canvasTexture(256, (ctx, size) => {
    ctx.fillStyle = '#4b2a17';
    ctx.fillRect(0, 0, size, size);
    const random = seededRandom(411);
    for (let i = 0; i < 42; i += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 8 + random() * 28;
      ctx.fillStyle = random() > 0.55 ? 'rgba(145,86,43,0.48)' : 'rgba(196,130,66,0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * (0.3 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 22; i += 1) {
      ctx.strokeStyle = 'rgba(38,19,10,0.30)';
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      const x = random() * size;
      const y = random() * size;
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + random() * 50 - 25, y + random() * 30, x + random() * 60 - 30, y + random() * 50, x + random() * 80 - 40, y + random() * 40);
      ctx.stroke();
    }
  }, { repeatX: 1, repeatY: 1 });
}

export function createMaterials(renderer) {
  const gradientMap = createGradientMap();
  const heather = makeHeatherTexture();
  const plaid = makePlaidTexture();
  const patch = makePatchTexture();
  const blush = makeBlushTexture();
  const shadow = makeShadowTexture();
  const tortoise = makeTortoiseTexture();
  const hair = makeHairTexture();
  const crab = makeCrabTexture();
  const logoLight = makeLogoTexture('CAMEL');
  const logoViolet = makeLogoTexture('OUTDOOR');
  if (renderer) {
    heather.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    plaid.anisotropy = heather.anisotropy;
    tortoise.anisotropy = heather.anisotropy;
    hair.anisotropy = heather.anisotropy;
    crab.anisotropy = heather.anisotropy;
    logoLight.anisotropy = heather.anisotropy;
    logoViolet.anisotropy = heather.anisotropy;
  }

  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap, ...extra });

  const materials = {
    skin: toon('#f2cdb7'),
    skinWarm: toon('#e9bb9f'),
    skinShade: toon('#dda98f'),
    lip: toon('#c8737c'),
    lipLight: toon('#e4a1a4'),
    mouthInner: new THREE.MeshBasicMaterial({ color: '#8e4049' }),
    tongue: new THREE.MeshBasicMaterial({ color: '#dd8f95' }),
    hair: toon('#3b261d'),
    hairShell: toon('#ffffff', { map: hair }),
    hairMid: toon('#593725'),
    hairWarm: toon('#7b4c31'),
    hairLight: toon('#956040'),
    brow: toon('#49301f'),
    eyeWhite: new THREE.MeshBasicMaterial({ color: '#fffaf4' }),
    iris: new THREE.MeshBasicMaterial({ color: '#5a6749' }),
    irisInner: new THREE.MeshBasicMaterial({ color: '#806f4b' }),
    pupil: new THREE.MeshBasicMaterial({ color: '#241b16' }),
    eyeHighlight: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    lash: new THREE.MeshBasicMaterial({ color: '#35241c' }),
    glass: new THREE.MeshStandardMaterial({ color: '#171514', roughness: 0.26, metalness: 0.1 }),
    glassLens: new THREE.MeshPhysicalMaterial({
      color: '#dbe9f2',
      transparent: true,
      opacity: 0.16,
      roughness: 0.06,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    }),
    glassShine: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.62, depthWrite: false }),
    gold: new THREE.MeshStandardMaterial({ color: '#d9aa4b', roughness: 0.28, metalness: 0.72 }),
    silver: new THREE.MeshStandardMaterial({ color: '#d6d9da', roughness: 0.25, metalness: 0.85 }),
    navy: toon('#203046'),
    navyDark: toon('#182331'),
    heather: toon('#f1efeb', { map: heather }),
    plaid: toon('#ffffff', { map: plaid }),
    plaidPlain: toon('#35496d'),
    pants: toon('#8496ac'),
    pantsCuff: toon('#6e8094'),
    sweaterRib: toon('#bcb6ad'),
    shoe: toon('#26303c'),
    shoeLight: toon('#eee8de'),
    sole: toon('#f7f2e9'),
    jade: new THREE.MeshStandardMaterial({ color: '#7da88f', roughness: 0.28, metalness: 0.05 }),
    highlighter: toon('#e6bf57'),
    highlighterCap: toon('#5a4a3a'),
    jacketDark: toon('#202127'),
    jacketNavy: toon('#202b3b'),
    jacketLilac: toon('#b6a1d1'),
    jacketLilacDark: toon('#9d86bc'),
    jacketIce: toon('#a9c4dd'),
    jacketIceDark: toon('#8faac6'),
    jacketWhite: toon('#e8e4de'),
    jacketStone: toon('#b4b2b7'),
    jacketStoneDark: toon('#98969b'),
    jacketTrim: toon('#34333a'),
    jacketLining: toon('#d9d1e3'),
    cargo: toon('#d8c6ab', { map: heather }),
    cargoDark: toon('#bcab94'),
    teeWhite: toon('#f3efe7', { map: heather }),
    crewWhite: toon('#ded7cc'),
    skirtNavy: toon('#263249'),
    skirtNavyDark: toon('#1d2639'),
    blackCloth: toon('#1b1b20'),
    blackClothSoft: toon('#29282f'),
    capBrown: toon('#6f5a42'),
    capBrim: toon('#504231'),
    zipper: new THREE.MeshStandardMaterial({ color: '#a9a9ab', roughness: 0.35, metalness: 0.65 }),
    snap: new THREE.MeshStandardMaterial({ color: '#47474a', roughness: 0.4, metalness: 0.35 }),
    crab: new THREE.MeshBasicMaterial({ map: crab, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    logoLight: new THREE.MeshBasicMaterial({ map: logoLight, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    logoViolet: new THREE.MeshBasicMaterial({ map: logoViolet, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    capLogo: new THREE.MeshBasicMaterial({ color: '#f3eadf', transparent: true }),
    chairFabric: toon('#9ca68f'),
    chairFabricDark: toon('#7d876f'),
    chairCushion: toon('#e7dbc9'),
    chairWood: toon('#7e5d43'),
    blanketPink: toon('#d9a6a3'),
    blanketCream: toon('#f0e5d8'),
    rug: toon('#cdbca9'),
    rugDark: toon('#bda48d'),
    cookie: toon('#bd8150'),
    chocolate: toon('#573620'),
    clip: new THREE.MeshStandardMaterial({ color: '#ffffff', map: tortoise, roughness: 0.34, metalness: 0.05 }),
    clipLight: new THREE.MeshStandardMaterial({ color: '#f1d3b4', map: tortoise, roughness: 0.28, metalness: 0.08 }),
    outline: new THREE.MeshBasicMaterial({ color: '#4a3025', side: THREE.BackSide }),
    outlineSoft: new THREE.MeshBasicMaterial({ color: '#6c4c3c', side: THREE.BackSide }),
    blush: new THREE.MeshBasicMaterial({ map: blush, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    shadow: new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false }),
    patch: new THREE.MeshBasicMaterial({ map: patch, transparent: true, depthWrite: false, alphaTest: 0.02, side: THREE.DoubleSide })
  };
  materials._textures = { gradientMap, heather, plaid, patch, blush, shadow, tortoise, hair, crab, logoLight, logoViolet };
  return materials;
}
