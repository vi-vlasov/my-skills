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
renderer.toneMappingExposure = 1.05;

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xecf6fb);

// studio wall: blurred bright panels, like the blown-out DBH backdrop
function wallTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 576;
  const ctx = c.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, 576);
  base.addColorStop(0, '#fafdff');
  base.addColorStop(0.5, '#edf5fb');
  base.addColorStop(1, '#d8e9f4');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 576);

  const topGlow = ctx.createRadialGradient(512, 86, 40, 512, 86, 380);
  topGlow.addColorStop(0, 'rgba(255,255,255,0.95)');
  topGlow.addColorStop(0.45, 'rgba(255,255,255,0.38)');
  topGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, 1024, 320);

  // soft vertical light panels
  ctx.filter = 'blur(24px)';
  const panels = [
    [30, 120, '#e6f5ff', 0.78],
    [175, 90, '#ffffff', 0.92],
    [322, 120, '#d9f0ff', 0.84],
    [470, 160, '#ffffff', 1.0],
    [690, 110, '#dbf2ff', 0.88],
    [840, 134, '#ffffff', 0.94],
  ];
  for (const [x, w, color, a] of panels) {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x, -40, w, 660);
  }

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#b3d5ea';
  ctx.fillRect(-40, 322, 1104, 26);
  ctx.fillRect(-40, 448, 1104, 22);

  ctx.filter = 'blur(12px)';
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(90, 306, 844, 40);

  const lowerFog = ctx.createLinearGradient(0, 260, 0, 576);
  lowerFog.addColorStop(0, 'rgba(255,255,255,0)');
  lowerFog.addColorStop(0.42, 'rgba(240,248,252,0.28)');
  lowerFog.addColorStop(1, 'rgba(230,241,247,0.86)');
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
halo.position.set(0.05, 1.92, -2.04);
halo.material.opacity = 0.32;
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
lowerWash.material.opacity = 0.05;
scene.add(lowerWash);

// hot glow strips that feed the bloom halo around the silhouette
function glowStrip(x, w, intensity) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, 4.2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(intensity, intensity, intensity),
      toneMapped: false,
      transparent: true,
      opacity: 0.9,
    })
  );
  m.position.set(x, 1.5, -2.1);
  scene.add(m);
}
glowStrip(-1.62, 0.46, 1.15);
glowStrip(0.08, 0.68, 1.55);
glowStrip(1.56, 0.52, 1.2);

// image-based lighting
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.74;
pmrem.dispose();

// ---------------------------------------------------------------- camera

const camera = new THREE.PerspectiveCamera(28.5, window.innerWidth / window.innerHeight, 0.05, 30);
const FOCUS = new THREE.Vector3(0, 1.57, 0); // face / upper-chest band
const CAM_Z = 0.9;
camera.position.set(0.012, FOCUS.y + 0.008, CAM_Z);
camera.lookAt(FOCUS);

// ---------------------------------------------------------------- lights

// soft frontal key — the bright studio look
const key = new THREE.DirectionalLight(0xffebd9, 1.86);
key.position.set(0.3, 2.85, 2.45);
scene.add(key);

// cool fill from the other side
const fill = new THREE.DirectionalLight(0xd7ecfb, 0.82);
fill.position.set(-1.55, 1.88, 1.45);
scene.add(fill);

// back/rim lights — edge glow that melts into the background
const rimL = new THREE.DirectionalLight(0xe9f7ff, 1.5);
rimL.position.set(-1.8, 2.45, -1.15);
scene.add(rimL);
const rimR = new THREE.DirectionalLight(0xf7fdff, 1.22);
rimR.position.set(1.42, 2.35, -0.96);
scene.add(rimR);

const overhead = new THREE.DirectionalLight(0xf3fbff, 0.58);
overhead.position.set(0, 3.3, 0.85);
scene.add(overhead);

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

  return {
    bones,
    baseRotations: new Map([...bones.values()].map((bone) => [bone, bone.rotation.clone()])),
    neck: bones.get('Bip_Neck'),
    head: bones.get('Bip_Head'),
    eyeL: bones.get('Bip_Eye_L'),
    eyeR: bones.get('Bip_Eye_R'),
    spineUpper: pick('Bip_Spine4', 'Bip_Spine3'),
    spineMid: pick('Bip_Spine2', 'Bip_Spine1'),
    clavicles: pick('Bip_Clavicle_L', 'Bip_Clavicle_R'),
    jaw: filter((name) => name.startsWith('Bip_FaceJawJoint')),
    upperLip: filter((name) => name.startsWith('Bip_FaceUpperLipUp')),
    browsL: filter((name) => /^Bip_FaceBrow(Up|Lo).*_L$/.test(name)),
    browsR: filter((name) => /^Bip_FaceBrow(Up|Lo).*_R$/.test(name)),
    lidsUpperL: filter((name) => /^Bip_Face(EyeCover|Eyelid)\d{2}_L$/.test(name)),
    lidsUpperR: filter((name) => /^Bip_Face(EyeCover|Eyelid)\d{2}_R$/.test(name)),
    lidsLowerL: filter((name) => /^Bip_FaceEyelidLo\d{2}.*_L$/.test(name)),
    lidsLowerR: filter((name) => /^Bip_FaceEyelidLo\d{2}.*_R$/.test(name)),
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

// ---- primary character: Chloe (bundled with the portfolio) ----
// If these assets are removed, the free facecap head still loads as fallback.

function chloeMaterials() {
  const A = 'assets/chloe/';
  const skin = (alb, nrm, rough) =>
    new THREE.MeshPhysicalMaterial({
      map: tex(A + alb, true),
      normalMap: tex(A + nrm),
      roughnessMap: tex(A + rough),
      roughness: 1.0,
      specularIntensity: 0.45,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.7,
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
    Chloe_Eyes: new THREE.MeshPhysicalMaterial({
      map: tex(A + 'eye_alb.jpg', true),
      normalMap: tex(A + 'eye_nrm.jpg'),
      roughness: 0.2,
      clearcoat: 0.92,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.82,
    }),
    Chloe_Hair: cutout('hair.png'),
    Chloe_Lashes: cutout('lashes.png', { roughness: 0.5 }),
    Chloe_Brows: cutout('brows.png', { roughness: 0.5 }),
    Chloe_Teeth: new THREE.MeshStandardMaterial({
      map: tex(A + 'teeth_alb.jpg', true),
      normalMap: tex(A + 'teeth_nrm.jpg'),
      roughness: 0.28,
      envMapIntensity: 0.6,
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
      roughness: 0.75,
      envMapIntensity: 0.6,
    }),
    Chloe_DressDark: new THREE.MeshStandardMaterial({
      map: tex(A + 'dress_alb.jpg', true),
      roughness: 0.7,
      envMapIntensity: 0.6,
    }),
    Chloe_DressTrans: new THREE.MeshStandardMaterial({
      map: tex(A + 'white_alb.jpg', true),
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      roughness: 0.6,
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
    if (name === 'Chloe_Shoes' || name === 'Chloe_CircleShadow') {
      obj.visible = false;
      return;
    }
    if (name.startsWith('Chloe_Duct')) obj.material = mats.Chloe_Duct;
    else if (mats[name]) obj.material = mats[name];
    obj.material.vertexColors = false;
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
  0.48, // strength — halo bleeding over the silhouette edges
  0.82, // radius
  0.93 // threshold — only the hot strips and LED bloom
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
const items = [...menu.querySelectorAll('.item')];
const panel = document.getElementById('panel');
const bodies = panel.querySelectorAll('.panel-body');
let selected = 0;

const MENU_POSES = {
  about:    { lookX: 0.01, lookY: 0.03, camX: 0.0,  camY: 0.006, bodyX: 0.0,   bodyY: 0.0,   mouth: 0.86, brow: 0.4, led: 1.0, squint: 0.08, roll: 0.0 },
  projects: { lookX: -0.16, lookY: 0.015, camX: -0.02, camY: 0.003, bodyX: -0.02, bodyY: -0.005, mouth: 0.34, brow: 0.18, led: 0.92, squint: 0.02, roll: -0.03 },
  skills:   { lookX: 0.035, lookY: 0.045, camX: 0.01, camY: 0.008, bodyX: 0.0,   bodyY: 0.01,  mouth: 0.46, brow: 0.3, led: 1.12, squint: 0.1,  roll: 0.0 },
  exp:      { lookX: 0.12, lookY: 0.01,  camX: 0.018, camY: -0.004, bodyX: 0.018, bodyY: -0.01, mouth: 0.28, brow: 0.14, led: 0.88, squint: 0.02, roll: 0.03 },
  contact:  { lookX: 0.18, lookY: 0.028, camX: 0.028, camY: 0.002, bodyX: 0.03,  bodyY: 0.0,   mouth: 0.62, brow: 0.34, led: 1.06, squint: 0.04, roll: 0.02 },
};

const PANEL_POSES = {
  about:    { lookX: -0.05, lookY: 0.02,  camX: -0.012, camY: 0.012, bodyX: 0.07, bodyY: 0.008, mouth: 0.62, brow: 0.24, led: 0.76, squint: 0.0,  roll: -0.02 },
  projects: { lookX: -0.15, lookY: 0.015, camX: -0.025, camY: 0.004, bodyX: 0.08, bodyY: 0.0,   mouth: 0.26, brow: 0.1,  led: 0.7,  squint: 0.0,  roll: -0.04 },
  skills:   { lookX: -0.03, lookY: 0.04,  camX: -0.01,  camY: 0.012, bodyX: 0.06, bodyY: 0.015, mouth: 0.34, brow: 0.2,  led: 0.8,  squint: 0.03, roll: -0.015 },
  exp:      { lookX: 0.05,  lookY: 0.01,  camX: 0.0,    camY: 0.002, bodyX: 0.05, bodyY: -0.004, mouth: 0.22, brow: 0.08, led: 0.68, squint: 0.0,  roll: 0.015 },
  contact:  { lookX: 0.1,   lookY: 0.028, camX: 0.012,  camY: 0.012, bodyX: 0.04, bodyY: 0.004, mouth: 0.42, brow: 0.18, led: 0.74, squint: 0.01, roll: 0.02 },
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
};

function getCurrentPose() {
  return motion.panelOpen ? PANEL_POSES[motion.active] : MENU_POSES[motion.active];
}

function blinkWave(time, interval, width, offset = 0) {
  const phase = (time + offset) % interval;
  if (phase > width) return 0;
  const t = phase / width;
  return Math.sin(t * Math.PI);
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
  motion.lookX = THREE.MathUtils.damp(motion.lookX, pose.lookX + mouse.x * 0.09, 4.5, dt);
  motion.lookY = THREE.MathUtils.damp(motion.lookY, pose.lookY - mouse.y * 0.05, 4.5, dt);
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
  headGroup.rotation.z = motion.roll * 0.4;

  const idleYaw = Math.sin(t * 0.42) * 0.025;
  const idlePitch = Math.sin(t * 0.53) * 0.018;
  const blink = Math.max(
    blinkWave(t, 4.3, 0.12, 0.18),
    blinkWave(t, 7.4, 0.08, 1.92)
  );

  const rig = headGroup.userData.rig;
  if (rig) {
    const headPitch = motion.lookY * 0.9 + idlePitch;
    const headYaw = motion.lookX * 0.78 + idleYaw;
    const shoulderBreath = Math.sin(t * 0.8) * 0.015;

    setBoneRotationDeltas(rig, rig.spineMid, headPitch * -0.08, headYaw * 0.08, motion.roll * 0.08);
    setBoneRotationDeltas(rig, rig.spineUpper, headPitch * -0.12, headYaw * 0.12, motion.roll * 0.14);
    setBoneRotationDeltas(rig, rig.clavicles, shoulderBreath, 0, 0);
    setBoneRotationDelta(rig, rig.neck, headPitch * -0.24, headYaw * 0.32, motion.roll * 0.18);
    setBoneRotationDelta(rig, rig.head, headPitch * -0.72, headYaw * 0.72, motion.roll + Math.sin(t * 0.67) * 0.012);
    setBoneRotationDelta(rig, rig.eyeL, -motion.lookY * 0.22 + blink * 0.04, motion.lookX * 0.45, 0);
    setBoneRotationDelta(rig, rig.eyeR, -motion.lookY * 0.22 + blink * 0.04, motion.lookX * 0.45, 0);

    const jawOpen = 0.026 + motion.mouth * 0.042 + Math.sin(t * 1.45) * 0.003;
    setBoneRotationDeltas(rig, rig.jaw, jawOpen, 0, 0);
    setBoneRotationDeltas(rig, rig.upperLip, -motion.mouth * 0.014, 0, 0);

    const browLift = 0.006 + motion.brow * 0.03;
    setBoneRotationDeltas(rig, rig.browsL, -browLift, 0, -motion.brow * 0.005);
    setBoneRotationDeltas(rig, rig.browsR, -browLift, 0, motion.brow * 0.005);

    const upperLid = blink * 0.26 + motion.squint * 0.05;
    const lowerLid = blink * 0.08 + motion.squint * 0.02;
    setBoneRotationDeltas(rig, rig.lidsUpperL, upperLid, 0, 0);
    setBoneRotationDeltas(rig, rig.lidsUpperR, upperLid, 0, 0);
    setBoneRotationDeltas(rig, rig.lidsLowerL, -lowerLid, 0, 0);
    setBoneRotationDeltas(rig, rig.lidsLowerR, -lowerLid, 0, 0);
  }

  // LED pulse
  const mats = headGroup.userData.ledMats;
  if (mats) {
    const pulse = (0.72 + 0.28 * Math.sin(t * 2.8)) * motion.led;
    for (const m of mats) m.opacity = pulse;
  }

  // slight camera breathing + UI-driven framing
  camera.position.x = 0.015 + motion.camX + Math.sin(t * 0.34) * 0.008 + mouse.x * 0.008;
  camera.position.y = FOCUS.y + 0.01 + motion.camY + Math.sin(t * 0.46) * 0.004 - mouse.y * 0.004;
  camera.lookAt(FOCUS);

  composer.render();
}

animate();
