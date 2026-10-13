import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// After the splat camera finishes its keyframes, the splat scene is rendered
// into a texture and hung as a portrait at the end of a dark gallery hallway.
// Scrolling further pulls the camera backward down the hallway, past framed
// works on the walls, until fog swallows everything to black.
//
// At progress 0 the portrait exactly fills the viewport, so switching from
// rendering the splat straight to the screen to rendering it via the
// portrait is invisible.

const PORTRAIT_HEIGHT = 1.4;
const EYE_HEIGHT = 1.6;
const HALL_WIDTH = 7;
const HALL_HEIGHT = 4;
const HALL_LENGTH = 34;
const END_DISTANCE = 26; // how far back the camera ends up, in world units
const RIB_SPACING = 3;
const RIB_DEPTH = 0.3; // pilaster/beam thickness
const FRAME_BORDER = 0.12; // total extra width/height of a work's frame
const FOV = 40;

// The render target only needs as many pixels as the portrait covers on
// screen, so its resolution steps down as the camera backs away. Stepped
// rather than continuous so the target isn't reallocated every frame.
const RESOLUTION_STEPS = [1, 0.75, 0.5, 0.35, 0.25];

export function createHallway({ renderer, works = [] }) {
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 6, 50);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
  camera.rotation.order = "YXZ";
  const startDistance = PORTRAIT_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
  let resolutionStep = 0;

  // Portrait. Spark writes sRGB values straight into whatever it renders to,
  // so the texture is passed through untouched (a ShaderMaterial skips
  // three's output color conversion). It ignores the fog and has its own
  // brightness instead, so it stays the last thing visible as the hallway
  // goes dark around it.
  const portraitMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      brightness: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float brightness;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(texture2D(map, vUv).rgb * brightness, 1.0);
      }
    `,
  });
  portraitMaterial.uniforms.map.value = renderTarget.texture;

  const portrait = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), portraitMaterial);
  portrait.position.set(0, EYE_HEIGHT, 0);
  scene.add(portrait);

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2620,
    roughness: 0.45,
    metalness: 0.6,
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.08), frameMaterial);
  frame.position.set(0, EYE_HEIGHT, -0.045);
  scene.add(frame);

  // The portrait is the main light in the hallway: a soft area light facing
  // down the corridor, so the walls and floor fall off into darkness.
  const portraitLight = new THREE.RectAreaLight(0xdfe6ff, 6, 1, 1);
  portraitLight.position.set(0, EYE_HEIGHT, 0.02);
  portraitLight.lookAt(0, EYE_HEIGHT, 10);
  scene.add(portraitLight);

  // Picture light over the portrait, washing the end wall and frame so the
  // portrait doesn't float in a black void.
  const pictureLight = new THREE.SpotLight(0xffe2c0, 14, 7, 0.75, 0.9, 1.6);
  pictureLight.position.set(0, HALL_HEIGHT - 0.3, 1.6);
  pictureLight.target.position.set(0, EYE_HEIGHT + 0.2, -0.1);
  scene.add(pictureLight, pictureLight.target);

  scene.add(new THREE.AmbientLight(0xffffff, 0.06));

  // Shell: end wall, side walls, ceiling, and a dim mirror floor under a
  // mostly opaque overlay so the portrait leaves a faint reflection.
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.92 });
  const halfWidth = HALL_WIDTH / 2;

  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, HALL_HEIGHT), wallMaterial);
  endWall.position.set(0, HALL_HEIGHT / 2, -0.1);
  scene.add(endWall);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(HALL_LENGTH, HALL_HEIGHT), wallMaterial);
    wall.rotation.y = -side * Math.PI / 2;
    wall.position.set(side * halfWidth, HALL_HEIGHT / 2, HALL_LENGTH / 2 - 0.1);
    scene.add(wall);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, HALL_LENGTH), wallMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, HALL_HEIGHT, HALL_LENGTH / 2 - 0.1);
  scene.add(ceiling);

  const mirror = new Reflector(new THREE.PlaneGeometry(HALL_WIDTH, HALL_LENGTH), {
    color: 0x666666,
    textureWidth: 512,
    textureHeight: 512,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, HALL_LENGTH / 2 - 0.1);
  scene.add(mirror);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALL_WIDTH, HALL_LENGTH),
    new THREE.MeshStandardMaterial({
      color: 0x0d0d0e,
      roughness: 0.8,
      transparent: true,
      opacity: 0.82,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.002, HALL_LENGTH / 2 - 0.1);
  scene.add(floor);

  // Ribs: a repeating portal of pilasters and a ceiling beam, which gives the
  // pull-back a sense of speed as they slide past.
  const ribMaterial = new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.7 });
  const pilasterGeometry = new THREE.BoxGeometry(RIB_DEPTH, HALL_HEIGHT, RIB_DEPTH);
  const beamGeometry = new THREE.BoxGeometry(HALL_WIDTH, RIB_DEPTH, RIB_DEPTH);
  for (let z = RIB_SPACING / 2; z < HALL_LENGTH; z += RIB_SPACING) {
    for (const side of [-1, 1]) {
      const pilaster = new THREE.Mesh(pilasterGeometry, ribMaterial);
      pilaster.position.set(side * (halfWidth - RIB_DEPTH / 2), HALL_HEIGHT / 2, z);
      scene.add(pilaster);
    }
    const beam = new THREE.Mesh(beamGeometry, ribMaterial);
    beam.position.set(0, HALL_HEIGHT - RIB_DEPTH / 2, z);
    scene.add(beam);
  }

  // Selected works hung along the walls, alternating sides, each under its
  // own picture light. Each one is centered in the bay between two ribs and
  // sized to fit inside it, so frames never cut into the pilasters.
  const bayClearWidth = RIB_SPACING - RIB_DEPTH - 0.3; // leaves a little wall either side
  const textureLoader = new THREE.TextureLoader();
  works.forEach((work, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const z = RIB_SPACING * (index + 1); // ribs sit at half-spacings, so this is mid-bay

    function sizeWork(aspect) {
      const height = Math.min(1, (bayClearWidth - FRAME_BORDER) / aspect);
      picture.scale.set(height * aspect, height, 1);
      workFrame.scale.set(height * aspect + FRAME_BORDER, height + FRAME_BORDER, 1);
    }

    const group = new THREE.Group();
    group.position.set(side * (halfWidth - 0.02), EYE_HEIGHT + 0.1, z);
    group.rotation.y = side * -Math.PI / 2;
    scene.add(group);

    const workFrame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.05), frameMaterial);
    group.add(workFrame);

    const picture = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    );
    picture.position.z = 0.03;
    group.add(picture);

    textureLoader.load(work.src, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = texture.image.width / texture.image.height;
      picture.material.map = texture;
      picture.material.needsUpdate = true;
      sizeWork(aspect);
    });
    sizeWork(16 / 9);

    const spot = new THREE.SpotLight(0xffe2c0, 18, 6, 0.5, 0.7, 2);
    spot.position.set(side * (halfWidth - 1.4), HALL_HEIGHT - 0.2, z);
    spot.target.position.set(side * halfWidth, EYE_HEIGHT, z);
    scene.add(spot, spot.target);
  });

  function sizePortrait(aspect) {
    const width = PORTRAIT_HEIGHT * aspect;
    portrait.scale.set(width, PORTRAIT_HEIGHT, 1);
    frame.scale.set(width + 0.16, PORTRAIT_HEIGHT + 0.16, 1);
    portraitLight.width = width;
    portraitLight.height = PORTRAIT_HEIGHT;
  }

  function sizeRenderTarget() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const scale = RESOLUTION_STEPS[resolutionStep];
    renderTarget.setSize(
      Math.max(1, Math.round(size.x * scale)),
      Math.max(1, Math.round(size.y * scale)),
    );
  }

  function setSize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    sizePortrait(camera.aspect);
    sizeRenderTarget();
  }

  // progress: 0 = portrait fills the screen, 1 = fully faded to black.
  // yaw/pitch: the same pointer look offsets the splat camera uses, eased in
  // as the camera pulls back so the frame stays locked at the seam.
  function update(progress, yaw, pitch) {
    const travel = THREE.MathUtils.smootherstep(progress, 0, 0.92);
    const distance = THREE.MathUtils.lerp(startDistance, END_DISTANCE, travel);
    camera.position.set(0, EYE_HEIGHT, distance);

    const look = THREE.MathUtils.smoothstep(progress, 0, 0.15);
    camera.rotation.set(pitch * 0.25 * look, yaw * 0.25 * look, 0);

    // Fog closes in on the hallway first; the portrait dims last.
    const fade = THREE.MathUtils.smoothstep(progress, 0.5, 0.9);
    scene.fog.near = THREE.MathUtils.lerp(6, 0, fade);
    scene.fog.far = THREE.MathUtils.lerp(50, 0.5, fade);
    portraitMaterial.uniforms.brightness.value =
      1 - THREE.MathUtils.smoothstep(progress, 0.8, 1);

    // How much of the screen height the portrait covers, for resolution.
    const coverage = startDistance / distance;
    let step = RESOLUTION_STEPS.length - 1;
    while (step > 0 && RESOLUTION_STEPS[step] < coverage) step--;
    if (progress <= 0) step = 0;
    if (step !== resolutionStep) {
      resolutionStep = step;
      sizeRenderTarget();
    }
  }

  // Draws the splat scene into the portrait, then the hallway to the screen.
  function render(splatScene, splatCamera) {
    renderer.setRenderTarget(renderTarget);
    renderer.render(splatScene, splatCamera);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }

  // scene is exposed so other pieces (e.g. museumVisitor.js) can be placed
  // in the hallway.
  return { scene, setSize, update, render };
}
