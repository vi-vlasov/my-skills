import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = await fs.readFile(new URL('./main.ts', import.meta.url), 'utf8');
const styleSource = await fs.readFile(new URL('./style.css', import.meta.url), 'utf8');
const htmlSource = await fs.readFile(new URL('./index.html', import.meta.url), 'utf8');
const nativeBlock = source.match(/const BLINK_NATIVE = \{([\s\S]*?)\};/);
const blinkDurationBlock = source.match(/const BLINK_PHASE_DURATION = \{([\s\S]*?)\};/);

assert.ok(nativeBlock, 'BLINK_NATIVE constants must exist');
assert.ok(blinkDurationBlock, 'blink phase duration constants must exist');

// No fake eye/catchlight, soft-lid stickers, or mouth patches: blink should be driven by Chloe's bones.
assert.doesNotMatch(source, /catchlightTexture|EyeCatchlight|eyeCatchlight/i, 'fake eye catchlight overlays must stay removed');
assert.doesNotMatch(source, /blinkVeilTexture|EyeBlinkVeil|eyeBlinkVeil/i, 'fake closed-eye veil overlays must stay removed');
assert.doesNotMatch(source, /softLid|soft lid|SpriteMaterial/i, 'soft eyelid sticker approach must stay removed');
assert.doesNotMatch(source, /mouthLineTexture|MouthLine|mouthLine/i, 'fake mouth-line overlays must stay removed');
assert.doesNotMatch(source, /Chloe_Lashes: cutout\('lashes\.png', \{ roughness: 0\.86/, 'lashes should not use the artificial matte/glass workaround');

// Keep only the calmer reference-mouth controls. No extra lip-bone mouth layer.
assert.match(source, /mouthRoot: pick\('Bip_FaceMouth'\)/, 'mouth root bone should stay rigged for native facial motion');
assert.match(source, /lipMidUpper: pick\('Bip_FaceLipMiUpOut', 'Bip_FaceLipMiUpIn'\)/, 'upper center lip bones should stay rigged');
assert.match(source, /lipMidLower: pick\('Bip_FaceLipMiLoOut', 'Bip_FaceLipMiLoIn'\)/, 'lower center lip bones should stay rigged');
assert.doesNotMatch(source, /function applyNativeMouth|applyNativeMouth\(/, 'extra native mouth lip-bone layer must stay removed');
assert.doesNotMatch(source, /const mouthOpen = THREE\.MathUtils\.clamp/, 'extra mouth-open driver must stay removed');
assert.doesNotMatch(source, /document\.body\.dataset\.facialMouthOpen/, 'removed mouth-open layer should not expose stale visual state');
assert.match(source, /const cornerUpL = -0\.000026 \* liftL/, 'mouth smile lift should stay calmer than the swollen-lip pass');
assert.match(source, /const cornerOutL = 0\.000009 \* liftL/, 'mouth corner widening should stay restrained like the reference');
assert.match(source, /const cheekLiftL = -0\.000012 \* liftL/, 'cheek lift should stay restrained so lips do not look inflated');
assert.match(source, /const smile = THREE\.MathUtils\.clamp\(0\.14 \+ expressiveMouth \* 0\.38/, 'menu expression should use the calmer reference smile driver');
assert.match(source, /const smileAsym = expressionAsym \* 0\.46/, 'smile asymmetry should stay restrained after removing mouth deformation');
assert.match(source, /const jawOpen = 0\.007 \+ expressiveMouth \* 0\.03/, 'jaw opening should stay subtle and not puff the lips');
assert.match(source, /setBoneRotationDeltas\(rig, rig\.upperLip, -expressiveMouth \* 0\.012/, 'upper lip should stay on the calmer simple driver');
assert.match(source, /living\.mouthTarget = rand\(-0\.022, 0\.026\)/, 'idle mouth drift should stay small enough to avoid swollen lips');
assert.match(source, /function createChloeFaceTexture\(\)/, 'face material should have a texture-level lip calming pass');
assert.match(source, /document\.body\.dataset\.faceTextureReady = 'calmed-lips'/, 'lip calming pass should expose a visual-test readiness flag');
assert.doesNotMatch(source, /toneFaceHairRoots|hairRootShade|liftFaceHairRootPixels|darkWarmRoot/, 'hair toning must not paint broad or masked regions onto the face texture');
assert.match(source, /Chloe_Teeth:[\s\S]*?roughness: 0\.8,[\s\S]*?envMapIntensity: 0\.075,[\s\S]*?color: new THREE\.Color\(0\.72, 0\.68, 0\.62\)/, 'teeth material should be back on the neutral native-mouth setting');

// Native blink/gaze should remain, but without overlay sprites.
assert.doesNotMatch(source, /blink\s*\*\s*0\.72/, 'blink close strength must not be capped at 72%');
assert.match(source, /blinkHold < 0\.2/, 'eye drift should be held while the blink is closing');
assert.match(source, /eyeTargetX = THREE\.MathUtils\.damp\(living\.eyeTargetX, living\.eyeDriftX/, 'eye target should be pulled to the held drift during blink');
assert.match(source, /function smootherStep01\(value\)/, 'blink states should use eased motion instead of jerky linear eye snaps');
assert.match(source, /function setBlinkSpeed\(speed\) \{[\s\S]*?living\.blinkSpeed = THREE\.MathUtils\.clamp\(speed, 0\.35, 3\.2\)/, 'blink speed should stay forceable for visual tests');
assert.match(source, /if \(typeof detail\.speed === 'number'\) setBlinkSpeed\(detail\.speed\)/, 'blink debug events should still control blink speed');
assert.match(source, /document\.body\.dataset\.blinkMode = 'animate'/, 'forced blink animation should expose animate mode for screenshot-state checks');
assert.match(source, /living\.eyeDriftX \* 1\.35/, 'idle gaze should remain readable on the portrait');
assert.match(source, /attentiveLookX \* -1\.75/, 'eye yaw should remain strong enough to create eye-contact movement');
assert.match(source, /restClose: 0\.18/, 'open eyes should be less widened and closer to the reference');
assert.match(source, /maxClose: 0\.72/, 'closed blink should stop before the Chloe rig folds into broken eyelid geometry');
assert.match(source, /rigCloseScale: 0\.42/, 'native eyelid rig should default to a partial blink that avoids broken closed-lid geometry');
assert.match(source, /const BLINK_RIG_OPEN = \{[\s\S]*?upper: 1\.15,[\s\S]*?cover: 0\.48,[\s\S]*?lower: 0\.58/, 'open eyes should use a less-expanded tested bone pose');
assert.match(source, /const blinkRigDebug = \{[\s\S]*?upper: 0\.2,[\s\S]*?cover: 2,[\s\S]*?lower: 2,[\s\S]*?fold: 0\.24,[\s\S]*?twist: 0/, 'bone blink should default to the tested blink-cover pose');
assert.match(source, /closedEyeOpacity: 1/, 'closed blink should keep the native eye surface visible instead of hiding it');
assert.match(source, /closedLashOpacity: 1/, 'native lashes should remain visible during the partial blink');
assert.match(source, /closedDuctOpacity: 1/, 'tear duct material should remain visible during the partial blink');
assert.match(source, /const rigClose = close \* blinkRigDebug\.scale/, 'native eyelid deformation should be controlled by bone tuning');
assert.match(source, /const blinkPose = smootherStep01\(\(close - BLINK_NATIVE\.restClose\) \/ \(BLINK_NATIVE\.maxClose - BLINK_NATIVE\.restClose\)\)/, 'blink should blend from open pose to blink pose');
assert.match(source, /const rigUpper = THREE\.MathUtils\.lerp\(BLINK_RIG_OPEN\.upper, blinkRigDebug\.upper, blinkPose\)/, 'upper lid should interpolate between open and blink poses');
assert.match(source, /const rigCover = THREE\.MathUtils\.lerp\(BLINK_RIG_OPEN\.cover, blinkRigDebug\.cover, blinkPose\)/, 'eye cover should interpolate between open and blink poses');
assert.match(source, /const rigLower = THREE\.MathUtils\.lerp\(BLINK_RIG_OPEN\.lower, blinkRigDebug\.lower, blinkPose\)/, 'lower lid should interpolate between open and blink poses');
assert.match(source, /BLINK_NATIVE\.upperDrop \* rigClose \* rigUpper/, 'upper lid close should use the interpolated bone pose');
assert.match(source, /BLINK_NATIVE\.lowerRise \* rigClose \* rigLower/, 'lower lid close should use the interpolated bone pose');
assert.match(source, /const twist = rigClose \* blinkRigDebug\.twist/, 'eyelid twist should be tunable to avoid broken triangles');
assert.match(source, /document\.body\.dataset\.blinkRigClose = rigClose\.toFixed\(3\)/, 'debug readout should expose reduced native rig closure');
assert.match(source, /document\.body\.dataset\.blinkRigBlend = blinkPose\.toFixed\(3\)/, 'debug readout should expose open-to-blink blend progress');
assert.match(source, /document\.body\.dataset\.blinkRigOpen = `\$\{BLINK_RIG_OPEN\.upper\.toFixed\(2\)\}/, 'debug readout should expose the fixed open pose');
assert.match(source, /document\.body\.dataset\.blinkRigTarget = `\$\{blinkRigDebug\.scale\.toFixed\(2\)\}\/\$\{blinkRigDebug\.upper\.toFixed\(2\)\}\/\$\{blinkRigDebug\.cover\.toFixed\(2\)\}/, 'debug readout should expose the blink target pose');
assert.match(source, /document\.body\.dataset\.blinkRigTune = `\$\{blinkRigDebug\.scale\.toFixed\(2\)\}\/\$\{rigUpper\.toFixed\(2\)\}\/\$\{rigCover\.toFixed\(2\)\}/, 'debug readout should expose the live blended bone tuning');
assert.match(source, /const CAM_Z = 0\.84/, 'portrait camera should sit a little farther back like the reference composition');
assert.match(source, /function createChloeEyeTexture\(\)/, 'eye material should use an enhanced native atlas instead of the raw blurry iris pixels');
assert.match(source, /const texture = new THREE\.CanvasTexture\(canvas\)/, 'procedural eye detail should be a material texture, not a screen overlay');
assert.match(source, /source\.src = 'assets\/chloe\/eye_alb\.jpg'/, 'enhanced eye atlas should preserve Chloe eye UV layout');
assert.match(source, /Chloe_Eyes:[\s\S]*?map: createChloeEyeTexture\(\),[\s\S]*?normalScale: new THREE\.Vector2\(0\.12, 0\.12\),[\s\S]*?roughness: 0\.82,[\s\S]*?envMapIntensity: 0\.008/, 'eye material should stay detailed but less glassy');
assert.match(source, /color: new THREE\.Color\(1, 1, 1\)/, 'iris texture should not be muted by a gray-blue material tint');
assert.match(source, /Chloe_Lashes: cutout\('lashes\.png', \{[\s\S]*?alphaTest: 0\.42,[\s\S]*?envMapIntensity: 0\.045,[\s\S]*?depthWrite: false/, 'lashes should be cleaner and non-depth-writing so they do not tear through closed lids');
assert.match(source, /Chloe_Duct: new THREE\.MeshStandardMaterial\(\{[\s\S]*?transparent: true,[\s\S]*?roughness: 0\.82,[\s\S]*?envMapIntensity: 0\.025/, 'tear duct material should stay matte while remaining visible in the partial blink');
assert.match(source, /if \(name === 'Chloe_Lashes'\) headGroup\.userData\.lashMats = \[obj\.material\]/, 'native lash material should be tracked for blink telemetry');
assert.match(source, /if \(name\.startsWith\('Chloe_Duct'\)\) headGroup\.userData\.ductMats = \[obj\.material\]/, 'tear duct material should be tracked for blink telemetry');
assert.match(source, /applyLashBlinkVisibility\(headGroup\.userData\.lashMats, blinkClose\)/, 'blink loop should keep native lashes in sync with the partial blink state');
assert.match(source, /applyDuctBlinkVisibility\(headGroup\.userData\.ductMats, blinkClose\)/, 'blink loop should keep tear ducts in sync with the partial blink state');
assert.match(source, /function setBlinkRigDebug\(detail\)/, 'debug panel should be able to tune eyelid bones live');
assert.match(source, /window\.addEventListener\('portrait:blink-rig-debug'/, 'bone tuning should also be scriptable for screenshot experiments');
assert.match(source, /const debugRigInputs = \[\.\.\.document\.querySelectorAll<HTMLInputElement>\('\[data-rig-param\]'\)\]/, 'debug rig sliders should be wired');
assert.match(source, /if \(detail\.immediate === true\) living\.eyeDriftX = living\.eyeTargetX;/, 'gaze debug should avoid snapping the eyes unless an immediate pose is requested');
assert.match(source, /living\.eyeDriftX = THREE\.MathUtils\.damp\(living\.eyeDriftX, living\.eyeTargetX, 0\.74, dt\)/, 'gaze drift should move calmly rather than twitching');
assert.match(source, /import \{ ShaderPass \} from 'three\/addons\/postprocessing\/ShaderPass\.js'/, 'portrait should use a postprocess shader pass for anti-aliasing');
assert.match(source, /const SoftFXAAShader = \{[\s\S]*?name: 'ChloeSoftFXAA'/, 'smoothing should be a named soft FXAA pass, not a CSS blur workaround');
assert.match(source, /const fxaaPass = new ShaderPass\(SoftFXAAShader\);[\s\S]*?composer\.addPass\(fxaaPass\);[\s\S]*?composer\.addPass\(new OutputPass\(\)\)/, 'FXAA should run after bloom and before output');
assert.match(source, /function syncFxaaResolution\(\)[\s\S]*?renderer\.getDrawingBufferSize\(size\)[\s\S]*?fxaaPass\.uniforms\.resolution\.value\.set\(1 \/ size\.x, 1 \/ size\.y\)/, 'FXAA resolution should track the real drawing buffer');
assert.match(source, /document\.body\.dataset\.fxaaResolution = `\$\{Math\.round\(size\.x\)\}x\$\{Math\.round\(size\.y\)\}`/, 'visual tests should be able to confirm FXAA sizing');
assert.match(htmlSource, /<aside class="debug-panel" id="debug-panel" aria-label="Debug controls">/, 'debug panel should be present for manual portrait testing');
assert.match(htmlSource, /data-blink-mode="closed"/, 'debug panel should expose a closed-eye state button');
assert.match(htmlSource, /id="debug-blink-speed" type="range"/, 'debug panel should expose blink speed control');
assert.match(htmlSource, /data-rig-param="upper"/, 'debug panel should expose upper lid bone tuning');
assert.match(htmlSource, /data-rig-param="cover" type="range" min="0\.2" max="2\.2" step="0\.01" value="2"/, 'debug panel should default cover to the blink target pose');
assert.match(htmlSource, /data-rig-param="lower"/, 'debug panel should expose lower lid bone tuning');
assert.match(htmlSource, /data-rig-param="lower" type="range" min="0\.2" max="2\.6" step="0\.01" value="2"/, 'debug panel should default lower lid to the blink target pose');
assert.match(htmlSource, /data-rig-param="fold"/, 'debug panel should expose eyelid fold tuning');
assert.match(htmlSource, /data-rig-param="twist"/, 'debug panel should expose eyelid twist tuning');
assert.match(htmlSource, /data-gaze-x="0" data-gaze-y="0"/, 'debug panel should expose a centered gaze button');
assert.match(styleSource, /\.debug-panel[\s\S]*?z-index: 8;[\s\S]*?backdrop-filter: blur\(18px\) saturate\(1\.08\)/, 'debug panel should stay visible above the portrait without replacing the menu');
assert.match(source, /function syncDebugControls\(\)/, 'debug panel should mirror live blink and material telemetry');
assert.match(source, /function setupDebugPanel\(\)/, 'debug panel should wire controls to the portrait state');

// Preserve the existing scene work outside the eye/mouth rollback.
assert.match(source, /const cutout = \(map, opts = \{\}\) =>[\s\S]*?map: tex\(A \+ map, true\)/, 'cutout materials should stay on the old direct texture setup');
assert.doesNotMatch(source, /function createChloeHairTexture\(\)/, 'hair should not use a dark canvas tone pass that creates forehead card shadows');
assert.match(source, /Chloe_Hair:[\s\S]*?alphaTest: 0\.28,[\s\S]*?roughness: 0\.84,[\s\S]*?envMapIntensity: 0\.18,[\s\S]*?color: new THREE\.Color\(0\.9, 0\.82, 0\.68\)/, 'hair should match the older warm blonde material from the good commits');
assert.match(source, /Chloe_Brows:[\s\S]*?roughness: 0\.58,[\s\S]*?envMapIntensity: 0\.28,[\s\S]*?color: new THREE\.Color\(0\.7, 0\.57, 0\.48\)/, 'brows should stay warm enough to match the reference face');
assert.match(source, /renderer\.toneMappingExposure = 0\.93/, 'renderer exposure should keep the bright studio portrait look');
assert.match(source, /scene\.environmentIntensity = 0\.46/, 'environment lighting should preserve face depth instead of flattening skin');
assert.match(source, /const fill = new THREE\.DirectionalLight\(0xd8efff, 0\.78\)/, 'cool fill should leave enough cheek and nose depth');
assert.match(source, /const rimL = new THREE\.DirectionalLight\(0xe9f7ff, 1\.02\)/, 'left rim should not bleach the hair white');
assert.match(source, /const rimR = new THREE\.DirectionalLight\(0xf7fdff, 0\.86\)/, 'right rim should not bleach the hair white');
assert.match(source, /specularIntensity: 0\.15,[\s\S]*?clearcoat: 0\.032,[\s\S]*?clearcoatRoughness: 0\.76/, 'skin should stay soft rather than waxy');
assert.match(source, /envMapIntensity: 0\.27,[\s\S]*?color: new THREE\.Color\(1\.045, 0\.995, 0\.965\)/, 'skin should stay pale but less glossy around lips');
assert.match(source, /const portraitFill = new THREE\.PointLight\(0xeaf7ff, 0\.36, 1\.35, 2\.0\)/, 'portrait should keep a reference-like front fill without washing out facial depth');
assert.match(htmlSource, /<div class="camera-diffusion" aria-hidden="true"><\/div>/, 'camera diffusion layer should soften the CG render without affecting menu markup');
assert.match(styleSource, /\.camera-diffusion[\s\S]*?z-index: 2;[\s\S]*?backdrop-filter: blur\(0\.18px\) saturate\(1\.02\) contrast\(1\.006\);[\s\S]*?opacity: 0\.42;/, 'camera diffusion should stay subtle while preserving eye detail below the HUD/menu');
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
const rigCloseScale = numberFor('rigCloseScale');
const closedEyeOpacity = numberFor('closedEyeOpacity');
const closedLashOpacity = numberFor('closedLashOpacity');
const closedDuctOpacity = numberFor('closedDuctOpacity');
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
  const hide = smoothstep(clamp(close, 0, 1), 0.14, maxClose);
  return 1 - hide * (1 - closedEyeOpacity);
}

assert.ok(nativeClose(0) >= 0.17 && nativeClose(0) <= 0.19, 'open state should keep the eyes less widened while staying distinct from a blink');
assert.ok(nativeClose(0.56) >= 0.58, 'half debug pose should visibly close the lids under the safer closed-lid limit');
assert.ok(nativeClose(1) >= 0.7 && nativeClose(1) <= 0.73, 'closed debug pose should stop at the clean native-lid limit');
assert.ok(nativeClose(1) * rigCloseScale >= 0.29 && nativeClose(1) * rigCloseScale <= 0.31, 'native rig closure should stay partial so the blink does not fold into broken eyelids');
assert.ok(eyeOpacity(nativeClose(1)) >= 0.99 && eyeOpacity(nativeClose(1)) <= 1, 'closed blink should keep the eye surface visible for a partial blink');
assert.equal(closedLashOpacity, 1, 'partial blink should keep native lashes visible');
assert.equal(closedDuctOpacity, 1, 'partial blink should keep tear ducts visible');
assert.ok(blinkClosing >= 0.07 && blinkClosing <= 0.08, 'blink should close quickly like a natural eyelid snap');
assert.ok(blinkClosed >= 0.05 && blinkClosed <= 0.06, 'natural blink closed hold should be brief; the debug closed pose provides inspection time');
assert.ok(blinkOpening >= 0.1 && blinkOpening <= 0.12, 'blink opening should be calm but not slow enough to look like drifting');
assert.ok(defaultBlinkSpeed >= 1.04 && defaultBlinkSpeed <= 1.12, 'default blink speed should be natural while remaining forceable');
assert.match(source, /Math\.random\(\) < 0\.025/, 'random double blinks should be rare enough to avoid nervous eye twitching');
assert.match(source, /living\.nextBlinkAt = time \+ rand\(3\.1, 6\.7\)/, 'natural blink cadence should not fire so often that it reads as jitter');
assert.ok(eyeTargetMaxX - eyeTargetMinX >= 0.02, 'idle eye gaze should have visible horizontal range without snapping');
assert.ok(eyeTargetMaxY - eyeTargetMinY >= 0.01, 'idle eye gaze should have visible vertical range without snapping');
assert.ok(nextSaccadeMin >= 6, 'idle gaze retargets should not twitch too frequently');
assert.ok(nextSaccadeMax >= 10, 'idle gaze should include calm held eye contact');

console.log('partial bone blink, debug panel, eye material, and mouth regression checks passed');
