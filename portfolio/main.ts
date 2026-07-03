import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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
scene.background = new THREE.Color(0xedf8fc);

// studio wall: blurred bright panels, like the blown-out DBH backdrop
function wallTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 576;
  const ctx = c.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, 576);
  base.addColorStop(0, '#ffffff');
  base.addColorStop(0.3, '#f7fcff');
  base.addColorStop(0.62, '#e2f3fb');
  base.addColorStop(1, '#c7e4f1');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 576);

  const topGlow = ctx.createRadialGradient(508, 98, 44, 508, 98, 460);
  topGlow.addColorStop(0, 'rgba(255,255,255,0.82)');
  topGlow.addColorStop(0.42, 'rgba(255,255,255,0.34)');
  topGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, 1024, 360);

  const paneWash = ctx.createLinearGradient(0, 0, 1024, 0);
  paneWash.addColorStop(0, 'rgba(132,197,229,0.42)');
  paneWash.addColorStop(0.18, 'rgba(236,249,254,0.28)');
  paneWash.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  paneWash.addColorStop(0.82, 'rgba(223,244,253,0.3)');
  paneWash.addColorStop(1, 'rgba(128,198,231,0.44)');
  ctx.fillStyle = paneWash;
  ctx.fillRect(0, 0, 1024, 576);

  // Broad luminous panes, not a picket fence: closer to the DBH overexposed window blocks.
  ctx.filter = 'blur(18px)';
  const broadWindowPanes: Array<[number, number, string, number]> = [
    [-70, 150, '#fbfeff', 0.96],
    [118, 166, '#d5eef9', 0.62],
    [330, 194, '#ffffff', 0.82],
    [548, 204, '#e3f6fd', 0.7],
    [792, 174, '#ffffff', 0.9],
    [956, 122, '#c5e8f7', 0.78],
  ];
  for (const [x, w, color, a] of broadWindowPanes) {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x, -80, w, 736);
  }

  ctx.filter = 'blur(8px)';
  const windowPipes: Array<[number, number, number]> = [
    [66, 14, 0.94],
    [218, 10, 0.68],
    [520, 9, 0.5],
    [806, 12, 0.78],
    [958, 14, 0.96],
  ];
  for (const [x, w, a] of windowPipes) {
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, -64, w, 712);
  }

  ctx.filter = 'blur(5px)';
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#f8fdff';
  for (const x of [94, 286, 516, 744, 940]) {
    ctx.fillRect(x, 0, 3, 576);
  }
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#9ccbe5';
  for (const x of [252, 764]) {
    ctx.fillRect(x, 0, 2, 576);
  }

  ctx.filter = 'blur(15px)';
  ctx.globalAlpha = 0.98;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-80, 270, 1184, 96);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#c7e5f4';
  ctx.fillRect(-60, 218, 1144, 22);
  ctx.fillRect(-60, 392, 1144, 20);
  ctx.globalAlpha = 0.44;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-80, 462, 1184, 34);

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
scene.environmentIntensity = 0.46;
pmrem.dispose();

// ---------------------------------------------------------------- camera

const camera = new THREE.PerspectiveCamera(23.8, window.innerWidth / window.innerHeight, 0.05, 30);
const FOCUS = new THREE.Vector3(0, 1.512, 0); // close-up portrait framing, DBH main-menu style
const CAM_Z = 0.84;
camera.position.set(0.004, FOCUS.y + 0.005, CAM_Z);
camera.lookAt(FOCUS);

// ---------------------------------------------------------------- lights

// soft frontal key — the bright studio look
const key = new THREE.DirectionalLight(0xfff1e9, 1.48);
key.position.set(0.3, 2.85, 2.45);
scene.add(key);

// cool fill from the other side
const fill = new THREE.DirectionalLight(0xd8efff, 0.78);
fill.position.set(-1.55, 1.88, 1.45);
scene.add(fill);

// back/rim lights — edge glow that melts into the background
const rimL = new THREE.DirectionalLight(0xe9f7ff, 1.02);
rimL.position.set(-1.8, 2.45, -1.15);
scene.add(rimL);
const rimR = new THREE.DirectionalLight(0xf7fdff, 0.86);
rimR.position.set(1.42, 2.35, -0.96);
scene.add(rimR);

const overhead = new THREE.DirectionalLight(0xf3fbff, 0.28);
overhead.position.set(0, 3.3, 0.85);
scene.add(overhead);

const portraitFill = new THREE.PointLight(0xeaf7ff, 0.36, 1.35, 2.0);
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

function createChloeEyeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return tex('assets/chloe/eye_alb.jpg', true);

  const hash = (value) => {
    const s = Math.sin(value * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };

  const sclera = ctx.createLinearGradient(0, 0, 0, 520);
  sclera.addColorStop(0, '#c7b9b1');
  sclera.addColorStop(0.5, '#ddd8ce');
  sclera.addColorStop(1, '#b9b8aa');
  ctx.fillStyle = sclera;
  ctx.fillRect(0, 0, canvas.width, 540);

  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 90; i += 1) {
    const x = hash(i) * canvas.width;
    const y = 40 + hash(i + 11) * 430;
    const len = 38 + hash(i + 23) * 160;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 16 * (hash(i + 3) - 0.5), y + len * 0.32, x + 40 * (hash(i + 5) - 0.5), y + len * 0.7, x + 20 * (hash(i + 7) - 0.5), y + len);
    ctx.strokeStyle = hash(i + 13) > 0.42 ? '#8f332f' : '#6f5b4e';
    ctx.lineWidth = 0.7 + hash(i + 17) * 1.7;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const irisTop = 500;
  const irisHeight = canvas.height - irisTop;
  const irisBase = ctx.createLinearGradient(0, irisTop, 0, canvas.height);
  irisBase.addColorStop(0, '#b9beb1');
  irisBase.addColorStop(0.12, '#7d928d');
  irisBase.addColorStop(0.38, '#526e72');
  irisBase.addColorStop(0.68, '#27383a');
  irisBase.addColorStop(1, '#050707');
  ctx.fillStyle = irisBase;
  ctx.fillRect(0, irisTop, canvas.width, irisHeight);

  const ring = ctx.createLinearGradient(0, irisTop, 0, canvas.height);
  ring.addColorStop(0, 'rgba(8, 14, 16, 0.82)');
  ring.addColorStop(0.09, 'rgba(215, 221, 195, 0.22)');
  ring.addColorStop(0.42, 'rgba(24, 40, 43, 0)');
  ring.addColorStop(0.72, 'rgba(4, 6, 7, 0.32)');
  ring.addColorStop(1, 'rgba(0, 0, 0, 0.94)');
  ctx.fillStyle = ring;
  ctx.fillRect(0, irisTop, canvas.width, irisHeight);

  ctx.globalCompositeOperation = 'screen';
  for (let x = 0; x < canvas.width; x += 3) {
    const n = hash(x);
    const y0 = irisTop + 24 + hash(x + 19) * 70;
    const y1 = canvas.height - 78 - hash(x + 29) * 120;
    const hue = n > 0.78 ? '183, 196, 170' : n > 0.5 ? '118, 153, 148' : '77, 106, 112';
    ctx.globalAlpha = 0.16 + hash(x + 5) * 0.42;
    ctx.strokeStyle = `rgb(${hue})`;
    ctx.lineWidth = 0.45 + hash(x + 9) * 1.7;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.bezierCurveTo(x + 8 * (hash(x + 2) - 0.5), y0 + 130, x + 18 * (hash(x + 4) - 0.5), y1 - 90, x + 4 * (hash(x + 6) - 0.5), y1);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'multiply';
  for (let x = 0; x < canvas.width; x += 5) {
    ctx.globalAlpha = 0.16 + hash(x + 41) * 0.34;
    ctx.strokeStyle = '#071012';
    ctx.lineWidth = 0.5 + hash(x + 43) * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, irisTop + hash(x + 47) * 64);
    ctx.lineTo(x + 10 * (hash(x + 53) - 0.5), canvas.height);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const pupil = ctx.createLinearGradient(0, 790, 0, canvas.height);
  pupil.addColorStop(0, 'rgba(4, 8, 9, 0)');
  pupil.addColorStop(0.52, 'rgba(2, 4, 5, 0.55)');
  pupil.addColorStop(1, 'rgba(0, 0, 0, 1)');
  ctx.fillStyle = pupil;
  ctx.fillRect(0, 790, canvas.width, 234);

  function paintAtlasEnhancement(strength = 1) {
    ctx.globalCompositeOperation = 'screen';
    for (let x = 0; x < canvas.width; x += 4) {
      const n = hash(x + 101);
      const y0 = irisTop + 12 + hash(x + 119) * 76;
      const y1 = canvas.height - 68 - hash(x + 129) * 118;
      const hue = n > 0.78 ? '173, 193, 198' : n > 0.5 ? '88, 129, 141' : '48, 78, 92';
      ctx.globalAlpha = (0.12 + hash(x + 105) * 0.28) * strength;
      ctx.strokeStyle = `rgb(${hue})`;
      ctx.lineWidth = 0.5 + hash(x + 109) * 1.35;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.bezierCurveTo(x + 6 * (hash(x + 112) - 0.5), y0 + 115, x + 15 * (hash(x + 114) - 0.5), y1 - 80, x + 4 * (hash(x + 116) - 0.5), y1);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.72 * strength;
    const pupilDepth = ctx.createLinearGradient(0, 585, 0, canvas.height);
    pupilDepth.addColorStop(0, 'rgba(0, 0, 0, 0)');
    pupilDepth.addColorStop(0.42, 'rgba(3, 6, 7, 0.42)');
    pupilDepth.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
    ctx.fillStyle = pupilDepth;
    ctx.fillRect(0, 585, canvas.width, 439);

    ctx.globalAlpha = 0.38 * strength;
    ctx.fillStyle = '#10191b';
    ctx.fillRect(0, irisTop + 8, canvas.width, 30);

    ctx.globalAlpha = 0.88 * strength;
    const pupilCore = ctx.createLinearGradient(0, irisTop + 78, 0, irisTop + 245);
    pupilCore.addColorStop(0, 'rgba(0, 0, 0, 0)');
    pupilCore.addColorStop(0.28, 'rgba(0, 0, 0, 0.72)');
    pupilCore.addColorStop(0.54, 'rgba(0, 0, 0, 0.98)');
    pupilCore.addColorStop(0.82, 'rgba(0, 0, 0, 0.18)');
    pupilCore.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pupilCore;
    ctx.fillRect(0, irisTop + 78, canvas.width, 245);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.58 * strength;
    const directPupil = ctx.createLinearGradient(0, 612, 0, 714);
    directPupil.addColorStop(0, 'rgba(0, 0, 0, 0)');
    directPupil.addColorStop(0.34, 'rgba(2, 4, 5, 0.88)');
    directPupil.addColorStop(0.62, 'rgba(0, 0, 0, 0.94)');
    directPupil.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = directPupil;
    ctx.fillRect(0, 612, canvas.width, 102);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  paintAtlasEnhancement(0.35);

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAniso;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  const source = new Image();
  source.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'contrast(1.56) saturate(1.08) brightness(0.94)';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    const eyeUvDebug = new URLSearchParams(window.location.search).get('eyeuv');
    if (eyeUvDebug) {
      const debugColors = ['#ff0033', '#ff7a00', '#ffe600', '#7dff00', '#00ff66', '#00ffd5', '#008cff', '#3d00ff', '#a100ff', '#ff00c8', '#ffffff', '#000000', '#8a5c32', '#69a0a8', '#2c4f6f', '#c8d0d5'];
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (eyeUvDebug === 'v') {
        const stripeHeight = canvas.height / debugColors.length;
        for (let i = 0; i < debugColors.length; i += 1) {
          ctx.fillStyle = debugColors[i];
          ctx.fillRect(0, i * stripeHeight, canvas.width, stripeHeight);
        }
      } else {
        const stripeWidth = canvas.width / debugColors.length;
        for (let i = 0; i < debugColors.length; i += 1) {
          ctx.fillStyle = debugColors[i];
          ctx.fillRect(i * stripeWidth, 0, stripeWidth, canvas.height);
        }
      }
      texture.needsUpdate = true;
      document.body.dataset.eyeTextureReady = 'uv-debug';
      return;
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#6f8a93';
    ctx.fillRect(0, irisTop, canvas.width, canvas.height - irisTop);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    paintAtlasEnhancement(0.9);
    texture.needsUpdate = true;
    document.body.dataset.eyeTextureReady = 'enhanced';
  };
  source.src = 'assets/chloe/eye_alb.jpg';
  texture.userData.sourceImage = source;

  return texture;
}

function createChloeFaceTexture() {
  const texture = tex('assets/chloe/face_alb.jpg', true);
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return texture;

  function paintSoftEllipse(cx, cy, rx, ry, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const soft = ctx.createRadialGradient(0, 0, 0.08, 0, 0, 1);
    soft.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
    soft.addColorStop(0.64, color.replace(')', `, ${alpha * 0.62})`).replace('rgb', 'rgba'));
    soft.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));
    ctx.fillStyle = soft;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const source = new Image();
  source.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'saturate(0.96) contrast(1.015) brightness(1.01)';
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';

    ctx.globalCompositeOperation = 'source-over';
    paintSoftEllipse(1024, 1162, 365, 96, 'rgb(188, 142, 126)', 0.2);
    paintSoftEllipse(1024, 1252, 390, 108, 'rgb(194, 148, 134)', 0.17);
    paintSoftEllipse(1024, 1214, 285, 42, 'rgb(126, 72, 70)', 0.08);

    texture.image = canvas;
    texture.needsUpdate = true;
    document.body.dataset.faceTextureReady = 'calmed-lips';
  };
  source.src = 'assets/chloe/face_alb.jpg';
  texture.userData.sourceImage = source;
  return texture;
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

const BLINK_NATIVE = {
  restClose: 0.18,
  maxClose: 0.72,
  rigCloseScale: 0.42,
  closeScale: 1.36,
  closeBias: -0.08,
  upperDrop: 0.000126,
  coverDrop: 0.000104,
  lowerRise: -0.00004,
  orbitDrop: 0.000028,
  upperFold: -0.052,
  coverFold: -0.038,
  lowerFold: 0.021,
  closedEyeOpacity: 1,
  closedLashOpacity: 1,
  closedDuctOpacity: 1,
};

const BLINK_RIG_OPEN = {
  upper: 1.15,
  cover: 0.48,
  lower: 0.58,
};

const blinkRigDebug = {
  scale: BLINK_NATIVE.rigCloseScale,
  upper: 0.2,
  cover: 2,
  lower: 2,
  fold: 0.24,
  twist: 0,
};

function smootherStep01(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function getNativeBlinkClose(blink) {
  const weightedBlink = THREE.MathUtils.clamp(blink * BLINK_NATIVE.closeScale + BLINK_NATIVE.closeBias, 0, 1);
  const animatedClose = THREE.MathUtils.smoothstep(weightedBlink, 0, 1);
  return THREE.MathUtils.clamp(
    BLINK_NATIVE.restClose + animatedClose * (BLINK_NATIVE.maxClose - BLINK_NATIVE.restClose),
    BLINK_NATIVE.restClose,
    BLINK_NATIVE.maxClose
  );
}

function applyNativeBlink(rig, blink, squint, lookY) {
  const close = getNativeBlinkClose(blink);
  const rigClose = close * blinkRigDebug.scale;
  const blinkPose = smootherStep01((close - BLINK_NATIVE.restClose) / (BLINK_NATIVE.maxClose - BLINK_NATIVE.restClose));
  const rigUpper = THREE.MathUtils.lerp(BLINK_RIG_OPEN.upper, blinkRigDebug.upper, blinkPose);
  const rigCover = THREE.MathUtils.lerp(BLINK_RIG_OPEN.cover, blinkRigDebug.cover, blinkPose);
  const rigLower = THREE.MathUtils.lerp(BLINK_RIG_OPEN.lower, blinkRigDebug.lower, blinkPose);
  const rigFold = blinkRigDebug.fold * blinkPose;
  const gazeSquint = THREE.MathUtils.clamp(squint + Math.max(0, lookY) * 0.08, 0, 0.08);
  const upperDrop = BLINK_NATIVE.upperDrop * rigClose * rigUpper + 0.000018 * gazeSquint;
  const coverDrop = BLINK_NATIVE.coverDrop * rigClose * rigCover + 0.000014 * gazeSquint;
  const lowerRise = BLINK_NATIVE.lowerRise * rigClose * rigLower - 0.000009 * gazeSquint;
  const orbitDrop = BLINK_NATIVE.orbitDrop * rigClose + 0.000006 * gazeSquint;
  const upperFold = BLINK_NATIVE.upperFold * rigClose * rigFold - 0.008 * gazeSquint;
  const coverFold = BLINK_NATIVE.coverFold * rigClose * rigFold - 0.006 * gazeSquint;
  const lowerFold = BLINK_NATIVE.lowerFold * rigClose * rigFold + 0.006 * gazeSquint;

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
  const twist = rigClose * blinkRigDebug.twist * blinkPose;
  setBoneRotationDeltas(rig, rig.eyeCoversL, coverFold, 0, twist * 0.012);
  setBoneRotationDeltas(rig, rig.eyeCoversR, coverFold, 0, -twist * 0.012);
  setBoneRotationDeltas(rig, rig.lidsUpperL, upperFold, 0, twist * 0.018);
  setBoneRotationDeltas(rig, rig.lidsUpperR, upperFold, 0, -twist * 0.018);
  setBoneRotationDeltas(rig, rig.lidsLowerL, lowerFold, 0, -twist * 0.008);
  setBoneRotationDeltas(rig, rig.lidsLowerR, lowerFold, 0, twist * 0.008);

  document.body.dataset.blinkNativeClose = close.toFixed(3);
  document.body.dataset.blinkRigClose = rigClose.toFixed(3);
  document.body.dataset.blinkRigBlend = blinkPose.toFixed(3);
  document.body.dataset.blinkRigOpen = `${BLINK_RIG_OPEN.upper.toFixed(2)}/${BLINK_RIG_OPEN.cover.toFixed(2)}/${BLINK_RIG_OPEN.lower.toFixed(2)}`;
  document.body.dataset.blinkRigTarget = `${blinkRigDebug.scale.toFixed(2)}/${blinkRigDebug.upper.toFixed(2)}/${blinkRigDebug.cover.toFixed(2)}/${blinkRigDebug.lower.toFixed(2)}/${blinkRigDebug.fold.toFixed(2)}/${blinkRigDebug.twist.toFixed(2)}`;
  document.body.dataset.blinkRigTune = `${blinkRigDebug.scale.toFixed(2)}/${rigUpper.toFixed(2)}/${rigCover.toFixed(2)}/${rigLower.toFixed(2)}/${rigFold.toFixed(2)}/${twist.toFixed(2)}`;
  return close;
}

function applyEyeBlinkVisibility(eyeMats, close) {
  if (!eyeMats) return;
  const blinkMix = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(close, 0, 1), 0.14, BLINK_NATIVE.maxClose);
  for (const mat of eyeMats) {
    if (mat.userData.openBlinkOpacity == null) mat.userData.openBlinkOpacity = mat.opacity ?? 1;
    if (!mat.userData.openBlinkColor) mat.userData.openBlinkColor = mat.color.clone();
    if (mat.userData.openBlinkEnv == null) mat.userData.openBlinkEnv = mat.envMapIntensity ?? 0;
    if (mat.userData.openBlinkDepthWrite == null) mat.userData.openBlinkDepthWrite = mat.depthWrite;
    mat.opacity = THREE.MathUtils.lerp(mat.userData.openBlinkOpacity, BLINK_NATIVE.closedEyeOpacity, blinkMix);
    mat.color.copy(mat.userData.openBlinkColor);
    mat.envMapIntensity = mat.userData.openBlinkEnv;
    mat.depthWrite = mat.userData.openBlinkDepthWrite;
  }
  if (eyeMats[0]) eyeMats[0].needsUpdate = true;
  document.body.dataset.eyeOpacity = eyeMats[0]?.opacity?.toFixed?.(3) ?? '';
}

function applyLashBlinkVisibility(lashMats, close) {
  if (!lashMats) return;
  const blinkMix = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(close, 0, 1), 0.16, BLINK_NATIVE.maxClose);
  for (const mat of lashMats) {
    if (mat.userData.openBlinkOpacity == null) mat.userData.openBlinkOpacity = mat.opacity ?? 1;
    if (mat.userData.openBlinkDepthWrite == null) mat.userData.openBlinkDepthWrite = mat.depthWrite;
    mat.opacity = THREE.MathUtils.lerp(mat.userData.openBlinkOpacity, BLINK_NATIVE.closedLashOpacity, blinkMix);
    mat.depthWrite = mat.userData.openBlinkDepthWrite;
  }
  if (lashMats[0]) lashMats[0].needsUpdate = true;
  document.body.dataset.lashOpacity = lashMats[0]?.opacity?.toFixed?.(3) ?? '';
}

function applyDuctBlinkVisibility(ductMats, close) {
  if (!ductMats) return;
  const blinkMix = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(close, 0, 1), 0.16, BLINK_NATIVE.maxClose);
  for (const mat of ductMats) {
    if (mat.userData.openBlinkOpacity == null) mat.userData.openBlinkOpacity = mat.opacity ?? 1;
    if (mat.userData.openBlinkEnv == null) mat.userData.openBlinkEnv = mat.envMapIntensity ?? 0;
    if (mat.userData.openBlinkDepthWrite == null) mat.userData.openBlinkDepthWrite = mat.depthWrite;
    mat.transparent = true;
    mat.opacity = THREE.MathUtils.lerp(mat.userData.openBlinkOpacity, BLINK_NATIVE.closedDuctOpacity, blinkMix);
    mat.envMapIntensity = mat.userData.openBlinkEnv;
    mat.depthWrite = mat.userData.openBlinkDepthWrite;
  }
  if (ductMats[0]) ductMats[0].needsUpdate = true;
  document.body.dataset.ductOpacity = ductMats[0]?.opacity?.toFixed?.(3) ?? '';
}

function applyNativeSmile(rig, smile, asymmetry = 0) {
  const liftL = THREE.MathUtils.clamp(smile + asymmetry, 0, 1);
  const liftR = THREE.MathUtils.clamp(smile - asymmetry, 0, 1);
  const cornerUpL = -0.000026 * liftL;
  const cornerUpR = -0.000026 * liftR;
  const cornerOutL = 0.000009 * liftL;
  const cornerOutR = -0.000009 * liftR;
  const cheekLiftL = -0.000012 * liftL;
  const cheekLiftR = -0.000012 * liftR;

  setBonePositionDeltas(rig, rig.mouthCornersL, cornerUpL, 0.000006 * liftL, cornerOutL);
  setBonePositionDeltas(rig, rig.mouthCornersR, cornerUpR, 0.000006 * liftR, cornerOutR);
  setBonePositionDeltas(rig, rig.lipEdgesL, cornerUpL * 0.45, 0, cornerOutL * 0.36);
  setBonePositionDeltas(rig, rig.lipEdgesR, cornerUpR * 0.45, 0, cornerOutR * 0.36);
  setBonePositionDeltas(rig, rig.cheeksL, cheekLiftL, 0.000005 * liftL, 0.000006 * liftL);
  setBonePositionDeltas(rig, rig.cheeksR, cheekLiftR, 0.000005 * liftR, -0.000006 * liftR);
}

// ---- primary character: Chloe (bundled with the portfolio) ----
// If these assets are removed, the free facecap head still loads as fallback.

function chloeMaterials() {
  const A = 'assets/chloe/';
  const skin = (alb, nrm, rough, mapOverride = null) =>
    new THREE.MeshPhysicalMaterial({
      map: mapOverride || tex(A + alb, true),
      normalMap: tex(A + nrm),
      roughnessMap: tex(A + rough),
      roughness: 0.84,
      specularIntensity: 0.15,
      clearcoat: 0.032,
      clearcoatRoughness: 0.76,
      envMapIntensity: 0.27,
      color: new THREE.Color(1.045, 0.995, 0.965),
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
    Chloe_Head: skin('face_alb.jpg', 'face_nrm.jpg', 'face_rough.jpg', createChloeFaceTexture()),
    Chloe_Body: skin('body_alb.jpg', 'body_nrm.jpg', 'body_rough.jpg'),
    Chloe_Arms: skin('arms_alb.jpg', 'arms_nrm.jpg', 'arms_rough.jpg'),
	    Chloe_Eyes: new THREE.MeshStandardMaterial({
	      map: createChloeEyeTexture(),
	      normalMap: tex(A + 'eye_nrm.jpg'),
	      normalScale: new THREE.Vector2(0.12, 0.12),
	      roughness: 0.82,
	      metalness: 0,
	      envMapIntensity: 0.008,
      color: new THREE.Color(1, 1, 1),
      transparent: true,
      opacity: 1,
    }),
	    Chloe_Hair: cutout('hair.png', {
	      alphaTest: 0.28,
	      roughness: 0.84,
	      envMapIntensity: 0.18,
	      color: new THREE.Color(0.9, 0.82, 0.68),
	    }),
    Chloe_Lashes: cutout('lashes.png', {
      alphaTest: 0.42,
      roughness: 0.72,
      envMapIntensity: 0.045,
      color: new THREE.Color(0.28, 0.24, 0.22),
      depthWrite: false,
    }),
    Chloe_Brows: cutout('brows.png', { roughness: 0.58, envMapIntensity: 0.28, color: new THREE.Color(0.7, 0.57, 0.48) }),
    Chloe_Teeth: new THREE.MeshStandardMaterial({
      map: tex(A + 'teeth_alb.jpg', true),
      normalMap: tex(A + 'teeth_nrm.jpg'),
      roughness: 0.8,
      envMapIntensity: 0.075,
      color: new THREE.Color(0.72, 0.68, 0.62),
    }),
    Chloe_Duct: new THREE.MeshStandardMaterial({
      map: tex(A + 'duct_alb.jpg', true),
      transparent: true,
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.025,
      color: new THREE.Color(0.7, 0.56, 0.52),
    }),
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
    if (name === 'Chloe_Lashes') headGroup.userData.lashMats = [obj.material];
    if (name.startsWith('Chloe_Duct')) headGroup.userData.ductMats = [obj.material];
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

const SoftFXAAShader = {
  name: 'ChloeSoftFXAA',
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1 / window.innerWidth, 1 / window.innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;

    float luma(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * resolution).rgb;
      vec3 rgbNE = texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * resolution).rgb;
      vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * resolution).rgb;
      vec3 rgbSE = texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * resolution).rgb;
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 rgbM = texel.rgb;

      float lumaNW = luma(rgbNW);
      float lumaNE = luma(rgbNE);
      float lumaSW = luma(rgbSW);
      float lumaSE = luma(rgbSE);
      float lumaM = luma(rgbM);
      float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
      float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

      vec2 dir = vec2(
        -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
        ((lumaNW + lumaSW) - (lumaNE + lumaSE))
      );

      float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * 0.03125, 0.0078125);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = min(vec2(8.0), max(vec2(-8.0), dir * rcpDirMin)) * resolution;

      vec3 rgbA = 0.5 * (
        texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
        texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
      );
      vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture2D(tDiffuse, vUv + dir * -0.5).rgb +
        texture2D(tDiffuse, vUv + dir * 0.5).rgb
      );
      float lumaB = luma(rgbB);
      vec3 smoothed = (lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB;

      gl_FragColor = vec4(mix(rgbM, smoothed, 0.78), texel.a);
    }
  `,
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.34, // strength — halo bleeding over the silhouette edges
  0.74, // radius
  0.96 // threshold — only the hot strips and LED bloom
);
composer.addPass(bloom);
const fxaaPass = new ShaderPass(SoftFXAAShader);
composer.addPass(fxaaPass);
composer.addPass(new OutputPass());

function syncFxaaResolution() {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  fxaaPass.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
  document.body.dataset.fxaaResolution = `${Math.round(size.x)}x${Math.round(size.y)}`;
}
syncFxaaResolution();

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
  syncFxaaResolution();
});

// menu: hover/arrows select, click/Enter opens
const menu = document.getElementById('menu');
const items = [...menu.querySelectorAll<HTMLButtonElement>('.item')];
const panel = document.getElementById('panel') as HTMLElement;
const bodies = panel.querySelectorAll<HTMLElement>('.panel-body');
let selected = 0;

const MENU_POSES = {
  about:    { lookX: 0.0,   lookY: 0.008, camX: 0.0,    camY: 0.002, bodyX: 0.0,    bodyY: 0.0,   mouth: 0.34, brow: 0.24, led: 1.0,  squint: 0.015, roll: -0.006 },
  projects: { lookX: -0.012,lookY: 0.006, camX: -0.008, camY: 0.001, bodyX: -0.006, bodyY: -0.002,mouth: 0.18, brow: 0.12, led: 0.94, squint: 0.005, roll: -0.01 },
  skills:   { lookX: 0.008, lookY: 0.012, camX: 0.004,  camY: 0.003, bodyX: 0.0,    bodyY: 0.004, mouth: 0.22, brow: 0.18, led: 1.05, squint: 0.012, roll: 0.0 },
  exp:      { lookX: 0.014, lookY: 0.004, camX: 0.007,  camY: -0.002,bodyX: 0.006,  bodyY: -0.004,mouth: 0.13, brow: 0.1,  led: 0.9,  squint: 0.0,   roll: 0.008 },
  contact:  { lookX: 0.016, lookY: 0.009, camX: 0.01,   camY: 0.001, bodyX: 0.008,  bodyY: 0.0,   mouth: 0.19, brow: 0.16, led: 1.0,  squint: 0.008, roll: 0.01 },
};

const PANEL_POSES = {
  about:    { lookX: -0.01, lookY: 0.01,  camX: -0.006, camY: 0.006, bodyX: 0.014, bodyY: 0.004, mouth: 0.3,  brow: 0.15, led: 0.78, squint: 0.0,   roll: -0.008 },
  projects: { lookX: -0.02, lookY: 0.007, camX: -0.012, camY: 0.002, bodyX: 0.018, bodyY: 0.0,   mouth: 0.14, brow: 0.08, led: 0.72, squint: 0.0,   roll: -0.012 },
  skills:   { lookX: -0.004,lookY: 0.015, camX: -0.004, camY: 0.006, bodyX: 0.014, bodyY: 0.008, mouth: 0.17, brow: 0.12, led: 0.82, squint: 0.01,  roll: -0.006 },
  exp:      { lookX: 0.008, lookY: 0.005, camX: 0.0,    camY: 0.001, bodyX: 0.012, bodyY: -0.002,mouth: 0.12, brow: 0.07, led: 0.7,  squint: 0.0,   roll: 0.006 },
  contact:  { lookX: 0.012, lookY: 0.012, camX: 0.004,  camY: 0.006, bodyX: 0.01,  bodyY: 0.003, mouth: 0.18, brow: 0.12, led: 0.78, squint: 0.004, roll: 0.008 },
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
  half: 0.56,
  closed: 1,
};

const BLINK_PHASE_DURATION = {
  closing: 0.075,
  closed: 0.055,
  opening: 0.11,
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
  if (forceDouble || Math.random() < 0.025) {
    living.queuedBlinks += 1;
    living.queuedBlinkAt = time + rand(0.28, 0.38);
  }
  living.nextBlinkAt = time + rand(3.1, 6.7);
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

function setBlinkSpeed(speed) {
  living.blinkSpeed = THREE.MathUtils.clamp(speed, 0.35, 3.2);
  document.body.dataset.blinkSpeed = living.blinkSpeed.toFixed(2);
}

function setBlinkRigDebug(detail) {
  const ranges = {
    scale: [0.35, 1.2],
    upper: [0.2, 2.2],
    cover: [0.2, 2.2],
    lower: [0.2, 2.6],
    fold: [0, 1.2],
    twist: [0, 1],
  };
  for (const key of Object.keys(ranges)) {
    if (typeof detail[key] !== 'number') continue;
    const [min, max] = ranges[key];
    blinkRigDebug[key] = THREE.MathUtils.clamp(detail[key], min, max);
  }
}

function triggerDebugBlink(double = false) {
  living.blinkDebugMode = 'animate';
  document.body.dataset.blinkMode = 'animate';
  queueBlink(performance.now() / 1000, double);
}

function setGazeDebugTarget(detail) {
  if (typeof detail.x === 'number') {
    living.eyeTargetX = THREE.MathUtils.clamp(detail.x, -0.026, 0.026);
    if (detail.immediate === true) living.eyeDriftX = living.eyeTargetX;
  }
  if (typeof detail.y === 'number') {
    living.eyeTargetY = THREE.MathUtils.clamp(detail.y, -0.014, 0.014);
    if (detail.immediate === true) living.eyeDriftY = living.eyeTargetY;
  }
  living.nextSaccadeAt = performance.now() / 1000 + 99;
}

window.addEventListener('portrait:blink-debug', (event) => {
  const blinkEvent = event as CustomEvent;
  const detail = blinkEvent.detail || {};
  if (detail.mode) setBlinkDebugMode(detail.mode);
  if (typeof detail.speed === 'number') setBlinkSpeed(detail.speed);
  if (detail.action === 'blink') {
    triggerDebugBlink(!!detail.double);
  }
});

window.addEventListener('portrait:blink-rig-debug', (event) => {
  const rigEvent = event as CustomEvent;
  setBlinkRigDebug(rigEvent.detail || {});
});

window.addEventListener('portrait:gaze-debug', (event) => {
  const gazeEvent = event as CustomEvent;
  setGazeDebugTarget(gazeEvent.detail || {});
});

function exposeBlinkState(amount = living.blinkAmount) {
  document.body.dataset.blinkPhase = living.blinkPhase;
  document.body.dataset.blinkAmount = amount.toFixed(3);
  document.body.dataset.blinkSpeed = living.blinkSpeed.toFixed(2);
  return amount;
}

function updateBlinkState(time, dt) {
  if (living.blinkDebugMode !== 'animate') {
    living.blinkAmount = BLINK_POSES[living.blinkDebugMode];
    return exposeBlinkState(living.blinkAmount);
  }

  if (living.blinkPhase === 'open') {
    living.blinkAmount = THREE.MathUtils.damp(living.blinkAmount, 0, 14, dt);
    if (living.queuedBlinks > 0 && time >= living.queuedBlinkAt) {
      living.queuedBlinks -= 1;
      startBlink();
    } else if (time >= living.nextBlinkAt) {
      queueBlink(time, false);
    }
    return exposeBlinkState(living.blinkAmount);
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
    return exposeBlinkState(living.blinkAmount);
  }

  if (living.blinkPhase === 'closed') {
    living.blinkAmount = 1;
    if (living.blinkElapsed >= BLINK_PHASE_DURATION.closed / living.blinkSpeed) {
      living.blinkPhase = 'opening';
      living.blinkElapsed = 0;
    }
    return exposeBlinkState(living.blinkAmount);
  }

  const duration = BLINK_PHASE_DURATION.opening / living.blinkSpeed;
  living.blinkAmount = 1 - smootherStep01(living.blinkElapsed / duration);
  if (living.blinkElapsed >= duration) {
    living.blinkPhase = 'open';
    living.blinkElapsed = 0;
    living.blinkAmount = 0;
  }
  return exposeBlinkState(living.blinkAmount);
}

function updateLivingMotion(time, dt) {
  const blink = updateBlinkState(time, dt);
  const blinkHold = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(blink, 0, 1), 0.18, 0.95);
  document.body.dataset.eyeDriftHold = blinkHold.toFixed(3);

  if (time >= living.nextSaccadeAt && blinkHold < 0.15) {
    living.eyeTargetX = rand(-0.011, 0.011);
    living.eyeTargetY = rand(-0.005, 0.006);
    living.browTarget = rand(-0.045, 0.055);
    living.mouthTarget = rand(-0.022, 0.026);
    living.nextSaccadeAt = time + rand(6.4, 10.8);
  }

  if (blinkHold < 0.2) {
    living.eyeDriftX = THREE.MathUtils.damp(living.eyeDriftX, living.eyeTargetX, 0.74, dt);
    living.eyeDriftY = THREE.MathUtils.damp(living.eyeDriftY, living.eyeTargetY, 0.74, dt);
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

const debugPanel = document.getElementById('debug-panel') as HTMLElement | null;
const debugToggle = document.getElementById('debug-toggle') as HTMLButtonElement | null;
const debugReadout = document.getElementById('debug-readout') as HTMLPreElement | null;
const debugSpeed = document.getElementById('debug-blink-speed') as HTMLInputElement | null;
const debugSpeedValue = document.getElementById('debug-speed-value') as HTMLOutputElement | null;
const debugRigInputs = [...document.querySelectorAll<HTMLInputElement>('[data-rig-param]')];

function syncDebugControls() {
  if (!debugPanel) return;
  debugPanel.querySelectorAll<HTMLButtonElement>('[data-blink-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.blinkMode === living.blinkDebugMode);
  });
  if (debugSpeed && debugSpeed !== document.activeElement) debugSpeed.value = living.blinkSpeed.toFixed(2);
  if (debugSpeedValue) debugSpeedValue.value = `${living.blinkSpeed.toFixed(2)}x`;
  for (const input of debugRigInputs) {
    const param = input.dataset.rigParam;
    if (!param) continue;
    const value = blinkRigDebug[param];
    if (input !== document.activeElement) input.value = value.toFixed(2);
    const output = document.getElementById(`${input.id}-value`) as HTMLOutputElement | null;
    if (output) output.value = value.toFixed(2);
  }
  if (!debugReadout) return;
  debugReadout.textContent = [
    `mode ${living.blinkDebugMode} / ${living.blinkPhase}`,
    `amount ${living.blinkAmount.toFixed(3)}  close ${document.body.dataset.blinkNativeClose ?? '--'}  rig ${document.body.dataset.blinkRigClose ?? '--'}`,
    `eye ${document.body.dataset.eyeOpacity ?? '--'}  lash ${document.body.dataset.lashOpacity ?? '--'}  duct ${document.body.dataset.ductOpacity ?? '--'}`,
    `blend ${document.body.dataset.blinkRigBlend ?? '--'}  bones now ${document.body.dataset.blinkRigTune ?? '--'}`,
    `open ${document.body.dataset.blinkRigOpen ?? '--'}  blink ${document.body.dataset.blinkRigTarget ?? '--'}`,
    `gaze x ${document.body.dataset.attentiveLookX ?? '--'}  y ${document.body.dataset.attentiveLookY ?? '--'}`,
    `speed ${living.blinkSpeed.toFixed(2)}x`,
  ].join('\n');
}

function setupDebugPanel() {
  if (!debugPanel) return;
  document.body.dataset.blinkMode = living.blinkDebugMode;
  document.body.dataset.blinkSpeed = living.blinkSpeed.toFixed(2);

  debugPanel.querySelectorAll<HTMLButtonElement>('[data-blink-mode]').forEach((button) => {
    button.addEventListener('click', () => setBlinkDebugMode(button.dataset.blinkMode));
  });

  debugPanel.querySelector<HTMLButtonElement>('[data-blink-action="blink"]')?.addEventListener('click', () => {
    triggerDebugBlink(false);
  });
  debugPanel.querySelector<HTMLButtonElement>('[data-blink-action="double"]')?.addEventListener('click', () => {
    triggerDebugBlink(true);
  });

  debugPanel.querySelectorAll<HTMLButtonElement>('[data-gaze-x][data-gaze-y]').forEach((button) => {
    button.addEventListener('click', () => {
      setGazeDebugTarget({
        x: Number(button.dataset.gazeX),
        y: Number(button.dataset.gazeY),
        immediate: true,
      });
    });
  });

  debugSpeed?.addEventListener('input', () => setBlinkSpeed(Number(debugSpeed.value)));
  for (const input of debugRigInputs) {
    input.addEventListener('input', () => {
      const param = input.dataset.rigParam;
      if (!param) return;
      setBlinkRigDebug({ [param]: Number(input.value) });
    });
  }
  debugToggle?.addEventListener('click', () => {
    debugPanel.classList.toggle('collapsed');
    const collapsed = debugPanel.classList.contains('collapsed');
    debugToggle.textContent = collapsed ? 'OPEN' : 'MIN';
    debugToggle.setAttribute('aria-label', collapsed ? 'Expand debug controls' : 'Collapse debug controls');
  });

  syncDebugControls();
}

setupDebugPanel();

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
  if (debugPanel?.contains(e.target as Node) && !e.altKey) return;
  if (e.altKey) {
    if (e.code === 'Digit0') setBlinkDebugMode('animate');
    else if (e.code === 'Digit1') setBlinkDebugMode('open');
    else if (e.code === 'Digit2') setBlinkDebugMode('half');
    else if (e.code === 'Digit3') setBlinkDebugMode('closed');
    else if (e.code === 'KeyB') {
      triggerDebugBlink(e.shiftKey);
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
    const smile = THREE.MathUtils.clamp(0.14 + expressiveMouth * 0.38 + Math.sin(t * 0.72) * 0.012, 0, 0.48);
    const smileAsym = expressionAsym * 0.46;

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

    const jawOpen = 0.007 + expressiveMouth * 0.03 + Math.sin(t * 1.45) * 0.001;
    setBoneRotationDeltas(rig, rig.jaw, jawOpen, 0, 0);
    setBoneRotationDeltas(rig, rig.upperLip, -expressiveMouth * 0.012 - Math.sin(t * 1.1) * 0.0007, 0, 0);
    applyNativeSmile(rig, smile, smileAsym);
    document.body.dataset.facialJawOpen = jawOpen.toFixed(3);
    document.body.dataset.facialSmileAsym = smileAsym.toFixed(3);

    const browLift = 0.004 + expressiveBrow * 0.018;
    setBoneRotationDeltas(rig, rig.browsL, -browLift - browAsym, 0, -expressiveBrow * 0.003);
    setBoneRotationDeltas(rig, rig.browsR, -browLift + browAsym, 0, expressiveBrow * 0.003);

    const blinkClose = applyNativeBlink(rig, blink, motion.squint + smile * 0.09, attentiveLookY);
    applyEyeBlinkVisibility(headGroup.userData.eyeMats, blinkClose);
    applyLashBlinkVisibility(headGroup.userData.lashMats, blinkClose);
    applyDuctBlinkVisibility(headGroup.userData.ductMats, blinkClose);
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
  syncDebugControls();
}

animate();
