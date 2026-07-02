import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();

// screen-space vertical gradient as the backdrop (clean DBH white room)
function gradientTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
scene.background = gradientTexture([
  [0.0, '#eef5f9'],
  [0.45, '#d3e1e9'],
  [1.0, '#9db1bd'],
]);
scene.fog = new THREE.Fog(0xd6e2e9, 9, 26);

// image-based lighting — studio-like HDR environment, no external file
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 1.15;
pmrem.dispose();

// ---------------------------------------------------------------- camera

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 60);
const CAM_BASE = new THREE.Vector3(-0.35, 1.4, 3.7);
const CAM_TARGET = new THREE.Vector3(0.62, 0.95, 0);
camera.position.copy(CAM_BASE);
camera.lookAt(CAM_TARGET);

// ---------------------------------------------------------------- lights

// key light — warm white, main shadow caster
const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
key.position.set(-3.5, 5.5, 3.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 16;
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -2;
key.shadow.bias = -0.0004;
key.shadow.radius = 6;
scene.add(key);

// cold cyan rim light from behind — the android glow
const rim = new THREE.DirectionalLight(0x8fdcf5, 2.2);
rim.position.set(3.2, 3.0, -3.6);
scene.add(rim);

// gentle bounce fill from below-front
const fill = new THREE.DirectionalLight(0xdfeaf2, 0.55);
fill.position.set(0.5, 0.6, 4.0);
scene.add(fill);

// ---------------------------------------------------------------- floor

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 64),
  new THREE.MeshStandardMaterial({ color: 0xe8eff3, roughness: 0.92, metalness: 0.0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// soft blob shadow to ground the character (in addition to the real shadow map)
function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(40,60,72,0.42)');
  g.addColorStop(0.55, 'rgba(40,60,72,0.16)');
  g.addColorStop(1, 'rgba(40,60,72,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 2.6),
  new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
);
blob.rotation.x = -Math.PI / 2;
blob.position.set(0.9, 0.01, 0);
scene.add(blob);

// soft ring accent under the character
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.92, 0.95, 96),
  new THREE.MeshBasicMaterial({ color: 0x35c8e8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.set(0.9, 0.005, 0);
scene.add(ring);

// ---------------------------------------------------------------- particles

const PARTICLES = 260;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLES * 3);
const pSpeed = new Float32Array(PARTICLES);
for (let i = 0; i < PARTICLES; i++) {
  pPos[i * 3 + 0] = (Math.random() - 0.5) * 14;
  pPos[i * 3 + 1] = Math.random() * 5;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
  pSpeed[i] = 0.05 + Math.random() * 0.15;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    color: 0xaee4f5,
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
scene.add(particles);

// ---------------------------------------------------------------- character

const bootEl = document.getElementById('boot');
const bootBar = document.getElementById('boot-progress');
const bootStatus = document.getElementById('boot-status');

const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
  bootBar.style.width = `${Math.round((loaded / total) * 100)}%`;
};

let mixer = null;
let headBone = null;
const characterGroup = new THREE.Group();
characterGroup.position.set(0.9, 0, 0);
characterGroup.rotation.y = -0.38; // face slightly toward the menu
scene.add(characterGroup);

new GLTFLoader(manager).load(
  'assets/michelle.glb',
  (gltf) => {
    const model = gltf.scene;

    // normalize: feet on the floor, ~1.72 m tall regardless of export units
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.72 / size.y;
    model.scale.setScalar(scale);
    box.setFromObject(model);
    model.position.y -= box.min.y;

    model.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
        if (obj.material) {
          obj.material.envMapIntensity = 0.85;
        }
      }
    });

    // GLTFLoader sanitizes node names, so 'mixamorig:Head' may lose the colon
    headBone =
      model.getObjectByName('mixamorigHead') ?? model.getObjectByName('mixamorig:Head');

    mixer = new THREE.AnimationMixer(model);
    const dance = gltf.animations.find((a) => a.name !== 'TPose') ?? gltf.animations[0];
    const action = mixer.clipAction(dance);
    action.timeScale = 0.55; // slow the samba down into a graceful sway
    action.play();

    characterGroup.add(model);

    bootBar.style.width = '100%';
    bootStatus.textContent = 'MODEL READY · СИСТЕМА АКТИВНА';
    setTimeout(() => bootEl.classList.add('done'), 450);
  },
  (xhr) => {
    if (xhr.total) bootBar.style.width = `${Math.round((xhr.loaded / xhr.total) * 100)}%`;
    bootStatus.textContent = 'LOADING GEOMETRY & SKELETON…';
  },
  (err) => {
    bootStatus.textContent = 'ОШИБКА ЗАГРУЗКИ МОДЕЛИ';
    console.error(err);
  }
);

// ---------------------------------------------------------------- post FX

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.22, // strength — subtle, highlights and rim only
  0.55, // radius
  0.96 // threshold — above the bright backdrop, so only true highlights bloom
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- LED overlay

const ledEl = document.getElementById('led');
const ledLocal = new THREE.Vector3(-7.8, 12.0, 0.5); // right-temple offset in head-bone space (cm-scaled rig)
const ledWorld = new THREE.Vector3();

function updateLED() {
  if (!headBone) return;
  ledWorld.copy(ledLocal).applyMatrix4(headBone.matrixWorld);
  ledWorld.project(camera);
  if (ledWorld.z > 1) {
    ledEl.style.opacity = '0';
    return;
  }
  ledEl.style.opacity = '1';
  const x = (ledWorld.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-ledWorld.y * 0.5 + 0.5) * window.innerHeight;
  ledEl.style.left = `${x}px`;
  ledEl.style.top = `${y}px`;
}

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

// menu <-> panels
const menu = document.getElementById('menu');
const panel = document.getElementById('panel');
const bodies = panel.querySelectorAll('.panel-body');

for (const item of document.querySelectorAll('.menu-item')) {
  item.addEventListener('click', () => {
    menu.classList.add('hidden');
    panel.hidden = false;
    for (const b of bodies) b.hidden = b.id !== `panel-${item.dataset.panel}`;
  });
}
document.getElementById('panel-back').addEventListener('click', () => {
  panel.hidden = true;
  menu.classList.remove('hidden');
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !panel.hidden) {
    panel.hidden = true;
    menu.classList.remove('hidden');
  }
});

// clock (DBH shows the live time in the corner)
const clockEl = document.getElementById('clock');
function tickClock() {
  const d = new Date();
  clockEl.textContent =
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

  // dust drifts upward, wraps around
  const pos = pGeo.attributes.position;
  for (let i = 0; i < PARTICLES; i++) {
    let y = pos.getY(i) + pSpeed[i] * dt;
    if (y > 5) y = 0;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;

  // slow breathing drift + mouse parallax
  camera.position.x = CAM_BASE.x + mouse.x * 0.22 + Math.sin(t * 0.25) * 0.05;
  camera.position.y = CAM_BASE.y - mouse.y * 0.14 + Math.sin(t * 0.4) * 0.03;
  camera.lookAt(CAM_TARGET);

  composer.render();
  updateLED();
}

animate();
