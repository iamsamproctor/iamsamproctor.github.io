import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { createGrandRoom, doorwayWallShape } from "./grandRoom.js";

// After the splat camera finishes its keyframes, the splat scene is rendered
// into a texture and hung as a portrait at the end of a dark gallery hallway.
// Scrolling further pulls the camera backward down the hallway, past framed
// works on the walls, to a resting view from behind the museum visitor's
// bench, where the page ends and the menu button appears.
//
// At progress 0 the portrait exactly fills the viewport, so switching from
// rendering the splat straight to the screen to rendering it via the
// portrait is invisible.

const PORTRAIT_HEIGHT = 1.4;
const EYE_HEIGHT = 1.6;
const HALL_WIDTH = 7;
const HALL_HEIGHT = 4;
// The hall gets one bay per work (see hallLength), but never so short that
// the resting view and the ceiling lights behind it run into the doors.
const MIN_HALL_LENGTH = 15;
// How far back the camera ends up, in world units: just behind the bench,
// with the portrait, quote, and first work in view. Scaled with main.js's
// hallwayScrollRange so the pull-back keeps its pace.
const END_DISTANCE = 10.5;
const RIB_SPACING = 3;
const RIB_DEPTH = 0.3; // pilaster/beam thickness
const FRAME_BORDER = 0.12; // total extra width/height of a work's frame
const FOV = 40;
const CEILING_LIGHTS_FROM = 13.5; // the rib just behind the resting view
const CEILING_PANEL_WIDTH = 1.2;
const CEILING_LIGHT_COLOR = 0xfff1e0;
const CEILING_LIGHT_INTENSITY = 8;
const DOOR_WIDTH = 2.4; // both leaves together
const DOOR_HEIGHT = 3;
const DOOR_CASING = 0.14;
const DOOR_SWING = 0.9; // seconds to open or close
const DOOR_OPEN_ANGLE = THREE.MathUtils.degToRad(92);
const WALL_THICKNESS = 0.4; // between the hallway and the grand room

// The render target only needs as many pixels as the portrait covers on
// screen, so its resolution steps down as the camera backs away. Stepped
// rather than continuous so the target isn't reallocated every frame.
const RESOLUTION_STEPS = [1, 0.75, 0.5, 0.35, 0.25];

export function createHallway({ renderer, works = [] }) {
  RectAreaLightUniformsLib.init();

  // Long enough for each work to hang in a bay of its own, ending at the rib
  // after the last one, where the doors into the grand room are.
  const hallLength = Math.max(RIB_SPACING * (works.length + 1), MIN_HALL_LENGTH);

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
  // three's output color conversion). It ignores the fog, so it stays fully
  // lit at any distance, and has a brightness uniform (left at 1) for
  // dimming it if that's ever wanted.
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
  // Aimed above the frame so the pool also takes in the quote on the wall.
  pictureLight.target.position.set(0, EYE_HEIGHT + 0.55, -0.1);
  scene.add(pictureLight, pictureLight.target);

  scene.add(new THREE.AmbientLight(0xffffff, 0.06));

  // Shell: end wall, side walls, ceiling, and a dim mirror floor under a
  // mostly opaque overlay so the portrait leaves a faint reflection.
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.92 });
  const halfWidth = HALL_WIDTH / 2;

  const endWall = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, HALL_HEIGHT), wallMaterial);
  endWall.position.set(0, HALL_HEIGHT / 2, -0.1);
  scene.add(endWall);

  // The far end, only ever seen when walking the gallery (galleryExplore.js)
  // and turning around; the scrolled view always faces the portrait. Its
  // doors lead through a doorway WALL_THICKNESS deep into the grand room.
  const farWallZ = hallLength - 0.1;
  const farWall = new THREE.Mesh(
    new THREE.ShapeGeometry(doorwayWallShape(HALL_WIDTH, HALL_HEIGHT, DOOR_WIDTH, DOOR_HEIGHT)),
    wallMaterial,
  );
  farWall.rotation.y = Math.PI;
  farWall.position.z = farWallZ;
  scene.add(farWall);
  for (const side of [-1, 1]) {
    const reveal = new THREE.Mesh(new THREE.PlaneGeometry(WALL_THICKNESS, DOOR_HEIGHT), wallMaterial);
    reveal.rotation.y = side * -Math.PI / 2; // facing into the doorway
    reveal.position.set(side * DOOR_WIDTH / 2, DOOR_HEIGHT / 2, farWallZ + WALL_THICKNESS / 2);
    scene.add(reveal);
  }
  const soffit = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_WIDTH, WALL_THICKNESS), wallMaterial);
  soffit.rotation.x = Math.PI / 2;
  soffit.position.set(0, DOOR_HEIGHT, farWallZ + WALL_THICKNESS / 2);
  scene.add(soffit);

  const doors = createDoors(farWallZ);
  scene.add(doors.group);

  // Only built into the scene while walking the gallery (setGrandRoomVisible):
  // its lights would otherwise cost every lit pixel of the scrolled view too.
  const grandRoom = createGrandRoom({
    entranceZ: farWallZ + WALL_THICKNESS,
    doorWidth: DOOR_WIDTH,
    doorHeight: DOOR_HEIGHT,
    wallThickness: WALL_THICKNESS,
  });
  grandRoom.group.visible = false;
  scene.add(grandRoom.group);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(hallLength, HALL_HEIGHT), wallMaterial);
    wall.rotation.y = -side * Math.PI / 2;
    wall.position.set(side * halfWidth, HALL_HEIGHT / 2, hallLength / 2 - 0.1);
    scene.add(wall);
  }

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALL_WIDTH, hallLength), wallMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, HALL_HEIGHT, hallLength / 2 - 0.1);
  scene.add(ceiling);

  const mirror = new Reflector(new THREE.PlaneGeometry(HALL_WIDTH, hallLength), {
    color: 0x666666,
    textureWidth: 512,
    textureHeight: 512,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, hallLength / 2 - 0.1);
  scene.add(mirror);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALL_WIDTH, hallLength),
    new THREE.MeshStandardMaterial({
      color: 0x0d0d0e,
      roughness: 0.8,
      transparent: true,
      opacity: 0.82,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.002, hallLength / 2 - 0.1);
  scene.add(floor);

  // Ribs: a repeating portal of pilasters and a ceiling beam, which gives the
  // pull-back a sense of speed as they slide past.
  const ribMaterial = new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.7 });
  const pilasterGeometry = new THREE.BoxGeometry(RIB_DEPTH, HALL_HEIGHT, RIB_DEPTH);
  const beamGeometry = new THREE.BoxGeometry(HALL_WIDTH, RIB_DEPTH, RIB_DEPTH);
  for (let z = RIB_SPACING / 2; z < hallLength; z += RIB_SPACING) {
    for (const side of [-1, 1]) {
      const pilaster = new THREE.Mesh(pilasterGeometry, ribMaterial);
      pilaster.position.set(side * (halfWidth - RIB_DEPTH / 2), HALL_HEIGHT / 2, z);
      scene.add(pilaster);
    }
    const beam = new THREE.Mesh(beamGeometry, ribMaterial);
    beam.position.set(0, HALL_HEIGHT - RIB_DEPTH / 2, z);
    scene.add(beam);
  }

  // Ceiling lights down the rest of the hall, from just behind the resting
  // view to the far wall: a glowing panel in each bay, and one long soft area
  // light under them standing in for all of them (one light is much cheaper
  // than one per panel). The portrait end keeps its own low light; this only
  // reaches it as a faint spill.
  const panelLength = RIB_SPACING - RIB_DEPTH - 0.6;
  const panelGeometry = new THREE.PlaneGeometry(CEILING_PANEL_WIDTH, panelLength);
  const panelMaterial = new THREE.MeshBasicMaterial({ color: CEILING_LIGHT_COLOR });
  for (
    let z = CEILING_LIGHTS_FROM + RIB_SPACING / 2;
    z + panelLength / 2 < hallLength - 0.1;
    z += RIB_SPACING
  ) {
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.rotation.x = Math.PI / 2;
    panel.position.set(0, HALL_HEIGHT - 0.005, z);
    scene.add(panel);
  }
  const ceilingLightLength = hallLength - 0.1 - CEILING_LIGHTS_FROM;
  const ceilingLight = new THREE.RectAreaLight(
    CEILING_LIGHT_COLOR,
    CEILING_LIGHT_INTENSITY,
    CEILING_PANEL_WIDTH,
    ceilingLightLength,
  );
  ceilingLight.rotation.x = -Math.PI / 2; // facing down, its length along the hall
  ceilingLight.position.set(0, HALL_HEIGHT - 0.01, CEILING_LIGHTS_FROM + ceilingLightLength / 2);
  scene.add(ceilingLight);

  // Selected works hung along the walls, alternating sides, each under its
  // own picture light. Each one is centered in the bay between two ribs and
  // sized to fit inside it, so frames never cut into the pilasters.
  const bayClearWidth = RIB_SPACING - RIB_DEPTH - 0.3; // leaves a little wall either side
  const textureLoader = new THREE.TextureLoader();
  // Resolves once every work's image has loaded (or failed), since a picture
  // gaining its texture changes its shader; see warmUp.
  const workLoads = [];
  // Each hung work, for picking them out when walking the gallery: index (as
  // in `works`), the picture mesh, and its wall side (-1 left, 1 right).
  const pieces = [];
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
    pieces.push({ index, picture, side });

    workLoads.push(
      new Promise((resolve) => {
        textureLoader.load(
          work.src,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            const aspect = texture.image.width / texture.image.height;
            picture.material.map = texture;
            picture.material.needsUpdate = true;
            sizeWork(aspect);
            resolve();
          },
          undefined,
          resolve,
        );
      }),
    );
    sizeWork(16 / 9);

    const spot = new THREE.SpotLight(0xffe2c0, 18, 6, 0.5, 0.7, 2);
    spot.position.set(side * (halfWidth - 1.4), HALL_HEIGHT - 0.2, z);
    spot.target.position.set(side * halfWidth, EYE_HEIGHT, z);
    scene.add(spot, spot.target);
  });

  // A pair of tall doors in the far wall into the grand room: panelled leaves
  // in a casing, bar pulls at the seam, and a thread of warm light under them
  // while they're shut. They swing open away from the hall (update). Built
  // facing +z, then turned to face back up the hall.
  function createDoors(wallZ) {
    const doors = new THREE.Group();
    doors.position.set(0, 0, wallZ);
    doors.rotation.y = Math.PI;

    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.55 });
    const casingMaterial = new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.7 });
    const pullMaterial = new THREE.MeshStandardMaterial({ color: 0x8c7a5c, roughness: 0.3, metalness: 0.85 });
    const leafWidth = DOOR_WIDTH / 2;

    // Casing: two jambs and a head, standing proud of the wall.
    const jambGeometry = new THREE.BoxGeometry(DOOR_CASING, DOOR_HEIGHT + DOOR_CASING, 0.1);
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(jambGeometry, casingMaterial);
      jamb.position.set(side * (DOOR_WIDTH / 2 + DOOR_CASING / 2), (DOOR_HEIGHT + DOOR_CASING) / 2, 0.05);
      doors.add(jamb);
    }
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH + DOOR_CASING * 2, DOOR_CASING, 0.1),
      casingMaterial,
    );
    head.position.set(0, DOOR_HEIGHT + DOOR_CASING / 2, 0.05);
    doors.add(head);

    // Leaves, each with a tall raised panel over a short one.
    const leafGeometry = new THREE.BoxGeometry(leafWidth - 0.01, DOOR_HEIGHT - 0.012, 0.05);
    const panelInset = 0.14;
    const panelWidth = leafWidth - panelInset * 2;
    const lowerHeight = 0.7;
    const upperHeight = DOOR_HEIGHT - lowerHeight - panelInset * 3;
    const upperGeometry = new THREE.BoxGeometry(panelWidth, upperHeight, 0.02);
    const lowerGeometry = new THREE.BoxGeometry(panelWidth, lowerHeight, 0.02);
    const pullGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 12);
    // Each leaf hangs from a hinge at its outer edge, set in a little from
    // the reveal so it clears it when open.
    const hinges = [];
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(side * (DOOR_WIDTH / 2 - 0.04), 0, 0);
      doors.add(hinge);
      hinges.push({ hinge, side });
      const leaf = new THREE.Group();
      leaf.position.set(-side * (leafWidth / 2 - 0.04), 0, 0.025);
      hinge.add(leaf);

      const slab = new THREE.Mesh(leafGeometry, leafMaterial);
      slab.position.y = 0.012 + (DOOR_HEIGHT - 0.012) / 2;
      leaf.add(slab);

      const lower = new THREE.Mesh(lowerGeometry, leafMaterial);
      lower.position.set(0, panelInset + lowerHeight / 2, 0.03);
      const upper = new THREE.Mesh(upperGeometry, leafMaterial);
      upper.position.set(0, panelInset * 2 + lowerHeight + upperHeight / 2, 0.03);
      leaf.add(lower, upper);

      // A long vertical bar pull, just in from the seam.
      const pull = new THREE.Mesh(pullGeometry, pullMaterial);
      pull.position.set(-side * (leafWidth / 2 - 0.12), 1.15, 0.08);
      leaf.add(pull);
      for (const end of [-1, 1]) {
        const standoff = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), pullMaterial);
        standoff.position.set(pull.position.x, 1.15 + end * 0.38, 0.05);
        leaf.add(standoff);
      }
    }

    // A light over them washing down the leaves, so the panels read.
    const wash = new THREE.SpotLight(0xffe2c0, 12, 6, 0.6, 0.9, 1.6);
    wash.position.set(0, HALL_HEIGHT - 0.2, 1.5);
    wash.target.position.set(0, DOOR_HEIGHT * 0.45, 0);
    doors.add(wash, wash.target);

    // Light from the other side, leaking under the doors and out across the
    // floor.
    const gap = new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_WIDTH - 0.02, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xffd9a8 }),
    );
    gap.position.set(0, 0.01, 0.002);
    doors.add(gap);
    // A thin area light the width of the gap, so it lights (and reflects in)
    // the floor as a line rather than a point.
    const spill = new THREE.RectAreaLight(0xffc98a, 30, DOOR_WIDTH - 0.02, 0.02);
    spill.position.set(0, 0.01, 0.004);
    spill.rotation.y = Math.PI; // area lights shine along -z; this faces it out into the hall
    doors.add(spill);
    const spillIntensity = spill.intensity;

    // 0 = shut, 1 = open.
    let openness = 0;
    function pose() {
      const angle = THREE.MathUtils.smoothstep(openness, 0, 1) * DOOR_OPEN_ANGLE;
      // Each turns its leaf's free edge toward local -z, away from the hall.
      for (const { hinge, side } of hinges) hinge.rotation.y = -side * angle;
      spill.intensity = spillIntensity * (1 - openness);
      gap.visible = openness === 0;
    }

    return {
      group: doors,
      // Opens them over DOOR_SWING seconds while `open`, else closes them.
      update(deltaTime, open) {
        const next = THREE.MathUtils.clamp(openness + ((open ? 1 : -1) * deltaTime) / DOOR_SWING, 0, 1);
        if (next === openness) return;
        openness = next;
        pose();
      },
      close() {
        openness = 0;
        pose();
      },
      // Open far enough to walk through.
      isOpen: () => openness > 0.85,
      // The middle of the doorway, at floor level.
      center: new THREE.Vector3(0, 0, wallZ + WALL_THICKNESS / 2),
    };
  }

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

  // progress: 0 = portrait fills the screen, 1 = the resting view at the end.
  // yaw/pitch: the same pointer look offsets the splat camera uses, eased in
  // as the camera pulls back so the frame stays locked at the seam.
  function update(progress, yaw, pitch) {
    const travel = THREE.MathUtils.smootherstep(progress, 0, 0.92);
    const distance = THREE.MathUtils.lerp(startDistance, END_DISTANCE, travel);
    camera.position.set(0, EYE_HEIGHT, distance);

    const look = THREE.MathUtils.smoothstep(progress, 0, 0.15);
    camera.rotation.set(pitch * 0.25 * look, yaw * 0.25 * look, 0);

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

  // Where a point on the end wall lands on screen, for HTML laid over the
  // hallway (see hallwayQuote.js). Returns its position in CSS pixels, how
  // many CSS pixels one world unit spans there, and how visible it is
  // through the fog (0..1).
  const projected = new THREE.Vector3();
  function projectWallPoint(point, viewWidth, viewHeight) {
    projected.copy(point).project(camera);
    const depth = camera.position.z - point.z;
    const pxPerUnit =
      viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth);
    const fog = THREE.MathUtils.clamp(
      (scene.fog.far - depth) / Math.max(scene.fog.far - scene.fog.near, 0.0001),
      0,
      1,
    );
    return {
      x: ((projected.x + 1) / 2) * viewWidth,
      y: ((1 - projected.y) / 2) * viewHeight,
      pxPerUnit,
      visibility: fog,
    };
  }

  // Draws the splat scene into the portrait, then the hallway to the screen.
  function render(splatScene, splatCamera) {
    renderer.setRenderTarget(renderTarget);
    renderer.render(splatScene, splatCamera);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }

  // Nothing here is drawn until the hallway first comes on screen, so that
  // first frame would otherwise compile every shader at once (the hallway's
  // lit materials, the mirror, and the splat scene drawn into the portrait)
  // and upload every texture, stalling the scroll. This does that ahead of
  // time, compiling in the background where the browser supports it.
  // Programs differ between drawing to the screen and into a render target
  // (the portrait, and the mirror's reflection), so both are compiled. Safe
  // to call again after something new is added, e.g. the museum visitor.
  async function warmUp(splatScene, splatCamera) {
    await Promise.all(workLoads);
    const previousTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    const jobs = [
      renderer.compileAsync(splatScene, splatCamera),
      renderer.compileAsync(scene, camera),
    ];
    renderer.setRenderTarget(null);
    jobs.push(renderer.compileAsync(scene, camera));
    renderer.setRenderTarget(previousTarget);

    scene.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value?.isTexture && value.image && !value.isRenderTargetTexture) {
            renderer.initTexture(value);
          }
        }
      }
    });
    await Promise.all(jobs);
  }

  // Draws the hallway from some other camera than the scrolled one, e.g.
  // when walking the gallery. The portrait can be seen up close then, so it
  // gets its full resolution.
  function renderFrom(splatScene, splatCamera, viewCamera) {
    if (resolutionStep !== 0) {
      resolutionStep = 0;
      sizeRenderTarget();
    }
    renderer.setRenderTarget(renderTarget);
    renderer.render(splatScene, splatCamera);
    renderer.setRenderTarget(null);
    renderer.render(scene, viewCamera);
  }

  // The floor plan, for walking the gallery: areas are open floor (boxes in
  // x/z, with a ceiling height), which overlap where one leads into the next;
  // the doorway's is only open while the doors are (door: true). Obstacles
  // are things on the floor to walk around: circles { x, z, radius } or
  // boxes { min, max }.
  const floorPlan = {
    areas: [
      { minX: -halfWidth + RIB_DEPTH, maxX: halfWidth - RIB_DEPTH, minZ: 0, maxZ: farWallZ, height: HALL_HEIGHT },
      {
        minX: -DOOR_WIDTH / 2 + 0.1,
        maxX: DOOR_WIDTH / 2 - 0.1,
        minZ: farWallZ - 1.5,
        maxZ: farWallZ + WALL_THICKNESS + 1.5,
        height: DOOR_HEIGHT,
        door: true,
      },
      grandRoom.area,
    ],
    obstacles: [
      // Keeps back from the portrait.
      { min: new THREE.Vector3(-halfWidth, 0, -1), max: new THREE.Vector3(halfWidth, 0, 0.45) },
      ...grandRoom.obstacles,
    ],
  };

  function setGrandRoomVisible(visible) {
    grandRoom.group.visible = visible;
    if (!visible) doors.close();
  }

  // scene is exposed so other pieces (e.g. museumVisitor.js) can be placed
  // in the hallway.
  return {
    scene,
    setSize,
    update,
    render,
    renderFrom,
    projectWallPoint,
    warmUp,
    pieces,
    portrait,
    floorPlan,
    doors,
    exhibits: grandRoom.exhibits,
    setGrandRoomVisible,
  };
}
