import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('./main.ts', import.meta.url), 'utf8');
const styleSource = await fs.readFile(new URL('./style.css', import.meta.url), 'utf8');
const htmlSource = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8');
const nativeBlock = source.match(/const BLINK_NATIVE = \{([\s\S]*?)\};/);
const blinkDurationBlock = source.match(/const BLINK_PHASE_DURATION = \{([\s\S]*?)\};/);

assert.ok(nativeBlock, 'BLINK_NATIVE constants must exist');
assert.ok(blinkDurationBlock, 'blink phase duration constants must exist');

// No fake overlay eyes or mouth patches: only the model's native geometry should drive expression.
assert.doesNotMatch(source, /catchlightTexture|EyeCatchlight|eyeCatchlight/i, 'fake eye catchlight overlays must stay removed');
assert.doesNotMatch(source, /blinkVeilTexture|EyeBlinkVeil|eyeBlinkVeil/i, 'fake closed-eye veil overlays must stay removed');
assert.doesNotMatch(source, /mouthLineTexture|MouthLine|mouthLine/i, 'fake mouth-line overlays must stay removed');
assert.doesNotMatch(source, /Chloe_Lashes: cutout\('lashes\.png', \{ roughness: 0\.86/, 'lashes should not use the artificial matte/glass workaround');

// Keep only the calmer pre-mouth-fix mouth controls. No extra lip-bone mouth layer.
assert.match(source, /mouthRoot: pick\('Bip_FaceMouth'\)/, 'mouth root bone should stay rigged for native facial motion');
assert.match(source, /lipMidUpper: pick\('Bip_FaceLipMiUpOut', 'Bip_FaceLipMiUpIn'\)/, 'upper center lip bones should stay rigged');
assert.match(source, /lipMidLower: pick\('Bip_FaceLipMiLoOut', 'Bip_FaceLipMiLoIn'\)/, 'lower center lip bones should stay rigged');
assert.doesNotMatch(source, /function applyNativeMouth|applyNativeMouth\(/, 'extra native mouth lip-bone layer must stay removed');
assert.doesNotMatch(source, /const mouthOpen = THREE\.MathUtils\.clamp/, 'extra mouth-open driver must stay removed');
assert.doesNotMatch(source, /document\.body\.dataset\.facialMouthOpen/, 'removed mouth-open layer should not expose stale visual state');
assert.match(source, /const cornerUpL = -0\.00004 \* liftL/, 'mouth smile lift should stay subtle');
assert.match(source, /const cornerOutL = 0\.000018 \* liftL/, 'mouth corner widening should stay on the older restrained setting');
assert.match(source, /const cheekLiftL = -0\.000018 \* liftL/, 'cheek lift should stay on the older restrained setting');
assert.match(source, /const smile = THREE\.MathUtils\.clamp\(0\.18 \+ expressiveMouth \* 0\.52/, 'menu expression should use the older simple smile driver');
assert.match(source, /const smileAsym = expressionAsym \* 0\.7/, 'smile asymmetry should stay restrained after removing mouth deformation');
assert.match(source, /const jawOpen = 0\.01 \+ expressiveMouth \* 0\.045/, 'jaw opening should stay on the older simple driver');
assert.match(source, /setBoneRotationDeltas\(rig, rig\.upperLip, -expressiveMouth \* 0\.02/, 'upper lip should stay on the older simple driver');
assert.match(source, /Chloe_Teeth:[\s\S]*?roughness: 0\.8,[\s\S]*?envMapIntensity: 0\.075,[\s\S]*?color: new THREE\.Color\(0\.72, 0\.68, 0\.62\)/, 'teeth material should be back on the neutral native-mouth setting');

// Native blink/gaze should remain, but without overlay sprites.
assert.doesNotMatch(source, /blink\s*\*\s*0\.72/, 'blink close strength must not be capped at 72%');
assert.match(source, /blinkHold < 0\.2/, 'eye drift should be held while the blink is closing');
assert.match(source, /eyeTargetX = THREE\.MathUtils\.damp\(living\.eyeTargetX, living\.eyeDriftX/, 'eye target should be pulled to the held drift during blink');
assert.match(source, /function smootherStep01\(value\)/, 'blink states should use eased motion instead of jerky linear eye snaps');
assert.match(source, /living\.blinkSpeed = THREE\.MathUtils\.clamp\(detail\.speed, 0\.35, 3\.2\)/, 'blink debug events should stay speed-forceable for visual tests');
assert.match(source, /document\.body\.dataset\.blinkMode = 'animate'/, 'forced blink animation should expose animate mode for screenshot-state checks');
assert.match(source, /living\.eyeDriftX \* 1\.35/, 'idle gaze should remain readable on the portrait');
assert.match(source, /attentiveLookX \* -1\.75/, 'eye yaw should remain strong enough to create eye-contact movement');
assert.match(source, /restClose: 0\.12/, 'open eyes should keep relaxed lids while staying distinct from a blink');
assert.match(source, /maxClose: 0\.82/, 'closed blink should stop before the Chloe rig folds into broken eyelid geometry');
assert.match(source, /closedEyeOpacity: 0\.2/, 'closed eyes should keep a muted native eye surface so sockets do not become black holes');
assert.match(source, /closedLashOpacity: 0\.24/, 'native lashes should soften at peak blink instead of forming black triangles');
assert.match(source, /const CAM_Z = 0\.78/, 'portrait camera should sit farther back like the reference composition');
assert.match(source, /Chloe_Eyes:[\s\S]*?roughness: 0\.9,[\s\S]*?envMapIntensity: 0\.004/, 'eye material should stay matte enough to avoid glassy reflections');
assert.match(source, /color: new THREE\.Color\(0\.49, 0\.58, 0\.64\)/, 'iris color should stay lighter and reference-like without fake overlays');
assert.match(source, /if \(name === 'Chloe_Lashes'\) headGroup\.userData\.lashMats = \[obj\.material\]/, 'native lash material should be tracked for blink-only softening');
assert.match(source, /applyLashBlinkVisibility\(headGroup\.userData\.lashMats, blinkClose\)/, 'blink loop should soften native lashes at the closed state');
assert.match(source, /if \(detail\.immediate === true\) living\.eyeDriftX = living\.eyeTargetX;/, 'gaze debug should avoid snapping the eyes unless an immediate pose is requested');
assert.match(source, /living\.eyeDriftX = THREE\.MathUtils\.damp\(living\.eyeDriftX, living\.eyeTargetX, 0\.74, dt\)/, 'gaze drift should move calmly rather than twitching');

// Preserve the existing scene work outside the eye/mouth rollback.
assert.match(source, /Chloe_Hair:[\s\S]*?roughness: 0\.84,[\s\S]*?envMapIntensity: 0\.18,[\s\S]*?color: new THREE\.Color\(0\.9, 0\.82, 0\.68\)/, 'hair should stay warm blonde instead of blown-out white');
assert.match(source, /Chloe_Brows:[\s\S]*?roughness: 0\.58,[\s\S]*?envMapIntensity: 0\.28,[\s\S]*?color: new THREE\.Color\(0\.7, 0\.57, 0\.48\)/, 'brows should stay warm enough to match the reference face');
assert.match(source, /renderer\.toneMappingExposure = 0\.93/, 'renderer exposure should keep the bright studio portrait look');
assert.match(source, /scene\.environmentIntensity = 0\.46/, 'environment lighting should preserve face depth instead of flattening skin');
assert.match(source, /const fill = new THREE\.DirectionalLight\(0xd8efff, 0\.78\)/, 'cool fill should leave enough cheek and nose depth');
assert.match(source, /specularIntensity: 0\.18,[\s\S]*?clearcoat: 0\.05,[\s\S]*?clearcoatRoughness: 0\.76/, 'skin should stay soft rather than waxy');
assert.match(source, /envMapIntensity: 0\.31,[\s\S]*?color: new THREE\.Color\(1\.065, 1\.0, 0\.965\)/, 'skin should stay pale but warmer and less chalk-flat like the reference');
assert.match(source, /const portraitFill = new THREE\.PointLight\(0xeaf7ff, 0\.36, 1\.35, 2\.0\)/, 'portrait should keep a reference-like front fill without washing out facial depth');
assert.match(htmlSource, /<div class="camera-diffusion" aria-hidden="true"><\/div>/, 'camera diffusion layer should soften the CG render without affecting menu markup');
assert.match(styleSource, /\.camera-diffusion[\s\S]*?z-index: 2;[\s\S]*?backdrop-filter: blur\(0\.48px\) saturate\(1\.035\) contrast\(0\.982\);[\s\S]*?opacity: 0\.66;/, 'camera diffusion should stay subtle and below the HUD/menu');
assert.match(source, /const broadWindowPanes: Array<\[number, number, string, number\]>/, 'background should use broad overexposed window blocks like the Detroit reference');
assert.match(source, /\[-70, 150, '#fbfeff', 0\.96\]/, 'background should keep a bright left window mass instead of narrow repeated stripes');
assert.match(source, /ctx\.globalAlpha = 0\.98;[\s\S]*?ctx\.fillRect\(-80, 270, 1184, 96\)/, 'background should keep a strong horizontal light band behind the portrait');

function numberFor(key) {
  const match = nativeBlock[1].match(new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
  assert.ok(match, `Missing BLINK_NATIVE.${key}`);
  return Number(match[1]);
}

function blockNumberFor(block, key) {
  const match = block[1].match(new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
  assert.ok(match, `Missing ${key}`);
  return Number(match[1]);
}

function numberRangeFor(pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `Missing ${label}`);
  return [Number(match[1]), Number(match[2])];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value, min, max) {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

const closeScale = numberFor('closeScale');
const closeBias = numberFor('closeBias');
const restClose = numberFor('restClose');
const maxClose = numberFor('maxClose');
const closedEyeOpacity = numberFor('closedEyeOpacity');
const blinkClosing = blockNumberFor(blinkDurationBlock, 'closing');
const blinkClosed = blockNumberFor(blinkDurationBlock, 'closed');
const blinkOpening = blockNumberFor(blinkDurationBlock, 'opening');
const defaultBlinkSpeed = Number(source.match(/blinkSpeed:\s*(-?\d+(?:\.\d+)?)/)?.[1]);
assert.ok(Number.isFinite(defaultBlinkSpeed), 'default blink speed should be declared');
const [eyeTargetMinX, eyeTargetMaxX] = numberRangeFor(
  /living\.eyeTargetX = rand\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/,
  'idle eye target X range'
);
const [eyeTargetMinY, eyeTargetMaxY] = numberRangeFor(
  /living\.eyeTargetY = rand\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/,
  'idle eye target Y range'
);
const [nextSaccadeMin, nextSaccadeMax] = numberRangeFor(
  /living\.nextSaccadeAt = time \+ rand\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/,
  'idle gaze retarget timing'
);

function nativeClose(blink) {
  const animatedClose = smoothstep(clamp(blink * closeScale + closeBias, 0, 1), 0, 1);
  return clamp(restClose + animatedClose * (maxClose - restClose), restClose, maxClose);
}

function eyeOpacity(close) {
  const hide = smoothstep(clamp(close, 0, 1), 0.18, maxClose);
  return 1 - hide * (1 - closedEyeOpacity);
}

assert.ok(nativeClose(0) >= 0.09 && nativeClose(0) <= 0.15, 'open state should keep relaxed lids while staying distinct from a blink');
assert.ok(nativeClose(0.56) >= 0.62, 'half debug pose should visibly close the lids');
assert.ok(nativeClose(1) >= 0.8 && nativeClose(1) <= 0.84, 'closed debug pose should stop at the clean native-lid limit');
assert.ok(eyeOpacity(nativeClose(1)) >= 0.18 && eyeOpacity(nativeClose(1)) <= 0.22, 'closed blink should keep a muted eye surface under the native eyelid instead of a black hole');
assert.ok(blinkClosing >= 0.14 && blinkClosing <= 0.15, 'blink should close visibly instead of reading as a twitch');
assert.ok(blinkClosed >= 0.33 && blinkClosed <= 0.36, 'closed blink state should be held long enough for perception');
assert.ok(blinkOpening >= 0.35 && blinkOpening <= 0.37, 'blink opening should be calm but not so slow that the eye looks like it is drifting');
assert.ok(defaultBlinkSpeed >= 0.82 && defaultBlinkSpeed <= 0.88, 'default blink speed should stay cinematic while remaining forceable');
assert.match(source, /Math\.random\(\) < 0\.025/, 'random double blinks should be rare enough to avoid nervous eye twitching');
assert.match(source, /living\.nextBlinkAt = time \+ rand\(3\.1, 6\.7\)/, 'natural blink cadence should not fire so often that it reads as jitter');
assert.ok(eyeTargetMaxX - eyeTargetMinX >= 0.02, 'idle eye gaze should have visible horizontal range without snapping');
assert.ok(eyeTargetMaxY - eyeTargetMinY >= 0.01, 'idle eye gaze should have visible vertical range without snapping');
assert.ok(nextSaccadeMin >= 6, 'idle gaze retargets should not twitch too frequently');
assert.ok(nextSaccadeMax >= 10, 'idle gaze should include calm held eye contact');

console.log('blink, eye overlay, and mouth regression checks passed');
