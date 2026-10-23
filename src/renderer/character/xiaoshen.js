import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createMaterials } from './materials.js';
import { normalizeOutfit } from '../features/outfits.js';
import { ellipsoid, capsule, toonSphere, taperedStrand, tubeAlong, arcTube, addOutline, createHairShellGeometry, createHairLeafGeometry, hairSurfaceZ, curvedPanelGeometry } from './geometry.js';

const HEAD_PIVOT_Y = 1.80;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function zone(mesh, name = 'body') {
  mesh.userData.zone = name;
  return mesh;
}

export function createXiaoshen(renderer) {
  const mats = createMaterials(renderer);
  const root = new THREE.Group();
  root.name = 'Xiaoshen';

  const rig = {
    root,
    mats,
    head: new THREE.Group(),
    eyes: {},
    mouth: {},
    arms: {},
    legs: {},
    hair: {},
    outfitGroups: {},
    cookie: null
  };

  rig.head.position.set(0, HEAD_PIVOT_Y, 0);
  rig.head.scale.setScalar(0.95);
  root.add(rig.head);

  // ---------- body ----------
  const body = new THREE.Group();
  body.position.y = 0;
  root.add(body);
  rig.body = body;

  const profile = [
    [0.02, 0.62], [0.27, 0.63], [0.33, 0.67], [0.36, 0.73],
    [0.368, 0.83], [0.364, 0.96], [0.352, 1.10], [0.334, 1.24],
    [0.312, 1.36], [0.282, 1.45], [0.228, 1.53], [0.145, 1.575], [0.02, 1.588]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torsoGeometry = new THREE.LatheGeometry(profile, 56);
  rig.torso = new THREE.Mesh(torsoGeometry, mats.heather);
  rig.torso.scale.z = 0.78;
  rig.torso.userData.zone = 'body';
  addOutline(rig.torso, mats.outline, 1.018);
  body.add(rig.torso);

  // ribbed sweatshirt hem (an open cylinder reads as a band rather than a plate)
  const hemMaterial = mats.sweaterRib.clone();
  hemMaterial.side = THREE.DoubleSide;
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.375, 0.06, 64, 1, true), hemMaterial);
  hem.position.set(0, 0.682, 0);
  hem.scale.z = 0.78;
  hem.userData.zone = 'body';
  body.add(hem);
  rig.outfitGroups.hem = hem;

  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.15, 0.26, 24), mats.skin);
  neck.position.set(0, 1.61, 0);
  neck.userData.zone = 'body';
  body.add(neck);
  const neckShade = ellipsoid(0.12, 0.07, 0.11, mats.skinShade);
  neckShade.position.set(0, 1.675, -0.035);
  body.add(neckShade);

  // sweater collar
  const sweaterCollar = new THREE.Group();
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.196, 0.057, 12, 40), mats.navy);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.scale.z = 0.82;
  sweaterCollar.add(collarRing);
  const collarInner = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.018, 8, 32), mats.navyDark);
  collarInner.rotation.x = Math.PI / 2;
  collarInner.position.y = 0.015;
  collarInner.scale.z = 0.82;
  sweaterCollar.add(collarInner);
  sweaterCollar.position.set(0, 1.575, 0);
  body.add(sweaterCollar);
  rig.outfitGroups.sweaterCollar = sweaterCollar;

  // shirt collar for the plaid outfit
  const shirtCollar = new THREE.Group();
  const collarShape = new THREE.Shape();
  collarShape.moveTo(0, 0.04);
  collarShape.lineTo(0.17, 0.10);
  collarShape.lineTo(0.185, 0.015);
  collarShape.lineTo(0.045, -0.12);
  collarShape.lineTo(0, -0.04);
  collarShape.closePath();
  const flapGeometry = new THREE.ExtrudeGeometry(collarShape, {
    depth: 0.018, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 4
  });
  const flapR = new THREE.Mesh(flapGeometry, mats.plaid);
  flapR.position.set(0.012, 1.58, 0.27);
  flapR.rotation.set(-0.24, 0.16, 0.04);
  const flapL = flapR.clone();
  flapL.scale.x = -1;
  flapL.position.x = -0.012;
  flapL.rotation.y = -0.16;
  const collarEdgeR = tubeAlong([
    [0.012, 1.62, 0.305], [0.10, 1.64, 0.315], [0.185, 1.585, 0.29]
  ], 0.008, mats.plaidPlain, 16, 4);
  const collarEdgeL = collarEdgeR.clone();
  collarEdgeL.scale.x = -1;
  shirtCollar.add(flapR, flapL, collarEdgeR, collarEdgeL);
  const buttonGroup = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 8), mats.plaidPlain);
    button.scale.z = 0.4;
    button.position.set(0, 1.44 - i * 0.15, 0.322 - i * 0.005);
    buttonGroup.add(button);
  }
  const placket = new RoundedBoxGeometry(0.04, 0.5, 0.012, 3, 0.006);
  const placketMesh = new THREE.Mesh(placket, mats.plaidPlain);
  placketMesh.position.set(0, 1.32, 0.308);
  shirtCollar.add(placketMesh, buttonGroup);
  shirtCollar.visible = false;
  body.add(shirtCollar);
  rig.outfitGroups.shirtCollar = shirtCollar;

  // soft raglan seams keep the sweater from reading as a plain sack
  const sweaterSeams = new THREE.Group();
  for (const side of [-1, 1]) {
    const seam = tubeAlong([
      [side * 0.10, 1.555, 0.175],
      [side * 0.20, 1.50, 0.21],
      [side * 0.285, 1.42, 0.215],
      [side * 0.335, 1.36, 0.17]
    ], 0.005, mats.sweaterRib, 22, 4);
    sweaterSeams.add(seam);
  }
  body.add(sweaterSeams);
  rig.outfitGroups.sweaterSeams = sweaterSeams;

  const pocketSeam = tubeAlong([
    [-0.215, 0.94, 0.285], [-0.17, 0.86, 0.315], [-0.02, 0.83, 0.325],
    [0.15, 0.86, 0.315], [0.215, 0.94, 0.285]
  ], 0.005, mats.sweaterRib, 26, 4);
  body.add(pocketSeam);
  rig.outfitGroups.pocketSeam = pocketSeam;

  // dog patch
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), mats.patch);
  patch.position.set(-0.155, 1.14, 0.312);
  patch.rotation.set(-0.02, 0.05, -0.07);
  body.add(patch);
  rig.outfitGroups.patch = patch;

  // necklace (silver chain + small tag)
  const necklace = new THREE.Group();
  const chain = tubeAlong([
    [-0.195, 1.545, 0.10], [-0.225, 1.47, 0.22], [-0.19, 1.36, 0.30],
    [-0.10, 1.24, 0.34], [0, 1.195, 0.352], [0.10, 1.24, 0.34],
    [0.19, 1.36, 0.30], [0.225, 1.47, 0.22], [0.195, 1.545, 0.10]
  ], 0.0058, mats.silver, 64, 5);
  necklace.add(chain);
  const pendant = new THREE.Group();
  const tag = new THREE.Mesh(new RoundedBoxGeometry(0.048, 0.064, 0.010, 3, 0.014), mats.silver);
  tag.scale.z = 0.7;
  const tagHole = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 5, 12), mats.silver);
  tagHole.position.y = 0.05;
  tagHole.rotation.x = Math.PI / 2;
  pendant.add(tag, tagHole);
  pendant.position.set(0, 1.14, 0.36);
  pendant.rotation.x = -0.08;
  necklace.add(pendant);
  body.add(necklace);
  rig.necklace = necklace;

  // arms
  function buildArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.335, 1.405, 0);
    const shoulder = ellipsoid(0.112, 0.12, 0.118, mats.heather);
    shoulder.userData.zone = 'body';
    arm.add(shoulder);
    const upper = capsule(0.09, 0.17, mats.heather, 6, 18);
    upper.position.y = -0.175;
    upper.userData.zone = 'body';
    addOutline(upper, mats.outline, 1.025);
    arm.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    arm.add(elbow);
    const lower = capsule(0.08, 0.15, mats.heather, 6, 18);
    lower.position.y = -0.14;
    lower.userData.zone = 'body';
    addOutline(lower, mats.outline, 1.028);
    elbow.add(lower);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.023, 8, 24), mats.navy);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.275;
    elbow.add(cuff);
    const hand = new THREE.Group();
    hand.position.y = -0.33;
    const palm = ellipsoid(0.082, 0.094, 0.065, mats.skin);
    palm.userData.zone = 'body';
    hand.add(palm);
    const thumb = capsule(0.036, 0.047, mats.skin, 4, 12);
    thumb.rotation.z = side * -0.8;
    thumb.position.set(side * 0.071, 0.01, 0.038);
    hand.add(thumb);
    elbow.add(hand);
    if (side > 0) {
      const bracelet = new THREE.Group();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 10, 8), mats.jade);
        bead.position.set(Math.cos(angle) * 0.103, -0.292, Math.sin(angle) * 0.103);
        bracelet.add(bead);
      }
      elbow.add(bracelet);
      rig.bracelet = bracelet;
    }
    body.add(arm);
    return { arm, elbow, hand, shoulder, upper, lower, cuff, palm };
  }
  rig.arms.right = buildArm(1);
  rig.arms.left = buildArm(-1);

  // legs
  function buildLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.165, 0.59, 0.015);
    const thigh = capsule(0.118, 0.22, mats.pants, 6, 16);
    thigh.position.y = -0.16;
    thigh.userData.zone = 'body';
    addOutline(thigh, mats.outlineSoft, 1.03);
    leg.add(thigh);
    const pantsCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.119, 0.116, 0.055, 24), mats.pantsCuff);
    pantsCuff.position.set(0, -0.315, 0);
    leg.add(pantsCuff);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.102, 0.10, 20), mats.crewWhite);
    sock.position.set(0, -0.30, 0.01);
    sock.visible = false;
    leg.add(sock);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.225, 0.145, 0.31, 4, 0.062), mats.shoeLight);
    shoe.position.set(0, -0.405, 0.065);
    shoe.userData.zone = 'body';
    addOutline(shoe, mats.outline, 1.035);
    leg.add(shoe);
    const sole = new THREE.Mesh(new RoundedBoxGeometry(0.235, 0.042, 0.32, 3, 0.018), mats.sole);
    sole.position.set(0, -0.487, 0.068);
    leg.add(sole);
    const toeCap = ellipsoid(0.105, 0.048, 0.10, mats.navy);
    toeCap.position.set(0, -0.452, 0.195);
    leg.add(toeCap);
    const heel = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.07, 0.02, 3, 0.008), mats.navy);
    heel.position.set(0, -0.39, -0.09);
    leg.add(heel);
    const laces = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const lace = tubeAlong([
        [-0.075, -0.365 + i * 0.028, 0.18], [0, -0.36 + i * 0.028, 0.205], [0.075, -0.365 + i * 0.028, 0.18]
      ], 0.006, mats.navy, 8, 4);
      laces.add(lace);
    }
    leg.add(laces);
    body.add(leg);
    return { leg, thigh, shoe, sole, toeCap, heel, laces, pantsCuff, sock };
  }
  rig.legs.right = buildLeg(1);
  rig.legs.left = buildLeg(-1);

  // ---------- additional outfits ----------
  const torsoRadiusAt = (y) => {
    for (let i = 0; i < profile.length - 1; i += 1) {
      const a = profile[i];
      const b = profile[i + 1];
      if (y <= b.y) {
        const t = clamp((y - a.y) / Math.max(0.0001, b.y - a.y), 0, 1);
        return lerp(a.x, b.x, t);
      }
    }
    return profile[profile.length - 1].x;
  };
  const frontOfBody = (y, x = 0, extra = 0) => {
    const r = Math.max(0.03, torsoRadiusAt(y));
    return 0.78 * r * Math.sqrt(Math.max(0, 1 - (x / r) ** 2)) + extra;
  };

  // Outdoor shell jacket, shared by the lilac and mist-blue colorways.
  const jacket = new THREE.Group();
  const jacketChest = new THREE.Mesh(curvedPanelGeometry({
    width: 0.52, height: 0.26, yCenter: 1.20, radiusAt: torsoRadiusAt, offset: 0.018
  }), mats.jacketWhite);
  const jacketLower = new THREE.Mesh(curvedPanelGeometry({
    width: 0.60, height: 0.38, yCenter: 0.93, radiusAt: torsoRadiusAt, offset: 0.014
  }), mats.jacketLilac);
  const jacketPocketL = new THREE.Mesh(curvedPanelGeometry({
    width: 0.18, height: 0.12, xCenter: -0.17, yCenter: 0.91, radiusAt: torsoRadiusAt, offset: 0.025
  }), mats.jacketLilacDark);
  const jacketPocketR = new THREE.Mesh(curvedPanelGeometry({
    width: 0.18, height: 0.12, xCenter: 0.17, yCenter: 0.91, radiusAt: torsoRadiusAt, offset: 0.025
  }), mats.jacketLilacDark);
  jacket.add(jacketChest, jacketLower, jacketPocketL, jacketPocketR);
  const jacketHem = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.366, 0.045, 48, 1, true), mats.jacketTrim);
  jacketHem.position.y = 0.685;
  jacketHem.scale.z = 0.78;
  jacket.add(jacketHem);
  const jacketCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.21, 0.095, 32, 1, true), mats.jacketDark);
  jacketCollar.position.y = 1.595;
  jacketCollar.scale.z = 0.82;
  const jacketCollarLining = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.011, 8, 28), mats.jacketLilac);
  jacketCollarLining.rotation.x = Math.PI / 2;
  jacketCollarLining.position.y = 1.642;
  jacketCollarLining.scale.z = 0.82;
  jacket.add(jacketCollar, jacketCollarLining);
  const jacketPlacketPoints = [];
  for (let i = 0; i <= 14; i += 1) {
    const y = 0.73 + (1.53 - 0.73) * (i / 14);
    jacketPlacketPoints.push([0, y, frontOfBody(y, 0, 0.032)]);
  }
  const jacketPlacket = tubeAlong(jacketPlacketPoints, 0.011, mats.jacketTrim, 40, 5);
  jacket.add(jacketPlacket);
  const jacketSnaps = new THREE.Group();
  for (const y of [0.84, 0.98, 1.12, 1.26, 1.40]) {
    const snap = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 10, 8), mats.snap);
    snap.scale.z = 0.5;
    snap.position.set(0, y, frontOfBody(y, 0, 0.042));
    jacketSnaps.add(snap);
  }
  jacket.add(jacketSnaps);
  const jacketLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), mats.logoLight);
  jacketLogo.position.set(0.16, 1.35, frontOfBody(1.35, 0.16, 0.035));
  jacket.add(jacketLogo);
  const jacketHood = new THREE.Group();
  const hoodOuter = ellipsoid(0.315, 0.16, 0.20, mats.jacketNavy);
  hoodOuter.position.set(0, 1.46, -0.21);
  hoodOuter.rotation.x = 0.25;
  const hoodInner = ellipsoid(0.265, 0.12, 0.15, mats.jacketIce);
  hoodInner.position.set(0, 1.48, -0.17);
  hoodInner.rotation.x = 0.25;
  jacketHood.add(hoodOuter, hoodInner);
  jacket.add(jacketHood);
  jacket.visible = false;
  body.add(jacket);
  rig.outfitGroups.jacket = jacket;
  rig.jacketParts = { jacketChest, jacketLower, jacketPocketL, jacketPocketR, jacketHem, jacketCollar, jacketCollarLining, jacketPlacket, jacketSnaps, jacketHood, jacketLogo, hoodOuter, hoodInner };

  // White crab-print long-sleeve tee and navy skirt.
  const crabOutfit = new THREE.Group();
  const crabPrint = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.44), mats.crab);
  crabPrint.position.set(0, 1.16, frontOfBody(1.16, 0, 0.036));
  crabPrint.scale.y = 1 / 1.14;
  crabPrint.rotation.x = -0.03;
  const crewCollar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.026, 10, 32), mats.crewWhite);
  crewCollar.rotation.x = Math.PI / 2;
  crewCollar.position.set(0, 1.585, 0);
  crewCollar.scale.z = 0.82;
  crabOutfit.add(crabPrint, crewCollar);
  crabOutfit.visible = false;
  body.add(crabOutfit);
  rig.outfitGroups.crabOutfit = crabOutfit;

  const skirtGroup = new THREE.Group();
  const skirtProfile = [
    [0.365, 0.66], [0.39, 0.61], [0.425, 0.53], [0.45, 0.45], [0.462, 0.38]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const skirtMaterial = mats.skirtNavy.clone();
  skirtMaterial.side = THREE.DoubleSide;
  const skirtMesh = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 56), skirtMaterial);
  skirtMesh.scale.z = 0.8;
  skirtMesh.userData.zone = 'body';
  const skirtBand = new THREE.Mesh(new THREE.CylinderGeometry(0.366, 0.36, 0.045, 48, 1, true), mats.skirtNavyDark);
  skirtBand.position.y = 0.663;
  skirtBand.scale.z = 0.8;
  skirtGroup.add(skirtMesh, skirtBand);
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const pts = [
      [Math.cos(angle) * 0.36, 0.66, Math.sin(angle) * 0.288 + 0.004],
      [Math.cos(angle) * 0.425, 0.53, Math.sin(angle) * 0.34 + 0.004],
      [Math.cos(angle) * 0.462, 0.38, Math.sin(angle) * 0.37 + 0.004]
    ];
    const pleat = taperedStrand({
      points: pts, radius: () => 0.004, flatten: 0.5, segments: 14, radialSegments: 4, material: mats.skirtNavyDark
    });
    skirtGroup.add(pleat);
  }
  skirtGroup.visible = false;
  body.add(skirtGroup);
  rig.outfitGroups.skirt = skirtGroup;

  // Black strappy top: a small skin cutout with crossing bands.
  const blackOutfit = new THREE.Group();
  const blackCutout = new THREE.Mesh(curvedPanelGeometry({
    width: 0.27, height: 0.135, yCenter: 1.50, radiusAt: torsoRadiusAt, offset: 0.022
  }), mats.skin);
  blackOutfit.add(blackCutout);
  const strapSpecs = [
    [[-0.18, 1.575], [0.02, 1.43]],
    [[0.18, 1.575], [-0.02, 1.43]],
    [[-0.20, 1.45], [0.10, 1.56]],
    [[0.20, 1.45], [-0.10, 1.56]]
  ];
  for (const [start, end] of strapSpecs) {
    const strap = tubeAlong([
      [start[0], start[1], frontOfBody(start[1], start[0], 0.035)],
      [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, frontOfBody((start[1] + end[1]) / 2, (start[0] + end[0]) / 2, 0.045)],
      [end[0], end[1], frontOfBody(end[1], end[0], 0.035)]
    ], 0.008, mats.blackClothSoft, 16, 4);
    blackOutfit.add(strap);
  }
  const blackBand = new THREE.Mesh(new THREE.TorusGeometry(0.174, 0.016, 8, 30), mats.blackClothSoft);
  blackBand.rotation.x = Math.PI / 2;
  blackBand.position.y = 1.593;
  blackBand.scale.z = 0.82;
  blackOutfit.add(blackBand);
  const blackPendant = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), mats.silver);
  blackPendant.position.set(0, 1.43, frontOfBody(1.43, 0, 0.05));
  blackOutfit.add(blackPendant);
  blackOutfit.visible = false;
  body.add(blackOutfit);
  rig.outfitGroups.blackOutfit = blackOutfit;

  // Cargo pockets used by the outdoor outfits and the black top.
  const cargoPockets = [];
  for (const side of [-1, 1]) {
    const legRoot = side > 0 ? rig.legs.right.leg : rig.legs.left.leg;
    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.115, 0.035, 3, 0.014), mats.cargoDark);
    pocket.position.set(side * 0.105, -0.10, 0.025);
    pocket.rotation.y = side * 0.14;
    const flap = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.032, 0.042, 3, 0.009), mats.cargoDark);
    flap.position.set(side * 0.105, -0.045, 0.035);
    flap.rotation.y = side * 0.14;
    legRoot.add(pocket, flap);
    cargoPockets.push(pocket, flap);
  }
  rig.outfitGroups.cargoPockets = cargoPockets;

  // Optional brown baseball cap from the newest photos.
  const capGroup = new THREE.Group();
  const capDome = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.46), mats.capBrown);
  capDome.scale.set(0.72, 0.45, 0.70);
  capDome.position.set(0, 0.84, 0.015);
  const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.032, 32), mats.capBrim);
  capBrim.scale.z = 0.80;
  capBrim.position.set(0, 0.91, 0.43);
  const capButton = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), mats.capBrim);
  capButton.position.set(0, 1.295, 0.015);
  const capLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.035), mats.capLogo);
  capLogo.position.set(0, 1.02, 0.735);
  capLogo.rotation.x = -0.22;
  capGroup.add(capDome, capBrim, capButton, capLogo);
  capGroup.visible = false;
  rig.head.add(capGroup);
  rig.cap = capGroup;

  // ---------- head ----------
  const headSculpt = (v) => {
    if (v.y < 0) {
      const f = Math.pow(-v.y, 1.35);
      v.x *= 1 - 0.185 * f;
      v.z *= 1 - 0.06 * f;
    }
    if (v.y < 0.32 && v.y > -0.35 && v.z > 0) {
      const cheek = Math.max(0, 1 - Math.abs(v.y - 0.04) / 0.32);
      v.z += 0.028 * cheek * (1 - Math.abs(v.x) * 0.6);
    }
    v.y *= 1.012;
    v.z *= 0.995;
  };
  const headMesh = toonSphere(0.69, 0.645, 0.615, mats.skin, headSculpt);
  headMesh.position.set(0, 0.56, 0);
  headMesh.userData.zone = 'head';
  addOutline(headMesh, mats.outlineSoft, 1.018);
  rig.head.add(headMesh);
  rig.headMesh = headMesh;

  const faceShadow = ellipsoid(0.40, 0.20, 0.26, mats.skinShade);
  faceShadow.position.set(0, 0.44, 0.33);
  faceShadow.visible = false;
  rig.head.add(faceShadow);

  // ears and earrings
  const earrings = new THREE.Group();
  rig.head.add(earrings);
  rig.earrings = earrings;
  function buildEar(side) {
    const ear = ellipsoid(0.072, 0.115, 0.055, mats.skin);
    ear.position.set(side * 0.72, 0.50, 0.135);
    ear.rotation.z = side * 0.14;
    ear.rotation.y = side * 0.18;
    ear.userData.zone = 'head';
    rig.head.add(ear);
    const earInner = ellipsoid(0.035, 0.06, 0.02, mats.skinWarm);
    earInner.position.set(side * 0.743, 0.50, 0.16);
    earInner.rotation.y = side * 0.25;
    rig.head.add(earInner);

    const flower = new THREE.Group();
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 8), mats.gold);
    flower.add(center);
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 6), mats.gold);
      petal.position.set(Math.cos(angle) * 0.023, Math.sin(angle) * 0.023, 0.004);
      flower.add(petal);
    }
    flower.position.set(side * 0.757, 0.435, 0.17);
    flower.rotation.y = side * 0.12;
    earrings.add(flower);
  }
  buildEar(1);
  buildEar(-1);

  // eyes
  function buildEye(side) {
    const group = new THREE.Group();
    group.position.set(side * 0.222, 0.606, 0.556);
    group.rotation.y = side * 0.17;
    const white = ellipsoid(0.112, 0.133, 0.038, mats.eyeWhite);
    group.add(white);
    const iris = ellipsoid(0.068, 0.087, 0.014, mats.iris);
    iris.position.z = 0.031;
    group.add(iris);
    const irisInner = ellipsoid(0.053, 0.068, 0.010, mats.irisInner);
    irisInner.position.z = 0.043;
    group.add(irisInner);
    const pupil = ellipsoid(0.033, 0.047, 0.009, mats.pupil);
    pupil.position.z = 0.050;
    group.add(pupil);
    const shine = ellipsoid(0.022, 0.027, 0.006, mats.eyeHighlight);
    shine.position.set(-0.022, 0.032, 0.057);
    group.add(shine);
    const shine2 = ellipsoid(0.009, 0.010, 0.004, mats.eyeHighlight);
    shine2.position.set(0.024, -0.028, 0.056);
    group.add(shine2);

    const lash = taperedStrand({
      points: [
        [-0.096, 0.108, 0.024], [-0.038, 0.137, 0.034], [0.034, 0.131, 0.035], [0.102, 0.098, 0.028]
      ],
      radius: (t) => 0.0105 * Math.sin(Math.PI * Math.min(1, t * 1.25)) + 0.0015,
      flatten: 0.35,
      segments: 16,
      radialSegments: 5,
      material: mats.lash
    });
    group.add(lash);
    const lowerLash = tubeAlong([
      [-0.055, -0.085, 0.028], [0, -0.096, 0.034], [0.052, -0.082, 0.03]
    ], 0.0035, mats.lash, 12, 4);
    group.add(lowerLash);

    const brow = taperedStrand({
      points: [
        [side * -0.075, 0.88, 0.545], [side * 0.0, 0.91, 0.575], [side * 0.075, 0.895, 0.55]
      ],
      radius: (t) => 0.010 * Math.sin(Math.PI * t) + 0.002,
      flatten: 0.45,
      segments: 12,
      radialSegments: 5,
      material: mats.brow
    });
    rig.head.add(brow);

    rig.head.add(group);
    return { group, white, iris, irisInner, pupil, shine, lash };
  }
  rig.eyes.right = buildEye(1);
  rig.eyes.left = buildEye(-1);

  // nose
  const nose = ellipsoid(0.037, 0.044, 0.036, mats.skinWarm);
  nose.position.set(0, 0.455, 0.592);
  nose.rotation.x = -0.1;
  rig.head.add(nose);
  const noseShine = ellipsoid(0.012, 0.013, 0.006, new THREE.MeshBasicMaterial({ color: '#fff3ea', transparent: true, opacity: 0.7 }));
  noseShine.position.set(-0.012, 0.47, 0.622);
  rig.head.add(noseShine);

  // mouth
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, 0.295, 0);
  const smile = tubeAlong([
    [-0.075, 0.008, 0.59], [-0.035, -0.012, 0.608], [0, -0.018, 0.615], [0.038, -0.010, 0.607], [0.077, 0.012, 0.588]
  ], 0.0085, mats.lip, 20, 5);
  const lowerLip = ellipsoid(0.048, 0.013, 0.008, mats.lipLight);
  lowerLip.position.set(0, -0.036, 0.596);
  const lipShine = ellipsoid(0.014, 0.005, 0.003, new THREE.MeshBasicMaterial({ color: '#fff2ef', transparent: true, opacity: 0.75 }));
  lipShine.position.set(0.012, -0.034, 0.605);
  const openMouth = ellipsoid(0.056, 0.052, 0.018, mats.mouthInner);
  openMouth.position.set(0, -0.03, 0.592);
  openMouth.visible = false;
  const tongue = ellipsoid(0.035, 0.02, 0.01, mats.tongue);
  tongue.position.set(0, -0.058, 0.607);
  tongue.visible = false;
  const pout = tubeAlong([
    [-0.035, 0, 0.596], [-0.012, -0.024, 0.606], [0.012, -0.024, 0.606], [0.035, 0, 0.596]
  ], 0.009, mats.lip, 12, 5);
  pout.visible = false;
  mouthGroup.add(smile, lowerLip, lipShine, openMouth, tongue, pout);
  rig.head.add(mouthGroup);
  rig.mouth = { group: mouthGroup, smile, lowerLip, lipShine, openMouth, tongue, pout };

  // blush
  const blushMaterialL = mats.blush.clone();
  const blushMaterialR = mats.blush.clone();
  const blushL = new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.10), blushMaterialL);
  blushL.position.set(-0.355, 0.37, 0.535);
  blushL.rotation.set(0.02, -0.34, 0.04);
  const blushR = blushL.clone();
  blushR.material = blushMaterialR;
  blushR.position.x = 0.355;
  blushR.rotation.y = 0.34;
  blushR.rotation.z = -0.04;
  rig.head.add(blushL, blushR);
  rig.blush = [blushL, blushR];

  // ---------- glasses ----------
  const glasses = new THREE.Group();
  glasses.position.z = 0.635;
  const ringRadius = 0.221;
  for (const side of [-1, 1]) {
    const cx = side * 0.238;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.024, 12, 48), mats.glass);
    ring.position.set(cx, 0.60, 0.01);
    ring.userData.zone = 'head';
    glasses.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(ringRadius - 0.018, 40), mats.glassLens);
    lens.position.set(cx, 0.60, 0.006);
    lens.renderOrder = 4;
    lens.userData.noHit = true;
    glasses.add(lens);

    const shinePoints = [];
    for (let i = 0; i <= 14; i += 1) {
      const angle = -2.70 + (i / 14) * 0.92;
      shinePoints.push([cx + Math.cos(angle) * 0.162, 0.60 + Math.sin(angle) * 0.162, 0.017]);
    }
    const shine = tubeAlong(shinePoints, 0.0055, mats.glassShine, 20, 4);
    shine.renderOrder = 5;
    glasses.add(shine);

    const armPoints = [
      [cx + side * (ringRadius + 0.015), 0.625, -0.005],
      [side * 0.575, 0.615, -0.03],
      [side * 0.665, 0.59, -0.18]
    ];
    const temple = tubeAlong(armPoints, 0.011, mats.glass, 20, 6);
    temple.userData.zone = 'head';
    glasses.add(temple);
    const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.020, 10, 8), mats.glass);
    hinge.position.set(cx + side * (ringRadius + 0.012), 0.625, -0.004);
    glasses.add(hinge);
  }
  const bridge = tubeAlong([
    [-0.030, 0.622, 0.022], [0, 0.652, 0.036], [0.030, 0.622, 0.022]
  ], 0.012, mats.glass, 16, 6);
  bridge.userData.zone = 'head';
  glasses.add(bridge);
  // nose pads
  for (const side of [-1, 1]) {
    const pad = ellipsoid(0.018, 0.028, 0.01, new THREE.MeshBasicMaterial({ color: '#f6dfc6', transparent: true, opacity: 0.75 }));
    pad.position.set(side * 0.085, 0.535, 0.035);
    pad.rotation.z = side * 0.3;
    glasses.add(pad);
  }
  rig.head.add(glasses);
  rig.glasses = glasses;

  // ---------- hair ----------
  const hair = new THREE.Group();
  rig.head.add(hair);
  rig.hair.root = hair;

  // A single hair shell with a face opening avoids visible seams between
  // a cap and a back-hair blob, and keeps the skull covered from every angle.
  const hairShellMaterial = mats.hairShell.clone();
  hairShellMaterial.side = THREE.DoubleSide;
  const shellGeometry = createHairShellGeometry({
    widthSegments: 168,
    heightSegments: 104,
    faceWidth: 0.735,
    faceHeight: 0.975,
    hairline: 0.55,
    bottom: -0.60,
    sideBottom: -0.08
  });
  const shell = new THREE.Mesh(shellGeometry, hairShellMaterial);
  shell.scale.set(0.727, 0.692, 0.668);
  shell.position.set(0, 0.558, -0.008);
  shell.userData.zone = 'head';
  hair.add(shell);
  rig.hair.shell = shell;

  // Smooth hairline roll along the face opening. This hides the triangle-level
  // edge of the shell and gives the fringe a clean, hand-drawn boundary.
  const shellParams = { rx: 0.727, ry: 0.692, rz: 0.668, centerY: 0.558 };
  const faceW = 0.735;
  const faceH = 0.975;
  const hairline = 0.55;
  const hairlinePoints = [];
  const topHalfX = faceW * Math.sqrt(1 - (hairline * hairline) / (faceH * faceH));
  const toLocal = (x, y, z) => [
    x * shellParams.rx,
    shellParams.centerY + y * shellParams.ry,
    z * shellParams.rz + 0.004
  ];
  for (let i = 0; i <= 12; i += 1) {
    const y = -0.02 + (hairline + 0.02) * (i / 12);
    const x = -faceW * Math.sqrt(Math.max(0, 1 - (y * y) / (faceH * faceH)));
    const z = Math.sqrt(Math.max(0.01, 1 - x * x - y * y));
    hairlinePoints.push(toLocal(x, y, z));
  }
  for (let i = 1; i < 16; i += 1) {
    const x = -topHalfX + (2 * topHalfX) * (i / 16);
    const y = hairline;
    const z = Math.sqrt(Math.max(0.01, 1 - x * x - y * y));
    hairlinePoints.push(toLocal(x, y, z));
  }
  for (let i = 12; i >= 0; i -= 1) {
    const y = -0.02 + (hairline + 0.02) * (i / 12);
    const x = faceW * Math.sqrt(Math.max(0, 1 - (y * y) / (faceH * faceH)));
    const z = Math.sqrt(Math.max(0.01, 1 - x * x - y * y));
    hairlinePoints.push(toLocal(x, y, z));
  }
  const hairlineRoll = tubeAlong(hairlinePoints, 0.022, mats.hairMid, 80, 6);
  hairlineRoll.userData.zone = 'head';
  hair.add(hairlineRoll);

  // Subtle pulled-together strands over the crown and back.
  for (let i = 0; i < 4; i += 1) {
    const pts = [];
    const xBase = -0.46 + i * 0.28;
    for (let k = 0; k <= 5; k += 1) {
      const y = 1.12 - k * 0.16;
      const x = xBase + Math.sin(k * 0.8 + i) * 0.025;
      const ny = (y - shellParams.centerY) / shellParams.ry;
      const nx = x / shellParams.rx;
      const z = -shellParams.rz * Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny)) + 0.008;
      pts.push([x, y, z]);
    }
    const strand = tubeAlong(pts, 0.0055, i % 2 ? mats.hairLight : mats.hairWarm, 26, 4);
    strand.userData.zone = 'head';
    hair.add(strand);
  }

  // A soft gather of hair where the bun meets the skull.
  const gather = ellipsoid(0.30, 0.25, 0.25, mats.hairMid);
  gather.position.set(0.015, 1.02, -0.30);
  gather.rotation.set(0.35, 0.2, -0.15);
  hair.add(gather);
  rig.hair.gather = gather;

  const hairShellParams = { rx: 0.727, ry: 0.692, rz: 0.668, centerY: 0.558 };

  function addHairLeaf(parent, {
    x = 0, y = 0.94, z = null, width = 0.12, height = 0.22, bend = 0,
    forward = 0.11, yaw = null, tilt = null, roll = 0, material = mats.hair, lift = 0.012
  }) {
    const geometry = createHairLeafGeometry({ width, height, bend, forward });
    const mesh = new THREE.Mesh(geometry, material);
    const rootZ = (z ?? hairSurfaceZ(x, y, hairShellParams)) + lift;
    mesh.position.set(x, y, rootZ);
    mesh.rotation.set(roll, yaw ?? x * 0.95, tilt ?? x * 0.28);
    mesh.userData.zone = 'head';
    parent.add(mesh);
    return mesh;
  }

  // Soft layered fringe. Roots sit on the hair shell and the tips sweep
  // forward, so the bangs read as hair instead of loose spikes.
  rig.hair.bangs = new THREE.Group();
  const bangSpecs = [
    { x: -0.545, y: 0.905, width: 0.16, height: 0.155, bend: -0.035, forward: 0.075, mat: mats.hairMid, tilt: -0.18 },
    { x: -0.405, y: 0.94, width: 0.205, height: 0.135, bend: -0.025, forward: 0.095, mat: mats.hairMid, tilt: -0.12 },
    { x: -0.235, y: 0.955, width: 0.215, height: 0.145, bend: -0.015, forward: 0.11, mat: mats.hairMid, tilt: -0.07 },
    { x: -0.055, y: 0.965, width: 0.20, height: 0.125, bend: 0.02, forward: 0.115, mat: mats.hairMid, tilt: -0.02 },
    { x: 0.135, y: 0.96, width: 0.215, height: 0.14, bend: 0.035, forward: 0.11, mat: mats.hairMid, tilt: 0.05 },
    { x: 0.325, y: 0.945, width: 0.205, height: 0.15, bend: 0.045, forward: 0.09, mat: mats.hairMid, tilt: 0.1 },
    { x: 0.505, y: 0.91, width: 0.17, height: 0.175, bend: 0.06, forward: 0.07, mat: mats.hairMid, tilt: 0.16 }
  ];
  for (const spec of bangSpecs) {
    addHairLeaf(rig.hair.bangs, {
      x: spec.x, y: spec.y, width: spec.width, height: spec.height,
      bend: spec.bend, forward: spec.forward, material: spec.mat, tilt: spec.tilt
    });
  }
  hair.add(rig.hair.bangs);

  // Layered ends around the nape hide the straight edge of the hair shell.
  const napeLayers = new THREE.Group();
  const napeSpecs = [
    { x: -0.47, y: 0.34, z: -0.29, w: 0.17, h: 0.25, yaw: Math.PI * 0.82, mat: mats.hairMid },
    { x: -0.25, y: 0.30, z: -0.44, w: 0.19, h: 0.27, yaw: Math.PI * 0.93, mat: mats.hairWarm },
    { x: 0.01, y: 0.27, z: -0.48, w: 0.20, h: 0.28, yaw: Math.PI, mat: mats.hairMid },
    { x: 0.27, y: 0.30, z: -0.44, w: 0.19, h: 0.27, yaw: Math.PI * 1.07, mat: mats.hairWarm },
    { x: 0.49, y: 0.34, z: -0.29, w: 0.17, h: 0.25, yaw: Math.PI * 1.18, mat: mats.hairMid }
  ];
  for (const spec of napeSpecs) {
    const layer = addHairLeaf(napeLayers, {
      x: spec.x, y: spec.y, z: spec.z, width: spec.w, height: spec.h,
      bend: spec.x * -0.15, forward: 0.015, yaw: spec.yaw, tilt: 0,
      material: spec.mat, lift: 0.008
    });
    layer.rotation.x = -0.15;
  }
  hair.add(napeLayers);

  // Delicate loose strands at the ears keep the pulled-back hairline soft.
  for (const side of [-1, 1]) {
    const rootX = side * 0.60;
    const wisp = taperedStrand({
      points: [
        [rootX, 0.78, hairSurfaceZ(rootX, 0.78, hairShellParams) + 0.012],
        [side * 0.655, 0.62, 0.31],
        [side * 0.675, 0.46, 0.30],
        [side * 0.64, 0.30, 0.25]
      ],
      radius: (t) => 0.015 * (1 - t * 0.85) + 0.001,
      flatten: 0.55,
      segments: 20,
      radialSegments: 5,
      material: mats.hairWarm
    });
    wisp.userData.zone = 'head';
    hair.add(wisp);
  }

  // A few lighter strands catch the light across the crown.
  const crownHighlights = [
    { mat: mats.hairWarm, w: 0.013, pts: [[-0.34, 0.92], [-0.23, 1.02], [-0.08, 1.09], [0.02, 1.12]] },
    { mat: mats.hairLight, w: 0.008, pts: [[0.31, 0.90], [0.22, 1.01], [0.07, 1.09], [-0.03, 1.125]] },
    { mat: mats.hairMid, w: 0.010, pts: [[-0.52, 0.78], [-0.42, 0.95], [-0.31, 1.06]] }
  ];
  for (const spec of crownHighlights) {
    const points = spec.pts.map(([x, y]) => [x, y, hairSurfaceZ(x, y, hairShellParams) + 0.010]);
    const strand = taperedStrand({
      points,
      radius: (t) => spec.w * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.92)) + 0.0015,
      flatten: 0.38,
      segments: 22,
      radialSegments: 5,
      material: spec.mat
    });
    strand.userData.zone = 'head';
    hair.add(strand);
  }


  // Fine flyaways that follow the crown instead of standing up like antennae.
  for (let i = 0; i < 3; i += 1) {
    const x = -0.36 + i * 0.36;
    const strand = taperedStrand({
      points: [
        [x, 1.08, hairSurfaceZ(x, 1.08, hairShellParams) + 0.012],
        [x + 0.12, 1.10, hairSurfaceZ(x + 0.12, 1.10, hairShellParams) + 0.016],
        [x + 0.23, 1.07, hairSurfaceZ(x + 0.23, 1.07, hairShellParams) + 0.02]
      ],
      radius: (t) => 0.0055 * (1 - t) + 0.001,
      flatten: 0.5,
      segments: 12,
      radialSegments: 4,
      material: mats.hairLight
    });
    hair.add(strand);
  }

  // bun
  const bun = new THREE.Group();
  bun.position.set(0.02, 1.205, -0.425);
  const bunParts = [
    { p: [0, 0, 0], r: 0.252, mat: mats.hairWarm },
    { p: [0.175, 0.04, -0.075], r: 0.155, mat: mats.hairMid },
    { p: [-0.16, 0.055, -0.055], r: 0.165, mat: mats.hairLight },
    { p: [0.045, -0.13, -0.04], r: 0.135, mat: mats.hairWarm },
    { p: [-0.06, 0.16, -0.03], r: 0.12, mat: mats.hairMid }
  ];
  for (const part of bunParts) {
    const blob = ellipsoid(part.r, part.r * 0.92, part.r * 0.88, part.mat);
    blob.position.set(...part.p);
    blob.rotation.set(part.p[0] * 1.5, part.p[1] * 3, part.p[2] * 2);
    blob.userData.zone = 'head';
    addOutline(blob, mats.outline, 1.03);
    bun.add(blob);
  }
  // messy wrapped strands around the bun
  for (let i = 0; i < 2; i += 1) {
    const pts = [];
    for (let k = 0; k <= 5; k += 1) {
      const a = k * 1.15 + i * 2.4;
      pts.push([Math.cos(a) * (0.22 + i * 0.032), 0.02 + Math.sin(a * 1.4) * 0.16, -0.16 + Math.sin(a) * 0.10]);
    }
    const wrap = tubeAlong(pts, 0.009 + i * 0.002, i % 2 ? mats.hairLight : mats.hairMid, 30, 5);
    bun.add(wrap);
  }
  // claw clip
  const clip = new THREE.Group();
  clip.position.set(0.275, 1.235, -0.425);
  clip.rotation.set(0.16, -0.52, 0.58);
  const jawA = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.021, 8, 26, Math.PI * 0.82), mats.clip);
  jawA.rotation.z = -0.48;
  jawA.scale.set(1, 0.72, 0.8);
  const jawB = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.018, 8, 24, Math.PI * 0.78), mats.clipLight);
  jawB.rotation.z = 0.56;
  jawB.scale.set(1, 0.7, 0.8);
  const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), mats.clipLight);
  hinge.position.set(0.055, -0.045, 0);
  clip.add(jawA, jawB, hinge);
  for (let i = 0; i < 3; i += 1) {
    const tooth = taperedStrand({
      points: [[0.02, -0.01, 0.015], [0.10 - i * 0.016, 0.035 + i * 0.055, 0.03], [0.13 - i * 0.016, 0.07 + i * 0.055, 0.035]],
      radius: (t) => 0.010 * (1 - t) + 0.001,
      flatten: 0.7,
      segments: 10,
      radialSegments: 5,
      material: mats.clip
    });
    tooth.userData.zone = 'head';
    clip.add(tooth);
  }
  bun.add(clip);
  rig.hair.bun = bun;
  rig.hair.clip = clip;
  hair.add(bun);

  // cookie prop for feeding
  const cookie = new THREE.Group();
  const cookieBase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.072, 0.025, 24), mats.cookie);
  cookieBase.rotation.x = Math.PI / 2;
  cookie.add(cookieBase);
  const chips = [
    [-0.035, 0.03, 0.03], [0.03, 0.045, 0.02], [0.045, -0.02, 0.03],
    [-0.02, -0.04, 0.028], [0.01, 0.01, 0.033]
  ];
  for (const p of chips) {
    const chip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mats.chocolate);
    chip.position.set(...p);
    cookie.add(chip);
  }
  cookie.position.set(0.02, 0.02, 0.095);
  cookie.rotation.set(0.25, 0.2, -0.1);
  cookie.visible = false;
  rig.arms.right.hand.add(cookie);
  rig.cookie = cookie;

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.78), mats.shadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.004, 0.035);
  shadow.renderOrder = -2;
  root.add(shadow);
  rig.shadow = shadow;

  // Slightly taller body proportions make the character read as a young
  // woman rather than a bobble-head plush.
  const BODY_STRETCH = 1.14;
  body.scale.y = BODY_STRETCH;
  rig.head.position.y = 2.02;
  patch.scale.y = 1 / BODY_STRETCH;

  // ---------- sleeping armchair ----------
  const sleepSet = new THREE.Group();
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.018, 56), mats.rug);
  rug.position.set(0, 0.009, 0.14);
  rug.scale.z = 0.82;
  const rugRim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.022, 6, 56), mats.rugDark);
  rugRim.rotation.x = Math.PI / 2;
  rugRim.position.set(0, 0.021, 0.14);
  rugRim.scale.y = 0.82;
  sleepSet.add(rug, rugRim);
  const chair = new THREE.Group();
  const chairBase = new THREE.Mesh(new RoundedBoxGeometry(1.16, 0.22, 0.76, 6, 0.06), mats.chairFabricDark);
  chairBase.position.set(0, 0.36, 0.03);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.18, 0.68, 6, 0.075), mats.chairCushion);
  seat.position.set(0, 0.56, 0.03);
  const back = new THREE.Mesh(new RoundedBoxGeometry(1.12, 1.52, 0.20, 7, 0.09), mats.chairFabric);
  back.position.set(0, 1.24, -0.38);
  back.rotation.x = -0.13;
  const backCushion = new THREE.Mesh(new RoundedBoxGeometry(0.94, 1.0, 0.12, 6, 0.06), mats.chairCushion);
  backCushion.position.set(0, 1.11, -0.265);
  backCushion.rotation.x = -0.13;
  chair.add(chairBase, seat, back, backCushion);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.16, 0.70, 4, 0.06), mats.chairFabric);
    arm.position.set(side * 0.60, 0.80, 0.03);
    const armPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.26, 12), mats.chairFabricDark);
    armPost.position.set(side * 0.60, 0.60, 0.31);
    chair.add(arm, armPost);
  }
  for (const side of [-1, 1]) {
    for (const z of [-0.18, 0.30]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.035, 0.22, 10), mats.chairWood);
      leg.position.set(side * 0.47, 0.14, z);
      chair.add(leg);
    }
  }
  const pillow = new THREE.Mesh(new RoundedBoxGeometry(0.40, 0.28, 0.12, 5, 0.055), mats.blanketPink);
  pillow.position.set(0.24, 1.42, -0.19);
  pillow.rotation.set(-0.2, 0.08, 0.08);
  chair.add(pillow);
  const blanket = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.13, 0.54, 5, 0.035), mats.blanketPink);
  blanket.position.set(0, 0.69, 0.20);
  blanket.rotation.x = 0.08;
  const blanketFold = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.035, 0.10, 4, 0.018), mats.blanketCream);
  blanketFold.position.set(0, 0.725, 0.035);
  blanketFold.rotation.x = 0.09;
  const ottoman = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.16, 0.36, 5, 0.05), mats.chairCushion);
  ottoman.position.set(0, 0.27, 0.60);
  const ottomanBase = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.12, 0.30, 4, 0.04), mats.chairFabricDark);
  ottomanBase.position.set(0, 0.15, 0.60);
  const blanketDrape = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.34, 0.07, 5, 0.03), mats.blanketPink);
  blanketDrape.position.set(0, 0.52, 0.48);
  blanketDrape.rotation.x = -0.08;
  chair.add(blanket, blanketFold, blanketDrape, ottoman, ottomanBase);
  for (const piece of [chairBase, seat, back, backCushion, pillow, blanket]) {
    addOutline(piece, mats.outlineSoft, 1.015);
  }
  // Clicking any part of the visible chair also gently wakes her.
  chair.traverse((obj) => { if (obj.isMesh) obj.userData.zone = 'body'; });
  rug.userData.zone = 'body';
  rugRim.userData.zone = 'body';
  sleepSet.add(chair);
  sleepSet.visible = false;
  root.add(sleepSet);
  rig.sleepSet = sleepSet;
  rig.sleepChair = chair;

  // ---------- outfit switching ----------
  const armParts = [rig.arms.left, rig.arms.right];
  const legParts = [rig.legs.left, rig.legs.right];
  const jacketParts = rig.jacketParts;
  function applyShoeStyle(dark) {
    for (const leg of legParts) {
      leg.shoe.material = dark ? mats.shoe : mats.shoeLight;
      leg.toeCap.material = dark ? mats.shoe : mats.navy;
      leg.heel.material = dark ? mats.shoe : mats.navy;
      leg.sole.material = mats.sole;
      for (const lace of leg.laces.children) lace.material = dark ? mats.sole : mats.navy;
    }
  }
  function setOutfit(name) {
    const outfit = normalizeOutfit(name);
    const plaid = outfit === 'plaid';
    const wind = outfit === 'windbreakerLilac' || outfit === 'windbreakerNavy' || outfit === 'windbreakerBlack';
    const navy = outfit === 'windbreakerNavy';
    const crab = outfit === 'crabTee';
    const crabCargo = outfit === 'crabCargo';
    const crabTop = crab || crabCargo;
    const black = outfit === 'blackTop';
    const cargo = wind || black || crabCargo;
    const darkShoes = wind || black;

    // hide all story-specific layers first
    sweaterCollar.visible = false;
    shirtCollar.visible = false;
    jacket.visible = false;
    crabOutfit.visible = false;
    skirtGroup.visible = false;
    blackOutfit.visible = false;
    patch.visible = false;
    hem.visible = false;
    sweaterSeams.visible = false;
    pocketSeam.visible = false;
    for (const piece of rig.outfitGroups.cargoPockets) piece.visible = false;
    jacketParts.jacketHood.visible = false;

    let torsoMaterial = mats.heather;
    let upperMaterial = mats.heather;
    let lowerMaterial = mats.heather;
    let cuffMaterial = mats.navy;

    if (plaid) {
      torsoMaterial = mats.plaid;
      upperMaterial = mats.plaid;
      lowerMaterial = mats.plaid;
      cuffMaterial = mats.plaidPlain;
      shirtCollar.visible = true;
    } else if (wind) {
      const blackJacket = outfit === 'windbreakerBlack';
      const base = navy ? mats.jacketNavy : mats.jacketDark;
      const chest = navy ? mats.jacketIce : blackJacket ? mats.jacketStone : mats.jacketWhite;
      const lower = navy ? mats.jacketStone : blackJacket ? mats.jacketLilacDark : mats.jacketLilac;
      const pocket = navy ? mats.jacketStoneDark : blackJacket ? mats.jacketStoneDark : mats.jacketLilacDark;
      torsoMaterial = base;
      upperMaterial = base;
      lowerMaterial = lower;
      cuffMaterial = mats.jacketTrim;
      jacket.visible = true;
      jacketParts.jacketChest.material = chest;
      jacketParts.jacketLower.material = lower;
      jacketParts.jacketPocketL.material = pocket;
      jacketParts.jacketPocketR.material = pocket;
      jacketParts.jacketHem.material = mats.jacketTrim;
      jacketParts.jacketCollar.material = base;
      jacketParts.jacketCollarLining.material = lower;
      jacketParts.jacketLogo.material = mats.logoLight;
      jacketParts.hoodOuter.material = base;
      jacketParts.hoodInner.material = lower;
      jacketParts.jacketHood.visible = navy || blackJacket;
    } else if (crabTop) {
      torsoMaterial = mats.teeWhite;
      upperMaterial = mats.teeWhite;
      lowerMaterial = mats.teeWhite;
      cuffMaterial = mats.crewWhite;
      crabOutfit.visible = true;
      skirtGroup.visible = crab;
      if (crabCargo) upperMaterial = mats.teeWhite;
    } else if (black) {
      torsoMaterial = mats.blackCloth;
      upperMaterial = mats.blackCloth;
      lowerMaterial = mats.blackCloth;
      cuffMaterial = mats.blackClothSoft;
      blackOutfit.visible = true;
    } else {
      sweaterCollar.visible = true;
      hem.visible = true;
      sweaterSeams.visible = true;
      pocketSeam.visible = true;
      patch.visible = true;
    }

    rig.torso.material = torsoMaterial;
    for (const arm of armParts) {
      arm.shoulder.material = upperMaterial;
      arm.upper.material = upperMaterial;
      arm.lower.material = lowerMaterial;
      arm.cuff.material = cuffMaterial;
    }

    for (const leg of legParts) {
      leg.thigh.material = crab ? mats.skin : cargo ? mats.cargo : mats.pants;
      leg.thigh.scale.set(cargo ? 1.10 : 1, 1, cargo ? 1.06 : 1);
      leg.pantsCuff.visible = !crab;
      leg.pantsCuff.material = cargo ? mats.cargoDark : mats.pantsCuff;
      leg.pantsCuff.scale.set(cargo ? 1.08 : 1, 1, cargo ? 1.05 : 1);
      leg.sock.visible = crab;
      for (const piece of rig.outfitGroups.cargoPockets) {
        // each pair is attached to one leg; show both sides when cargo is on
        piece.visible = cargo;
      }
    }
    applyShoeStyle(darkShoes);

    state.outfit = outfit;
    return state.outfit;
  }

  // ---------- animation state ----------
  const state = {
    outfit: 'sweater',
    action: null,
    sleeping: false,
    talking: false,
    dragging: false,
    expression: 'smile',
    view: 0,
    targetView: 0,
    time: 0,
    blinkAt: 1.6,
    blinkStart: -1,
    blinkDouble: false,
    blinkQueue: 0,
    lastMouseMove: -100,
    lookX: 0,
    lookY: 0,
    lookTargetX: 0,
    lookTargetY: 0,
    idleAt: 5,
    baseScale: 1,
    autoRotate: false,
    autoRotateAngle: 0
  };

  const base = {
    armLZ: -0.12,
    armRZ: 0.12,
    armX: 0.03,
    elbowX: -0.04
  };
  let actionStart = 0;
  let actionData = null;
  const actionDurations = {
    pet: 1.6,
    poke: 0.7,
    wave: 2.2,
    jump: 0.85,
    dance: 3.6,
    spin: 1.25,
    eat: 2.4,
    stretch: 2.6,
    nod: 1.2,
    shy: 2.0,
    heart: 2.4,
    laugh: 2.6,
    grumpy: 2.2,
    yawn: 2.5,
    dizzy: 1.8,
    startled: 1.0,
    cheer: 1.6
  };

  function setAction(name, options = {}) {
    if (!actionDurations[name]) return false;
    if (state.sleeping) {
      state.sleeping = false;
      if (rig.sleepSet) rig.sleepSet.visible = false;
      if (rig.shadow) rig.shadow.visible = true;
    }
    state.sleeping = false;
    state.action = name;
    actionStart = state.time;
    actionData = options;
    if (name === 'eat') {
      rig.cookie.visible = true;
      if (options.feed) state.feedAt = state.time + 0.95;
    }
    if (name === 'grumpy') setExpression('pout');
    else if (['heart', 'laugh', 'yawn', 'dizzy', 'startled', 'cheer'].includes(name)) setExpression('smile');
    return true;
  }

  function setSleeping(value) {
    state.sleeping = !!value;
    state.talking = false;
    if (rig.sleepSet) rig.sleepSet.visible = state.sleeping;
    if (rig.shadow) rig.shadow.visible = !state.sleeping;
    if (value) {
      state.action = null;
      state.blinkQueue = 0;
      rig.cookie.visible = false;
      rig.mouth.openMouth.visible = false;
      rig.mouth.smile.visible = true;
      rig.mouth.lowerLip.visible = true;
      rig.mouth.lipShine.visible = true;
    } else {
      state.blinkQueue = 0;
      state.blinkStart = -1;
      state.blinkAt = state.time + 0.4;
    }
    return state.sleeping;
  }

  function setTalking(value) {
    state.talking = !!value;
  }

  function setDragging(value) {
    state.dragging = !!value;
    if (value) {
      state.action = null;
      state.sleeping = false;
      if (rig.sleepSet) rig.sleepSet.visible = false;
      if (rig.shadow) rig.shadow.visible = true;
    }
    return state.dragging;
  }

  function setExpression(name) {
    state.expression = name || 'smile';
    const open = state.expression === 'surprised' || state.expression === 'talk';
    rig.mouth.smile.visible = !open && state.expression !== 'pout';
    rig.mouth.lowerLip.visible = !open && state.expression !== 'pout';
    rig.mouth.openMouth.visible = open;
    rig.mouth.tongue.visible = state.expression === 'surprised';
    rig.mouth.pout.visible = state.expression === 'pout';
  }

  function setView(name) {
    const map = { front: 0, right: -Math.PI / 2, back: Math.PI, left: Math.PI / 2 };
    if (typeof name === 'number') state.targetView = name;
    else state.targetView = map[name] ?? 0;
    state.autoRotate = false;
    state.autoRotateAngle = 0;
  }

  function setAutoRotate(value) {
    const next = !!value;
    if (!next) state.autoRotateAngle = 0;
    state.autoRotate = next;
    return state.autoRotate;
  }

  function setScale(value) {
    state.baseScale = clamp(Number(value) || 1, 0.82, 1.06);
    return state.baseScale;
  }

  function setAccessory(name, visible) {
    const targets = {
      glasses: rig.glasses,
      earrings: rig.earrings,
      necklace: rig.necklace,
      clip: rig.hair.clip,
      cap: rig.cap
    };
    if (!targets[name]) return false;
    targets[name].visible = !!visible;
    if (name === 'cap') {
      const on = !!visible;
      rig.hair.bun.visible = !on;
      if (rig.hair.gather) rig.hair.gather.visible = !on;
    }
    return true;
  }

  function lookAtPointer(nx, ny, active = true) {
    if (!active) return;
    state.lastMouseMove = state.time;
    state.lookTargetX = clamp(nx, -1, 1);
    state.lookTargetY = clamp(ny, -1, 1);
  }

  function update(dt, elapsed) {
    state.time = elapsed;
    const t = elapsed;
    const actionT = state.action ? Math.min(1, (t - actionStart) / actionDurations[state.action]) : 0;
    const actionDur = state.action ? actionDurations[state.action] : 0;

    // idle micro-movement
    const breathe = Math.sin(t * 1.75) * 0.5 + Math.sin(t * 0.83) * 0.5;
    const slowSway = Math.sin(t * 0.55);
    const idleHeadYaw = state.sleeping ? 0 : slowSway * 0.035;
    const idleHeadRoll = state.sleeping ? 0.18 : Math.sin(t * 0.7) * 0.018;

    if (t - state.lastMouseMove > 6.0) {
      state.lookTargetX = Math.sin(t * 0.23) * 0.45;
      state.lookTargetY = Math.sin(t * 0.31 + 1.2) * 0.22;
    }
    state.lookX = lerp(state.lookX, state.lookTargetX, clamp(dt * 7, 0, 1));
    state.lookY = lerp(state.lookY, state.lookTargetY, clamp(dt * 7, 0, 1));

    // blinking
    let blink = 0;
    if (state.sleeping) {
      blink = 1;
    } else {
      if (state.blinkStart < 0 && t >= state.blinkAt) {
        state.blinkStart = t;
        if (state.blinkQueue <= 0) state.blinkQueue = Math.random() < 0.22 ? 2 : 1;
      }
      if (state.blinkStart >= 0) {
        const bp = (t - state.blinkStart) / 0.16;
        blink = Math.sin(clamp(bp, 0, 1) * Math.PI);
        if (bp >= 1) {
          blink = 0;
          state.blinkQueue -= 1;
          state.blinkStart = -1;
          if (state.blinkQueue > 0) state.blinkAt = t + 0.16;
          else state.blinkAt = t + 2.1 + Math.random() * 4.5;
        }
      }
    }

    // reset pose each frame
    let headYaw = idleHeadYaw;
    let headPitch = Math.sin(t * 0.9) * 0.012 + 0.01;
    let headRoll = idleHeadRoll + 0.034;
    let rootBob = Math.sin(t * 1.75) * 0.006;
    let rootScaleX = 1;
    let rootScaleY = 1;
    let armLZ = base.armLZ + Math.sin(t * 1.3) * 0.025;
    let armRZ = base.armRZ - Math.sin(t * 1.3 + 0.4) * 0.025;
    let armLX = base.armX;
    let armRX = base.armX;
    let elbowLX = base.elbowX;
    let elbowRX = base.elbowX;
    let eyeScale = 1 - blink * 0.94;
    let eyeHappy = 0;
    let mouthOpen = 0;
    let blush = 0.45;
    let bunSwayX = 0;
    let bunSwayZ = Math.sin(t * 1.2) * 0.025;
    let viewSpin = 0;
    let shadowScale = 1;
    let rootYawExtra = 0;
    let legLX = 0;
    let legRX = 0;
    let legLZ = 0;
    let legRZ = 0;

    // look at pointer
    if (!state.sleeping) {
      headYaw += state.lookX * 0.22;
      headPitch += -state.lookY * 0.10;
    }

    // active actions
    if (state.action) {
      const p = actionT;
      switch (state.action) {
        case 'pet': {
          const wiggle = Math.sin(p * Math.PI * 6) * (1 - p);
          headYaw += wiggle * 0.15;
          headRoll -= 0.10 + Math.sin(p * Math.PI) * 0.08;
          headPitch += 0.07;
          eyeHappy = Math.sin(p * Math.PI) * 0.55;
          blush = 0.75 + Math.sin(p * Math.PI) * 0.25;
          mouthOpen = 0.2;
          bunSwayZ += Math.sin(p * Math.PI * 5) * 0.08;
          break;
        }
        case 'poke': {
          rootScaleX = 1 + Math.sin(p * Math.PI * 3) * 0.035 * (1 - p);
          rootScaleY = 1 - Math.sin(p * Math.PI * 3) * 0.03 * (1 - p);
          rootBob -= Math.sin(p * Math.PI) * 0.035;
          headPitch -= Math.sin(p * Math.PI) * 0.12;
          mouthOpen = Math.sin(p * Math.PI) * 0.9;
          eyeScale = Math.min(eyeScale, 1 - Math.sin(p * Math.PI) * 0.25);
          break;
        }
        case 'wave': {
          armRZ = 0.12 + easeInOutSine(Math.min(1, p * 3)) * 1.9;
          elbowRX = -0.15;
          const wave = Math.sin(t * 11) * 0.20 * Math.sin(Math.min(1, p * 2) * Math.PI);
          armRZ += wave;
          headRoll += 0.07;
          headYaw += 0.1;
          eyeHappy = 0.35;
          mouthOpen = 0.25;
          break;
        }
        case 'jump': {
          const up = Math.sin(Math.min(1, p) * Math.PI);
          rootBob += up * 0.36;
          rootScaleX = 1 - up * 0.035;
          rootScaleY = 1 + up * 0.05;
          shadowScale = 1 - up * 0.16;
          armLZ = -0.12 - up * 1.3;
          armRZ = 0.12 + up * 1.3;
          headPitch -= up * 0.12;
          mouthOpen = 0.55;
          break;
        }
        case 'dance': {
          const beat = Math.sin(t * 8.5);
          const beat2 = Math.sin(t * 4.25);
          rootYawExtra = beat2 * 0.17;
          rootBob += Math.abs(Math.sin(t * 8.5)) * 0.045;
          armLZ = -0.4 + beat * 0.75;
          armRZ = 0.4 + beat * 0.75;
          armLX = 0.15;
          armRX = 0.15;
          elbowLX = -0.3;
          elbowRX = -0.3;
          headRoll += beat2 * 0.10;
          headYaw += beat * 0.08;
          eyeHappy = 0.4;
          mouthOpen = 0.4;
          bunSwayZ += beat2 * 0.08;
          break;
        }
        case 'spin': {
          const spin = easeInOutSine(p) * Math.PI * 2;
          rootYawExtra = spin;
          armLZ = -0.12 - Math.sin(p * Math.PI) * 0.55;
          armRZ = 0.12 + Math.sin(p * Math.PI) * 0.55;
          headRoll += Math.sin(p * Math.PI * 2) * 0.05;
          bunSwayZ += Math.sin(p * Math.PI * 2) * 0.12;
          eyeHappy = 0.35;
          mouthOpen = 0.3;
          break;
        }
        case 'eat': {
          const lift = Math.sin(Math.min(1, p * 1.65) * Math.PI);
          armRX = -0.25 - lift * 1.15;
          elbowRX = -0.3 - lift * 1.15;
          headPitch += lift * 0.08;
          mouthOpen = lift * (0.5 + Math.abs(Math.sin(t * 9)) * 0.4);
          eyeHappy = lift * 0.35;
          rootBob -= lift * 0.01;
          if (actionT >= 0.4 && actionT <= 0.45 && rig.cookie.visible) {
            rig.cookie.scale.setScalar(Math.max(0.001, 1 - (actionT - 0.4) * 20));
          }
          if (actionT > 0.55) {
            rig.cookie.visible = false;
            blush = 0.8;
          }
          break;
        }
        case 'stretch': {
          const s = Math.sin(p * Math.PI);
          armLZ = -0.12 - s * 2.15;
          armRZ = 0.12 + s * 2.15;
          elbowLX = -0.2;
          elbowRX = -0.2;
          rootScaleY = 1 + s * 0.045;
          rootBob += s * 0.02;
          headPitch -= s * 0.18;
          eyeScale = 1 - Math.min(0.8, s * 0.9);
          mouthOpen = s * 0.4;
          break;
        }
        case 'nod': {
          headPitch += Math.sin(p * Math.PI * 4) * 0.11;
          mouthOpen = Math.sin(p * Math.PI) * 0.25;
          break;
        }
        case 'shy': {
          headRoll -= 0.14;
          headYaw -= 0.1;
          eyeHappy = Math.sin(p * Math.PI) * 0.6;
          blush = 0.9;
          armLX = 0.28;
          armRX = 0.28;
          elbowLX = -0.35;
          elbowRX = -0.35;
          mouthOpen = 0.1;
          break;
        }
        case 'heart': {
          const hp = Math.sin(actionT * Math.PI);
          armLZ = 1.15 * hp;
          armRZ = -1.15 * hp;
          elbowLX = -1.35 * hp;
          elbowRX = -1.35 * hp;
          armLX = -0.48 * hp;
          armRX = -0.48 * hp;
          headPitch += 0.05;
          headRoll -= 0.07 * hp;
          eyeHappy = 0.7;
          blush = 0.85;
          mouthOpen = 0.12 * hp;
          rootBob += Math.sin(t * 6) * 0.004;
          break;
        }
        case 'laugh': {
          const bounce = Math.abs(Math.sin(t * 9));
          rootBob += bounce * 0.028;
          rootScaleX = 1 + bounce * 0.012;
          rootScaleY = 1 - bounce * 0.008;
          headPitch -= 0.14;
          headRoll += 0.05;
          armLZ = -0.28;
          armRZ = 0.28;
          armLX = 0.22;
          armRX = 0.22;
          elbowLX = -0.9;
          elbowRX = -0.9;
          eyeHappy = 0.9;
          mouthOpen = 0.7;
          blush = 0.8;
          break;
        }
        case 'grumpy': {
          headYaw -= 0.28;
          headRoll -= 0.13;
          armLZ = 0.65;
          armRZ = -0.65;
          armLX = -0.42;
          armRX = -0.42;
          elbowLX = -1.32;
          elbowRX = -1.32;
          legRX = Math.abs(Math.sin(t * 12)) * 0.08;
          eyeScale = 1;
          mouthOpen = 0;
          blush = 0.35;
          break;
        }
        case 'yawn': {
          const yp = Math.sin(actionT * Math.PI);
          armLZ = -0.12 - yp * 2.0;
          armRZ = 0.12 + yp * 2.0;
          elbowLX = -0.12;
          elbowRX = -0.12;
          headPitch -= yp * 0.18;
          eyeScale = 1 - yp * 0.95;
          mouthOpen = yp * 0.95;
          rootScaleY = 1 + yp * 0.03;
          rootBob += yp * 0.02;
          blush = 0.45;
          break;
        }
        case 'dizzy': {
          const wobble = Math.sin(t * 16);
          headYaw += wobble * 0.22;
          headRoll += Math.sin(t * 12) * 0.18;
          rootYawExtra = Math.sin(t * 10) * 0.05;
          armLZ = -0.55;
          armRZ = 0.55;
          armLX = 0.12;
          armRX = 0.12;
          elbowLX = -0.3;
          elbowRX = -0.3;
          eyeScale = Math.max(eyeScale, 0.65);
          mouthOpen = 0.35;
          blush = 0.65;
          bunSwayZ += wobble * 0.08;
          break;
        }
        case 'startled': {
          const sp = Math.sin(actionT * Math.PI);
          rootBob += sp * 0.14;
          rootScaleY = 1 + sp * 0.055;
          headPitch -= sp * 0.08;
          headRoll += sp * 0.05;
          armLZ = -0.12 - sp * 1.9;
          armRZ = 0.12 + sp * 1.9;
          elbowLX = -0.15;
          elbowRX = -0.15;
          eyeScale = Math.max(eyeScale, 0.9);
          mouthOpen = sp * 0.95;
          blush = 0.4;
          break;
        }
        case 'cheer': {
          const cp = Math.sin(actionT * Math.PI);
          armLZ = -0.12 - cp * 2.5;
          armRZ = 0.12 + cp * 2.5;
          elbowLX = -0.12;
          elbowRX = -0.12;
          rootBob += cp * 0.13;
          headPitch -= cp * 0.06;
          eyeHappy = 0.75;
          mouthOpen = cp * 0.7;
          blush = 0.8;
          break;
        }
        default:
          break;
      }
      if (actionT >= 1) {
        state.action = null;
        if (actionData?.feed && state.feedAt && state.time >= state.feedAt) {
          window.dispatchEvent(new CustomEvent('xiaoshen:fed'));
          state.feedAt = 0;
        }
        actionData = null;
        rig.cookie.visible = false;
        rig.cookie.scale.setScalar(1);
        if (state.expression === 'pout') setExpression('smile');
      }
    }

    // sleeping pose
    if (state.sleeping) {
      headPitch = -0.04;
      headRoll = 0.24;
      headYaw = 0.05;
      eyeScale = 0.0;
      armLZ = -0.28;
      armRZ = 0.28;
      armLX = -0.18;
      armRX = -0.18;
      elbowLX = -0.36;
      elbowRX = -0.36;
      legLX = -1.12;
      legRX = -1.12;
      legLZ = 0.07;
      legRZ = -0.07;
      rootBob = Math.sin(t * 0.65) * 0.008 - 0.11;
      mouthOpen = 0;
      blush = 0.35;
      rootScaleY = 1 - Math.sin(t * 0.65) * 0.006;
    }

    // dragging dangle
    if (state.dragging) {
      armLZ = -2.45;
      armRZ = 2.45;
      armLX = 0.18;
      armRX = 0.18;
      elbowLX = -0.25;
      elbowRX = -0.25;
      legLX = 0.42 + Math.sin(t * 9) * 0.18;
      legRX = 0.42 - Math.sin(t * 9) * 0.18;
      legLZ = 0.06;
      legRZ = -0.06;
      headPitch = 0.12;
      headRoll = 0.17;
      eyeScale = Math.max(eyeScale, 0.55);
      mouthOpen = 0.55;
      blush = 0.55;
      rootBob = 0.02 + Math.sin(t * 5) * 0.01;
    }

    // talking mouth
    if (state.talking) {
      mouthOpen = Math.max(mouthOpen, 0.16 + Math.abs(Math.sin(t * 15)) * 0.34);
    }

    // apply poses
    root.position.y = rootBob;
    const scaleBase = state.baseScale;
    root.scale.set(rootScaleX * scaleBase, rootScaleY * scaleBase, rootScaleX * scaleBase);
    state.view = lerp(state.view, state.targetView, clamp(dt * 5.5, 0, 1));
    if (state.autoRotate && !state.action) state.autoRotateAngle += dt * 0.42;
    root.rotation.y = state.view + state.autoRotateAngle + rootYawExtra + Math.sin(t * 0.4) * 0.012 * (state.sleeping ? 0.3 : 1);
    rig.head.rotation.set(headPitch, headYaw, headRoll);
    rig.legs.left.leg.rotation.set(legLX, 0, legLZ);
    rig.legs.right.leg.rotation.set(legRX, 0, legRZ);
    rig.arms.left.arm.rotation.set(armLX, 0, armLZ);
    rig.arms.right.arm.rotation.set(armRX, 0, armRZ);
    rig.arms.left.elbow.rotation.x = elbowLX;
    rig.arms.right.elbow.rotation.x = elbowRX;
    rig.arms.left.palm.rotation.z = -0.1;
    rig.arms.right.palm.rotation.z = 0.1;
    rig.hair.bun.position.x = 0.01 + bunSwayX;
    rig.hair.bun.rotation.z = bunSwayZ;
    rig.hair.bun.rotation.x = Math.sin(t * 0.9) * 0.025;
    rig.hair.bangs.rotation.z = bunSwayZ * 0.25;
    rig.hair.bangs.rotation.x = Math.sin(t * 1.1) * 0.006;

    const happyEyes = Math.max(eyeHappy, state.expression === 'happy' ? 0.5 : 0);
    rig.eyes.left.group.scale.y = Math.max(0.055, eyeScale * (1 - happyEyes * 0.45));
    rig.eyes.right.group.scale.y = rig.eyes.left.group.scale.y;
    // gaze
    const pupilX = state.lookX * 0.013;
    const pupilY = -state.lookY * 0.010;
    for (const eye of [rig.eyes.left, rig.eyes.right]) {
      eye.iris.position.x = pupilX * 0.55;
      eye.irisInner.position.x = pupilX * 0.7;
      eye.pupil.position.x = pupilX;
      eye.shine.position.x = -0.022 + pupilX;
      eye.pupil.position.y = pupilY;
      eye.iris.position.y = pupilY * 0.5;
      eye.irisInner.position.y = pupilY * 0.65;
      eye.shine.position.y = 0.032 + pupilY;
    }
    // mouth
    const open = clamp(mouthOpen, 0, 1);
    if (open > 0.06) {
      rig.mouth.smile.visible = false;
      rig.mouth.lowerLip.visible = false;
      rig.mouth.openMouth.visible = true;
      rig.mouth.tongue.visible = open > 0.35;
      rig.mouth.pout.visible = false;
      rig.mouth.lipShine.visible = false;
      rig.mouth.openMouth.scale.set(0.056 * (1 + open * 0.22), 0.036 * (0.80 + open * 0.82), 0.018);
      rig.mouth.tongue.position.y = -0.055 - open * 0.008;
    } else if (state.expression === 'pout') {
      rig.mouth.smile.visible = false;
      rig.mouth.lowerLip.visible = false;
      rig.mouth.openMouth.visible = false;
      rig.mouth.tongue.visible = false;
      rig.mouth.pout.visible = true;
      rig.mouth.lipShine.visible = false;
    } else {
      rig.mouth.smile.visible = true;
      rig.mouth.lowerLip.visible = true;
      rig.mouth.openMouth.visible = false;
      rig.mouth.tongue.visible = false;
      rig.mouth.pout.visible = false;
      rig.mouth.smile.scale.y = 1 + Math.max(0, open) * 2;
    }
    // blush
    for (const b of rig.blush) b.material.opacity = clamp(blush, 0, 1);
    // shadow
    rig.shadow.scale.set(shadowScale * scaleBase, shadowScale * 0.95 * scaleBase, 1);
    rig.cookie.visible = state.action === 'eat' && actionT < 0.56;

    // random idle gestures
    if (!state.action && !state.sleeping && t > state.idleAt) {
      const pick = Math.random();
      if (pick < 0.28) setAction('wave');
      else if (pick < 0.5) setAction('stretch');
      else if (pick < 0.68) setAction('nod');
      else if (pick < 0.84) setAction('shy');
      state.idleAt = t + 22 + Math.random() * 24;
    }
    rig.hair.bun.rotation.y = Math.sin(t * 0.5) * 0.02;
  }

  function dispose() {
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose?.();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      }
    });
    Object.values(mats).forEach((m) => {
      if (m && m.isMaterial) m.dispose();
    });
  }

  const hitMeshes = [];
  root.traverse((obj) => {
    if (obj.isMesh && obj.userData.zone) hitMeshes.push(obj);
  });

  setOutfit('sweater');
  setExpression('smile');

  return {
    root,
    rig,
    state,
    hitMeshes,
    setOutfit,
    setExpression,
    setAction,
    setSleeping,
    setTalking,
    setDragging,
    setView,
    setAutoRotate,
    setScale,
    setAccessory,
    lookAtPointer,
    update,
    dispose,
    get outfit() { return state.outfit; },
    get action() { return state.action; },
    get sleeping() { return state.sleeping; },
    get view() { return state.view; }
  };
}
