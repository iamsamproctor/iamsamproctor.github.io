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
import { createHallway } from "./hallway.js";

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
    { id: "mom", bytes: 3296646 },
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
      },
    });
  },
});

const debugMode = new URLSearchParams(window.location.search).has("debug");

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
const orbitRadius = 5;
const orbitHeight = 1;
const orbitSpeed = THREE.MathUtils.degToRad(1); // radians per second
let orbitAngle = 0;

// Additional points of interest the camera dollies between as the user
// scrolls, continuing to orbit around whichever point is currently active.
const focusCenter = new THREE.Vector3(0, 0.7, 0);
const focusRadius = 1.5;
const focusHeight = 0.1;

// Third point: high and far out, looking down at the scene from a distance
// rather than straight overhead (bird's-eye).
const skyCenter = new THREE.Vector3(0, 0, 0);
const skyRadius = 10;
const skyHeight = 4;

const orbitKeyframes = [
  { center: orbitCenter, radius: orbitRadius, height: orbitHeight },
  { center: focusCenter, radius: focusRadius, height: focusHeight },
  { center: skyCenter, radius: skyRadius, height: skyHeight },
];

const activeCenter = orbitCenter.clone();
let activeRadius = orbitRadius;
let activeHeight = orbitHeight;

let scrollProgress = 0; // raw 0-1 across the camera keyframe sequence
let scrollBlend = 0; // smoothed toward scrollProgress each frame
const cameraScrollRange = 2400; // px of scroll to move through all camera keyframes
const scrollBlendSmoothing = 1.5; // rate scrollBlend chases scrollProgress; lower = more lag/slower dolly

const heroHeadingEl = document.querySelector(".hero-heading");
const heroFadeDistance = 500; // px of scroll over which it fully fades away
const heroDriftDistance = 140; // px it drifts upward while fading

const introEl = document.querySelector(".intro");
const introBodyEl = document.querySelector(".intro-body");
const introBodyReveal = introBodyEl
  ? createTextReveal(introBodyEl, { lockWidths: true })
  : null;
let introWasVisible = false;
const introRevealAt = 0.25; // fraction of cameraScrollRange after which the intro text appears
const introFadeStart = 0.7; // holds full opacity, anchored at its CSS position, all the way to here
const introFadeEnd = 0.78; // fraction where it's fully faded away
const introExitDistance = 220; // px it scrolls up while fading out

// Past the last camera keyframe (the sky point), continuing to scroll pulls
// back from the splat scene to reveal it as a portrait at the end of a
// hallway (see hallway.js), retreating down the hallway until it fades to
// black, before the Work section scrolls in.
const hallwayScrollRange = 2200; // px of scroll, after cameraScrollRange, for this phase
const hallwayBlendSmoothing = 3; // rate the hallway dolly chases scroll; lower = more lag
let hallwayProgress = 0; // raw 0-1
let hallwayBlend = 0; // smoothed toward hallwayProgress each frame

// The scroll-spacer exists purely to give the fixed hero/transition elements
// room to animate. It needs to cover that scroll distance *plus* one extra
// viewport height of buffer — otherwise the next section's opaque background
// scrolls into view (and visually clips the shrinking/sliding frame) before
// the slide-away animation has actually carried it off-screen.
const scrollSpacerEl = document.querySelector(".scroll-spacer");
function sizeScrollSpacer() {
  if (scrollSpacerEl) {
    scrollSpacerEl.style.height = `${cameraScrollRange + hallwayScrollRange + window.innerHeight}px`;
  }
}
sizeScrollSpacer();
window.addEventListener("resize", sizeScrollSpacer);

// Right-side dot navigation: jumps to and highlights the current section.
// Highlighting is applied once per rendered frame (see applyScrollEffects)
// rather than on every raw scroll event, for the same reason as above.
const sectionNavEl = document.querySelector(".section-nav");
let updateActiveSection = () => {};
if (sectionNavEl) {
  const navButtons = Array.from(sectionNavEl.querySelectorAll("button[data-section]"));
  const sectionTargets = navButtons.map((button) => {
    const id = button.dataset.section;
    const el = id === "hero" ? null : document.getElementById(id);
    return { button, id, el };
  });

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.section;
      if (id === "hero") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  updateActiveSection = (scrollY) => {
    let activeId = "hero";
    for (const target of sectionTargets) {
      if (!target.el) continue;
      if (scrollY >= target.el.offsetTop - window.innerHeight / 2) {
        activeId = target.id;
      }
    }
    for (const { button, id } of sectionTargets) {
      button.classList.toggle("is-active", id === activeId);
    }
  };

  window.addEventListener("resize", () => updateActiveSection(window.scrollY));
  updateActiveSection(window.scrollY);
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
      const heroT = THREE.MathUtils.smoothstep(
        THREE.MathUtils.clamp(scrollY / heroFadeDistance, 0, 1),
        0,
        1,
      );
      heroHeadingEl.style.opacity = String(1 - heroT);
      heroHeadingEl.style.transform = `translateY(${-heroT * heroDriftDistance}px)`;
    }
  }

  if (introEl) {
    const isVisible = scrollProgress >= introRevealAt;
    introEl.classList.toggle("is-visible", isVisible);

    if (isVisible && !introWasVisible && introBodyReveal) {
      introBodyReveal.play();
    }
    introWasVisible = isVisible;

    if (isVisible) {
      const fadeT = THREE.MathUtils.smoothstep(
        (scrollProgress - introFadeStart) / (introFadeEnd - introFadeStart),
        0,
        1,
      );
      introEl.style.transform = `translateY(${-fadeT * introExitDistance}px)`;
      introEl.style.opacity = String(1 - fadeT);
    } else {
      introEl.style.transform = "";
      introEl.style.opacity = "";
    }
  }

  hallwayProgress = THREE.MathUtils.clamp(
    (scrollY - cameraScrollRange) / hallwayScrollRange,
    0,
    1,
  );

  updateActiveSection(scrollY);
}
applyScrollEffects(latestScrollY);
 
const maxYaw = THREE.MathUtils.degToRad(20);
const maxPitch = THREE.MathUtils.degToRad(20);
const cameraSmoothing = 0.2;
let targetYaw = 0;
let targetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;  

window.addEventListener("pointermove", (event) => {
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

const hallway = createHallway({
  renderer,
  works: Array.from(document.querySelectorAll(".work-cell img")).map((img) => ({
    src: img.getAttribute("src"),
  })),
});
hallway.setSize(window.innerWidth, window.innerHeight);
scene.add(spark);

const environmentSplat = new SplatMesh({
  url: "/assets/splats/cholla2.spz",
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

const momSplat = new SplatMesh({
  url: "/assets/splats/mom.spz",
  onProgress: (event) => loadingScreen.report("mom", event.loaded, event.total),
});
momSplat.position.set(0, 0, 0);

Promise.all([environmentSplat.initialized, momSplat.initialized]).then(() =>
  loadingScreen.finish(),
);
scene.add(momSplat);

// Breathe mom.spz between solid and a scattered, abstract state: a slow
// global envelope eases from 0 (solid) to 1 (fully disintegrated) and back,
// while each splat drifts outward along its own random direction and
// flickers toward white at the peak of the cycle.
// Pattern adapted from https://github.com/sparkjsdev/spark/blob/main/examples/splat-dissolve-effects/index.html
const scatterTime = dyno.dynoFloat(0);
const scatterAmount = dyno.dynoFloat(0.4); // how far splats drift at the peak
const scatterSpeed = dyno.dynoFloat(0.1); // oscillations per second, roughly
const scatterEnvelope = dyno.dynoFloat(0); // 0 = fully solid, 1 = fully disintegrated
const scatterCyclePeriod = 16; // seconds for one full solid -> disintegrate -> solid cycle

momSplat.worldModifier = dyno.dynoBlock(
  { gsplat: dyno.Gsplat },
  { gsplat: dyno.Gsplat },
  ({ gsplat }) => {
    const d = new dyno.Dyno({
      inTypes: {
        gsplat: dyno.Gsplat,
        t: "float",
        amount: "float",
        speed: "float",
        envelope: "float",
      },
      outTypes: { gsplat: dyno.Gsplat },
      globals: () => [
        dyno.unindent(/* glsl */ `
          vec3 hash(vec3 p) {
            return fract(sin(p * 123.456) * 123.456);
          }
        `),
      ],
      statements: ({ inputs, outputs }) => dyno.unindentLines(/* glsl */ `
        ${outputs.gsplat} = ${inputs.gsplat};

        vec3 localPos = ${inputs.gsplat}.center;
        vec3 hashVal = hash(localPos);

        vec3 moveDirection = normalize(hashVal - 0.5);
        float phase = hashVal.x * 6.28;
        float oscillation = sin(${inputs.t} * ${inputs.speed} * 6.28 + phase) * 0.5 + 0.5;
        oscillation *= ${inputs.envelope};
        float drift = oscillation * ${inputs.amount};

        ${outputs.gsplat}.center = localPos + moveDirection * drift;

        vec3 scattered = mix(${inputs.gsplat}.rgba.rgb, vec3(1.0), oscillation * 0.7);

        ${outputs.gsplat}.rgba.rgb = scattered;
        ${outputs.gsplat}.rgba.a *= mix(1.0, 0.03, oscillation);
        ${outputs.gsplat}.scales = ${inputs.gsplat}.scales * (1.0 + oscillation * 0.6);
      `),
    });

    gsplat = d.apply({
      gsplat,
      t: scatterTime,
      amount: scatterAmount,
      speed: scatterSpeed,
      envelope: scatterEnvelope,
    }).gsplat;
    return { gsplat };
  },
);
momSplat.updateGenerator();

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
  environmentSplat.updateVersion();

  scatterTime.value = currentTime / 1000;
  const scatterCyclePhase =
    ((currentTime / 1000) % scatterCyclePeriod) / scatterCyclePeriod;
  // Eased 0 -> 1 -> 0 breathing cycle: lingers calm near the solid ends and
  // slowly dissolves through the middle, rather than jumping straight in.
  scatterEnvelope.value = (1 - Math.cos(scatterCyclePhase * Math.PI * 2)) / 2;
  momSplat.updateVersion();

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
      `(w: move, e: rotate, r: scale)`;

    renderer.render(scene, debugCamera);
  } else {
    applyScrollEffects(latestScrollY);

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

    if (hallwayBlend <= 0) {
      renderer.render(scene, camera);
    } else if (hallwayBlend >= 1) {
      // Fully faded to black: skip the splat and hallway passes entirely.
      renderer.clear();
    } else {
      hallway.update(hallwayBlend, currentYaw, currentPitch);
      hallway.render(scene, camera);
    }
  }

  revealBurn.setTime(currentTime / 1000);
  revealBurn.render(renderer);
});

const workModal = createWorkModal();

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

const workIntro = document.querySelector(".work-intro");
if (workIntro) {
  revealOnEnter(workIntro, { lockWidths: false });
}

document.querySelector(".contact-button")?.addEventListener("click", () => {
  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
});
