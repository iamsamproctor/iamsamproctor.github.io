import * as THREE from "three";
import { SparkRenderer, SplatMesh, dyno } from "@sparkjsdev/spark";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { createTextReveal, revealOnEnter } from "./textReveal.js";
import { createLoadingScreen } from "./loadingScreen.js";
import { createRevealBurn } from "./revealBurn.js";
import { createWorkModal } from "./workModal.js";
import { createWindScroll } from "./windScroll.js";
import { createBackgroundMusic } from "./backgroundMusic.js";
import { setRevealSoundEnabled } from "./revealSound.js";
import {
  setImpactSoundEnabled,
  playImpactSound,
  startChargeSound,
  stopChargeSound,
} from "./impactSound.js";
import { createHallway } from "./hallway.js";
import { createMuseumVisitor } from "./museumVisitor.js";
import { createAboutPortrait } from "./aboutPortrait.js";
import { createHallwayQuote } from "./hallwayQuote.js";
import { addDustDevil } from "./dustDevil.js";
import { createChromeBlob } from "./chromeBlob.js";
import { createSplatShockwave } from "./splatShockwave.js";
import { createSplatCharge } from "./splatCharge.js";
import { createSplatRipples } from "./splatRipples.js";
import { createSplatSparkle } from "./splatSparkle.js";
import { createGameMenu } from "./gameMenu.js";
import quotes from "./quotes.json";

const revealBurn = createRevealBurn();
const windScroll = createWindScroll();
const backgroundMusic = createBackgroundMusic();

const heroHeadingTitleEl = document.querySelector(".hero-heading h2");
const heroHeadingSubEl = document.querySelector(".hero-heading p");
const heroHeadingReveal = heroHeadingTitleEl
  ? createTextReveal(heroHeadingTitleEl, { lockWidths: true })
  : null;

const audioToggleEl = document.querySelector(".audio-toggle");

// Both start/enable calls must happen inside a click, which is why this is
// only ever called from the Enter button or the toggle itself.
function setAudio(on, { fadeSeconds = 1.5 } = {}) {
  audioToggleEl?.setAttribute("aria-pressed", String(on));
  setRevealSoundEnabled(on);
  setImpactSoundEnabled(on);
  if (on) {
    windScroll.enable();
    backgroundMusic.start();
    if (fadeSeconds) backgroundMusic.fadeIn(fadeSeconds);
  } else {
    windScroll.disable();
    backgroundMusic.stop();
  }
}

audioToggleEl?.addEventListener("click", () => {
  setAudio(audioToggleEl.getAttribute("aria-pressed") !== "true");
});

const loadingScreen = createLoadingScreen({
  assets: [
    { id: "environment", bytes: 2359717 },
  ],
  // Starts the music silently; the longer fade below begins with the burn.
  onEnterWithAudio: () => setAudio(true, { fadeSeconds: 0 }),
  onEnter: () => {
    // No-op if they entered without audio, since start() never ran.
    backgroundMusic.fadeIn(4);
    revealBurn.play({
      onReveal: () => {
        document.body.classList.remove("is-loading");
        heroHeadingReveal?.play();
        // Let the title's scramble read as the lead beat before the
        // subtext settles in underneath it, rather than both landing at once.
        setTimeout(() => heroHeadingSubEl?.classList.add("is-visible"), 550);
        scheduleMuseumVisitor();
      },
    });
  },
});

const debugMode = new URLSearchParams(window.location.search).has("debug");
const realReflection = new URLSearchParams(window.location.search).has("realreflection");
// With realReflection, how often the blob's reflection is recaptured so it
// keeps up with the scene. Each recapture redraws every splat six times, so
// it's skipped on touch devices (assumed weaker GPUs; see isTouchDevice),
// which keep the reflection captured at load.
const reflectionRefreshSeconds = 0.2;
let lastReflectionRefresh = 0;

// ?fonts: temporary picker for trying heading fonts on the real hero.
if (new URLSearchParams(window.location.search).has("fonts") && heroHeadingTitleEl) {
  import("./fontPreview.js").then(({ createFontPreview }) =>
    createFontPreview(heroHeadingTitleEl, heroHeadingReveal),
  );
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 1, 3);
camera.rotation.order = "YXZ";
camera.rotation.x = THREE.MathUtils.degToRad(-60);

const orbitCenter = new THREE.Vector3(0, 0.0, 0);
const orbitRadius = 4;
// Low over the desert floor for a cinematic opening. Much below 0.3 the camera
// starts passing through the scan's splats.
const orbitHeight = 0.4;
const orbitSpeed = THREE.MathUtils.degToRad(1); // radians per second
let orbitAngle = 0;

// Point the camera dollies out to as the user scrolls, continuing to orbit
// around whichever point is currently active: high and far out, looking
// down at the scene from a distance rather than straight overhead.
const skyCenter = new THREE.Vector3(0, 0, 0);
const skyRadius = 12;
const skyHeight = 3.6;

const orbitKeyframes = [
  { center: orbitCenter, radius: orbitRadius, height: orbitHeight },
  { center: skyCenter, radius: skyRadius, height: skyHeight },
];

const activeCenter = orbitCenter.clone();
let activeRadius = orbitRadius;
let activeHeight = orbitHeight;

let scrollProgress = 0; // raw 0-1 across the camera keyframe sequence
let scrollBlend = 0; // smoothed toward scrollProgress each frame
const cameraScrollRange = 1500; // px of scroll to move through all camera keyframes
const scrollBlendSmoothing = 1.5; // rate scrollBlend chases scrollProgress; lower = more lag/slower dolly

const heroHeadingEl = document.querySelector(".hero-heading");
// The hero heading stays put in the corner like a title card. As the camera
// starts to pull away, the subtitle fades and the title scrambles back out,
// the reverse of its intro; scrolling back up scrambles it in again.
const heroSubFadeEnd = 250; // px of scroll the subtitle is gone by
const heroScrambleEnd = 700; // px of scroll the title is fully scrambled out by
const heroDrift = 24; // px it rises over that span, for a little parallax
let heroRevealAmount = 1; // last value handed to heroHeadingReveal.scrub

// Past the last camera keyframe (the sky point), continuing to scroll pulls
// back from the splat scene to reveal it as a portrait at the end of a
// hallway (see hallway.js), retreating down the hallway to a resting view
// behind the bench, where the page ends and the menu button appears.
// Kept short so the menu arrives soon; scaled with hallway.js's END_DISTANCE,
// so the walk back keeps the same pace per px scrolled.
const hallwayScrollRange = 800; // px of scroll, after cameraScrollRange, for this phase
const hallwayBlendSmoothing = 3; // rate the hallway dolly chases scroll; lower = more lag
let hallwayProgress = 0; // raw 0-1
let hallwayBlend = 0; // smoothed toward hallwayProgress each frame

// The scroll-spacer exists purely to give the fixed scene and its transitions
// room to animate, and it's the whole page: scrolling ends where the hallway
// fades to black. Its height is that scroll distance plus one viewport, so
// the last px of scroll lands exactly at the end of the hallway.
const scrollSpacerEl = document.querySelector(".scroll-spacer");
function sizeScrollSpacer() {
  if (scrollSpacerEl) {
    scrollSpacerEl.style.height = `${cameraScrollRange + hallwayScrollRange + window.innerHeight}px`;
  }
}
sizeScrollSpacer();
window.addEventListener("resize", sizeScrollSpacer);

// Work and About live in a game-style menu modal that opens from a button at
// the end of the hallway (see gameMenu.js), with a project's details as its
// deepest screen (workModal.js). The right-side dots open them directly, and
// highlight whichever is open.
const sectionNavEl = document.querySelector(".section-nav");
const navButtons = sectionNavEl
  ? Array.from(sectionNavEl.querySelectorAll("button[data-section]"))
  : [];
const hallwayMenuShowAt = 0.92; // hallway progress at which the menu button appears
const workModal = createWorkModal({
  onOpen: (work) => gameMenu.setDetail(work.title),
  onClose: () => gameMenu.setDetail(null),
});
const gameMenu = createGameMenu({
  detail: workModal,
  onChange: (state) => {
    const activeId = state === "work" || state === "about" ? state : "hero";
    for (const button of navButtons) {
      button.classList.toggle("is-active", button.dataset.section === activeId);
    }
  },
  onBackToStart: () => window.scrollTo({ top: 0, behavior: "smooth" }),
});
for (const button of navButtons) {
  button.addEventListener("click", () => {
    const id = button.dataset.section;
    if (id === "hero") {
      gameMenu.close();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      gameMenu.open(id, { from: button });
    }
  });
}

// Scroll events on mobile can fire much more frequently than animation
// frames. The listener itself just records the raw value (cheap); the actual
// DOM writes below happen once per rendered frame in the animation loop, so
// they don't compete with WebGL rendering for main-thread time mid-scroll.
let latestScrollY = window.scrollY;
// The idle orbit keeps the camera constantly moving, which forces a fresh
// splat depth-sort every frame even when nothing else is happening. Freezing
// it for the duration of a scroll (plus a short settle delay) removes that
// extra motion during the exact moment mobile is already under load.
let isScrolling = false;
let scrollIdleTimer = null;
const scrollIdleDelay = 150; // ms of no scroll events before orbit resumes
function handleScroll() {
  latestScrollY = window.scrollY;
  isScrolling = true;
  clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    isScrolling = false;
  }, scrollIdleDelay);
}
window.addEventListener("scroll", handleScroll, { passive: true });
handleScroll();

function applyScrollEffects(scrollY) {
  scrollProgress = THREE.MathUtils.clamp(scrollY / cameraScrollRange, 0, 1);

  if (heroHeadingEl) {
    // Gated on is-loading rather than left to the CSS rule for it: this
    // element's opacity is also driven inline below, and an inline style
    // always wins over a class-based rule, so without this check it would
    // pop in the instant the loader is removed instead of waiting for the
    // reveal-burn's fade-in.
    if (document.body.classList.contains("is-loading")) {
      heroHeadingEl.style.opacity = "0";
    } else {
      const exitT = THREE.MathUtils.clamp(scrollY / heroScrambleEnd, 0, 1);
      // Only scrub on a change, so sitting at the top doesn't cut short the
      // intro scramble that plays on reveal.
      const revealAmount = 1 - exitT;
      if (revealAmount !== heroRevealAmount) {
        heroRevealAmount = revealAmount;
        heroHeadingReveal?.scrub(revealAmount);
      }
      // Left to the stylesheet at the top, so it doesn't override the
      // subtitle's own delayed fade-in after the title's intro.
      if (heroHeadingSubEl) {
        heroHeadingSubEl.style.opacity =
          scrollY > 0
            ? String(1 - THREE.MathUtils.smoothstep(scrollY, 0, heroSubFadeEnd))
            : "";
      }
      // Fully hidden past the end, so reduced-motion (where scrub is a no-op)
      // still clears it.
      heroHeadingEl.style.opacity = exitT >= 1 ? "0" : "1";
      heroHeadingEl.style.setProperty("--hero-scrim", String(1 - exitT));
      heroHeadingEl.style.transform = `translateY(${-exitT * heroDrift}px)`;
    }
  }

  hallwayProgress = THREE.MathUtils.clamp(
    (scrollY - cameraScrollRange) / hallwayScrollRange,
    0,
    1,
  );
}
applyScrollEffects(latestScrollY);
 
const maxYaw = THREE.MathUtils.degToRad(20);
const maxPitch = THREE.MathUtils.degToRad(20);
const cameraSmoothing = 0.2;
let targetYaw = 0;
let targetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;  

// Only a mouse steers the look. On touch screens every tap and scroll swipe
// reports a pointer position too, and with nothing to bring it back the view
// would stay turned toward wherever the finger last was.
window.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse") return;
  const horizontalPosition = THREE.MathUtils.clamp(
    (event.clientX / window.innerWidth) * 2 - 1,
    -1,
    1,
  );
  const verticalPosition = THREE.MathUtils.clamp(
    1 - (event.clientY / window.innerHeight) * 2,
    -1,
    1,
  );

  targetYaw = -horizontalPosition * maxYaw;
  targetPitch = verticalPosition * maxPitch;
});

window.addEventListener("pointerleave", () => {
  targetYaw = 0;
  targetPitch = 0;
});

// Splat rendering re-sorts and shades every splat each frame, so pixel count
// and antialiasing cost matter a lot more here than in a typical scene.
// Touch devices are assumed to be less powerful GPUs, so they get a lower
// pixel ratio and no MSAA to keep frame time down.
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
const renderer = new THREE.WebGLRenderer({ antialias: !isTouchDevice });
renderer.setPixelRatio(isTouchDevice ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector(".scene-window").appendChild(renderer.domElement);

const spark = new SparkRenderer({ renderer });
// Spark softens every splat by a fixed amount on screen (anti-aliasing) and
// draws each as a soft Gaussian. Invisible on ordinary splats, but it smears
// the sparkle effect's pinpoint stars into dim, out-of-focus blobs, so both
// ease toward sharp while the scene is stars (see the animation loop).
const splatBlurNormal = spark.blurAmount;
const splatFalloffNormal = spark.falloff;
const splatBlurStars = 0.04;
const splatFalloffStars = 0.55; // firmer-edged points rather than soft blobs

const hallway = createHallway({
  renderer,
  works: Array.from(document.querySelectorAll(".work-cell img")).map((img) => ({
    src: img.getAttribute("src"),
  })),
});
hallway.setSize(window.innerWidth, window.innerHeight);

const hallwayQuoteEl = document.querySelector(".hallway-quote");
const hallwayQuote = hallwayQuoteEl ? createHallwayQuote(hallwayQuoteEl, quotes) : null;

// Someone on a bench partway down the hallway, watching the portrait. The
// camera starts in front of them and pulls back over them; since it faces
// the portrait, their head stays below and behind the view until it's past
// them, so they can sit dead center. The figure is a large file, so it isn't
// part of the initial load. It's fetched once the landing scene has settled
// (or on the first scroll, if that comes sooner), so that parsing it, which
// briefly blocks the page, is less likely to land mid-scroll near the hallway.
const museumVisitor = createMuseumVisitor({ url: "/assets/animations/sitting-idle.fbx" });
museumVisitor.group.position.set(0, 0, 4.5);
hallway.scene.add(museumVisitor.group);
const museumVisitorDelay = 2500; // ms after the reveal before fetching when idle
let museumVisitorRequested = false;
function loadMuseumVisitor() {
  if (museumVisitorRequested) return;
  museumVisitorRequested = true;
  // Its shaders and textures are new to the hallway, so warm it up again.
  museumVisitor.load().then(() => hallway.warmUp(scene, camera));
}
function scheduleMuseumVisitor() {
  setTimeout(() => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadMuseumVisitor, { timeout: 2000 });
    } else {
      loadMuseumVisitor();
    }
  }, museumVisitorDelay);
}
scene.add(spark);

const environmentSplat = new SplatMesh({
  url: "/assets/splats/cholla.spz",
  onProgress: (event) =>
    loadingScreen.report("environment", event.loaded, event.total),
});
environmentSplat.position.set(-1, 0, 2);
environmentSplat.rotation.z = THREE.MathUtils.degToRad(180); // adjust to rotate the splat
environmentSplat.rotation.y = THREE.MathUtils.degToRad(180); 
scene.add(environmentSplat);

// Waves shader effect: pulses color and displaces splats along a sine field
// over time, adapted from https://github.com/sparkjsdev/spark/blob/main/examples/splat-shader-effects/index.html
const waveTime = dyno.dynoFloat(0);
const waveIntensity = dyno.dynoFloat(2);
const cursorLocalPos = dyno.dynoVec3(new THREE.Vector3());
const cursorInfluence = dyno.dynoFloat(0);
const cursorRadius = dyno.dynoFloat(0.9);
const scaleAmplitude = dyno.dynoFloat(0.3);
const scaleSpeed = dyno.dynoFloat(2.0);
environmentSplat.objectModifier = dyno.dynoBlock(
  { gsplat: dyno.Gsplat },
  { gsplat: dyno.Gsplat },
  ({ gsplat }) => {
    const d = new dyno.Dyno({
      inTypes: {
        gsplat: dyno.Gsplat,
        t: "float",
        intensity: "float",
        cursor: "vec3",
        cursorInfluence: "float",
        cursorRadius: "float",
        scaleAmplitude: "float",
        scaleSpeed: "float",
      },
      outTypes: { gsplat: dyno.Gsplat },
      globals: () => [
        dyno.unindent(/* glsl */ `
          vec4 sin3D(vec3 p, float t) {
            float m = exp(-2. * length(sin(p * 5. + t * 0.05))) * 5.;
            return vec4(m) + .3;
          }
        `),
      ],
      statements: ({ inputs, outputs }) => dyno.unindentLines(/* glsl */ `
        ${outputs.gsplat} = ${inputs.gsplat};

        vec3 localPos = ${inputs.gsplat}.center;
        vec4 splatColor = ${inputs.gsplat}.rgba;
        vec4 effect = sin3D(localPos, ${inputs.t});

        float dist = length(localPos - ${inputs.cursor});
        float falloff = 1. - smoothstep(0., ${inputs.cursorRadius}, dist);
        float amount = ${inputs.intensity} * falloff * ${inputs.cursorInfluence};

        ${outputs.gsplat}.rgba.rgba = mix(splatColor, splatColor * effect, amount);

        vec3 pos = localPos;
        pos.y += 1.;
        pos *= (1. + effect.x * .05 * amount);
        pos.y -= 1.;
        ${outputs.gsplat}.center = pos;

        float scalePhase = dot(localPos, vec3(1.3, 0.7, 1.9));
        float scalePulse = 1. + ${inputs.scaleAmplitude} * sin(${inputs.t} * ${inputs.scaleSpeed} + scalePhase);
        ${outputs.gsplat}.scales = ${inputs.gsplat}.scales * scalePulse;
      `),
    });

    gsplat = d.apply({
      gsplat,
      t: waveTime,
      intensity: waveIntensity,
      cursor: cursorLocalPos,
      cursorInfluence,
      cursorRadius,
      scaleAmplitude,
      scaleSpeed,
    }).gsplat;
    return { gsplat };
  },
);
environmentSplat.updateGenerator();

// Home point sits on the desert floor at the center of the opening orbit.
// Set dustDevilEnabled to false to switch the effect off; it still runs its
// gentle wander, which the chrome blob follows.
const dustDevilEnabled = false;
const shockwave = createSplatShockwave();
// Holding the pointer down on the desert charges the splats there; letting
// go sends the shockwave out from that spot (see the pointer handlers below).
const splatCharge = createSplatCharge();
// Moving the pointer over the desert ripples the ground like water.
const ripples = createSplatRipples();
const desertFloorY = -0.7;
ripples.setGround(desertFloorY);
// The sparkle effect: every so often the splats shrink to pinpoints and the
// scene becomes stars.
const sparkle = createSplatSparkle();
const dustDevil = addDustDevil(environmentSplat, {
  home: new THREE.Vector3(0, desertFloorY, 0),
  stages: [sparkle.apply, splatCharge.apply, ripples.apply, shockwave.apply],
});
dustDevil.setStrength(dustDevilEnabled ? 1 : 0);

environmentSplat.initialized.then(() => loadingScreen.finish());

// Liquid-chrome blob floating where the dust devil would carry it. It reflects a
// snapshot of the scene captured once the environment has loaded.
// Set chromeBlobEnabled to false to switch it off (?chromeball turns it back
// on for a look). When off it's never added to the scene or given a
// reflection, so it costs nothing and can't be tapped; it still tracks its
// position, since the sparkle spreads out from where it would be.
const chromeBlobEnabled =
  false || new URLSearchParams(window.location.search).has("chromeball");
const chromeBlob = createChromeBlob();
const chromeBlobLift = 1.25; // world units above the dust devil's base
// Extra height it floats up by as the camera zooms out, following the same
// smoothed scroll as the camera so the two move together.
const chromeBlobScrollRise = 1.5;
const chromeBlobAnchor = new THREE.Vector3();
if (chromeBlobEnabled) scene.add(chromeBlob.mesh);
function updateChromeBlob(seconds) {
  if (chargeTarget === "blob") chromeBlob.setCharge(chargeAmount());
  chromeBlobAnchor.copy(dustDevil.center);
  chromeBlobAnchor.y +=
    chromeBlobLift +
    chromeBlobScrollRise * THREE.MathUtils.smoothstep(scrollBlend, 0, 1);
  chromeBlob.update(seconds, chromeBlobAnchor);
}
environmentSplat.initialized.then(async () => {
  updateChromeBlob(performance.now() / 1000);
  if (chromeBlobEnabled) {
    // Settle the dust so the reflection is of the clean desert, not of the
    // puffs swirling right around the blob.
    dustDevil.setStrength(0);
    environmentSplat.updateVersion();
    // Splat regeneration is asynchronous; give it a few frames to land.
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      // ?realreflection: try a true reflection from the blob's position (see
      // chromeBlob.js), for comparing against the default.
      await chromeBlob.captureEnvironment(renderer, scene, camera, {
        real: realReflection,
      });
    } finally {
      dustDevil.setStrength(dustDevilEnabled ? 1 : 0);
    }
  }
  // After the capture, since giving the blob its reflection changes its
  // shader, and the blob is drawn into the hallway's portrait too.
  hallway.warmUp(scene, camera);
});

// Tapping the blob makes it wobble, sends a shockwave out through the
// desert, and plays a quiet impact. Only while the landing scene itself is
// on screen, not once it has become the hallway portrait.
const blobRaycaster = new THREE.Raycaster();
const blobPointer = new THREE.Vector2();
function pointerIsOnBlob(event) {
  if (!chromeBlob.mesh.visible || hallwayBlend > 0 || debugMode) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  blobPointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  blobRaycaster.setFromCamera(blobPointer, camera);
  return blobRaycaster.intersectObject(chromeBlob.mesh, false).length > 0;
}
renderer.domElement.addEventListener("pointermove", (event) => {
  if (hallwayBlend <= 0 && !debugMode) {
    const rect = renderer.domElement.getBoundingClientRect();
    ripples.pointerMoved(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
      camera,
      performance.now() / 1000,
    );
  }
  renderer.domElement.style.cursor = pointerIsOnBlob(event) ? "pointer" : "";
});
// Holding the blob, or anywhere on the desert, charges it up (the blob draws
// in and shivers; the splats under the pointer gather, shiver, and glow);
// letting go releases a bigger, louder shockwave the longer it was held. A
// quick tap is the plain impact.
const CHARGE_SECONDS = 2;
let chargeStart = null;
let chargeTarget = null; // "blob" or "splats" while held
const chargeOrigin = new THREE.Vector3(); // where on the ground, for "splats"
const groundRaycaster = new THREE.Raycaster();
const groundPointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -desertFloorY);
const groundMaxDistance = 25; // ignore hits out toward the horizon
// Where on the desert floor the pointer is, into `out`; false if it's
// pointing at the sky or too far away.
function pointerGroundPoint(event, out) {
  const rect = renderer.domElement.getBoundingClientRect();
  groundPointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  groundRaycaster.setFromCamera(groundPointer, camera);
  if (!groundRaycaster.ray.intersectPlane(groundPlane, out)) return false;
  return out.distanceTo(camera.position) <= groundMaxDistance;
}
function chargeAmount() {
  if (chargeStart === null) return 0;
  const held = performance.now() / 1000 - chargeStart;
  return THREE.MathUtils.smoothstep(held / CHARGE_SECONDS, 0, 1);
}
function endCharge() {
  chargeStart = null;
  chargeTarget = null;
  stopChargeSound();
  chromeBlob.setCharge(0);
  splatCharge.release();
}
function releaseCharge() {
  if (chargeStart === null) return;
  const power = chargeAmount();
  const target = chargeTarget;
  endCharge();
  const seconds = performance.now() / 1000;
  const origin = target === "blob" ? chromeBlob.mesh.position : chargeOrigin;
  if (target === "blob") chromeBlob.hit(seconds, power);
  shockwave.trigger(origin, seconds, power);
  // Quieter the further away it went off.
  playImpactSound(power, camera.position.distanceTo(origin));
}
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (pointerIsOnBlob(event)) {
    chargeTarget = "blob";
  } else if (
    hallwayBlend <= 0 &&
    !debugMode &&
    !document.body.classList.contains("is-loading") &&
    pointerGroundPoint(event, chargeOrigin)
  ) {
    chargeTarget = "splats";
    splatCharge.set(chargeOrigin, 0);
  } else {
    return;
  }
  chargeStart = performance.now() / 1000;
  startChargeSound(CHARGE_SECONDS);
});
window.addEventListener("pointerup", releaseCharge);
// e.g. a touch that turns into a scroll: no blast.
window.addEventListener("pointercancel", endCharge);

let debugCamera;
let debugControls;
let cameraHelper;
let transformControls;
let transformReadout;

if (debugMode) {
  debugCamera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  debugCamera.position.set(4, 3, 4);

  debugControls = new OrbitControls(debugCamera, renderer.domElement);
  debugControls.target.set(0, 0, -2.5);
  debugControls.update();

  cameraHelper = new THREE.CameraHelper(camera);
  scene.add(cameraHelper);

  transformControls = new TransformControls(debugCamera, renderer.domElement);
  transformControls.attach(environmentSplat);
  scene.add(transformControls.getHelper());

  transformControls.addEventListener("dragging-changed", (event) => {
    debugControls.enabled = !event.value;
  });

  transformReadout = document.createElement("pre");
  Object.assign(transformReadout.style, {
    position: "fixed",
    top: "10px",
    left: "10px",
    margin: "0",
    padding: "8px 10px",
    background: "rgba(0, 0, 0, 0.6)",
    color: "#0f0",
    font: "12px/1.4 monospace",
    pointerEvents: "none",
    whiteSpace: "pre",
    zIndex: "10",
  });
  document.body.appendChild(transformReadout);

  window.addEventListener("keydown", (event) => {
    if (event.key === "w") transformControls.setMode("translate");
    if (event.key === "e") transformControls.setMode("rotate");
    if (event.key === "r") transformControls.setMode("scale");
    if (event.key === "s") sparkle.triggerNow();
  });
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (debugCamera) {
    debugCamera.aspect = window.innerWidth / window.innerHeight;
    debugCamera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  hallway.setSize(window.innerWidth, window.innerHeight);
  revealBurn.setAspect(window.innerWidth / window.innerHeight);
}
window.addEventListener("resize", handleResize);

let previousTime = performance.now();
renderer.setAnimationLoop(() => {
  const currentTime = performance.now();
  const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.1);
  previousTime = currentTime;

  waveTime.value = currentTime / 1000;
  dustDevil.update(currentTime / 1000);
  shockwave.update(currentTime / 1000);
  splatCharge.update(currentTime / 1000);
  if (chargeTarget === "splats") splatCharge.set(null, chargeAmount());
  ripples.update(currentTime / 1000);
  updateChromeBlob(currentTime / 1000);
  // Runs whenever the scene is visible: on its own, or as the hallway's
  // portrait.
  sparkle.update(
    currentTime / 1000,
    chromeBlob.mesh.position,
    debugMode ||
      !document.body.classList.contains("is-loading"),
    camera.position.distanceTo(chromeBlob.mesh.position),
  );
  const starLevel = sparkle.level();
  spark.blurAmount = THREE.MathUtils.lerp(splatBlurNormal, splatBlurStars, starLevel);
  spark.falloff = THREE.MathUtils.lerp(splatFalloffNormal, splatFalloffStars, starLevel);
  environmentSplat.updateVersion();

  if (
    chromeBlobEnabled &&
    realReflection &&
    !isTouchDevice &&
    currentTime / 1000 - lastReflectionRefresh >= reflectionRefreshSeconds
  ) {
    lastReflectionRefresh = currentTime / 1000;
    chromeBlob.refreshReflection();
  }

  if (debugMode) {
    debugControls.update();
    cameraHelper.update();

    const p = environmentSplat.position;
    const r = environmentSplat.rotation;
    const s = environmentSplat.scale;
    transformReadout.textContent =
      `position: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\n` +
      `rotation: ${THREE.MathUtils.radToDeg(r.x).toFixed(1)}, ${THREE.MathUtils.radToDeg(r.y).toFixed(1)}, ${THREE.MathUtils.radToDeg(r.z).toFixed(1)}\n` +
      `scale:    ${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)}\n` +
      `(w: move, e: rotate, r: scale, s: sparkle)`;

    renderer.render(scene, debugCamera);
  } else {
    applyScrollEffects(latestScrollY);
    if (scrollProgress > 0) loadMuseumVisitor();

    if (!isScrolling) {
      orbitAngle += orbitSpeed * deltaTime;
    }

    const scrollSmoothing = 1 - Math.exp(-scrollBlendSmoothing * deltaTime);
    scrollBlend = THREE.MathUtils.lerp(scrollBlend, scrollProgress, scrollSmoothing);

    const segmentCount = orbitKeyframes.length - 1;
    const segmentProgress = THREE.MathUtils.clamp(scrollBlend, 0, 1) * segmentCount;
    const segmentIndex = Math.min(Math.floor(segmentProgress), segmentCount - 1);
    const segmentT = THREE.MathUtils.smoothstep(segmentProgress - segmentIndex, 0, 1);
    const fromKeyframe = orbitKeyframes[segmentIndex];
    const toKeyframe = orbitKeyframes[segmentIndex + 1];

    activeCenter.lerpVectors(fromKeyframe.center, toKeyframe.center, segmentT);
    activeRadius = THREE.MathUtils.lerp(fromKeyframe.radius, toKeyframe.radius, segmentT);
    activeHeight = THREE.MathUtils.lerp(fromKeyframe.height, toKeyframe.height, segmentT);

    camera.position.set(
      activeCenter.x + activeRadius * Math.sin(orbitAngle),
      activeCenter.y + activeHeight,
      activeCenter.z + activeRadius * Math.cos(orbitAngle),
    );
    camera.lookAt(activeCenter);

    const smoothing = 1 - Math.exp(-cameraSmoothing * deltaTime);
    currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw, smoothing);
    currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, smoothing);
    camera.rotation.y += currentYaw;
    camera.rotation.x += currentPitch;

    const hallwaySmoothing = 1 - Math.exp(-hallwayBlendSmoothing * deltaTime);
    hallwayBlend = THREE.MathUtils.lerp(hallwayBlend, hallwayProgress, hallwaySmoothing);
    if (Math.abs(hallwayBlend - hallwayProgress) < 0.0005) hallwayBlend = hallwayProgress;
    gameMenu.setCtaVisible(hallwayBlend >= hallwayMenuShowAt);

    if (hallwayBlend <= 0) {
      renderer.render(scene, camera);
      hallwayQuote?.hide();
    } else {
      museumVisitor.update(deltaTime);
      hallway.update(hallwayBlend, currentYaw, currentPitch);
      hallway.render(scene, camera);
      hallwayQuote?.update(hallway.projectWallPoint, hallwayBlend);
    }
  }

  revealBurn.setTime(currentTime / 1000);
  revealBurn.render(renderer);
});


document.querySelectorAll('.work-cell').forEach((cell) => {
  const video = cell.querySelector('video');

  // While the modal is open the card's video lives inside it, so the card's
  // own hover/focus handlers must leave it alone.
  const activate = () => {
    if (workModal.isOpenFor(cell)) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  const deactivate = () => {
    if (workModal.isOpenFor(cell)) return;
    video.pause();
  };

  cell.addEventListener('pointerenter', activate);
  cell.addEventListener('focus', activate);
  cell.addEventListener('pointerleave', deactivate);
  cell.addEventListener('blur', deactivate);
  cell.addEventListener('click', () => workModal.open(cell));
});

const aboutPhotoEl = document.querySelector(".about-photo");
if (aboutPhotoEl) {
  // Stand-in scan until there's a capture of Sam to swap in.
  createAboutPortrait(aboutPhotoEl, {
    url: "/assets/splats/mom.spz",
    viewerEl: document.querySelector(".portrait-viewer"),
  });
}

const workIntro = document.querySelector(".work-intro");
if (workIntro) {
  revealOnEnter(workIntro, { lockWidths: false });
}

document.querySelector(".contact-button")?.addEventListener("click", () => {
  gameMenu.open("about", {
    from: document.querySelector(".contact-button"),
    scrollTo: "contact",
  });
});
