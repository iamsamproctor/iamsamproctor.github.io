import * as THREE from "three";
import gsap from "gsap";
import { loadJosh } from "./josh.js";
import { createBlendTree1D } from "./blendTree1D.js";

// Walking the gallery: from the end of the hallway, the scene fades to black
// and back in with the museum visitor (Josh, see josh.js) standing up from
// the bench, and he walks the hallway in third person, and on through the
// doors at its far end into the grand room (grandRoom.js). Idle, walk and run
// are blended by his speed (see blendTree1D.js). Leaving fades back out and
// returns to the visitor sitting on the bench, exactly where the page was
// left.
//
// Controls (mouse and keyboard; it isn't offered on touch screens yet), as in
// most third-person games:
//  - Clicking the scene captures the mouse (pointer lock), which then turns
//    the camera; nothing else does. Esc frees it again.
//  - WASD or the arrow keys walk relative to the camera (W away from it, S
//    toward it, A/D across), Shift runs. He turns to face where he's going.
//  - Clicking a work under the crosshair brings the camera round to face it;
//    clicking it again opens its project (onOpenWork). Exhibits in the grand
//    room work the same way, a second click touching them instead. Walking,
//    looking away, clicking elsewhere, or Esc steps back from it.
//  - Tab (or Enter, see gameMenu.js) opens the menu, and M toggles the sound
//    (main.js), for while the mouse is captured.
//  - Esc with the mouse free (and not looking at a work) leaves.

const FADE = 0.55; // seconds for each half of the fade through black

const RADIUS = 0.28; // how close he gets to walls and things on the floor
const WALK_SPEED = 2.1; // world units per second
const RUN_SPEED = 3.6;
const ACCELERATION = 10; // how quickly he reaches speed and stops
const FACE_SMOOTHING = 10; // how quickly he turns to face where he's going
const SPAWN = new THREE.Vector3(0, 0, 3.7); // just in front of the bench
const DOOR_REACH = 3.5; // how close the doors open at

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

// Looking around with the mouse, once it's captured (pointer lock).
const MOUSE_TURN = THREE.MathUtils.degToRad(0.12); // camera turn per px of mouse movement
const PITCH_MIN = THREE.MathUtils.degToRad(-35); // furthest it looks down
const PITCH_MAX = THREE.MathUtils.degToRad(20); // and up
const LOOK_AWAY = 60; // px of mouse movement that looks away from a work being faced
// The Esc that frees the mouse may reach the page too; one this soon after
// is that one, not a second press to leave.
const UNLOCK_ESC_GRACE = 250; // ms
const ESC_HINT_FRESH = 3000; // ms the "esc to free your cursor" hint stays bright

const FOCUS_DURATION = 0.9; // seconds to swing round to face a work
const FOCUS_MARGIN = 1.35; // room around a work when facing it

export function createGalleryExplore({ hallway, museumVisitor, onOpenWork, onOpenMenu, isModalOpen }) {
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 100);
  camera.rotation.order = "YXZ";

  const fadeEl = document.querySelector(".gallery-fade");
  const hudEl = document.querySelector(".gallery-hud");
  const exitEl = hudEl.querySelector(".gallery-exit");
  const crosshairEl = hudEl.querySelector(".gallery-crosshair");
  const lookHintEl = hudEl.querySelector(".gallery-look-hint");
  const escHintEl = hudEl.querySelector(".gallery-esc-hint");
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

  const { areas, obstacles } = hallway.floorPlan;
  const benchBox = new THREE.Box3();

  let active = false;
  let busy = false; // mid-fade
  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let heading = 0; // the way he faces, in radians; 0 faces the portrait (-z)
  let cameraYaw = 0; // the way the camera faces, likewise; only the mouse turns it
  let cameraPitch = CAMERA_PITCH;
  const keys = new Set();

  // Facing a work: which one, and how far the camera has swung round to it.
  let focused = null; // a hallway.pieces or hallway.exhibits entry, or "portrait"
  let lookAway = 0; // px the mouse has moved since facing it
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
    lockScroll();
    // While the click that entered still counts as one, so it's allowed.
    captureMouse();
    fadeThrough(() => {
      active = true;
      document.body.classList.add("is-exploring");
      museumVisitor.setFigureVisible(false);
      hallway.setGrandRoomVisible(true);
      character.visible = true;
      position.copy(SPAWN);
      velocity.set(0, 0, 0);
      heading = 0;
      cameraYaw = 0;
      cameraPitch = CAMERA_PITCH;
      clearFocus({ instant: true });
      keys.clear();
      updateCamera(0, { snap: true });
      hudEl.hidden = false;
    });
  }

  // onLeft: called once the page is back underneath (and can scroll again),
  // hidden by the fade.
  function exit({ onLeft } = {}) {
    if (!active || busy) return;
    releaseMouse();
    fadeThrough(() => {
      active = false;
      document.body.classList.remove("is-exploring");
      unlockScroll();
      museumVisitor.setFigureVisible(true);
      hallway.setGrandRoomVisible(false);
      character.visible = false;
      clearFocus({ instant: true });
      keys.clear();
      canvas.style.cursor = "";
      hudEl.hidden = true;
      onLeft?.();
    });
  }

  // --- Facing a work ---------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = () => [
    hallway.portrait,
    ...hallway.pieces.map((piece) => piece.picture),
    ...hallway.exhibits.map((exhibit) => exhibit.hitbox),
  ];

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
    return (
      hallway.pieces.find((piece) => piece.picture === hit.object) ??
      hallway.exhibits.find((exhibit) => exhibit.hitbox === hit.object) ??
      null
    );
  }

  // What the crosshair is on, in the middle of the screen.
  function pickAtCenter() {
    const rect = canvas.getBoundingClientRect();
    return pick(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  const normal = new THREE.Vector3();
  const size = new THREE.Vector3();
  function focusOn(target) {
    focused = target;
    lookAway = 0;
    focusTween?.kill();
    focusTween = gsap.to(focus, { amount: 1, duration: FOCUS_DURATION, ease: "power2.inOut" });

    // Exhibits know where to be viewed from.
    if (target.focusPosition) {
      focusPosition.copy(target.focusPosition);
      focusTarget.copy(target.focusTarget);
      return;
    }

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
    confine(focusPosition, WALL_GAP, { vertical: true });
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

  // Keeps a point on the open floor (hallway.floorPlan's areas), at least
  // `margin` from any wall: if it's strayed outside all of them, it's moved to
  // the nearest point that isn't, which slides it along walls. With
  // `vertical`, it's also kept under that area's ceiling (for the camera).
  const clamped = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  function confine(point, margin, { vertical = false } = {}) {
    let best = null;
    let bestDistance = Infinity;
    for (const area of areas) {
      if (area.door && !hallway.doors.isOpen()) continue;
      clamped.set(
        THREE.MathUtils.clamp(point.x, area.minX + margin, area.maxX - margin),
        point.y,
        THREE.MathUtils.clamp(point.z, area.minZ + margin, area.maxZ - margin),
      );
      const distance = clamped.distanceToSquared(point);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = area;
        nearest.copy(clamped);
      }
      if (distance === 0) break;
    }
    point.copy(nearest);
    if (vertical) point.y = THREE.MathUtils.clamp(point.y, 0.3, best.height - 0.3);
  }

  function pushOutOfBox(minX, maxX, minZ, maxZ) {
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

  function collide() {
    confine(position, RADIUS);

    // Round whatever's on the floor: out along whichever side is nearest.
    for (const obstacle of obstacles) {
      if (obstacle.radius) {
        const dx = position.x - obstacle.x;
        const dz = position.z - obstacle.z;
        const reach = obstacle.radius + RADIUS;
        const distance = Math.hypot(dx, dz);
        if (distance < reach && distance > 0) {
          position.x = obstacle.x + (dx / distance) * reach;
          position.z = obstacle.z + (dz / distance) * reach;
        }
      } else {
        const { min, max } = obstacle;
        pushOutOfBox(min.x - RADIUS, max.x + RADIUS, min.z - RADIUS, max.z + RADIUS);
      }
    }
    museumVisitor.getBenchBounds(benchBox);
    pushOutOfBox(
      benchBox.min.x - RADIUS,
      benchBox.max.x + RADIUS,
      benchBox.min.z - RADIUS,
      benchBox.max.z + RADIUS,
    );
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desired = new THREE.Vector3();

  // The signed turn from angle `from` to angle `to`, the short way round.
  const angleTo = (from, to) => THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;

  function update(deltaTime) {
    if (!active) return;
    const paused = isModalOpen() || busy;
    // The menu or a project needs the cursor back.
    if (isModalOpen()) releaseMouse();
    syncLookUi();

    // Walk, relative to the camera: away from it, toward it, or across.
    let ahead = 0;
    let sideways = 0;
    if (!paused) {
      if (keys.has("w") || keys.has("arrowup")) ahead += 1;
      if (keys.has("s") || keys.has("arrowdown")) ahead -= 1;
      if (keys.has("d") || keys.has("arrowright")) sideways += 1;
      if (keys.has("a") || keys.has("arrowleft")) sideways -= 1;
    }
    if ((ahead || sideways) && focused) clearFocus();

    forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    desired.set(0, 0, 0).addScaledVector(forward, ahead).addScaledVector(right, sideways);
    if (desired.lengthSq() > 0) {
      desired.normalize();
      // He turns to face that way, the short way round.
      const facing = Math.atan2(-desired.x, -desired.z);
      heading += angleTo(heading, facing) * (1 - Math.exp(-FACE_SMOOTHING * deltaTime));
      desired.multiplyScalar(keys.has("shift") ? RUN_SPEED : WALK_SPEED);
    }
    velocity.lerp(desired, 1 - Math.exp(-ACCELERATION * deltaTime));
    position.addScaledVector(velocity, deltaTime);
    // The doors into the grand room open as he comes up to them, from either
    // side, and close once he's moved on.
    hallway.doors.update(deltaTime, position.distanceTo(hallway.doors.center) < DOOR_REACH);
    collide();

    character.position.set(position.x, 0, position.z);
    character.rotation.y = heading;
    if (locomotion) {
      locomotion.update(deltaTime, velocity.length());
      mixer.update(deltaTime);
    }

    updateCamera(deltaTime);
  }

  function updateCamera(deltaTime, { snap = false } = {}) {
    const yaw = cameraYaw;
    const pitch = cameraPitch;
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
    confine(followPosition, WALL_GAP, { vertical: true });

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
    // defaultPrevented: already handled, e.g. Esc closing the menu.
    if (!active || busy || isModalOpen() || event.defaultPrevented) return;
    const key = event.key.toLowerCase();
    if (key === "escape") {
      // The first Esc frees the mouse (the browser does that itself).
      if (isMouseCaptured() || performance.now() - mouseFreedAt < UNLOCK_ESC_GRACE) return;
      if (focused) clearFocus();
      else exit();
      return;
    }
    // Tab opens the menu, as in a game (freeing the mouse, see update).
    if (key === "tab") {
      event.preventDefault();
      keys.clear();
      onOpenMenu();
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

  // The page under the walk stays put (from entering until the fade back
  // out). overflow: hidden alone doesn't stop every browser or trackpad
  // scrolling the root, so the wheel and scrolling keys are swallowed too,
  // and any scroll that still gets through is undone. Not inside the menu or
  // a project, which scroll themselves.
  let lockedScrollY = null;
  const SCROLL_KEYS = new Set([" ", "pageup", "pagedown", "home", "end"]);
  const ownsScroll = (event) =>
    event.target.closest?.(".menu-modal, .portrait-viewer, button, a, input, textarea") != null;

  function lockScroll() {
    lockedScrollY = window.scrollY;
    document.documentElement.style.overflow = "hidden";
  }

  function unlockScroll() {
    lockedScrollY = null;
    document.documentElement.style.overflow = "";
  }

  window.addEventListener(
    "wheel",
    (event) => {
      if (lockedScrollY !== null && !ownsScroll(event)) event.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener("keydown", (event) => {
    if (lockedScrollY !== null && SCROLL_KEYS.has(event.key.toLowerCase()) && !ownsScroll(event)) {
      event.preventDefault();
    }
  });
  window.addEventListener("scroll", () => {
    if (lockedScrollY !== null && window.scrollY !== lockedScrollY) window.scrollTo(0, lockedScrollY);
  });

  // The mouse turns the camera once it's captured (pointer lock): clicking
  // the scene captures it, and Esc, the menu or a project frees it. While
  // captured, a crosshair in the middle of the screen picks works.
  const isMouseCaptured = () => document.pointerLockElement === canvas;
  let mouseFreedAt = -Infinity;

  function captureMouse() {
    if (isMouseCaptured()) return;
    // Refused e.g. just after Esc freed it; the hint stays up to try again.
    try {
      canvas.requestPointerLock()?.catch?.(() => {});
    } catch {
      // Not supported: the hint stays up.
    }
  }

  function releaseMouse() {
    if (isMouseCaptured()) document.exitPointerLock();
  }

  // Each time the mouse is captured, the Esc hint starts out bright.
  let escHintFade = null;
  document.addEventListener("pointerlockchange", () => {
    if (isMouseCaptured()) {
      escHintEl.classList.add("is-fresh");
      clearTimeout(escHintFade);
      escHintFade = setTimeout(() => escHintEl.classList.remove("is-fresh"), ESC_HINT_FRESH);
    } else {
      mouseFreedAt = performance.now();
    }
    syncLookUi();
  });

  // The crosshair (filled in over something to click) and how to free the
  // cursor while captured, and an invitation to click into the scene while not.
  function syncLookUi() {
    const captured = isMouseCaptured();
    hudEl.classList.toggle("is-captured", captured);
    escHintEl.hidden = !captured || busy;
    crosshairEl.hidden = !captured || busy;
    crosshairEl.classList.toggle("is-over", captured && !busy && pickAtCenter() !== null);
    lookHintEl.hidden = captured || !active || busy || isModalOpen();
    canvas.style.cursor = lookHintEl.hidden ? "" : "pointer";
  }

  document.addEventListener("mousemove", (event) => {
    if (!active || busy || !isMouseCaptured()) return;
    // Facing a work holds the view until the mouse moves a little way.
    if (focused) {
      lookAway += Math.abs(event.movementX) + Math.abs(event.movementY);
      if (lookAway < LOOK_AWAY) return;
      clearFocus();
    }
    cameraYaw -= event.movementX * MOUSE_TURN;
    cameraPitch = THREE.MathUtils.clamp(cameraPitch - event.movementY * MOUSE_TURN, PITCH_MIN, PITCH_MAX);
  });

  canvas.addEventListener("click", () => {
    if (!active || busy || isModalOpen()) return;
    if (!isMouseCaptured()) {
      captureMouse();
      return;
    }
    const target = pickAtCenter();
    if (!target) {
      clearFocus();
      return;
    }
    // A second click on the work being faced opens its project, or on an
    // exhibit, touches it.
    if (target === focused && target !== "portrait" && focus.amount > 0.9) {
      if (target.interact) target.interact();
      else {
        releaseMouse();
        onOpenWork(target.index, () => screenRect(target));
      }
      return;
    }
    focusOn(target);
  });

  exitEl.addEventListener("click", () => exit());

  return { enter, exit, update, render, setSize, isActive: () => active };
}
