import * as THREE from "three";
import gsap from "gsap";
import { loadJosh } from "./josh.js";
import { createBlendTree1D } from "./blendTree1D.js";

// Walking the gallery: from the end of the hallway, the scene fades to black
// and back in with the museum visitor (Josh, see josh.js) standing up from
// the bench, and he walks the hallway in third person. Idle, walk and run
// are blended by his speed (see blendTree1D.js). Leaving fades
// back out and returns to the visitor sitting on the bench, exactly where
// the page was left.
//
// Controls (mouse and keyboard; it isn't offered on touch screens yet):
//  - W/S or ↑/↓ walk, A/D step sideways, ←/→ turn, Shift runs.
//  - Moving the mouse looks around a little; pushing it toward the left or
//    right edge of the screen keeps turning that way. The cursor stays free
//    so works can be clicked.
//  - Clicking a work on the wall brings the camera round to face it;
//    clicking it again opens its project (onOpenWork). Walking, clicking
//    elsewhere, or Esc steps back from it.
//  - Esc (when not looking at a work) leaves.

const FADE = 0.55; // seconds for each half of the fade through black

const RADIUS = 0.28; // how close he gets to walls and the bench
const WALK_SPEED = 2.1; // world units per second
const RUN_SPEED = 3.6;
const ACCELERATION = 10; // how quickly he reaches speed and stops
const TURN_SPEED = THREE.MathUtils.degToRad(100); // ←/→ keys, per second
const SPAWN = new THREE.Vector3(0, 0, 3.7); // just in front of the bench

// How fast the walk and run clips cover ground at normal speed, measured from
// how fast a planted foot slides back in each. Walking faster or slower than
// this plays the clip faster or slower, so the feet don't skate.
const WALK_CLIP_SPEED = 1.7;
const RUN_CLIP_SPEED = 3.34;
// The walk's left foot comes forward slightly later in its cycle than the
// run's; this lines them up.
const WALK_CLIP_PHASE = 0.05;

// Above and behind the character's right shoulder, looking slightly down, so
// it sits low and to one side of the view instead of covering the middle.
const EYE_HEIGHT = 1.55; // what the camera looks at, above the floor
const CAMERA_RISE = 0.5; // how far above that the camera sits
const CAMERA_DISTANCE = 3.1; // behind the character
const CAMERA_SHOULDER = 0.6; // to the right, so the character isn't dead center
const CAMERA_PITCH = THREE.MathUtils.degToRad(-9); // looking slightly down
const CAMERA_SMOOTHING = 12;
const WALL_GAP = 0.15; // closest the camera gets to a wall

const LOOK_YAW = THREE.MathUtils.degToRad(25); // with the cursor at the screen edge
const LOOK_PITCH = THREE.MathUtils.degToRad(16);
const EDGE = 0.7; // fraction of the way to the screen edge where turning starts
const EDGE_TURN = THREE.MathUtils.degToRad(110); // per second, right at the edge
const LOOK_SMOOTHING = 8;

const FOCUS_DURATION = 0.9; // seconds to swing round to face a work
const FOCUS_MARGIN = 1.35; // room around a work when facing it

export function createGalleryExplore({ hallway, museumVisitor, onOpenWork, isModalOpen }) {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.rotation.order = "YXZ";

  const fadeEl = document.querySelector(".gallery-fade");
  const hudEl = document.querySelector(".gallery-hud");
  const exitEl = hudEl.querySelector(".gallery-exit");
  const canvas = document.querySelector(".scene-window canvas");

  // Josh is added once he's loaded (usually long before, for the bench).
  const character = new THREE.Group();
  character.visible = false;
  hallway.scene.add(character);
  let mixer = null;
  let locomotion = null;

  function addJosh() {
    loadJosh().then((josh) => {
      if (mixer) return;
      const figure = josh.create();
      figure.rotation.y = Math.PI; // Mixamo characters face +z; heading 0 is -z
      character.add(figure);
      mixer = new THREE.AnimationMixer(figure);
      locomotion = createBlendTree1D(mixer, [
        { clip: josh.clips.idle, at: 0 },
        { clip: josh.clips.walk, at: WALK_SPEED, groundSpeed: WALK_CLIP_SPEED, phase: WALK_CLIP_PHASE },
        { clip: josh.clips.run, at: RUN_SPEED, groundSpeed: RUN_CLIP_SPEED },
      ]);
    });
  }

  const { halfWidth, length, height, ribDepth } = hallway.bounds;
  const benchBox = new THREE.Box3();

  let active = false;
  let busy = false; // mid-fade
  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let heading = 0; // radians; 0 faces the portrait (-z)
  const keys = new Set();

  // Cursor in -1..1 across the screen, and the look it eases toward.
  let pointerX = 0;
  let pointerY = 0;
  let pointerKnown = false;
  let lookYaw = 0;
  let lookPitch = 0;

  // Facing a work: which one, and how far the camera has swung round to it.
  let focused = null; // a hallway.pieces entry, or "portrait"
  const focus = { amount: 0 };
  let focusTween = null;
  const focusPosition = new THREE.Vector3();
  const focusTarget = new THREE.Vector3();

  const followPosition = new THREE.Vector3();
  const followTarget = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  // --- Entering and leaving --------------------------------------------

  function fadeThrough(midway) {
    busy = true;
    fadeEl.style.pointerEvents = "auto";
    gsap.to(fadeEl, {
      opacity: 1,
      duration: FADE,
      ease: "power2.in",
      onComplete: () => {
        midway();
        gsap.to(fadeEl, {
          opacity: 0,
          duration: FADE,
          delay: 0.1,
          ease: "power2.out",
          onComplete: () => {
            fadeEl.style.pointerEvents = "";
            busy = false;
          },
        });
      },
    });
  }

  function enter() {
    if (active || busy) return;
    addJosh();
    fadeThrough(() => {
      active = true;
      document.body.classList.add("is-exploring");
      document.documentElement.style.overflow = "hidden";
      museumVisitor.setFigureVisible(false);
      character.visible = true;
      position.copy(SPAWN);
      velocity.set(0, 0, 0);
      heading = 0;
      lookYaw = 0;
      lookPitch = 0;
      clearFocus({ instant: true });
      keys.clear();
      updateCamera(0, { snap: true });
      hudEl.hidden = false;
    });
  }

  function exit() {
    if (!active || busy) return;
    fadeThrough(() => {
      active = false;
      document.body.classList.remove("is-exploring");
      document.documentElement.style.overflow = "";
      museumVisitor.setFigureVisible(true);
      character.visible = false;
      clearFocus({ instant: true });
      keys.clear();
      canvas.style.cursor = "";
      hudEl.hidden = true;
    });
  }

  // --- Facing a work ---------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = () => [hallway.portrait, ...hallway.pieces.map((piece) => piece.picture)];

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables(), false)[0];
    if (!hit) return null;
    if (hit.object === hallway.portrait) return "portrait";
    return hallway.pieces.find((piece) => piece.picture === hit.object) ?? null;
  }

  const normal = new THREE.Vector3();
  const size = new THREE.Vector3();
  function focusOn(target) {
    const mesh = target === "portrait" ? hallway.portrait : target.picture;
    mesh.updateWorldMatrix(true, false);
    mesh.getWorldPosition(focusTarget);
    mesh.getWorldDirection(normal);
    mesh.getWorldScale(size);
    // Far enough back to see the whole thing with some wall around it.
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const fitHeight = size.y / 2 / Math.tan(halfFov);
    const fitWidth = size.x / 2 / (Math.tan(halfFov) * camera.aspect);
    const distance = Math.max(fitHeight, fitWidth) * FOCUS_MARGIN;
    focusPosition.copy(focusTarget).addScaledVector(normal, distance);
    clampToHall(focusPosition);

    focused = target;
    focusTween?.kill();
    focusTween = gsap.to(focus, { amount: 1, duration: FOCUS_DURATION, ease: "power2.inOut" });
  }

  function clearFocus({ instant = false } = {}) {
    if (!focused && focus.amount === 0) return;
    focused = null;
    focusTween?.kill();
    if (instant) focus.amount = 0;
    else focusTween = gsap.to(focus, { amount: 0, duration: FOCUS_DURATION * 0.8, ease: "power2.inOut" });
  }

  // The picture's rect on screen, for the project to grow out of and shrink
  // back into.
  const corner = new THREE.Vector3();
  function screenRect(piece) {
    const rect = canvas.getBoundingClientRect();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      corner.set(x, y, 0).applyMatrix4(piece.picture.matrixWorld).project(camera);
      const px = rect.left + ((corner.x + 1) / 2) * rect.width;
      const py = rect.top + ((1 - corner.y) / 2) * rect.height;
      left = Math.min(left, px);
      right = Math.max(right, px);
      top = Math.min(top, py);
      bottom = Math.max(bottom, py);
    }
    return new DOMRect(left, top, right - left, bottom - top);
  }

  // --- Moving ----------------------------------------------------------

  function clampToHall(point) {
    point.x = THREE.MathUtils.clamp(point.x, -halfWidth + WALL_GAP, halfWidth - WALL_GAP);
    point.y = THREE.MathUtils.clamp(point.y, 0.3, height - 0.3);
    point.z = THREE.MathUtils.clamp(point.z, WALL_GAP + 0.1, length - 0.1 - WALL_GAP);
  }

  function collide() {
    // Inside the pilasters along the walls, and short of either end.
    const sideLimit = halfWidth - ribDepth - RADIUS;
    position.x = THREE.MathUtils.clamp(position.x, -sideLimit, sideLimit);
    position.z = THREE.MathUtils.clamp(position.z, 0.45 + RADIUS, length - 0.1 - RADIUS);

    // Round the bench: push out along whichever side is nearest.
    museumVisitor.getBenchBounds(benchBox);
    const minX = benchBox.min.x - RADIUS;
    const maxX = benchBox.max.x + RADIUS;
    const minZ = benchBox.min.z - RADIUS;
    const maxZ = benchBox.max.z + RADIUS;
    if (position.x > minX && position.x < maxX && position.z > minZ && position.z < maxZ) {
      const pushes = [
        [position.x - minX, () => (position.x = minX)],
        [maxX - position.x, () => (position.x = maxX)],
        [position.z - minZ, () => (position.z = minZ)],
        [maxZ - position.z, () => (position.z = maxZ)],
      ];
      pushes.sort((a, b) => a[0] - b[0])[0][1]();
    }
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desired = new THREE.Vector3();

  function update(deltaTime) {
    if (!active) return;
    const paused = isModalOpen() || busy;

    // Look: a little with the cursor, and turning near the edges.
    const smoothing = 1 - Math.exp(-LOOK_SMOOTHING * deltaTime);
    const lookingAround = pointerKnown && !paused && !focused;
    lookYaw = THREE.MathUtils.lerp(lookYaw, lookingAround ? -pointerX * LOOK_YAW : 0, smoothing);
    lookPitch = THREE.MathUtils.lerp(lookPitch, lookingAround ? -pointerY * LOOK_PITCH : 0, smoothing);
    if (lookingAround && Math.abs(pointerX) > EDGE) {
      const push = (Math.abs(pointerX) - EDGE) / (1 - EDGE);
      heading -= Math.sign(pointerX) * Math.pow(push, 1.5) * EDGE_TURN * deltaTime;
    }

    // Walk.
    let ahead = 0;
    let sideways = 0;
    let turn = 0;
    if (!paused) {
      if (keys.has("w") || keys.has("arrowup")) ahead += 1;
      if (keys.has("s") || keys.has("arrowdown")) ahead -= 1;
      if (keys.has("d")) sideways += 1;
      if (keys.has("a")) sideways -= 1;
      if (keys.has("arrowleft")) turn += 1;
      if (keys.has("arrowright")) turn -= 1;
    }
    if ((ahead || sideways || turn) && focused) clearFocus();
    heading += turn * TURN_SPEED * deltaTime;

    forward.set(-Math.sin(heading), 0, -Math.cos(heading));
    right.set(Math.cos(heading), 0, -Math.sin(heading));
    desired.set(0, 0, 0).addScaledVector(forward, ahead).addScaledVector(right, sideways);
    if (desired.lengthSq() > 0) {
      desired.normalize().multiplyScalar(keys.has("shift") ? RUN_SPEED : WALK_SPEED);
    }
    velocity.lerp(desired, 1 - Math.exp(-ACCELERATION * deltaTime));
    position.addScaledVector(velocity, deltaTime);
    collide();

    character.position.set(position.x, 0, position.z);
    character.rotation.y = heading;
    if (locomotion) {
      // Stepping back plays the strides backwards.
      const speed = velocity.length();
      const backwards = velocity.dot(forward) < -0.3 * speed;
      locomotion.update(deltaTime, backwards ? -speed : speed);
      mixer.update(deltaTime);
    }

    updateCamera(deltaTime);
  }

  function updateCamera(deltaTime, { snap = false } = {}) {
    const yaw = heading + lookYaw;
    const pitch = CAMERA_PITCH + lookPitch;
    const lookDirection = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    );
    followTarget.set(position.x, EYE_HEIGHT, position.z).addScaledVector(lookDirection, 2);
    followPosition
      .set(position.x, EYE_HEIGHT + CAMERA_RISE, position.z)
      .addScaledVector(lookDirection, -CAMERA_DISTANCE)
      .add(new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(CAMERA_SHOULDER));
    clampToHall(followPosition);

    // Swing between following and facing a work.
    const t = focus.amount;
    const wantedPosition = followPosition.clone().lerp(focusPosition, t);
    const wantedTarget = followTarget.clone().lerp(focusTarget, t);
    if (snap) {
      cameraPosition.copy(wantedPosition);
      lookAt.copy(wantedTarget);
    } else {
      const s = 1 - Math.exp(-CAMERA_SMOOTHING * deltaTime);
      cameraPosition.lerp(wantedPosition, t > 0 ? Math.max(s, t) : s);
      lookAt.lerp(wantedTarget, t > 0 ? Math.max(s, t) : s);
    }
    camera.position.copy(cameraPosition);
    camera.lookAt(lookAt);
  }

  function render(splatScene, splatCamera) {
    hallway.renderFrom(splatScene, splatCamera, camera);
  }

  function setSize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // --- Input -----------------------------------------------------------

  const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"]);

  window.addEventListener("keydown", (event) => {
    if (!active || busy || isModalOpen()) return;
    const key = event.key.toLowerCase();
    if (key === "escape") {
      if (focused) clearFocus();
      else exit();
      return;
    }
    if (MOVE_KEYS.has(key)) {
      keys.add(key);
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
  // Letting go of everything if the window loses focus mid-walk.
  window.addEventListener("blur", () => keys.clear());

  window.addEventListener("pointermove", (event) => {
    if (!active || event.pointerType !== "mouse") return;
    pointerX = THREE.MathUtils.clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
    pointerY = THREE.MathUtils.clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
    pointerKnown = true;
    if (!isModalOpen() && !busy) {
      canvas.style.cursor = pick(event.clientX, event.clientY) ? "pointer" : "";
    }
  });
  document.documentElement.addEventListener("pointerleave", () => {
    pointerKnown = false;
  });

  canvas.addEventListener("click", (event) => {
    if (!active || busy || isModalOpen()) return;
    const target = pick(event.clientX, event.clientY);
    if (!target) {
      clearFocus();
      return;
    }
    // A second click on the work being faced opens its project.
    if (target === focused && target !== "portrait" && focus.amount > 0.9) {
      onOpenWork(target.index, () => screenRect(target));
      return;
    }
    focusOn(target);
  });

  exitEl.addEventListener("click", exit);

  return { enter, exit, update, render, setSize, isActive: () => active };
}
