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
assert.match(source, /const cornerUpL = -0\.000038 \* liftL/, 'mouth corners should stay soft rather than exposing only side teeth');
assert.match(source, /const upperLift = -0\.00006 \* smileLift - 0\.00009 \* open/, 'upper lip should lift enough for a readable soft smile');
assert.match(source, /const lowerDrop = 0\.00018 \* open/, 'center lower lip should drop enough for a visible central smile aperture');
assert.match(source, /const sideSeal = 0\.000032 \* open/, 'side lips should seal the corners so teeth stay centered');
assert.match(source, /lowerDrop \* 0\.5 - sideSeal/, 'side lower lips should follow the center enough to avoid a puppet V-mouth');
assert.match(source, /const mouthOpen = THREE\.MathUtils\.clamp\(0\.145 \+ expressiveMouth \* 0\.28/, 'menu expression should keep a reference-like soft open mouth without fangy teeth');
assert.match(source, /const jawOpen = 0\.01 \+ mouthOpen \* 0\.11/, 'jaw opening should stay soft enough for a relaxed DBH menu expression');
assert.match(source, /Chloe_Teeth:[\s\S]*?roughness: 0\.8,[\s\S]*?envMapIntensity: 0\.075/, 'teeth should stay softly visible for the central open-mouth expression');
assert.match(source, /const expressionAsym = Math\.sin\(t \* 0\.61\) \* 0\.022/, 'face should keep subtle expression asymmetry');
assert.match(source, /document\.body\.dataset\.facialSmileAsym = smileAsym\.toFixed\(3\)/, 'smile asymmetry should be exposed for visual checks');
assert.match(source, /function catchlightTexture\(\)/, 'eye catchlight texture should exist');
assert.match(source, /function updateEyeCatchlights\(rig, blinkClose, smile\)/, 'eye catchlights should follow the native eye bones');
assert.match(source, /setupEyeCatchlights\(\)/, 'Chloe setup should create eye catchlights');
assert.match(source, /document\.body\.dataset\.eyeCatchlightOpacity/, 'eye catchlight opacity should be exposed for visual checks');
assert.match(source, /smoothstep\(THREE\.MathUtils\.clamp\(blinkClose, 0, 1\), 0\.24, 0\.56\)/, 'eye catchlights should fade before the half-blink pose so closing eyes do not look glassy');
assert.match(source, /sprite\.material\.opacity = openFade \* \(0\.24 \+ smile \* 0\.08\)/, 'eye catchlights should stay readable but controlled instead of glassy');
assert.match(source, /const scale = 0\.0088 \+ smile \* 0\.0018/, 'eye catchlights should remain small enough to avoid fake overlay eyes');
assert.match(source, /Chloe_Eyes:[\s\S]*?roughness: 0\.9,[\s\S]*?envMapIntensity: 0\.006/, 'eye material should stay matte enough to avoid glassy reflections');
assert.match(source, /color: new THREE\.Color\(0\.43, 0\.52, 0\.58\)/, 'iris color should stay lighter and reference-like without adding glass');
assert.match(source, /renderer\.toneMappingExposure = 0\.93/, 'renderer exposure should keep the bright studio portrait look');
assert.match(source, /specularIntensity: 0\.2,[\s\S]*?clearcoat: 0\.05,[\s\S]*?clearcoatRoughness: 0\.72/, 'skin should stay soft rather than waxy');
assert.match(source, /envMapIntensity: 0\.36,[\s\S]*?color: new THREE\.Color\(1\.09, 1\.035, 1\.0\)/, 'skin should stay pale and softly lit like the reference');
assert.match(source, /const portraitFill = new THREE\.PointLight\(0xeaf7ff, 0\.46, 1\.35, 2\.0\)/, 'portrait should keep a reference-like front fill for skin softness');
assert.match(source, /function blinkVeilTexture\(\)/, 'blink veil texture should exist for closed-eye states');
assert.match(source, /function updateEyeBlinkVeils\(rig, blinkClose\)/, 'blink veils should follow the native eye bones');
assert.match(source, /setupEyeBlinkVeils\(\)/, 'Chloe setup should create blink veils');
assert.match(source, /document\.body\.dataset\.eyeBlinkVeilOpacity/, 'blink veil opacity should be exposed for visual checks');
assert.match(source, /sprite\.material\.opacity = close \* 0\.98/, 'closed eyelid veil should visibly cover the eye surface');
assert.match(source, /sprite\.scale\.set\(0\.052, 0\.018 \+ close \* 0\.02, 1\)/, 'closed eyelid veil should stay fitted instead of becoming a large translucent oval');
assert.match(source, /restClose: 0\.16/, 'open eyes should keep a relaxed lid baseline instead of a wide puppet stare');
assert.match(source, /function smootherStep01\(value\)/, 'blink states should use eased motion instead of jerky linear eye snaps');
assert.match(source, /living\.blinkSpeed = THREE\.MathUtils\.clamp\(detail\.speed, 0\.55, 2\.4\)/, 'blink debug events should be able to force animation speed for testing');
assert.match(source, /living\.eyeDriftX \* 1\.35/, 'idle gaze should be amplified enough to read on the portrait');
assert.match(source, /attentiveLookX \* -1\.75/, 'eye yaw should be strong enough to create eye-contact movement');
assert.match(source, /living\.eyeDriftX = THREE\.MathUtils\.damp\(living\.eyeDriftX, living\.eyeTargetX, 1\.75, dt\)/, 'gaze drift should move calmly rather than twitching');
assert.match(htmlSource, /<i class="torso-haze"><\/i>/, 'reference haze layer should exist in the cinematic backdrop');
assert.match(htmlSource, /<i class="glass-band glass-band-a"><\/i>/, 'glass band layer should exist for the Detroit-like menu pane');
assert.match(htmlSource, /<i class="menu-flare"><\/i>/, 'menu flare layer should exist for the selected-row lens bloom');
assert.match(styleSource, /\.torso-haze[\s\S]*?top: 68vh;[\s\S]*?opacity: 0\.42;/, 'torso haze should soften the dress area without erasing the silhouette');
assert.match(styleSource, /\.floor-mist[\s\S]*?height: 34vh;[\s\S]*?opacity: 0\.4;/, 'floor mist should keep the lower torso subdued without washing out the straps');
assert.match(styleSource, /\.glass-band[\s\S]*?height: 1px;[\s\S]*?opacity: 0\.52;/, 'glass bands should add thin horizontal camera-glass lines like the reference');
assert.match(styleSource, /\.menu-flare[\s\S]*?top: 79\.2vh;[\s\S]*?opacity: 0\.42;/, 'menu flare should add a subtle selected-row bloom without washing out the portrait');
assert.match(source, /Chloe_DressMain:[\s\S]*?roughness: 0\.93,[\s\S]*?envMapIntensity: 0\.085,[\s\S]*?color: new THREE\.Color\(0\.76, 0\.82, 0\.9\)/, 'main dress material should stay matte enough to reveal torso structure through the haze');
assert.match(source, /Chloe_DressDark:[\s\S]*?roughness: 0\.9,[\s\S]*?envMapIntensity: 0\.075,[\s\S]*?color: new THREE\.Color\(0\.58, 0\.66, 0\.78\)/, 'dark dress straps should stay visible like the reference silhouette');
assert.match(styleSource, /\.menu::before[\s\S]*?height: 138px;[\s\S]*?rgba\(255,255,255,0\.36\)/, 'menu glow should veil the lower portrait behind the UI');
assert.match(styleSource, /\.item[\s\S]*?height: 42px;[\s\S]*?font-size: clamp\(12px, 1\.02vw, 17px\)/, 'menu items should stay slim like the reference UI');
assert.match(styleSource, /\.item::after[\s\S]*?rgba\(237,244,248,0\.38\)[\s\S]*?opacity: 0\.46;/, 'inactive menu panels should stay faint instead of heavy cards');
assert.match(styleSource, /\.item::before[\s\S]*?#10233b 0%[\s\S]*?#47759c 100%/, 'selected menu bar should keep the dark Detroit-like blue ramp');
assert.match(styleSource, /\.cinematic-backdrop[\s\S]*?opacity: 0\.9;[\s\S]*?ellipse 30% 45%/, 'cinematic backdrop panes should stay visible around the portrait like the reference');
assert.match(styleSource, /\.horizon-glow[\s\S]*?top: 50vh;[\s\S]*?opacity: 0\.76;/, 'reference-like horizontal window glow should stay readable behind the menu');
assert.match(source, /\[100, 66, '#ffffff', 0\.9\]/, 'background should keep bright vertical panes like the Detroit reference');
assert.match(source, /const hotColumns: Array<\[number, number, number\]>/, 'background should add thin hot window columns like the Detroit reference');
assert.match(source, /ctx\.globalAlpha = 0\.84;[\s\S]*?ctx\.fillRect\(-60, 292, 1144, 52\)/, 'background should keep a strong horizontal light band behind the portrait');

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
  return clamp(restClose + animatedClose * (1 - restClose), 0, 1);
}

function eyeOpacity(close) {
  const hide = smoothstep(clamp(close, 0, 1), 0.18, 0.88);
  return 1 - hide * (1 - closedEyeOpacity);
}

assert.ok(nativeClose(0) >= 0.12 && nativeClose(0) <= 0.22, 'open state should keep relaxed lids without becoming a blink');
assert.ok(nativeClose(0.46) >= 0.4, 'half debug pose should visibly close the lids');
assert.equal(nativeClose(1), 1, 'closed debug pose should reach full native close');
assert.ok(
  eyeOpacity(nativeClose(1)) <= 0.4,
  'closed blink should fade the eye surface enough that the eyelid reads as closed'
);
assert.ok(blinkClosing >= 0.075 && blinkClosing <= 0.095, 'blink should snap closed quickly enough to read as intentional instead of twitchy');
assert.ok(blinkClosed >= 0.22, 'closed blink state should be held long enough for screenshots and perception');
assert.ok(blinkOpening >= 0.17 && blinkOpening <= 0.22, 'blink opening should be calm but not so slow that the eye looks like it is drifting');
assert.ok(defaultBlinkSpeed >= 1.05 && defaultBlinkSpeed <= 1.12, 'default blink speed should be slightly faster without erasing the closed hold');
assert.match(source, /Math\.random\(\) < 0\.04/, 'random double blinks should be rare enough to avoid nervous eye twitching');
assert.match(source, /living\.nextBlinkAt = time \+ rand\(2\.2, 4\.8\)/, 'natural blink cadence should not fire so often that it reads as jitter');
assert.ok(eyeTargetMaxX - eyeTargetMinX >= 0.024, 'idle eye gaze should have visible horizontal range');
assert.ok(eyeTargetMaxY - eyeTargetMinY >= 0.012, 'idle eye gaze should have visible vertical range');
assert.ok(nextSaccadeMin >= 3, 'idle gaze retargets should not twitch too frequently');
assert.ok(nextSaccadeMax >= 5, 'idle gaze should include calm held eye contact');

console.log('blink and facial regression checks passed');
