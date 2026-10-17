import * as THREE from "three";

// A museum label: a small off-white card with a title and a line or two of
// smaller text under it, drawn to a canvas. Used beside the works in the
// hallway and on the grand room's pedestals. Faintly self-lit, so it stays
// readable at the edge of a spotlight.

const CANVAS_WIDTH = 640;
const PADDING = 40;
const TITLE_SIZE = 44; // px, shrunk to fit a long title
const TITLE_MIN_SIZE = 28;
const LINE_SIZE = 34;
const LINE_GAP = 12;
const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";

// width: in world units; the height follows from the text.
export function createPlacard({ title, lines = [], width = 0.36 }) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const textWidth = CANVAS_WIDTH - PADDING * 2;

  let titleSize = TITLE_SIZE;
  context.font = `600 ${titleSize}px ${FONT}`;
  while (titleSize > TITLE_MIN_SIZE && context.measureText(title).width > textWidth) {
    titleSize -= 2;
    context.font = `600 ${titleSize}px ${FONT}`;
  }

  canvas.width = CANVAS_WIDTH;
  canvas.height = Math.round(
    PADDING * 2 + titleSize + lines.length * (LINE_SIZE + LINE_GAP) + (lines.length ? LINE_GAP : 0),
  );
  context.fillStyle = "#ece7dd";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = "top";

  let y = PADDING;
  context.fillStyle = "#1d1b19";
  context.font = `600 ${titleSize}px ${FONT}`;
  context.fillText(title, PADDING, y, textWidth);
  y += titleSize + LINE_GAP * 2;

  context.fillStyle = "#57524b";
  context.font = `${LINE_SIZE}px ${FONT}`;
  for (const line of lines) {
    context.fillText(line, PADDING, y, textWidth);
    y += LINE_SIZE + LINE_GAP;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const placard = new THREE.Mesh(
    new THREE.PlaneGeometry(width, (width * canvas.height) / canvas.width),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.25,
    }),
  );
  placard.userData.height = (width * canvas.height) / canvas.width;
  return placard;
}
