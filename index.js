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
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const spark = new SparkRenderer({ renderer });
scene.add(spark);

const butterfly = new SplatMesh({ url: "assets/splats/sfbotanicalgardens.spz" });
butterfly.position.set(0, 0, -3);
scene.add(butterfly);

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", handleResize);

renderer.setAnimationLoop(() => {
  butterfly.rotation.y += 0.002;
  renderer.render(scene, camera);
});