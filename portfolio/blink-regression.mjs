import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('./main.ts', import.meta.url), 'utf8');
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
assert.match(source, /function catchlightTexture\(\)/, 'eye catchlight texture should exist');
assert.match(source, /function updateEyeCatchlights\(rig, blinkClose, smile\)/, 'eye catchlights should follow the native eye bones');
assert.match(source, /setupEyeCatchlights\(\)/, 'Chloe setup should create eye catchlights');
assert.match(source, /document\.body\.dataset\.eyeCatchlightOpacity/, 'eye catchlight opacity should be exposed for visual checks');
assert.match(source, /function blinkVeilTexture\(\)/, 'blink veil texture should exist for closed-eye states');
assert.match(source, /function updateEyeBlinkVeils\(rig, blinkClose\)/, 'blink veils should follow the native eye bones');
assert.match(source, /setupEyeBlinkVeils\(\)/, 'Chloe setup should create blink veils');
assert.match(source, /document\.body\.dataset\.eyeBlinkVeilOpacity/, 'blink veil opacity should be exposed for visual checks');
assert.match(source, /living\.eyeDriftX \* 1\.35/, 'idle gaze should be amplified enough to read on the portrait');
assert.match(source, /attentiveLookX \* -1\.65/, 'eye yaw should be strong enough to create eye-contact movement');

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
