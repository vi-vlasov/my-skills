import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------- renderer

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.93;

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8f6fc);

// studio wall: blurred bright panels, like the blown-out DBH backdrop
function wallTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 576;
  const ctx = c.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, 576);
  base.addColorStop(0, '#fbfdff');
  base.addColorStop(0.3, '#f3fbff');
  base.addColorStop(0.62, '#dceff8');
  base.addColorStop(1, '#bcdceb');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 576);

  const topGlow = ctx.createRadialGradient(508, 98, 44, 508, 98, 460);
  topGlow.addColorStop(0, 'rgba(255,255,255,0.82)');
  topGlow.addColorStop(0.42, 'rgba(255,255,255,0.34)');
  topGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, 1024, 360);

  const paneWash = ctx.createLinearGradient(0, 0, 1024, 0);
  paneWash.addColorStop(0, 'rgba(136,194,226,0.54)');
  paneWash.addColorStop(0.16, 'rgba(225,244,252,0.18)');
  paneWash.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  paneWash.addColorStop(0.84, 'rgba(202,232,247,0.3)');
  paneWash.addColorStop(1, 'rgba(121,190,226,0.56)');
  ctx.fillStyle = paneWash;
  ctx.fillRect(0, 0, 1024, 576);

  // tall luminous panes: soft enough to sit behind the face, but structured like the DBH menu.
  ctx.filter = 'blur(14px)';
  const panels: Array<[number, number, string, number]> = [
    [14, 46, '#9ed2ee', 1.0],
    [100, 66, '#ffffff', 0.9],
    [232, 76, '#bfe1f4', 0.86],
    [402, 92, '#ffffff', 0.72],
    [594, 100, '#c6e6f7', 0.82],
    [784, 66, '#ffffff', 0.92],
    [922, 58, '#92caea', 0.96],
  ];
  for (const [x, w, color, a] of panels) {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x, -42, w, 680);
  }

  ctx.filter = 'blur(8px)';
  const hotColumns: Array<[number, number, number]> = [
    [38, 18, 0.72],
    [144, 26, 0.76],
    [316, 22, 0.52],
    [748, 26, 0.58],
    [886, 22, 0.78],
    [982, 18, 0.82],
  ];
  for (const [x, w, a] of hotColumns) {
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, -48, w, 696);
  }

  ctx.filter = 'blur(3px)';
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = '#f8fdff';
  for (const x of [82, 190, 334, 516, 708, 878, 986]) {
    ctx.fillRect(x, 0, 4, 576);
  }
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#9ccbe5';
  for (const x of [74, 204, 348, 696, 866]) {
    ctx.fillRect(x, 0, 2, 576);
  }

  ctx.filter = 'blur(12px)';
  ctx.globalAlpha = 0.84;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-60, 292, 1144, 52);
  ctx.globalAlpha = 0.58;
  ctx.fillStyle = '#b7d8eb';
  ctx.fillRect(-40, 210, 1104, 12);
  ctx.fillRect(-40, 372, 1104, 10);
  ctx.fillRect(-40, 462, 1104, 12);

  const sideFog = ctx.createLinearGradient(0, 0, 1024, 0);
  sideFog.addColorStop(0, 'rgba(136,194,226,0.48)');
  sideFog.addColorStop(0.18, 'rgba(232,247,253,0.1)');
  sideFog.addColorStop(0.78, 'rgba(232,247,253,0.06)');
  sideFog.addColorStop(1, 'rgba(118,187,224,0.46)');
  ctx.fillStyle = sideFog;
  ctx.fillRect(0, 0, 1024, 576);

  const lowerFog = ctx.createLinearGradient(0, 260, 0, 576);
  lowerFog.addColorStop(0, 'rgba(255,255,255,0)');
  lowerFog.addColorStop(0.46, 'rgba(226,242,250,0.22)');
  lowerFog.addColorStop(1, 'rgba(189,216,232,0.68)');
  ctx.fillStyle = lowerFog;
  ctx.fillRect(0, 250, 1024, 326);

  ctx.filter = 'none';
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.52)');
  g.addColorStop(0.62, 'rgba(215,235,248,0.18)');
  g.addColorStop(1, 'rgba(215,235,248,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function catchlightTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(40, 34, 1, 40, 34, 38);
  g.addColorStop(0, 'rgba(255,255,255,0.96)');
  g.addColorStop(0.24, 'rgba(238,250,255,0.72)');
  g.addColorStop(0.52, 'rgba(166,220,255,0.18)');
  g.addColorStop(1, 'rgba(166,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);

  const pin = ctx.createRadialGradient(56, 52, 0, 56, 52, 14);
  pin.addColorStop(0, 'rgba(255,255,255,0.62)');
  pin.addColorStop(0.34, 'rgba(255,255,255,0.24)');
  pin.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = pin;
  ctx.fillRect(0, 0, 96, 96);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function blinkVeilTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');

  const lid = ctx.createRadialGradient(128, 64, 12, 128, 66, 112);
  lid.addColorStop(0, 'rgba(194,150,139,0.98)');
  lid.addColorStop(0.48, 'rgba(166,124,118,0.9)');
  lid.addColorStop(0.82, 'rgba(104,78,84,0.5)');
  lid.addColorStop(1, 'rgba(154,126,120,0)');
  ctx.fillStyle = lid;
  ctx.beginPath();
  ctx.ellipse(128, 66, 106, 42, 0, 0, Math.PI * 2);
  ctx.fill();

  const crease = ctx.createLinearGradient(0, 34, 0, 88);
  crease.addColorStop(0, 'rgba(62,50,54,0.26)');
  crease.addColorStop(0.46, 'rgba(82,61,64,0.12)');
  crease.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = crease;
  ctx.beginPath();
  ctx.ellipse(128, 56, 102, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(48,38,44,0.44)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(44, 82);
  ctx.quadraticCurveTo(128, 98, 212, 82);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(244,214,204,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(58, 73);
  ctx.quadraticCurveTo(128, 86, 198, 73);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(7.2, 4.05),
  new THREE.MeshBasicMaterial({ map: wallTexture() })
);
wall.position.set(0, 1.5, -2.2);
scene.add(wall);

const halo = new THREE.Mesh(
  new THREE.PlaneGeometry(2.65, 2.65),
  new THREE.MeshBasicMaterial({
    map: haloTexture(),
    transparent: true,
    opacity: 0.65,
    toneMapped: false,
    depthWrite: false,
  })
);
halo.position.set(0.02, 1.9, -2.04);
halo.material.opacity = 0.2;
scene.add(halo);

const lowerWash = new THREE.Mesh(
  new THREE.PlaneGeometry(7.8, 1.9),
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.96, 1.0, 1.08),
    transparent: true,
    opacity: 0.22,
    toneMapped: false,
    depthWrite: false,
  })
);
lowerWash.position.set(0, 0.28, -1.96);
lowerWash.material.opacity = 0.015;
scene.add(lowerWash);

const menuGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(7.8, 0.32),
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.88, 1.02, 1.18),
    transparent: true,
    opacity: 0.36,
    toneMapped: false,
    depthWrite: false,
  })
);
menuGlow.position.set(0, 0.91, -2.0);
scene.add(menuGlow);

// hot glow strips that feed the bloom halo around the silhouette
function glowStrip(x, w, intensity, opacity = 0.82) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, 4.2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(intensity, intensity, intensity),
      toneMapped: false,
      transparent: true,
      opacity,
    })
  );
  m.position.set(x, 1.5, -2.1);
  scene.add(m);
}
glowStrip(-3.02, 0.2, 1.38, 0.9);
glowStrip(-1.72, 0.26, 1.18, 0.74);
glowStrip(0.28, 0.3, 0.98, 0.5);
glowStrip(1.7, 0.24, 1.22, 0.8);
glowStrip(2.96, 0.2, 1.42, 0.92);

// image-based lighting
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.5;
pmrem.dispose();

// ---------------------------------------------------------------- camera

const camera = new THREE.PerspectiveCamera(24.6, window.innerWidth / window.innerHeight, 0.05, 30);
const FOCUS = new THREE.Vector3(0, 1.5, 0); // close-up portrait framing, DBH main-menu style
const CAM_Z = 0.69;
camera.position.set(0.004, FOCUS.y + 0.005, CAM_Z);
camera.lookAt(FOCUS);

// ---------------------------------------------------------------- lights

// soft frontal key — the bright studio look
const key = new THREE.DirectionalLight(0xfff1e9, 1.48);
key.position.set(0.3, 2.85, 2.45);
scene.add(key);

// cool fill from the other side
const fill = new THREE.DirectionalLight(0xd8efff, 0.92);
fill.position.set(-1.55, 1.88, 1.45);
scene.add(fill);

// back/rim lights — edge glow that melts into the background
const rimL = new THREE.DirectionalLight(0xe9f7ff, 1.32);
rimL.position.set(-1.8, 2.45, -1.15);
scene.add(rimL);
const rimR = new THREE.DirectionalLight(0xf7fdff, 1.14);
rimR.position.set(1.42, 2.35, -0.96);
scene.add(rimR);

const overhead = new THREE.DirectionalLight(0xf3fbff, 0.34);
overhead.position.set(0, 3.3, 0.85);
scene.add(overhead);

const portraitFill = new THREE.PointLight(0xeaf7ff, 0.46, 1.35, 2.0);
portraitFill.position.set(0, 1.62, 0.58);
scene.add(portraitFill);

// ---------------------------------------------------------------- character

const bootEl = document.getElementById('boot');
const bootBar = document.getElementById('boot-progress');
const bootStatus = document.getElementById('boot-status');

// the whole head group turns toward the pointer (androids watch you)
const headGroup = new THREE.Group();
scene.add(headGroup);

let mixer = null;

const ktx2 = new KTX2Loader()
  .setTranscoderPath('vendor/addons/libs/basis/')
  .detectSupport(renderer);
const draco = new DRACOLoader().setDecoderPath('vendor/addons/libs/draco/gltf/');
const gltfLoader = new GLTFLoader()
  .setKTX2Loader(ktx2)
  .setDRACOLoader(draco)
  .setMeshoptDecoder(MeshoptDecoder);

const texLoader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(url, srgb = false) {
  const t = texLoader.load(url);
  t.flipY = false; // glTF UV convention
  t.wrapS = t.wrapT = THREE.RepeatWrapping; // UDIM-смещённые UV рипа
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function modelReady() {
  bootBar.style.width = '100%';
  bootStatus.textContent = 'MODEL READY · СИСТЕМА АКТИВНА';
  setTimeout(() => bootEl.classList.add('done'), 450);
}
function onProgress(xhr) {
  if (xhr.total) bootBar.style.width = `${Math.round((xhr.loaded / xhr.total) * 100)}%`;
  bootStatus.textContent = 'LOADING GEOMETRY & TEXTURES…';
}

function buildRig(root) {
  const bones = new Map();
  root.traverse((obj) => {
    if (obj.isBone) bones.set(obj.name, obj);
  });

  const names = [...bones.keys()];
  const pick = (...list) => list.map((name) => bones.get(name)).filter(Boolean);
  const filter = (fn) => names.filter(fn).map((name) => bones.get(name));
  const lowerLids = filter((name) => /^Bip_FaceEyelidLo/.test(name));
  const isLowerLidL = (bone) => /_L$/.test(bone.name) || (bone.name.includes('Base') && bone.position.z > 0);
  const isLowerLidR = (bone) => /_R(\.\d+)?$/.test(bone.name) && !isLowerLidL(bone);

  return {
    bones,
    baseRotations: new Map([...bones.values()].map((bone) => [bone, bone.rotation.clone()])),
    basePositions: new Map([...bones.values()].map((bone) => [bone, bone.position.clone()])),
    neck: bones.get('Bip_Neck'),
    head: bones.get('Bip_Head'),
    eyeL: bones.get('Bip_Eye_L'),
    eyeR: bones.get('Bip_Eye_R'),
    spineUpper: pick('Bip_Spine4', 'Bip_Spine3'),
    spineMid: pick('Bip_Spine2', 'Bip_Spine1'),
    clavicles: pick('Bip_Clavicle_L', 'Bip_Clavicle_R'),
    mouthRoot: pick('Bip_FaceMouth'),
    jaw: filter((name) => name.startsWith('Bip_FaceJawJoint')),
    mandiblesL: filter((name) => /^Bip_FaceMandible.*_L$/.test(name)),
    mandiblesR: filter((name) => /^Bip_FaceMandible.*_R$/.test(name)),
    mouthCornersL: filter((name) => /^Bip_FaceMouthCorner.*_L$/.test(name)),
    mouthCornersR: filter((name) => /^Bip_FaceMouthCorner.*_R$/.test(name)),
    lipMidUpper: pick('Bip_FaceLipMiUpOut', 'Bip_FaceLipMiUpIn'),
    lipMidLower: pick('Bip_FaceLipMiLoOut', 'Bip_FaceLipMiLoIn'),
    lipLowerL: filter((name) => /^Bip_FaceLip(BumpLo|Ridge).*_L$/.test(name)),
    lipLowerR: filter((name) => /^Bip_FaceLip(BumpLo|Ridge).*_R$/.test(name)),
    lipEdgesL: filter((name) => /^Bip_FaceLip(Edge|Roll|Ridge).*_L$/.test(name)),
    lipEdgesR: filter((name) => /^Bip_FaceLip(Edge|Roll|Ridge).*_R$/.test(name)),
    upperLip: filter((name) => name.startsWith('Bip_FaceUpperLipUp')),
    tongue: filter((name) => /^Bip_FaceTongue/.test(name)),
    cheeksL: filter((name) => /^Bip_Face(Cheek|NostrilCheek).*_L$/.test(name)),
    cheeksR: filter((name) => /^Bip_Face(Cheek|NostrilCheek).*_R$/.test(name)),
    browsL: filter((name) => /^Bip_FaceBrow(Up|Lo).*_L$/.test(name)),
    browsR: filter((name) => /^Bip_FaceBrow(Up|Lo).*_R$/.test(name)),
    orbitsUpperL: filter((name) => /^Bip_FaceEyeOrbitUp\d{2}_L$/.test(name)),
    orbitsUpperR: filter((name) => /^Bip_FaceEyeOrbitUp\d{2}_R$/.test(name)),
    eyeCoversL: filter((name) => /^Bip_FaceEyeCover\d{2}_L$/.test(name)),
    eyeCoversR: filter((name) => /^Bip_FaceEyeCover\d{2}_R$/.test(name)),
    lidsUpperL: filter((name) => /^Bip_FaceEyelid\d{2}_L$/.test(name)),
    lidsUpperR: filter((name) => /^Bip_FaceEyelid\d{2}_R$/.test(name)),
    lidsLowerL: lowerLids.filter(isLowerLidL),
    lidsLowerR: lowerLids.filter(isLowerLidR),
  };
}

function setBoneRotationDelta(rig, bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  const base = rig.baseRotations.get(bone);
  if (!base) return;
  bone.rotation.set(base.x + x, base.y + y, base.z + z);
}

function setBoneRotationDeltas(rig, bones, x = 0, y = 0, z = 0) {
  for (const bone of bones) setBoneRotationDelta(rig, bone, x, y, z);
}

function setBonePositionDelta(rig, bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  const base = rig.basePositions.get(bone);
  if (!base) return;
  bone.position.set(base.x + x, base.y + y, base.z + z);
}

function setBonePositionDeltas(rig, bones, x = 0, y = 0, z = 0) {
  for (const bone of bones) setBonePositionDelta(rig, bone, x, y, z);
}

const eyeCatchlightMap = catchlightTexture();
const eyeBlinkVeilMap = blinkVeilTexture();
const eyeWorld = new THREE.Vector3();
const eyeToCamera = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const cameraUp = new THREE.Vector3();
const cameraForward = new THREE.Vector3();

function createEyeCatchlight(name) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: eyeCatchlightMap,
    color: new THREE.Color(0.82, 0.92, 1.02),
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }));
  sprite.name = name;
  sprite.scale.setScalar(0.012);
  sprite.visible = false;
  scene.add(sprite);
  return sprite;
}

function createEyeBlinkVeil(name) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: eyeBlinkVeilMap,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  }));
  sprite.name = name;
  sprite.renderOrder = 14;
  sprite.scale.set(0.055, 0.026, 1);
  sprite.visible = false;
  scene.add(sprite);
  return sprite;
}

function setupEyeCatchlights() {
  const prev = headGroup.userData.eyeCatchlights;
  if (prev) {
    scene.remove(prev.left, prev.right);
  }
  headGroup.userData.eyeCatchlights = {
    left: createEyeCatchlight('Chloe_EyeCatchlight_L'),
    right: createEyeCatchlight('Chloe_EyeCatchlight_R'),
  };
  document.body.dataset.eyeCatchlights = '2';
}

function setupEyeBlinkVeils() {
  const prev = headGroup.userData.eyeBlinkVeils;
  if (prev) {
    scene.remove(prev.left, prev.right);
  }
  headGroup.userData.eyeBlinkVeils = {
    left: createEyeBlinkVeil('Chloe_EyeBlinkVeil_L'),
    right: createEyeBlinkVeil('Chloe_EyeBlinkVeil_R'),
  };
  document.body.dataset.eyeBlinkVeils = '2';
}

function updateEyeCatchlight(sprite, eyeBone, blinkClose, side, smile) {
  if (!sprite || !eyeBone) return;
  const openFade = 1 - THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(blinkClose, 0, 1), 0.24, 0.56);
  sprite.material.opacity = openFade * (0.24 + smile * 0.08);
  sprite.visible = sprite.material.opacity > 0.02;
  if (!sprite.visible) return;

  camera.matrixWorld.extractBasis(cameraRight, cameraUp, cameraForward);
  eyeBone.getWorldPosition(eyeWorld);
  eyeToCamera.copy(camera.position).sub(eyeWorld).normalize();
  sprite.position
    .copy(eyeWorld)
    .addScaledVector(eyeToCamera, 0.022)
    .addScaledVector(cameraRight, -0.004 + side * 0.0015)
    .addScaledVector(cameraUp, 0.0074);

  const scale = 0.0088 + smile * 0.0018;
  sprite.scale.set(scale, scale, scale);
}

function updateEyeCatchlights(rig, blinkClose, smile) {
  const catchlights = headGroup.userData.eyeCatchlights;
  if (!catchlights) return;
  headGroup.updateMatrixWorld(true);
  updateEyeCatchlight(catchlights.left, rig.eyeL, blinkClose, -1, smile);
  updateEyeCatchlight(catchlights.right, rig.eyeR, blinkClose, 1, smile);
  document.body.dataset.eyeCatchlightOpacity = catchlights.left.material.opacity.toFixed(3);
}

function updateEyeBlinkVeil(sprite, eyeBone, blinkClose, side) {
  if (!sprite || !eyeBone) return;
  const close = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(blinkClose, 0, 1), 0.18, 0.86);
  sprite.material.opacity = close * 0.98;
  sprite.visible = sprite.material.opacity > 0.02;
  if (!sprite.visible) return;

  camera.matrixWorld.extractBasis(cameraRight, cameraUp, cameraForward);
  eyeBone.getWorldPosition(eyeWorld);
  eyeToCamera.copy(camera.position).sub(eyeWorld).normalize();
  sprite.position
    .copy(eyeWorld)
    .addScaledVector(eyeToCamera, 0.026)
    .addScaledVector(cameraRight, side * 0.001)
    .addScaledVector(cameraUp, -0.0054 - close * 0.001);

  sprite.scale.set(0.052, 0.018 + close * 0.02, 1);
}

function updateEyeBlinkVeils(rig, blinkClose) {
  const veils = headGroup.userData.eyeBlinkVeils;
  if (!veils) return;
  headGroup.updateMatrixWorld(true);
  updateEyeBlinkVeil(veils.left, rig.eyeL, blinkClose, -1);
  updateEyeBlinkVeil(veils.right, rig.eyeR, blinkClose, 1);
  document.body.dataset.eyeBlinkVeilOpacity = veils.left.material.opacity.toFixed(3);
}

const BLINK_NATIVE = {
  restClose: 0.16,
  closeScale: 1.32,
  closeBias: -0.08,
  upperDrop: 0.00009,
  coverDrop: 0.000074,
  lowerRise: -0.000025,
  orbitDrop: 0.000018,
  upperFold: -0.04,
  coverFold: -0.028,
  lowerFold: 0.014,
  closedEyeOpacity: 0.28,
};

function smootherStep01(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function getNativeBlinkClose(blink) {
  const weightedBlink = THREE.MathUtils.clamp(blink * BLINK_NATIVE.closeScale + BLINK_NATIVE.closeBias, 0, 1);
  const animatedClose = THREE.MathUtils.smoothstep(weightedBlink, 0, 1);
  return THREE.MathUtils.clamp(BLINK_NATIVE.restClose + animatedClose * (1 - BLINK_NATIVE.restClose), 0, 1);
}

function applyNativeBlink(rig, blink, squint, lookY) {
  const close = getNativeBlinkClose(blink);
  const gazeSquint = THREE.MathUtils.clamp(squint + Math.max(0, lookY) * 0.08, 0, 0.08);
  const upperDrop = BLINK_NATIVE.upperDrop * close + 0.000018 * gazeSquint;
  const coverDrop = BLINK_NATIVE.coverDrop * close + 0.000014 * gazeSquint;
  const lowerRise = BLINK_NATIVE.lowerRise * close - 0.000009 * gazeSquint;
  const orbitDrop = BLINK_NATIVE.orbitDrop * close + 0.000006 * gazeSquint;
  const upperFold = BLINK_NATIVE.upperFold * close - 0.008 * gazeSquint;
  const coverFold = BLINK_NATIVE.coverFold * close - 0.006 * gazeSquint;
  const lowerFold = BLINK_NATIVE.lowerFold * close + 0.006 * gazeSquint;

  setBonePositionDeltas(rig, rig.orbitsUpperL, orbitDrop, 0, 0);
  setBonePositionDeltas(rig, rig.orbitsUpperR, orbitDrop, 0, 0);
  setBonePositionDeltas(rig, rig.eyeCoversL, coverDrop, 0, 0);
  setBonePositionDeltas(rig, rig.eyeCoversR, coverDrop, 0, 0);
  setBonePositionDeltas(rig, rig.lidsUpperL, upperDrop, 0, 0);
  setBonePositionDeltas(rig, rig.lidsUpperR, upperDrop, 0, 0);
  setBonePositionDeltas(rig, rig.lidsLowerL, lowerRise, 0, 0);
  setBonePositionDeltas(rig, rig.lidsLowerR, lowerRise, 0, 0);

  setBoneRotationDeltas(rig, rig.orbitsUpperL, coverFold * 0.35, 0, 0);
  setBoneRotationDeltas(rig, rig.orbitsUpperR, coverFold * 0.35, 0, 0);
  setBoneRotationDeltas(rig, rig.eyeCoversL, coverFold, 0, close * 0.035);
  setBoneRotationDeltas(rig, rig.eyeCoversR, coverFold, 0, -close * 0.035);
  setBoneRotationDeltas(rig, rig.lidsUpperL, upperFold, 0, close * 0.055);
  setBoneRotationDeltas(rig, rig.lidsUpperR, upperFold, 0, -close * 0.055);
  setBoneRotationDeltas(rig, rig.lidsLowerL, lowerFold, 0, -close * 0.018);
  setBoneRotationDeltas(rig, rig.lidsLowerR, lowerFold, 0, close * 0.018);

  document.body.dataset.blinkNativeClose = close.toFixed(3);
  return close;
}

function applyEyeBlinkVisibility(eyeMats, close) {
  if (!eyeMats) return;
  const hide = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(close, 0, 1), 0.18, 0.88);
  for (const mat of eyeMats) {
    mat.opacity = 1 - hide * (1 - BLINK_NATIVE.closedEyeOpacity);
  }
  document.body.dataset.eyeOpacity = eyeMats[0]?.opacity?.toFixed?.(3) ?? '';
}

function applyNativeSmile(rig, smile, asymmetry = 0) {
  const liftL = THREE.MathUtils.clamp(smile + asymmetry, 0, 1);
  const liftR = THREE.MathUtils.clamp(smile - asymmetry, 0, 1);
  const cornerUpL = -0.000048 * liftL;
  const cornerUpR = -0.000048 * liftR;
  const cornerOutL = 0.00001 * liftL;
  const cornerOutR = -0.00001 * liftR;
  const cheekLiftL = -0.000042 * liftL;
  const cheekLiftR = -0.000042 * liftR;

  setBonePositionDeltas(rig, rig.mouthCornersL, cornerUpL, 0.000009 * liftL, cornerOutL);
  setBonePositionDeltas(rig, rig.mouthCornersR, cornerUpR, 0.000009 * liftR, cornerOutR);
  setBonePositionDeltas(rig, rig.lipEdgesL, cornerUpL * 0.34, 0, cornerOutL * 0.32);
  setBonePositionDeltas(rig, rig.lipEdgesR, cornerUpR * 0.34, 0, cornerOutR * 0.32);
  setBonePositionDeltas(rig, rig.cheeksL, cheekLiftL, 0.000008 * liftL, 0.000008 * liftL);
  setBonePositionDeltas(rig, rig.cheeksR, cheekLiftR, 0.000008 * liftR, -0.000008 * liftR);
}

function applyNativeMouth(rig, openness, smile, speechPulse = 0) {
  const open = THREE.MathUtils.clamp(openness, 0, 1);
  const smileLift = THREE.MathUtils.clamp(smile, 0, 1);
  const pulse = THREE.MathUtils.clamp(speechPulse, -1, 1);
  const upperLift = -0.000072 * smileLift - 0.000082 * open + 0.000004 * pulse;
  const lowerDrop = 0.000145 * open + 0.000004 * Math.max(0, pulse);
  const lowerOut = 0.000007 * open;
  const sideSeal = 0.000041 * open;

  setBoneRotationDeltas(rig, rig.mouthRoot, open * 0.026, 0, 0);
  setBoneRotationDeltas(rig, rig.mandiblesL, open * 0.016, 0, -open * 0.004);
  setBoneRotationDeltas(rig, rig.mandiblesR, open * 0.016, 0, open * 0.004);
  setBonePositionDeltas(rig, rig.lipMidUpper, upperLift, 0.000002 * pulse, 0);
  setBonePositionDeltas(rig, rig.lipMidLower, lowerDrop, -0.000003 * pulse, 0);
  setBonePositionDeltas(rig, rig.lipLowerL, lowerDrop * 0.44 - sideSeal, 0, lowerOut);
  setBonePositionDeltas(rig, rig.lipLowerR, lowerDrop * 0.44 - sideSeal, 0, -lowerOut);
  setBoneRotationDeltas(rig, rig.tongue, open * 0.006, 0, 0);

  document.body.dataset.facialMouthOpen = open.toFixed(3);
  document.body.dataset.facialSmile = smileLift.toFixed(3);
}

// ---- primary character: Chloe (bundled with the portfolio) ----
// If these assets are removed, the free facecap head still loads as fallback.

function chloeMaterials() {
  const A = 'assets/chloe/';
  const skin = (alb, nrm, rough) =>
    new THREE.MeshPhysicalMaterial({
      map: tex(A + alb, true),
      normalMap: tex(A + nrm),
      roughnessMap: tex(A + rough),
      roughness: 0.86,
      specularIntensity: 0.2,
      clearcoat: 0.05,
      clearcoatRoughness: 0.72,
      envMapIntensity: 0.36,
      color: new THREE.Color(1.09, 1.035, 1.0),
    });
  const cutout = (map, opts = {}) =>
    new THREE.MeshStandardMaterial({
      map: tex(A + map, true),
      transparent: true,
      alphaTest: 0.32,
      side: THREE.DoubleSide,
      roughness: 0.62,
      envMapIntensity: 0.55,
      ...opts,
    });

  return {
    Chloe_Head: skin('face_alb.jpg', 'face_nrm.jpg', 'face_rough.jpg'),
    Chloe_Body: skin('body_alb.jpg', 'body_nrm.jpg', 'body_rough.jpg'),
    Chloe_Arms: skin('arms_alb.jpg', 'arms_nrm.jpg', 'arms_rough.jpg'),
    Chloe_Eyes: new THREE.MeshStandardMaterial({
      map: tex(A + 'eye_alb.jpg', true),
      normalMap: tex(A + 'eye_nrm.jpg'),
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.006,
      color: new THREE.Color(0.43, 0.52, 0.58),
      transparent: true,
      opacity: 1,
    }),
    Chloe_Hair: cutout('hair.png'),
    Chloe_Lashes: cutout('lashes.png', { roughness: 0.5 }),
    Chloe_Brows: cutout('brows.png', { roughness: 0.5 }),
    Chloe_Teeth: new THREE.MeshStandardMaterial({
      map: tex(A + 'teeth_alb.jpg', true),
      normalMap: tex(A + 'teeth_nrm.jpg'),
      roughness: 0.8,
      envMapIntensity: 0.075,
      color: new THREE.Color(0.72, 0.68, 0.62),
    }),
    Chloe_Duct: new THREE.MeshStandardMaterial({ map: tex(A + 'duct_alb.jpg', true), roughness: 0.35 }),
    Chloe_tear: new THREE.MeshPhysicalMaterial({
      transparent: true,
      opacity: 0.3,
      roughness: 0.05,
      color: 0xffffff,
      depthWrite: false,
    }),
    Chloe_DressMain: new THREE.MeshStandardMaterial({
      map: tex(A + 'dress_alb.jpg', true),
      normalMap: tex(A + 'dress_nrm.jpg'),
      roughness: 0.93,
      envMapIntensity: 0.085,
      color: new THREE.Color(0.76, 0.82, 0.9),
    }),
    Chloe_DressDark: new THREE.MeshStandardMaterial({
      map: tex(A + 'dress_alb.jpg', true),
      roughness: 0.9,
      envMapIntensity: 0.075,
      color: new THREE.Color(0.58, 0.66, 0.78),
    }),
    Chloe_DressTrans: new THREE.MeshStandardMaterial({
      map: tex(A + 'white_alb.jpg', true),
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      roughness: 0.92,
      envMapIntensity: 0.04,
      color: new THREE.Color(0.74, 0.82, 0.92),
    }),
    // the temple LED: the in-game mesh, plain HDR cyan so bloom picks it up
    Chloe_Circle: new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.5, 2.2, 3.2),
      toneMapped: false,
      transparent: true,
    }),
  };
}

function setupChloe(gltf) {
  const model = gltf.scene;
  const mats = chloeMaterials();

  model.traverse((obj) => {
    if (!obj.isMesh && !obj.isSkinnedMesh) return;
    obj.frustumCulled = false;
    // the FBX rip carries black vertex colors that would multiply the maps
    if (obj.geometry.getAttribute('color')) obj.geometry.deleteAttribute('color');
    const name = obj.name;
    if (name === 'Chloe_Shoes' || name === 'Chloe_CircleShadow' || name === 'Chloe_tear') {
      obj.visible = false;
      return;
    }
    if (name.startsWith('Chloe_Duct')) obj.material = mats.Chloe_Duct;
    else if (mats[name]) obj.material = mats[name];
    obj.material.vertexColors = false;
    if (name === 'Chloe_Eyes') headGroup.userData.eyeMats = [obj.material];
    if (name === 'Chloe_Circle') headGroup.userData.ledMats = [obj.material];
  });

  // normalize: full height 1.75, feet on y=0, centered on x/z
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 1.75 / size.y;
  model.scale.setScalar(s);
  model.position.x -= center.x * s;
  model.position.z -= center.z * s;
  model.position.y -= box.min.y * s;
  model.position.y -= 0.07;

  headGroup.userData.rig = buildRig(model);
  setupEyeCatchlights();
  setupEyeBlinkVeils();
  document.body.dataset.orbitsUpperL = String(headGroup.userData.rig.orbitsUpperL.length);
  document.body.dataset.orbitsUpperR = String(headGroup.userData.rig.orbitsUpperR.length);
  document.body.dataset.eyeCoversL = String(headGroup.userData.rig.eyeCoversL.length);
  document.body.dataset.eyeCoversR = String(headGroup.userData.rig.eyeCoversR.length);
  document.body.dataset.lidsUpperL = String(headGroup.userData.rig.lidsUpperL.length);
  document.body.dataset.lidsUpperR = String(headGroup.userData.rig.lidsUpperR.length);
  document.body.dataset.lidsLowerL = String(headGroup.userData.rig.lidsLowerL.length);
  document.body.dataset.lidsLowerR = String(headGroup.userData.rig.lidsLowerR.length);
  document.body.dataset.mouthRoot = String(headGroup.userData.rig.mouthRoot.length);
  document.body.dataset.lipMidUpper = String(headGroup.userData.rig.lipMidUpper.length);
  document.body.dataset.lipMidLower = String(headGroup.userData.rig.lipMidLower.length);
  document.body.dataset.mandiblesL = String(headGroup.userData.rig.mandiblesL.length);
  document.body.dataset.mandiblesR = String(headGroup.userData.rig.mandiblesR.length);
  headGroup.add(model);
  return { headY: 1.49 }; // vertical focus: face/upper chest band
}

// ---- fallback character: free facecap head ----

function setupFacecap(gltf) {
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = 1.0 / size.y;
  model.scale.setScalar(s);
  model.position.sub(center.multiplyScalar(s));
  model.position.y += 1.49;

  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.frustumCulled = false;
      if (obj.material) {
        obj.material.envMapIntensity = 0.85;
        obj.material.color.setRGB(1.0, 0.91, 0.845);
      }
    }
  });

  // android LED raycast-mounted on the temple (this head has none of its own)
  model.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.set(
    new THREE.Vector3(-0.9, 1.49 + 0.11, 0.85),
    new THREE.Vector3(0.72, -0.04, -0.75).normalize()
  );
  const hits = raycaster.intersectObject(model, true);
  const led = new THREE.Group();
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 3.2), toneMapped: false, transparent: true });
  const ledRing = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0045, 12, 36), ledMat);
  const ledCore = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), ledMat.clone());
  ledCore.material.opacity = 0.9;
  led.add(ledRing, ledCore);
  if (hits.length) {
    const hit = hits[0];
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    led.position.copy(hit.point).addScaledVector(n, 0.004);
    led.lookAt(hit.point.clone().addScaledVector(n, 1));
  }
  headGroup.add(led);
  headGroup.userData.ledMats = [ledMat, ledCore.material];

  mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(gltf.animations[0]).play();
  headGroup.add(model);
  return { headY: 1.49 };
}

gltfLoader.load(
  'assets/chloe/chloe.glb',
  (gltf) => { setupChloe(gltf); modelReady(); },
  onProgress,
  () => {
    gltfLoader.load(
      'assets/facecap.glb',
      (gltf) => { setupFacecap(gltf); modelReady(); },
      onProgress,
      (err) => {
        bootStatus.textContent = 'ОШИБКА ЗАГРУЗКИ МОДЕЛИ';
        console.error(err);
      }
    );
  }
);

// ---------------------------------------------------------------- post FX

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.34, // strength — halo bleeding over the silhouette edges
  0.74, // radius
  0.96 // threshold — only the hot strips and LED bloom
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- interaction

const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// menu: hover/arrows select, click/Enter opens
const menu = document.getElementById('menu');
const items = [...menu.querySelectorAll<HTMLButtonElement>('.item')];
const panel = document.getElementById('panel') as HTMLElement;
const bodies = panel.querySelectorAll<HTMLElement>('.panel-body');
let selected = 0;

const MENU_POSES = {
  about:    { lookX: 0.0,   lookY: 0.008, camX: 0.0,    camY: 0.002, bodyX: 0.0,    bodyY: 0.0,   mouth: 0.48, brow: 0.24, led: 1.0,  squint: 0.015, roll: -0.006 },
  projects: { lookX: -0.012,lookY: 0.006, camX: -0.008, camY: 0.001, bodyX: -0.006, bodyY: -0.002,mouth: 0.24, brow: 0.12, led: 0.94, squint: 0.005, roll: -0.01 },
  skills:   { lookX: 0.008, lookY: 0.012, camX: 0.004,  camY: 0.003, bodyX: 0.0,    bodyY: 0.004, mouth: 0.3,  brow: 0.18, led: 1.05, squint: 0.012, roll: 0.0 },
  exp:      { lookX: 0.014, lookY: 0.004, camX: 0.007,  camY: -0.002,bodyX: 0.006,  bodyY: -0.004,mouth: 0.18, brow: 0.1,  led: 0.9,  squint: 0.0,   roll: 0.008 },
  contact:  { lookX: 0.016, lookY: 0.009, camX: 0.01,   camY: 0.001, bodyX: 0.008,  bodyY: 0.0,   mouth: 0.26, brow: 0.16, led: 1.0,  squint: 0.008, roll: 0.01 },
};

const PANEL_POSES = {
  about:    { lookX: -0.01, lookY: 0.01,  camX: -0.006, camY: 0.006, bodyX: 0.014, bodyY: 0.004, mouth: 0.42, brow: 0.15, led: 0.78, squint: 0.0,   roll: -0.008 },
  projects: { lookX: -0.02, lookY: 0.007, camX: -0.012, camY: 0.002, bodyX: 0.018, bodyY: 0.0,   mouth: 0.18, brow: 0.08, led: 0.72, squint: 0.0,   roll: -0.012 },
  skills:   { lookX: -0.004,lookY: 0.015, camX: -0.004, camY: 0.006, bodyX: 0.014, bodyY: 0.008, mouth: 0.22, brow: 0.12, led: 0.82, squint: 0.01,  roll: -0.006 },
  exp:      { lookX: 0.008, lookY: 0.005, camX: 0.0,    camY: 0.001, bodyX: 0.012, bodyY: -0.002,mouth: 0.16, brow: 0.07, led: 0.7,  squint: 0.0,   roll: 0.006 },
  contact:  { lookX: 0.012, lookY: 0.012, camX: 0.004,  camY: 0.006, bodyX: 0.01,  bodyY: 0.003, mouth: 0.24, brow: 0.12, led: 0.78, squint: 0.004, roll: 0.008 },
};

const motion = {
  active: items[selected].dataset.panel,
  panelOpen: false,
  lookX: 0,
  lookY: 0,
  camX: 0,
  camY: 0,
  bodyX: 0,
  bodyY: 0,
  mouth: 0,
  brow: 0,
  led: 1,
  squint: 0,
  roll: 0,
  viewerX: 0,
  viewerY: 0,
};

const living = {
  eyeDriftX: 0,
  eyeDriftY: 0,
  eyeTargetX: 0,
  eyeTargetY: 0,
  browDrift: 0,
  mouthDrift: 0,
  browTarget: 0,
  mouthTarget: 0,
  nextSaccadeAt: 0.9,
  nextBlinkAt: 1.1,
  blinkPhase: 'open',
  blinkElapsed: 0,
  blinkAmount: 0,
  queuedBlinks: 0,
  queuedBlinkAt: -1,
  blinkDebugMode: 'animate',
  blinkSpeed: 1.08,
};

const BLINK_POSES = {
  open: 0,
  half: 0.46,
  closed: 1,
};

const BLINK_PHASE_DURATION = {
  closing: 0.09,
  closed: 0.24,
  opening: 0.2,
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function getCurrentPose() {
  return motion.panelOpen ? PANEL_POSES[motion.active] : MENU_POSES[motion.active];
}

function startBlink() {
  living.blinkPhase = 'closing';
  living.blinkElapsed = 0;
}

function queueBlink(time, forceDouble = false) {
  if (living.blinkPhase === 'open') {
    startBlink();
  } else {
    living.queuedBlinks += 1;
  }
  if (forceDouble || Math.random() < 0.04) {
    living.queuedBlinks += 1;
    living.queuedBlinkAt = time + rand(0.34, 0.48);
  }
  living.nextBlinkAt = time + rand(2.2, 4.8);
}

function setBlinkDebugMode(mode) {
  if (!['animate', 'open', 'half', 'closed'].includes(mode)) return;
  living.blinkDebugMode = mode;
  document.body.dataset.blinkMode = mode;
  if (mode !== 'animate') {
    living.blinkPhase = 'open';
    living.blinkElapsed = 0;
    living.blinkAmount = BLINK_POSES[mode];
    living.queuedBlinks = 0;
    living.queuedBlinkAt = -1;
  }
}

window.addEventListener('portrait:blink-debug', (event) => {
  const blinkEvent = event as CustomEvent;
  const detail = blinkEvent.detail || {};
  if (detail.mode) setBlinkDebugMode(detail.mode);
  if (typeof detail.speed === 'number') {
    living.blinkSpeed = THREE.MathUtils.clamp(detail.speed, 0.55, 2.4);
  }
  if (detail.action === 'blink') {
    living.blinkDebugMode = 'animate';
    queueBlink(performance.now() / 1000, !!detail.double);
  }
});

window.addEventListener('portrait:gaze-debug', (event) => {
  const gazeEvent = event as CustomEvent;
  const detail = gazeEvent.detail || {};
  if (typeof detail.x === 'number') {
    living.eyeTargetX = THREE.MathUtils.clamp(detail.x, -0.026, 0.026);
    living.eyeDriftX = living.eyeTargetX;
  }
  if (typeof detail.y === 'number') {
    living.eyeTargetY = THREE.MathUtils.clamp(detail.y, -0.014, 0.014);
    living.eyeDriftY = living.eyeTargetY;
  }
  living.nextSaccadeAt = performance.now() / 1000 + 99;
});

function updateBlinkState(time, dt) {
  document.body.dataset.blinkPhase = living.blinkPhase;
  document.body.dataset.blinkAmount = living.blinkAmount.toFixed(3);
  if (living.blinkDebugMode !== 'animate') return BLINK_POSES[living.blinkDebugMode];

  if (living.blinkPhase === 'open') {
    living.blinkAmount = THREE.MathUtils.damp(living.blinkAmount, 0, 14, dt);
    if (living.queuedBlinks > 0 && time >= living.queuedBlinkAt) {
      living.queuedBlinks -= 1;
      startBlink();
    } else if (time >= living.nextBlinkAt) {
      queueBlink(time, false);
    }
    return living.blinkAmount;
  }

  living.blinkElapsed += dt;
  if (living.blinkPhase === 'closing') {
    const duration = BLINK_PHASE_DURATION.closing / living.blinkSpeed;
    living.blinkAmount = smootherStep01(living.blinkElapsed / duration);
    if (living.blinkElapsed >= duration) {
      living.blinkPhase = 'closed';
      living.blinkElapsed = 0;
      living.blinkAmount = 1;
    }
    return living.blinkAmount;
  }

  if (living.blinkPhase === 'closed') {
    living.blinkAmount = 1;
    if (living.blinkElapsed >= BLINK_PHASE_DURATION.closed / living.blinkSpeed) {
      living.blinkPhase = 'opening';
      living.blinkElapsed = 0;
    }
    return living.blinkAmount;
  }

  const duration = BLINK_PHASE_DURATION.opening / living.blinkSpeed;
  living.blinkAmount = 1 - smootherStep01(living.blinkElapsed / duration);
  if (living.blinkElapsed >= duration) {
    living.blinkPhase = 'open';
    living.blinkElapsed = 0;
    living.blinkAmount = 0;
  }
  return living.blinkAmount;
}

function updateLivingMotion(time, dt) {
  const blink = updateBlinkState(time, dt);
  const blinkHold = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(blink, 0, 1), 0.18, 0.95);
  document.body.dataset.eyeDriftHold = blinkHold.toFixed(3);

  if (time >= living.nextSaccadeAt && blinkHold < 0.15) {
    living.eyeTargetX = rand(-0.013, 0.013);
    living.eyeTargetY = rand(-0.006, 0.007);
    living.browTarget = rand(-0.045, 0.055);
    living.mouthTarget = rand(-0.035, 0.045);
    living.nextSaccadeAt = time + rand(4.2, 7.2);
  }

  if (blinkHold < 0.2) {
    living.eyeDriftX = THREE.MathUtils.damp(living.eyeDriftX, living.eyeTargetX, 1.75, dt);
    living.eyeDriftY = THREE.MathUtils.damp(living.eyeDriftY, living.eyeTargetY, 1.75, dt);
  } else {
    living.eyeTargetX = THREE.MathUtils.damp(living.eyeTargetX, living.eyeDriftX, 5.2, dt);
    living.eyeTargetY = THREE.MathUtils.damp(living.eyeTargetY, living.eyeDriftY, 5.2, dt);
  }
  document.body.dataset.eyeDriftX = living.eyeDriftX.toFixed(4);
  document.body.dataset.eyeDriftY = living.eyeDriftY.toFixed(4);
  living.browDrift = THREE.MathUtils.damp(living.browDrift, living.browTarget, 4.2, dt);
  living.mouthDrift = THREE.MathUtils.damp(living.mouthDrift, living.mouthTarget, 3.8, dt);
  return blink;
}
function select(i) {
  selected = (i + items.length) % items.length;
  motion.active = items[selected].dataset.panel;
  items.forEach((el, n) => el.classList.toggle('selected', n === selected));
}
function openPanel(name) {
  motion.active = name;
  motion.panelOpen = true;
  menu.classList.add('hidden');
  panel.hidden = false;
  document.body.classList.add('panel-open');
  for (const b of bodies) b.hidden = b.id !== `panel-${name}`;
}
function closePanel() {
  motion.panelOpen = false;
  panel.hidden = true;
  menu.classList.remove('hidden');
  document.body.classList.remove('panel-open');
}

items.forEach((el, n) => {
  el.addEventListener('mouseenter', () => select(n));
  el.addEventListener('focus', () => select(n));
  el.addEventListener('click', () => openPanel(el.dataset.panel));
});
document.getElementById('panel-back').addEventListener('click', closePanel);
window.addEventListener('keydown', (e) => {
  if (e.altKey) {
    if (e.code === 'Digit0') setBlinkDebugMode('animate');
    else if (e.code === 'Digit1') setBlinkDebugMode('open');
    else if (e.code === 'Digit2') setBlinkDebugMode('half');
    else if (e.code === 'Digit3') setBlinkDebugMode('closed');
    else if (e.code === 'KeyB') {
      living.blinkDebugMode = 'animate';
      queueBlink(performance.now() / 1000, e.shiftKey);
    } else {
      return;
    }
    e.preventDefault();
    return;
  }
  if (!panel.hidden) {
    if (e.key === 'Escape') closePanel();
    return;
  }
  if (e.key === 'ArrowRight') select(selected + 1);
  else if (e.key === 'ArrowLeft') select(selected - 1);
  else if (e.key === 'Enter') openPanel(items[selected].dataset.panel);
});

// live clock inside the telemetry layer
const teleClock = document.getElementById('tele-clock');
function tickClock() {
  const d = new Date();
  teleClock.textContent =
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
tickClock();
setInterval(tickClock, 5000);

// ---------------------------------------------------------------- loop

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (mixer) mixer.update(dt);

  const pose = getCurrentPose();
  const interfaceBiasX = motion.panelOpen ? -0.015 : 0.0;
  const interfaceBiasY = motion.panelOpen ? 0.004 : 0.0;
  motion.viewerX = THREE.MathUtils.damp(motion.viewerX, mouse.x, 4.2, dt);
  motion.viewerY = THREE.MathUtils.damp(motion.viewerY, mouse.y, 4.2, dt);
  motion.lookX = THREE.MathUtils.damp(
    motion.lookX,
    pose.lookX + interfaceBiasX + motion.viewerX * 0.12,
    4.5,
    dt
  );
  motion.lookY = THREE.MathUtils.damp(
    motion.lookY,
    pose.lookY + interfaceBiasY - motion.viewerY * 0.08,
    4.5,
    dt
  );
  motion.camX = THREE.MathUtils.damp(motion.camX, pose.camX, 3.4, dt);
  motion.camY = THREE.MathUtils.damp(motion.camY, pose.camY, 3.4, dt);
  motion.bodyX = THREE.MathUtils.damp(motion.bodyX, pose.bodyX, 3.6, dt);
  motion.bodyY = THREE.MathUtils.damp(motion.bodyY, pose.bodyY, 3.6, dt);
  motion.mouth = THREE.MathUtils.damp(motion.mouth, pose.mouth, 4.8, dt);
  motion.brow = THREE.MathUtils.damp(motion.brow, pose.brow, 4.8, dt);
  motion.led = THREE.MathUtils.damp(motion.led, pose.led, 5.2, dt);
  motion.squint = THREE.MathUtils.damp(motion.squint, pose.squint, 4.4, dt);
  motion.roll = THREE.MathUtils.damp(motion.roll, pose.roll, 3.8, dt);

  headGroup.position.x = motion.bodyX;
  headGroup.position.y = motion.bodyY;
  headGroup.rotation.z = motion.roll * 0.52;

  const idleYaw = Math.sin(t * 0.42) * 0.025;
  const idlePitch = Math.sin(t * 0.53) * 0.018;
  const blink = updateLivingMotion(t, dt);

  const rig = headGroup.userData.rig;
  if (rig) {
    const attentiveLookX = motion.lookX + living.eyeDriftX * 1.35;
    const attentiveLookY = motion.lookY + living.eyeDriftY * 1.1;
    const expressiveMouth = motion.mouth + living.mouthDrift;
    const expressiveBrow = motion.brow + living.browDrift;
    const headPitch = motion.lookY * 0.66 + living.eyeDriftY * 0.08 + idlePitch;
    const headYaw = motion.lookX * 0.42 + living.eyeDriftX * 0.05 + idleYaw;
    const shoulderBreath = Math.sin(t * 0.8) * 0.012;
    const expressionAsym = Math.sin(t * 0.61) * 0.026 + Math.sin(t * 0.27 + 1.2) * 0.012 + living.eyeDriftX * 0.18;
    const browAsym = Math.sin(t * 0.92) * 0.0048 + expressionAsym * 0.24 + living.eyeDriftX * 0.008;
    const speechPulse = Math.sin(t * 1.35) * 0.45 + Math.sin(t * 0.58 + 1.7) * 0.22;
    const smile = THREE.MathUtils.clamp(0.34 + expressiveMouth * 0.26 + Math.sin(t * 0.72) * 0.012, 0.2, 0.56);
    const mouthOpen = THREE.MathUtils.clamp(0.15 + expressiveMouth * 0.26 + speechPulse * 0.006, 0.09, 0.4);
    const smileAsym = expressionAsym * 1.16;

    setBoneRotationDeltas(rig, rig.spineMid, headPitch * -0.08, headYaw * -0.08, motion.roll * 0.08);
    setBoneRotationDeltas(rig, rig.spineUpper, headPitch * -0.12, headYaw * -0.12, motion.roll * 0.14);
    setBoneRotationDeltas(rig, rig.clavicles, shoulderBreath, 0, 0);
    setBoneRotationDelta(rig, rig.neck, headPitch * -0.2, headYaw * -0.2, motion.roll * 0.14);
    setBoneRotationDelta(rig, rig.head, headPitch * -0.52, headYaw * -0.42, motion.roll + Math.sin(t * 0.67) * 0.008);
    setBoneRotationDelta(
      rig,
      rig.eyeL,
      -attentiveLookY * 0.55,
      attentiveLookX * -1.75,
      -living.eyeDriftX * 0.015
    );
    setBoneRotationDelta(
      rig,
      rig.eyeR,
      -attentiveLookY * 0.55,
      attentiveLookX * -1.75,
      living.eyeDriftX * 0.015
    );
    document.body.dataset.attentiveLookX = attentiveLookX.toFixed(4);
    document.body.dataset.attentiveLookY = attentiveLookY.toFixed(4);

    const jawOpen = 0.01 + mouthOpen * 0.11 + Math.sin(t * 1.45) * 0.0005;
    setBoneRotationDeltas(rig, rig.jaw, jawOpen, 0, 0);
    setBoneRotationDeltas(rig, rig.upperLip, -mouthOpen * 0.044 - Math.sin(t * 1.1) * 0.0012, 0, 0);
    applyNativeSmile(rig, smile, smileAsym);
    applyNativeMouth(rig, mouthOpen, smile, speechPulse);
    document.body.dataset.facialJawOpen = jawOpen.toFixed(3);
    document.body.dataset.facialSmileAsym = smileAsym.toFixed(3);

    const browLift = 0.004 + expressiveBrow * 0.018;
    setBoneRotationDeltas(rig, rig.browsL, -browLift - browAsym, 0, -expressiveBrow * 0.003);
    setBoneRotationDeltas(rig, rig.browsR, -browLift + browAsym, 0, expressiveBrow * 0.003);

    const blinkClose = applyNativeBlink(rig, blink, motion.squint + smile * 0.09, attentiveLookY);
    applyEyeBlinkVisibility(headGroup.userData.eyeMats, blinkClose);
    updateEyeBlinkVeils(rig, blinkClose);
    updateEyeCatchlights(rig, blinkClose, smile);
  }

  // LED pulse
  const mats = headGroup.userData.ledMats;
  if (mats) {
    const pulse = (0.72 + 0.28 * Math.sin(t * 2.8)) * motion.led;
    for (const m of mats) m.opacity = pulse;
  }

  // slight camera breathing + UI-driven framing
  camera.position.x = 0.004 + motion.camX + Math.sin(t * 0.34) * 0.006 + motion.viewerX * 0.01;
  camera.position.y = FOCUS.y + 0.008 + motion.camY + Math.sin(t * 0.46) * 0.003 - motion.viewerY * 0.006;
  camera.lookAt(FOCUS);

  composer.render();
}

animate();
