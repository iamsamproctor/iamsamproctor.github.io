import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";

const debugMode = new URLSearchParams(window.location.search).has("debug");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0.5, 0);
camera.rotation.order = "YXZ";

const baseRotation = {
  x: camera.rotation.x,
  y: camera.rotation.y,
};
const maxYaw = THREE.MathUtils.degToRad(22);
const maxPitch = THREE.MathUtils.degToRad(22);
const cameraSmoothing = 1;
const cameraPositionSmoothing = 1;
const splatSpinSpeed = 0.03; // radians per second
const baseCameraY = camera.position.y;
const scrollSensitivity = 0.003; // scene units per pixel of document scroll
let targetYaw = 0;
let targetPitch = 0;
let targetScrollDrop = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const spark = new SparkRenderer({ renderer });
scene.add(spark);

let debugCamera;
let debugControls;
let cameraHelper;
if (debugMode) {
  debugCamera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  debugCamera.position.set(4, 3, 4);

  debugControls = new OrbitControls(debugCamera, renderer.domElement);
  debugControls.target.set(0, 0, -5);
  debugControls.update();

  cameraHelper = new THREE.CameraHelper(camera);
  scene.add(cameraHelper);
  scene.add(new THREE.AxesHelper(2));
  scene.add(new THREE.GridHelper(20, 20));
}

const splatLibrary = {
  mom: "assets/splats/mom.spz",
  sfbotanicalgardens: "assets/splats/sfbotanicalgardens.spz",
  desert: "assets/splats/desert.spz",
};
const landingPageSplatNames = ["sfbotanicalgardens", "desert"];
const splatSwitchInterval = 10; // seconds
let splatIndex = 0;
let timeSinceSplatSwitch = 0;

// MOM
let splatLandingPage = new SplatMesh({ url: splatLibrary.mom });
splatLandingPage.position.set(0, -1.5, -2.5);
scene.add(splatLandingPage);

let transformControls;
let transformReadout;
if (debugMode) {
  transformControls = new TransformControls(debugCamera, renderer.domElement);
  transformControls.attach(splatLandingPage);
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

function switchSplat() {
  scene.remove(splatLandingPage);
  splatLandingPage.dispose();

  splatIndex = (splatIndex + 1) % landingPageSplatNames.length;
  splatLandingPage = new SplatMesh({ url: splatLibrary[landingPageSplatNames[splatIndex]] });
  splatLandingPage.position.set(0, 0, -3);
  scene.add(splatLandingPage);

  if (transformControls) {
    transformControls.attach(splatLandingPage);
  }
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

window.addEventListener(
  "scroll",
  () => {
    targetScrollDrop = window.scrollY * scrollSensitivity;
  },
  { passive: true },
);

let previousTime = performance.now();
renderer.setAnimationLoop(() => {
  const currentTime = performance.now();
  const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.1);
  previousTime = currentTime;

  const smoothing = 1 - Math.exp(-cameraSmoothing * deltaTime);
  camera.rotation.y = THREE.MathUtils.lerp(
    camera.rotation.y,
    baseRotation.y + targetYaw,
    smoothing,
  );
  camera.rotation.x = THREE.MathUtils.lerp(
    camera.rotation.x,
    baseRotation.x + targetPitch,
    smoothing,
  );

  const positionSmoothing = 1 - Math.exp(-cameraPositionSmoothing * deltaTime);
  camera.position.y = THREE.MathUtils.lerp(
    camera.position.y,
    baseCameraY - targetScrollDrop,
    positionSmoothing,
  );

  // splatLandingPage.rotation.y += splatSpinSpeed * deltaTime;

  // timeSinceSplatSwitch += deltaTime;
  // if (timeSinceSplatSwitch >= splatSwitchInterval) {
  //   timeSinceSplatSwitch -= splatSwitchInterval;
  //   switchSplat();
  // }

  if (debugMode) {
    cameraHelper.update();
    debugControls.update();

    const p = splatLandingPage.position;
    const r = splatLandingPage.rotation;
    const s = splatLandingPage.scale;
    transformReadout.textContent =
      `position: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\n` +
      `rotation: ${THREE.MathUtils.radToDeg(r.x).toFixed(1)}, ${THREE.MathUtils.radToDeg(r.y).toFixed(1)}, ${THREE.MathUtils.radToDeg(r.z).toFixed(1)}\n` +
      `scale:    ${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)}\n` +
      `(w: move, e: rotate, r: scale)`;

    renderer.render(scene, debugCamera);
  } else {
    renderer.render(scene, camera);
  }
});