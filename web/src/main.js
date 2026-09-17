import * as THREE from "three";
import { SparkRenderer, SplatMesh, dyno } from "@sparkjsdev/spark";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { revealOnEnter } from "./textReveal.js";

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

// Third point high above the scene, looking down at it.
const skyCenter = new THREE.Vector3(0, 0, 0);
const skyRadius = 4;
const skyHeight = 9;

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

const introEl = document.querySelector(".intro");
const introRevealAt = 0.25; // fraction of cameraScrollRange after which the intro text appears
const introMoveEnd = 0.45; // fraction by which it has scrolled up to its max travel
const introFadeStart = 0.35; // fraction where it starts fading (still moving, mid-travel)
const introFadeEnd = 0.45; // fraction where it's fully faded away
const introMoveDistance = 500; // px it travels upward over the move range

// Past the last camera keyframe (the sky point), continuing to scroll shrinks
// the 3D view into a "window" with page padding around it, then slides that
// window up off-screen — a test of transitioning from the 3D scene into a
// flat 2D page. CSS-only: the wrapper is visually scaled/moved, the WebGL
// canvas itself is never resized.
const sceneWindowEl = document.querySelector(".scene-window");
const windowScrollRange = 1200; // px of scroll, after cameraScrollRange, for this phase
const windowShrinkEnd = 0.5; // fraction of windowScrollRange by which shrink completes
const windowSlideStart = 0.5; // fraction where the shrunk window starts sliding away
const windowSlideEnd = 1; // fraction where it's fully off-screen
const windowTargetScale = 0.55;
const windowTargetRadius = 24; // px

// The scroll-spacer exists purely to give the fixed hero/transition elements
// room to animate. It needs to cover that scroll distance *plus* one extra
// viewport height of buffer — otherwise the next section's opaque background
// scrolls into view (and visually clips the shrinking/sliding frame) before
// the slide-away animation has actually carried it off-screen.
const scrollSpacerEl = document.querySelector(".scroll-spacer");
function sizeScrollSpacer() {
  if (scrollSpacerEl) {
    scrollSpacerEl.style.height = `${cameraScrollRange + windowScrollRange + window.innerHeight}px`;
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
  if (introEl) {
    const isVisible = scrollProgress >= introRevealAt;
    introEl.classList.toggle("is-visible", isVisible);

    if (isVisible) {
      const moveT = THREE.MathUtils.clamp(
        (scrollProgress - introRevealAt) / (introMoveEnd - introRevealAt),
        0,
        1,
      );
      const fadeT = THREE.MathUtils.clamp(
        (scrollProgress - introFadeStart) / (introFadeEnd - introFadeStart),
        0,
        1,
      );
      introEl.style.transform = `translateY(${-moveT * introMoveDistance}px)`;
      introEl.style.opacity = String(1 - fadeT);
    } else {
      introEl.style.transform = "";
      introEl.style.opacity = "";
    }
  }

  if (sceneWindowEl) {
    const windowProgress = THREE.MathUtils.clamp(
      (scrollY - cameraScrollRange) / windowScrollRange,
      0,
      1,
    );
    const shrinkT = THREE.MathUtils.clamp(windowProgress / windowShrinkEnd, 0, 1);
    const slideT = THREE.MathUtils.clamp(
      (windowProgress - windowSlideStart) / (windowSlideEnd - windowSlideStart),
      0,
      1,
    );

    const scale = THREE.MathUtils.lerp(1, windowTargetScale, shrinkT);
    const radius = THREE.MathUtils.lerp(0, windowTargetRadius, shrinkT);
    const slideY = -slideT * window.innerHeight * 1.2;

    sceneWindowEl.style.borderRadius = `${radius}px`;
    sceneWindowEl.style.transform = `translateY(${slideY}px) scale(${scale})`;
  }

  updateActiveSection(scrollY);
}
applyScrollEffects(latestScrollY);

const maxYaw = THREE.MathUtils.degToRad(10);
const maxPitch = THREE.MathUtils.degToRad(10);
const cameraSmoothing = 0.1;
let targetYaw = 0;
let targetPitch = 0;
let currentYaw = 0;
let currentPitch = 0;

const cursorDot = document.querySelector(".cursor-dot");

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

  if (cursorDot) {
    cursorDot.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    cursorDot.style.opacity = "1";
  }
});

window.addEventListener("pointerleave", () => {
  targetYaw = 0;
  targetPitch = 0;

  if (cursorDot) {
    cursorDot.style.opacity = "0";
  }
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
scene.add(spark);

const environmentSplat = new SplatMesh({ url: "/assets/splats/cholla2.spz" });
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

const momSplat = new SplatMesh({ url: "/assets/splats/mom.spz" });
momSplat.position.set(0, 0, 0);
// scene.add(momSplat);

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

    const scrollSmoothing = 1 - Math.exp(-3 * deltaTime);
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

    renderer.render(scene, camera);
  }
});

document.querySelectorAll('.work-cell').forEach((cell) => {
  const video = cell.querySelector('video');

  const activate = () => {
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  const deactivate = () => {
    video.pause();
  };

  cell.addEventListener('pointerenter', activate);
  cell.addEventListener('focus', activate);
  cell.addEventListener('pointerleave', deactivate);
  cell.addEventListener('blur', deactivate);
  cell.addEventListener('click', () => {
    console.log(`Clicked ${cell.dataset.work}`);
  });
});

const workIntro = document.querySelector(".work-intro");
if (workIntro) {
  revealOnEnter(workIntro, { lockWidths: false });
}
