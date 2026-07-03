import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('./main.ts', import.meta.url), 'utf8');
const nativeBlock = source.match(/const BLINK_NATIVE = \{([\s\S]*?)\};/);

assert.ok(nativeBlock, 'BLINK_NATIVE constants must exist');
assert.doesNotMatch(source, /blink\s*\*\s*0\.72/, 'blink close strength must not be capped at 72%');
assert.match(source, /blinkHold < 0\.2/, 'eye drift should be held while the blink is closing');
assert.match(source, /eyeTargetX = THREE\.MathUtils\.damp\(living\.eyeTargetX, living\.eyeDriftX/, 'eye target should be pulled to the held drift during blink');
assert.match(source, /mouthRoot: pick\('Bip_FaceMouth'\)/, 'mouth root bone should be rigged for facial openness');
assert.match(source, /lipMidUpper: pick\('Bip_FaceLipMiUpOut', 'Bip_FaceLipMiUpIn'\)/, 'upper center lip bones should be rigged');
assert.match(source, /lipMidLower: pick\('Bip_FaceLipMiLoOut', 'Bip_FaceLipMiLoIn'\)/, 'lower center lip bones should be rigged');
assert.match(source, /function applyNativeMouth\(rig, openness, smile, speechPulse = 0\)/, 'native mouth expression layer should exist');
assert.match(source, /document\.body\.dataset\.facialMouthOpen = open\.toFixed\(3\)/, 'mouth openness should be exposed for visual state checks');
assert.match(source, /document\.body\.dataset\.facialJawOpen = jawOpen\.toFixed\(3\)/, 'jaw openness should be exposed for visual state checks');

function numberFor(key) {
  const match = nativeBlock[1].match(new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)`));
  assert.ok(match, `Missing BLINK_NATIVE.${key}`);
  return Number(match[1]);
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
assert.ok(eyeOpacity(nativeClose(1)) <= 0.1, 'closed blink should hide the glossy eye surface');

console.log('blink and facial regression checks passed');
