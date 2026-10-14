import * as THREE from "three";
import gsap from "gsap";
import { SparkRenderer, SplatMesh, dyno } from "@sparkjsdev/spark";

// A Gaussian splat of a person shown inside the About photo frame. Scrolling
// the frame through the viewport turns the figure from one side to the
// other, with a little extra tilt from the cursor. The flat photo stays in
// place underneath until the splat has loaded.
//
// Clicking the frame opens a full-body viewer: the frame grows out to a
// large panel while the camera pulls back from head-and-shoulders to the
// whole figure, which can then be dragged to spin. The same renderer and
// canvas move into the viewer and back, so nothing reloads.
//
// It runs its own small renderer, but only while the frame is near the
// viewport (or the viewer is open), and it doesn't start downloading the
// splat until then either, so it costs nothing on the landing scene.

const FOV = 30;
const MAX_TURN = THREE.MathUtils.degToRad(35); // yaw at either end of the scroll
const MAX_TILT = THREE.MathUtils.degToRad(8); // extra yaw/pitch from the cursor
const TURN_SMOOTHING = 6; // rate the turn chases scroll; lower = more lag
const FRAMING = 0.36; // fraction of the figure's height (from the top) that fills the frame
const FULL_FRAMING = 1.32; // full-body view: whole figure plus room above and below
const FULL_ELEVATION = THREE.MathUtils.degToRad(14); // full-body view: camera raised, looking down

const FLOOR_SIZE = 8; // world units across the grid floor
const FLOOR_CELL = 0.25; // world units between grid lines
const SHADOW_SPREAD = 3; // contact shadow size, relative to the figure's footprint
const SHADOW_DARKNESS = 1;

const DRAG_SPEED = 0.008; // radians of spin per px dragged
const AUTO_SPIN = 0.25; // radians/sec the viewer drifts at when left alone
const SPIN_DAMPING = 2.5; // how quickly a flick's momentum settles back to AUTO_SPIN

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const OPEN_DURATION = reduceMotion ? 0.01 : 1.1;
const CLOSE_DURATION = reduceMotion ? 0.01 : 0.8;

const lerp = THREE.MathUtils.lerp;

function lerpRect(a, b, t) {
  const left = lerp(a.left, b.left, t);
  const top = lerp(a.top, b.top, t);
  const width = lerp(a.width, b.width, t);
  const height = lerp(a.height, b.height, t);
  return { left, top, width, height, right: left + width, bottom: top + height };
}

export function createAboutPortrait(containerEl, { url, viewerEl }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = "about-photo-splat";
  containerEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100);
  scene.add(new SparkRenderer({ renderer }));

  // The splat hangs off a pivot so it turns around its own vertical axis,
  // whatever its origin was in the capture.
  const pivot = new THREE.Group();
  scene.add(pivot);

  // A grid floor under the figure's feet, only seen in the full-body view.
  // It turns with the pivot, so spinning the figure reads as turning the
  // whole stage rather than the figure alone.
  const floor = createGridFloor();
  pivot.add(floor.mesh);
  // A soft contact shadow pooled under the feet, so the figure stands on
  // the floor instead of hovering over it.
  const shadow = createContactShadow();
  pivot.add(shadow.mesh);

  let splat = null;
  let bounds = null; // { center, top, height } once loaded
  let isVisible = false;
  let targetTurn = 0;
  let currentTurn = 0;
  let pointerX = 0;
  let pointerY = 0;
  let currentPointerX = 0;
  let currentPointerY = 0;

  // 0 = head and shoulders, 1 = full body. Driven by the open/close morph.
  const morph = { value: 0 };
  let viewer = null; // set while the viewer is open or animating
  let spin = 0;
  let spinVelocity = 0;

  function load() {
    splat = new SplatMesh({ url });
    splat.initialized.then(() => {
      const box = splat.getBoundingBox(true);
      bounds = {
        center: box.getCenter(new THREE.Vector3()),
        top: box.max.y,
        bottom: box.min.y,
        height: box.max.y - box.min.y,
        footprint: Math.max(box.max.x - box.min.x, box.max.z - box.min.z),
      };
      pivot.add(splat);
      addBreathing(splat);
      frameCamera();
      containerEl.classList.add("has-splat");
    });
  }

  // Blends between framing the top of the figure and the whole of it. The
  // frame height is fitted to the canvas's shorter side, so a square crop
  // from the middle of a wide or tall canvas shows the same thing as the
  // square photo frame — which is what lets the open morph line up.
  function frameCamera() {
    if (!bounds) return;
    const { center, top, bottom, height } = bounds;
    const headHeight = height * FRAMING;
    const frameHeight = lerp(headHeight, height * FULL_FRAMING, morph.value);
    const focusY = lerp(top - headHeight / 2, center.y, morph.value);
    splat.position.set(-center.x, -focusY, -center.z);
    floor.mesh.position.y = bottom - focusY;
    const floorOpacity = THREE.MathUtils.smoothstep(morph.value, 0.4, 1);
    floor.setOpacity(floorOpacity);
    // Centered under the figure itself, whatever its offset in the capture.
    shadow.mesh.position.set(0, bottom - focusY + 0.002, 0);
    shadow.mesh.scale.setScalar(bounds.footprint * SHADOW_SPREAD);
    shadow.setOpacity(floorOpacity);

    const halfFov = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const distance = frameHeight / 2 / (halfFov * Math.min(1, camera.aspect));
    // Raise the camera on an arc around the focus point as it pulls back,
    // so the full-body view looks slightly down at the figure.
    const elevation = FULL_ELEVATION * morph.value;
    camera.position.set(0, distance * Math.sin(elevation), distance * Math.cos(elevation));
    camera.lookAt(0, 0, 0);
  }

  function setRendererSize(width, height) {
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  new ResizeObserver(() => {
    if (viewer) return;
    const { width, height } = containerEl.getBoundingClientRect();
    setRendererSize(width, height);
  }).observe(containerEl);

  new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible && !splat) load();
    },
    { rootMargin: "50% 0px" },
  ).observe(containerEl);

  window.addEventListener("pointermove", (event) => {
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  });

  let previousTime = performance.now();
  renderer.setAnimationLoop(() => {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.1);
    previousTime = currentTime;
    if ((!isVisible && !viewer) || !bounds) return;

    const smoothing = 1 - Math.exp(-TURN_SMOOTHING * deltaTime);

    if (viewer && !viewer.closing) {
      // Free spin: dragging sets it directly; otherwise a flick's momentum
      // eases back down to a slow idle drift.
      if (!viewer.dragging) {
        spinVelocity = lerp(spinVelocity, AUTO_SPIN, 1 - Math.exp(-SPIN_DAMPING * deltaTime));
        spin += spinVelocity * deltaTime;
      }
      currentPointerY = lerp(currentPointerY, 0, smoothing);
      pivot.rotation.set(currentPointerY * MAX_TILT, spin, 0);
    } else {
      // 0 as the frame enters at the bottom of the screen, 1 as it leaves the top.
      const rect = containerEl.getBoundingClientRect();
      const passage = THREE.MathUtils.clamp(
        (window.innerHeight - rect.top) / (window.innerHeight + rect.height),
        0,
        1,
      );
      targetTurn = lerp(-MAX_TURN, MAX_TURN, passage);

      currentTurn = lerp(currentTurn, targetTurn, smoothing);
      currentPointerX = lerp(currentPointerX, pointerX, smoothing);
      currentPointerY = lerp(currentPointerY, pointerY, smoothing);

      pivot.rotation.set(
        currentPointerY * MAX_TILT,
        currentTurn + currentPointerX * MAX_TILT,
        0,
      );
    }

    breathingTime.value = currentTime / 1000;
    const cyclePhase = ((currentTime / 1000) % breathingCyclePeriod) / breathingCyclePeriod;
    breathingEnvelope.value = (1 - Math.cos(cyclePhase * Math.PI * 2)) / 2;
    splat.updateVersion();

    renderer.render(scene, camera);
  });

  if (viewerEl) setUpViewer();

  function setUpViewer() {
    const backdropEl = viewerEl.querySelector(".portrait-viewer-backdrop");
    const stageEl = viewerEl.querySelector(".portrait-viewer-stage");
    const closeEl = viewerEl.querySelector(".portrait-viewer-close");
    const hintEl = viewerEl.querySelector(".portrait-viewer-hint");
    let rects = null;
    let morphTween = null;

    // Same approach as the work modal's hero: the stage sits at its final
    // size the whole time and is scaled/clipped down to the photo frame's
    // rect, so the canvas never has to be resized mid-animation.
    function measure() {
      return {
        from: containerEl.getBoundingClientRect(),
        fromRadius: parseFloat(getComputedStyle(containerEl).borderTopLeftRadius) || 0,
        stage: stageEl.getBoundingClientRect(),
        stageRadius: parseFloat(getComputedStyle(stageEl).borderTopLeftRadius) || 0,
      };
    }

    function renderMorph() {
      const t = morph.value;
      const { from, fromRadius, stage, stageRadius } = rects;
      const r = lerpRect(from, stage, t);
      const scale = Math.max(r.width / stage.width, r.height / stage.height);
      const dx = r.left + r.width / 2 - (stage.left + stage.width / 2);
      const dy = r.top + r.height / 2 - (stage.top + stage.height / 2);
      const insetX = (stage.width - r.width / scale) / 2;
      const insetY = (stage.height - r.height / scale) / 2;
      const radius = lerp(fromRadius, stageRadius, t) / scale;
      stageEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      stageEl.style.clipPath = `inset(${insetY}px ${insetX}px round ${radius}px)`;
      frameCamera();
    }

    function clearMorph() {
      stageEl.style.transform = "";
      stageEl.style.clipPath = "";
    }

    function lockScroll() {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.overflow = "hidden";
      document.body.style.paddingRight = scrollbarWidth ? `${scrollbarWidth}px` : "";
    }

    function unlockScroll() {
      document.documentElement.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    function open() {
      if (viewer || !bounds) return;
      viewer = { closing: false, dragging: false };

      // Pick up the spin exactly where the scroll/cursor turn left it.
      spin = currentTurn + currentPointerX * MAX_TILT;
      spinVelocity = 0;

      lockScroll();
      viewerEl.hidden = false;
      viewerEl.classList.add("is-animating");
      stageEl.appendChild(renderer.domElement);
      rects = measure();
      setRendererSize(rects.stage.width, rects.stage.height);
      containerEl.classList.add("is-lifted");

      morph.value = 0;
      renderMorph();
      gsap.set([closeEl, hintEl], { opacity: 0 });
      gsap.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
      morphTween = gsap.to(morph, {
        value: 1,
        duration: OPEN_DURATION,
        ease: "power3.inOut",
        onUpdate: renderMorph,
        onComplete: () => {
          viewerEl.classList.remove("is-animating");
          clearMorph();
          gsap.to(closeEl, { opacity: 1, duration: 0.5, ease: "power2.out" });
          gsap.to(hintEl, { opacity: 1, duration: 0.8, ease: "power2.out" });
        },
      });

      closeEl.focus({ preventScroll: true });
    }

    function close() {
      if (!viewer || viewer.closing) return;
      viewer.closing = true;
      viewer.dragging = false;

      // Hand the spin back to the scroll turn by its nearest equivalent
      // angle, so it unwinds the short way rather than spinning back round.
      currentTurn = Math.atan2(Math.sin(spin), Math.cos(spin));
      currentPointerX = 0;

      const wasMorphing = morphTween?.isActive();
      morphTween?.kill();
      viewerEl.classList.add("is-animating");
      if (wasMorphing) {
        rects.from = containerEl.getBoundingClientRect();
      } else {
        rects = measure();
        morph.value = 1;
      }

      gsap.to([closeEl, hintEl], { opacity: 0, duration: 0.25, ease: "power2.out" });
      gsap.to(backdropEl, { opacity: 0, duration: 0.6, delay: 0.15, ease: "power2.inOut" });
      morphTween = gsap.to(morph, {
        value: 0,
        duration: CLOSE_DURATION,
        ease: "power3.inOut",
        onUpdate: renderMorph,
        onComplete: finishClose,
      });
    }

    function finishClose() {
      containerEl.appendChild(renderer.domElement);
      containerEl.classList.remove("is-lifted");
      viewerEl.hidden = true;
      viewerEl.classList.remove("is-animating");
      clearMorph();
      unlockScroll();
      viewer = null;

      const { width, height } = containerEl.getBoundingClientRect();
      setRendererSize(width, height);
      frameCamera();
      containerEl.focus({ preventScroll: true });
    }

    containerEl.addEventListener("click", open);
    containerEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
    closeEl.addEventListener("click", close);
    backdropEl.addEventListener("click", close);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });

    // Drag to spin, keeping the release speed as momentum.
    let lastX = 0;
    let lastTime = 0;
    stageEl.addEventListener("pointerdown", (event) => {
      if (!viewer || viewer.closing || event.target.closest("button")) return;
      viewer.dragging = true;
      lastX = event.clientX;
      lastTime = performance.now();
      spinVelocity = 0;
      stageEl.setPointerCapture(event.pointerId);
      stageEl.classList.add("is-dragging");
      gsap.to(hintEl, { opacity: 0, duration: 0.4 });
    });
    stageEl.addEventListener("pointermove", (event) => {
      if (!viewer?.dragging) return;
      const now = performance.now();
      const delta = (event.clientX - lastX) * DRAG_SPEED;
      spin += delta;
      spinVelocity = delta / Math.max((now - lastTime) / 1000, 0.008);
      lastX = event.clientX;
      lastTime = now;
    });
    const endDrag = () => {
      if (!viewer?.dragging) return;
      viewer.dragging = false;
      stageEl.classList.remove("is-dragging");
      // A drag that stopped before release shouldn't keep its old speed.
      if (performance.now() - lastTime > 80) spinVelocity = 0;
    };
    stageEl.addEventListener("pointerup", endDrag);
    stageEl.addEventListener("pointercancel", endDrag);

    window.addEventListener("resize", () => {
      if (!viewer || viewer.closing || viewerEl.classList.contains("is-animating")) return;
      const { width, height } = stageEl.getBoundingClientRect();
      setRendererSize(width, height);
      frameCamera();
    });
  }
}

// A faint wireframe floor: grid lines drawn in the shader so they stay one
// pixel thin at any distance, fading out toward the edges into the dark.
// Drawn before the splats, which blend over it.
function createGridFloor() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      opacity: { value: 0 },
      cell: { value: FLOOR_CELL },
      radius: { value: FLOOR_SIZE / 2 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPos;
      void main() {
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      uniform float cell;
      uniform float radius;
      varying vec2 vPos;
      void main() {
        vec2 g = vPos / cell;
        vec2 w = fwidth(g);
        vec2 line = abs(fract(g - 0.5) - 0.5) / w;
        float grid = 1.0 - min(min(line.x, line.y), 1.0);
        // Every fourth line a little brighter, like a drafting grid.
        vec2 g4 = g / 4.0;
        vec2 line4 = abs(fract(g4 - 0.5) - 0.5) / fwidth(g4);
        float major = 1.0 - min(min(line4.x, line4.y), 1.0);
        float fade = 1.0 - smoothstep(radius * 0.15, radius, length(vPos));
        float alpha = max(grid * 0.22, major * 0.45) * fade * opacity;
        gl_FragColor = vec4(vec3(1.0), alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  mesh.visible = false;

  return {
    mesh,
    setOpacity(value) {
      material.uniforms.opacity.value = value;
      mesh.visible = value > 0.001;
    },
  };
}

// A dark pool that is densest right under the figure and feathers out to
// nothing, drawn over the grid floor and under the splats.
function createContactShadow() {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        // A tight core under the feet plus a wide, faint falloff.
        float core = 1.0 - smoothstep(0.0, 0.45, d);
        float soft = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0);
        float alpha = (core * 0.55 + soft * 0.45) * ${SHADOW_DARKNESS.toFixed(3)} * opacity;
        gl_FragColor = vec4(vec3(0.0), alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -0.5;
  mesh.visible = false;

  return {
    mesh,
    setOpacity(value) {
      material.uniforms.opacity.value = value;
      mesh.visible = value > 0.001;
    },
  };
}

// Breathe the figure between solid and a scattered, abstract state: a slow
// global envelope eases from 0 (solid) to 1 (fully disintegrated) and back,
// while each splat drifts outward along its own random direction and
// flickers toward white at the peak of the cycle.
// Pattern adapted from https://github.com/sparkjsdev/spark/blob/main/examples/splat-dissolve-effects/index.html
const breathingTime = dyno.dynoFloat(0);
const breathingAmount = dyno.dynoFloat(0.15); // how far splats drift at the peak
const breathingSpeed = dyno.dynoFloat(0.1); // oscillations per second, roughly
const breathingEnvelope = dyno.dynoFloat(0); // 0 = fully solid, 1 = fully disintegrated
const breathingCyclePeriod = 16; // seconds for one full solid -> disintegrate -> solid cycle

function addBreathing(splat) {
  splat.objectModifier = dyno.dynoBlock(
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
        t: breathingTime,
        amount: breathingAmount,
        speed: breathingSpeed,
        envelope: breathingEnvelope,
      }).gsplat;
      return { gsplat };
    },
  );
  splat.updateGenerator();
}
