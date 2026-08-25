import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";

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
const maxYaw = THREE.MathUtils.degToRad(35);
const maxPitch = THREE.MathUtils.degToRad(22);
const cameraSmoothing = 50;
const cameraPositionSmoothing = 0.4;
const splatSpinSpeed = 0.03; // radians per second
const baseCameraY = camera.position.y;
const maxScrollDrop = 1.5;
const scrollSensitivity = 0.002;
let targetYaw = 0;
let targetPitch = 0;
let targetScrollDrop = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const spark = new SparkRenderer({ renderer });
scene.add(spark);

const splatUrls = [
  "assets/splats/sfbotanicalgardens.spz",
  "assets/splats/desert.spz",
];
const splatSwitchInterval = 10; // seconds
let splatIndex = 0;
let timeSinceSplatSwitch = 0;

let splat = new SplatMesh({ url: splatUrls[splatIndex] });
splat.position.set(0, 0, -3);
scene.add(splat);

function switchSplat() {
  scene.remove(splat);
  splat.dispose();

  splatIndex = (splatIndex + 1) % splatUrls.length;
  splat = new SplatMesh({ url: splatUrls[splatIndex] });
  splat.position.set(0, 0, -3);
  scene.add(splat);
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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
  "wheel",
  (event) => {
    targetScrollDrop = THREE.MathUtils.clamp(
      targetScrollDrop + event.deltaY * scrollSensitivity,
      0,
      maxScrollDrop,
    );
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

  splat.rotation.y += splatSpinSpeed * deltaTime;

  timeSinceSplatSwitch += deltaTime;
  if (timeSinceSplatSwitch >= splatSwitchInterval) {
    timeSinceSplatSwitch -= splatSwitchInterval;
    switchSplat();
  }

  renderer.render(scene, camera);
});