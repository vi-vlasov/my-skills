import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('./main.ts', import.meta.url), 'utf8');
const styleSource = await fs.readFile(new URL('./style.css', import.meta.url), 'utf8');
const htmlSource = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8');
const nativeBlock = source.match(/const BLINK_NATIVE = \{([\s\S]*?)\};/);
const blinkDurationBlock = source.match(/const BLINK_PHASE_DURATION = \{([\s\S]*?)\};/);

assert.ok(nativeBlock, 'BLINK_NATIVE constants must exist');
assert.ok(blinkDurationBlock, 'blink phase duration constants must exist');
assert.doesNotMatch(source, /blink\s*\*\s*0\.72/, 'blink close strength must not be capped at 72%');
assert.match(source, /blinkHold < 0\.2/, 'eye drift should be held while the blink is closing');
assert.match(source, /eyeTargetX = THREE\.MathUtils\.damp\(living\.eyeTargetX, living\.eyeDriftX/, 'eye target should be pulled to the held drift during blink');
assert.match(source, /mouthRoot: pick\('Bip_FaceMouth'\)/, 'mouth root bone should be rigged for facial openness');
assert.match(source, /lipMidUpper: pick\('Bip_FaceLipMiUpOut', 'Bip_FaceLipMiUpIn'\)/, 'upper center lip bones should be rigged');
assert.match(source, /lipMidLower: pick\('Bip_FaceLipMiLoOut', 'Bip_FaceLipMiLoIn'\)/, 'lower center lip bones should be rigged');
assert.match(source, /function applyNativeMouth\(rig, openness, smile, speechPulse = 0\)/, 'native mouth expression layer should exist');
assert.match(source, /document\.body\.dataset\.facialMouthOpen = open\.toFixed\(3\)/, 'mouth openness should be exposed for visual state checks');
assert.match(source, /document\.body\.dataset\.facialJawOpen = jawOpen\.toFixed\(3\)/, 'jaw openness should be exposed for visual state checks');
assert.match(source, /const cornerUpL = -0\.000056 \* liftL/, 'mouth corners should stay soft rather than exposing only side teeth');
assert.match(source, /const upperLift = -0\.000056 \* smileLift - 0\.00004 \* open/, 'upper lip should lift enough for a readable soft smile');
assert.match(source, /const lowerDrop = 0\.000078 \* open/, 'lower lip should drop enough for a readable open-mouth expression');
assert.match(source, /const mouthOpen = THREE\.MathUtils\.clamp\(0\.1 \+ expressiveMouth \* 0\.34/, 'menu expression should keep the reference-like mouth opening visible');
assert.match(source, /const jawOpen = 0\.008 \+ mouthOpen \* 0\.064/, 'jaw opening should be strong enough to show teeth in the portrait');
assert.match(source, /Chloe_Teeth:[\s\S]*?roughness: 0\.68,[\s\S]*?envMapIntensity: 0\.12/, 'teeth should stay soft enough for the open-mouth expression');
assert.match(source, /function catchlightTexture\(\)/, 'eye catchlight texture should exist');
assert.match(source, /function updateEyeCatchlights\(rig, blinkClose, smile\)/, 'eye catchlights should follow the native eye bones');
assert.match(source, /setupEyeCatchlights\(\)/, 'Chloe setup should create eye catchlights');
assert.match(source, /document\.body\.dataset\.eyeCatchlightOpacity/, 'eye catchlight opacity should be exposed for visual checks');
assert.match(source, /sprite\.material\.opacity = openFade \* \(0\.2 \+ smile \* 0\.12\)/, 'eye catchlights should stay subtle instead of glassy');
assert.match(source, /Chloe_Eyes:[\s\S]*?roughness: 0\.86,[\s\S]*?envMapIntensity: 0\.008/, 'eye material should stay matte enough to avoid glassy reflections');
assert.match(source, /color: new THREE\.Color\(0\.34, 0\.41, 0\.46\)/, 'iris color should stay deep and reference-like');
assert.match(source, /specularIntensity: 0\.24,[\s\S]*?clearcoat: 0\.05,[\s\S]*?clearcoatRoughness: 0\.72/, 'skin should stay soft rather than waxy');
assert.match(source, /const portraitFill = new THREE\.PointLight\(0xeaf7ff, 0\.32, 1\.2, 2\.0\)/, 'portrait should keep a subtle front fill for reference-like skin softness');
assert.match(source, /function blinkVeilTexture\(\)/, 'blink veil texture should exist for closed-eye states');
assert.match(source, /function updateEyeBlinkVeils\(rig, blinkClose\)/, 'blink veils should follow the native eye bones');
assert.match(source, /setupEyeBlinkVeils\(\)/, 'Chloe setup should create blink veils');
assert.match(source, /document\.body\.dataset\.eyeBlinkVeilOpacity/, 'blink veil opacity should be exposed for visual checks');
assert.match(source, /living\.eyeDriftX \* 1\.35/, 'idle gaze should be amplified enough to read on the portrait');
assert.match(source, /attentiveLookX \* -1\.65/, 'eye yaw should be strong enough to create eye-contact movement');
assert.match(htmlSource, /<i class="torso-haze"><\/i>/, 'reference haze layer should exist in the cinematic backdrop');
assert.match(styleSource, /\.torso-haze[\s\S]*?top: 66vh;[\s\S]*?opacity: 0\.58;/, 'torso haze should soften the dress area like the reference menu');
assert.match(styleSource, /\.floor-mist[\s\S]*?height: 39vh;[\s\S]*?opacity: 0\.54;/, 'floor mist should keep the lower torso subdued');
assert.match(styleSource, /\.menu::before[\s\S]*?height: 138px;[\s\S]*?rgba\(255,255,255,0\.36\)/, 'menu glow should veil the lower portrait behind the UI');

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
const closedEyeOpacity = numberFor('closedEyeOpacity');
const blinkClosing = blockNumberFor(blinkDurationBlock, 'closing');
const blinkClosed = blockNumberFor(blinkDurationBlock, 'closed');
const blinkOpening = blockNumberFor(blinkDurationBlock, 'opening');
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
  return smoothstep(clamp(blink * closeScale + closeBias, 0, 1), 0, 1);
}

function eyeOpacity(close) {
  const hide = smoothstep(clamp(close, 0, 1), 0.18, 0.88);
  return 1 - hide * (1 - closedEyeOpacity);
}

assert.ok(nativeClose(0) <= 0.001, 'open state should stay open');
assert.ok(nativeClose(0.46) >= 0.4, 'half debug pose should visibly close the lids');
assert.equal(nativeClose(1), 1, 'closed debug pose should reach full native close');
assert.ok(
  eyeOpacity(nativeClose(1)) >= 0.75,
  'closed blink should keep eye surfaces mostly present so blink veils do not reveal socket holes'
);
assert.ok(blinkClosing >= 0.08, 'blink closing phase should last long enough to read');
assert.ok(blinkClosed >= 0.2, 'closed blink state should be held long enough for screenshots and perception');
assert.ok(blinkOpening >= 0.15, 'blink opening phase should not snap back too quickly');
assert.ok(eyeTargetMaxX - eyeTargetMinX >= 0.024, 'idle eye gaze should have visible horizontal range');
assert.ok(eyeTargetMaxY - eyeTargetMinY >= 0.012, 'idle eye gaze should have visible vertical range');
assert.ok(nextSaccadeMin >= 3, 'idle gaze retargets should not twitch too frequently');
assert.ok(nextSaccadeMax >= 5, 'idle gaze should include calm held eye contact');

console.log('blink and facial regression checks passed');
