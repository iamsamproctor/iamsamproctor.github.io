import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

// Josh, the gallery's character, and his animations. They began as Mixamo
// FBXs (the model in a T-pose with skin, the animations without) and were
// converted to glTF with FBX2glTF; the model's textures were then shrunk to
// WebP and its meshes compressed with gltf-transform (meshopt). The clips were
// given a held key for every bone they leave still, so each poses the whole
// skeleton itself rather than falling back to Josh's T-pose. They share the
// mixamorig skeleton, so any of the clips plays on him.
//
// Nothing is fetched until loadJosh() is first called; after that every
// caller shares the one load.

const MODEL_URL = "/assets/models/Josh.glb";
const CLIP_URLS = {
  idle: "/assets/animations/Idle.glb",
  walk: "/assets/animations/Walking.glb",
  run: "/assets/animations/Running.glb",
  sittingIdle: "/assets/animations/SittingIdle.glb",
};

export const JOSH_HEIGHT = 1.75; // standing height he's scaled to, in world units (m)

let loading = null;

// Resolves to { clips, create }: clips by name (see CLIP_URLS), and create()
// for a new Josh with his own skeleton, so several can be posed at once. The
// copies share geometry and textures.
export function loadJosh() {
  if (loading) return loading;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const names = Object.keys(CLIP_URLS);
  loading = Promise.all([
    loader.loadAsync(MODEL_URL),
    ...names.map((name) => loader.loadAsync(CLIP_URLS[name])),
  ]).then(([{ scene: model }, ...animations]) => {
    // Scale by the bind-pose height instead of assuming, so any character
    // comes out the same size.
    const box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(JOSH_HEIGHT / (box.max.y - box.min.y));
    model.traverse((node) => {
      if (node.isSkinnedMesh) node.frustumCulled = false;
    });

    const clips = Object.fromEntries(names.map((name, i) => [name, animations[i].animations[0]]));
    return { clips, create: () => SkeletonUtils.clone(model) };
  });
  return loading;
}
