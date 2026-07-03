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
assert.match(source, /const cornerUpL = -0\.000082 \* liftL/, 'mouth corners should lift enough for the warm reference smile');
assert.match(source, /const cornerOutL = 0\.000038 \* liftL/, 'mouth corners should widen the expression toward a DBH speaking smile');
assert.match(source, /const cheekLiftL = -0\.000068 \* liftL/, 'cheeks should lift enough to make the smile feel alive');
assert.match(source, /const upperLift = -0\.000084 \* smileLift - 0\.000072 \* open/, 'upper lip should lift enough for a readable speaking smile without over-puckering');
assert.match(source, /const lowerDrop = 0\.000062 \* open/, 'center lower lip should avoid a puppet V while keeping the central smile aperture');
assert.match(source, /const sideSeal = 0\.000024 \* open/, 'side lips should seal fang-like side teeth without pinching the mouth into a vertical V');
assert.match(source, /lowerDrop \* 0\.22 - sideSeal/, 'side lower lips should follow enough for a horizontal speaking smile without fang-like side teeth');
assert.match(source, /const smile = THREE\.MathUtils\.clamp\(0\.46 \+ expressiveMouth \* 0\.32/, 'menu expression should keep a warmer reference-like smile');
assert.match(source, /const mouthOpen = THREE\.MathUtils\.clamp\(0\.17 \+ expressiveMouth \* 0\.2/, 'menu expression should keep a reference-like soft open mouth without fangy teeth');
assert.match(source, /const jawOpen = 0\.01 \+ mouthOpen \* 0\.13/, 'jaw opening should stay soft but visible for a relaxed DBH speaking expression');
assert.match(source, /setBoneRotationDeltas\(rig, rig\.upperLip, -mouthOpen \* 0\.045/, 'upper lip should reveal a horizontal speaking-smile line without a puppet V');
assert.match(source, /Chloe_Teeth:[\s\S]*?roughness: 0\.82,[\s\S]*?envMapIntensity: 0\.052,[\s\S]*?color: new THREE\.Color\(0\.72, 0\.7, 0\.66\)/, 'teeth should stay softly visible for the central open-mouth expression without fang-like highlights');
assert.match(source, /function mouthLineTexture\(\)/, 'mouth line texture should exist to soften side teeth into a central DBH-like dental line');
assert.match(source, /function setupMouthLine\(\)/, 'mouth line sprite should be set up with the Chloe rig');
assert.match(source, /function updateMouthLine\(rig, open, smile\)/, 'mouth line should follow the native mouth bone instead of being a fixed screen overlay');
assert.match(source, /setupMouthLine\(\)/, 'Chloe setup should create the mouth line softener');
assert.match(source, /document\.body\.dataset\.mouthLineOpacity = sprite\.material\.opacity\.toFixed\(3\)/, 'mouth line opacity should be exposed for visual checks');
assert.match(source, /sprite\.material\.opacity = THREE\.MathUtils\.clamp\(0\.08 \+ openness \* 0\.42 \+ smileLift \* 0\.035, 0, 0\.24\)/, 'mouth line should stay subtle while hiding fang-like side teeth');
assert.match(source, /about:\s*\{[\s\S]*?roll: -0\.006 \}/, 'main portrait pose should keep a subtle reference-like head roll instead of looking passport-flat');
assert.match(source, /headGroup\.rotation\.z = motion\.roll \* 0\.52/, 'head roll should be visible enough to soften the portrait pose');
assert.match(source, /new THREE\.PerspectiveCamera\(23\.8,/, 'camera should stay tightly framed like the DBH reference portrait');
assert.match(source, /const FOCUS = new THREE\.Vector3\(0, 1\.512, 0\)/, 'portrait focus should keep the eyes and mouth in a reference-like vertical composition');
assert.match(source, /const CAM_Z = 0\.665/, 'camera distance should keep the face large enough for a main-menu close-up');
assert.match(source, /const expressionAsym = Math\.sin\(t \* 0\.61\) \* 0\.026/, 'face should keep subtle expression asymmetry');
assert.match(source, /const smileAsym = expressionAsym \* 1\.16/, 'smile asymmetry should be visible enough to avoid a mirrored mask expression');
assert.match(source, /document\.body\.dataset\.facialSmileAsym = smileAsym\.toFixed\(3\)/, 'smile asymmetry should be exposed for visual checks');
assert.match(source, /function catchlightTexture\(\)/, 'eye catchlight texture should exist');
assert.match(source, /function updateEyeCatchlights\(rig, blinkClose, smile\)/, 'eye catchlights should follow the native eye bones');
assert.match(source, /setupEyeCatchlights\(\)/, 'Chloe setup should create eye catchlights');
assert.match(source, /document\.body\.dataset\.eyeCatchlightOpacity/, 'eye catchlight opacity should be exposed for visual checks');
assert.match(source, /smoothstep\(THREE\.MathUtils\.clamp\(blinkClose, 0, 1\), 0\.24, 0\.56\)/, 'eye catchlights should fade before the half-blink pose so closing eyes do not look glassy');
assert.match(source, /sprite\.material\.opacity = openFade \* \(0\.16 \+ smile \* 0\.045\)/, 'eye catchlights should stay readable but controlled instead of glassy');
assert.match(source, /\.addScaledVector\(cameraUp, 0\.0036\)/, 'eye catchlights should sit on the iris instead of floating on the upper lid');
assert.match(source, /const scale = 0\.0068 \+ smile \* 0\.001/, 'eye catchlights should remain small enough to avoid fake overlay eyes');
assert.match(source, /Chloe_Eyes:[\s\S]*?roughness: 0\.9,[\s\S]*?envMapIntensity: 0\.004/, 'eye material should stay matte enough to avoid glassy reflections');
assert.match(source, /color: new THREE\.Color\(0\.49, 0\.58, 0\.64\)/, 'iris color should stay lighter and reference-like without adding glass');
assert.match(source, /Chloe_Lashes:[\s\S]*?roughness: 0\.86,[\s\S]*?envMapIntensity: 0\.08,[\s\S]*?color: new THREE\.Color\(0\.34, 0\.3, 0\.3\)/, 'lashes should stay matte so blink frames do not flash with glassy streaks');
assert.match(source, /Chloe_Hair:[\s\S]*?roughness: 0\.84,[\s\S]*?envMapIntensity: 0\.18,[\s\S]*?color: new THREE\.Color\(0\.9, 0\.82, 0\.68\)/, 'hair should stay warm blonde instead of blown-out white');
assert.match(source, /Chloe_Brows:[\s\S]*?roughness: 0\.58,[\s\S]*?envMapIntensity: 0\.28,[\s\S]*?color: new THREE\.Color\(0\.7, 0\.57, 0\.48\)/, 'brows should stay warm enough to match the reference face');
assert.match(source, /renderer\.toneMappingExposure = 0\.93/, 'renderer exposure should keep the bright studio portrait look');
assert.match(source, /scene\.environmentIntensity = 0\.46/, 'environment lighting should preserve face depth instead of flattening skin');
assert.match(source, /const fill = new THREE\.DirectionalLight\(0xd8efff, 0\.78\)/, 'cool fill should leave enough cheek and nose depth');
assert.match(source, /specularIntensity: 0\.18,[\s\S]*?clearcoat: 0\.05,[\s\S]*?clearcoatRoughness: 0\.76/, 'skin should stay soft rather than waxy');
assert.match(source, /envMapIntensity: 0\.31,[\s\S]*?color: new THREE\.Color\(1\.065, 1\.0, 0\.965\)/, 'skin should stay pale but warmer and less chalk-flat like the reference');
assert.match(source, /const portraitFill = new THREE\.PointLight\(0xeaf7ff, 0\.36, 1\.35, 2\.0\)/, 'portrait should keep a reference-like front fill without washing out facial depth');
assert.match(source, /function blinkVeilTexture\(\)/, 'blink veil texture should exist for closed-eye states');
assert.match(source, /function updateEyeBlinkVeils\(rig, blinkClose\)/, 'blink veils should follow the native eye bones');
assert.match(source, /setupEyeBlinkVeils\(\)/, 'Chloe setup should create blink veils');
assert.match(source, /document\.body\.dataset\.eyeBlinkVeilOpacity/, 'blink veil opacity should be exposed for visual checks');
assert.match(source, /smoothstep\(THREE\.MathUtils\.clamp\(blinkClose, 0, 1\), 0\.28, 0\.9\)/, 'blink veil should fade in smoothly before the fully closed state instead of popping');
assert.match(source, /sprite\.material\.opacity = close \* 0\.96;/, 'closed eyelid veil should soften the eye surface without becoming a flat sticker');
assert.match(source, /sprite\.scale\.set\(0\.052 \+ close \* 0\.004, 0\.014 \+ close \* 0\.011, 1\)/, 'closed eyelid veil should stay fitted instead of becoming a large translucent oval');
assert.match(source, /function smootherStep01\(value\)/, 'blink states should use eased motion instead of jerky linear eye snaps');
assert.match(source, /living\.blinkSpeed = THREE\.MathUtils\.clamp\(detail\.speed, 0\.35, 3\.2\)/, 'blink debug events should be able to force animation speed for testing');
assert.match(source, /document\.body\.dataset\.blinkSpeed = living\.blinkSpeed\.toFixed\(2\)/, 'forced blink speed should be exposed for visual state checks');
assert.match(source, /document\.body\.dataset\.blinkMode = 'animate'/, 'forced blink animation should expose animate mode for screenshot-state checks');
assert.match(source, /living\.eyeDriftX \* 1\.35/, 'idle gaze should be amplified enough to read on the portrait');
assert.match(source, /attentiveLookX \* -1\.75/, 'eye yaw should be strong enough to create eye-contact movement');
assert.match(source, /restClose: 0\.12/, 'open eyes should be open enough that the blink reads on the full portrait');
assert.match(source, /closedEyeOpacity: 0/, 'closed eyes should hide glassy iris reflections under the eyelid');
assert.match(source, /if \(detail\.immediate === true\) living\.eyeDriftX = living\.eyeTargetX;/, 'gaze debug should avoid snapping the eyes unless an immediate pose is requested');
assert.match(source, /living\.eyeDriftX = THREE\.MathUtils\.damp\(living\.eyeDriftX, living\.eyeTargetX, 0\.74, dt\)/, 'gaze drift should move calmly rather than twitching');
assert.match(htmlSource, /<div class="camera-diffusion" aria-hidden="true"><\/div>/, 'camera diffusion layer should soften the CG render without affecting menu markup');
assert.match(styleSource, /\.camera-diffusion[\s\S]*?z-index: 2;[\s\S]*?backdrop-filter: blur\(0\.48px\) saturate\(1\.035\) contrast\(0\.982\);[\s\S]*?opacity: 0\.66;/, 'camera diffusion should stay subtle and below the HUD/menu');
assert.match(htmlSource, /<i class="torso-haze"><\/i>/, 'reference haze layer should exist in the cinematic backdrop');
assert.match(htmlSource, /<i class="glass-band glass-band-a"><\/i>/, 'glass band layer should exist for the Detroit-like menu pane');
assert.match(htmlSource, /<i class="menu-flare"><\/i>/, 'menu flare layer should exist for the selected-row lens bloom');
assert.match(styleSource, /\.torso-haze[\s\S]*?top: 64\.2vh;[\s\S]*?opacity: 0\.54;/, 'torso haze should soften the dress area without erasing the silhouette');
assert.match(styleSource, /\.floor-mist[\s\S]*?height: 36vh;[\s\S]*?opacity: 0\.46;/, 'floor mist should keep the lower torso subdued without washing out the straps');
assert.match(styleSource, /\.glass-band-a \{ top: 71\.4vh; opacity: 0\.6; \}/, 'upper glass band should sit over the lower portrait like the reference');
assert.match(styleSource, /\.glass-band-b \{ top: 80\.2vh; opacity: 0\.48; \}/, 'lower glass band should reinforce the Detroit-like menu lane');
assert.match(styleSource, /\.menu-flare[\s\S]*?top: 77\.8vh;[\s\S]*?opacity: 0\.5;/, 'menu flare should add a subtle selected-row bloom without washing out the portrait');
assert.match(source, /Chloe_DressMain:[\s\S]*?roughness: 0\.93,[\s\S]*?envMapIntensity: 0\.085,[\s\S]*?color: new THREE\.Color\(0\.76, 0\.82, 0\.9\)/, 'main dress material should stay matte enough to reveal torso structure through the haze');
assert.match(source, /Chloe_DressDark:[\s\S]*?roughness: 0\.9,[\s\S]*?envMapIntensity: 0\.075,[\s\S]*?color: new THREE\.Color\(0\.58, 0\.66, 0\.78\)/, 'dark dress straps should stay visible like the reference silhouette');
assert.match(styleSource, /\.menu::before[\s\S]*?top: -42px;[\s\S]*?height: 164px;[\s\S]*?rgba\(255,255,255,0\.42\)/, 'menu glow should veil the lower portrait behind the UI');
assert.match(styleSource, /\.item[\s\S]*?height: 42px;[\s\S]*?font-size: clamp\(12px, 1\.02vw, 17px\)/, 'menu items should stay slim like the reference UI');
assert.match(styleSource, /\.item::after[\s\S]*?rgba\(237,244,248,0\.38\)[\s\S]*?opacity: 0\.46;/, 'inactive menu panels should stay faint instead of heavy cards');
assert.match(styleSource, /\.item::before[\s\S]*?#10233b 0%[\s\S]*?#47759c 100%/, 'selected menu bar should keep the dark Detroit-like blue ramp');
assert.match(styleSource, /\.cinematic-backdrop[\s\S]*?opacity: 0\.96;[\s\S]*?ellipse 31% 44%/, 'cinematic backdrop panes should stay visible around the portrait like the reference');
assert.match(styleSource, /\.horizon-glow[\s\S]*?top: 47\.8vh;[\s\S]*?height: 23\.5vh;[\s\S]*?opacity: 0\.92;/, 'reference-like horizontal window glow should stay readable behind the menu');
assert.match(source, /const broadWindowPanes: Array<\[number, number, string, number\]>/, 'background should use broad overexposed window blocks like the Detroit reference');
assert.match(source, /\[-70, 150, '#fbfeff', 0\.96\]/, 'background should keep a bright left window mass instead of narrow repeated stripes');
assert.match(source, /const windowPipes: Array<\[number, number, number\]>/, 'background should keep only a few soft vertical light pipes like the Detroit reference');
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

assert.ok(nativeClose(0) >= 0.09 && nativeClose(0) <= 0.15, 'open state should keep relaxed lids while staying distinct from a blink');
assert.ok(nativeClose(0.56) >= 0.62, 'half debug pose should visibly close the lids');
assert.equal(nativeClose(1), 1, 'closed debug pose should reach full native close');
assert.ok(
  eyeOpacity(nativeClose(1)) <= 0.02,
  'closed blink should fade the eye surface enough that the eyelid reads as closed'
);
assert.ok(blinkClosing >= 0.14 && blinkClosing <= 0.15, 'blink should close visibly instead of reading as a twitch');
assert.ok(blinkClosed >= 0.33 && blinkClosed <= 0.36, 'closed blink state should be held long enough for screenshots and perception');
assert.ok(blinkOpening >= 0.35 && blinkOpening <= 0.37, 'blink opening should be calm but not so slow that the eye looks like it is drifting');
assert.ok(defaultBlinkSpeed >= 0.82 && defaultBlinkSpeed <= 0.88, 'default blink speed should stay cinematic while remaining forceable');
assert.match(source, /Math\.random\(\) < 0\.025/, 'random double blinks should be rare enough to avoid nervous eye twitching');
assert.match(source, /living\.nextBlinkAt = time \+ rand\(3\.1, 6\.7\)/, 'natural blink cadence should not fire so often that it reads as jitter');
assert.ok(eyeTargetMaxX - eyeTargetMinX >= 0.02, 'idle eye gaze should have visible horizontal range without snapping');
assert.ok(eyeTargetMaxY - eyeTargetMinY >= 0.01, 'idle eye gaze should have visible vertical range without snapping');
assert.ok(nextSaccadeMin >= 6, 'idle gaze retargets should not twitch too frequently');
assert.ok(nextSaccadeMax >= 10, 'idle gaze should include calm held eye contact');

console.log('blink and facial regression checks passed');
