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
scene.background = new THREE.Color(0xe9f2f7);

// studio wall: blurred bright panels, like the blown-out DBH backdrop
function wallTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 576;
  const ctx = c.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, 576);
  base.addColorStop(0, '#f2f8fb');
  base.addColorStop(0.6, '#dfecf3');
  base.addColorStop(1, '#cbdde8');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 576);

  // soft vertical light panels
  ctx.filter = 'blur(26px)';
  const panels = [
    [60, 130, '#ffffff', 0.95],
    [250, 90, '#eef7fc', 0.8],
    [420, 150, '#ffffff', 1.0],
    [660, 110, '#f4fafd', 0.85],
    [850, 140, '#ffffff', 0.95],
  ];
  for (const [x, w, color, a] of panels) {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x, -40, w, 660);
  }
  // horizontal band structure, barely visible
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#bcd3e0';
  ctx.fillRect(-40, 300, 1104, 30);
  ctx.fillRect(-40, 430, 1104, 22);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;

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
glowStrip(-1.55, 0.5, 1.25);
glowStrip(0.1, 0.65, 1.35);
glowStrip(1.5, 0.55, 1.25);

// image-based lighting
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.65;
pmrem.dispose();

// ---------------------------------------------------------------- camera

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 30);
const FOCUS = new THREE.Vector3(0, 1.55, 0); // face / upper-chest band
const CAM_Z = 0.92;
camera.position.set(0, FOCUS.y + 0.02, CAM_Z);
camera.lookAt(FOCUS);

// ---------------------------------------------------------------- lights

// soft frontal key — the bright studio look
const key = new THREE.DirectionalLight(0xffe4c8, 1.6);
key.position.set(0.6, 2.7, 2.2);
scene.add(key);

// cool fill from the other side
const fill = new THREE.DirectionalLight(0xdcecf7, 0.5);
fill.position.set(-1.4, 1.7, 1.6);
scene.add(fill);

// back/rim lights — edge glow that melts into the background
const rimL = new THREE.DirectionalLight(0xeaf6ff, 1.5);
rimL.position.set(-1.6, 2.3, -1.4);
scene.add(rimL);
const rimR = new THREE.DirectionalLight(0xeaf6ff, 1.2);
rimR.position.set(1.7, 2.1, -1.2);
scene.add(rimR);

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
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.1,
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
  0.4, // strength — halo bleeding over the silhouette edges
  0.85, // radius
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
const items = [...menu.querySelectorAll('.item')];
const panel = document.getElementById('panel');
const bodies = panel.querySelectorAll('.panel-body');
let selected = 0;

function select(i) {
  selected = (i + items.length) % items.length;
  items.forEach((el, n) => el.classList.toggle('selected', n === selected));
}
function openPanel(name) {
  menu.classList.add('hidden');
  panel.hidden = false;
  for (const b of bodies) b.hidden = b.id !== `panel-${name}`;
}
function closePanel() {
  panel.hidden = true;
  menu.classList.remove('hidden');
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

  // subtle idle sway (interactivity comes later)
  const targetY = mouse.x * 0.06 + Math.sin(t * 0.3) * 0.015;
  headGroup.rotation.y += (targetY - headGroup.rotation.y) * Math.min(1, dt * 2.2);

  // LED pulse
  const mats = headGroup.userData.ledMats;
  if (mats) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
    for (const m of mats) m.opacity = pulse;
  }

  // slight camera breathing
  camera.position.x = Math.sin(t * 0.35) * 0.008 + mouse.x * 0.012;
  camera.position.y = FOCUS.y + 0.02 + Math.sin(t * 0.5) * 0.005 - mouse.y * 0.008;
  camera.lookAt(FOCUS);

  composer.render();
}

animate();
