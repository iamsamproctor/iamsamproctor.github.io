// Dev-only tool for trying heading fonts on the real hero. Loaded only when
// the URL has ?fonts (see main.js). Click a name, or press [ and ] to step
// through them; C toggles all caps; R replays the scramble. Each switch
// replays the scramble reveal so fonts can be judged in motion. Delete this
// file once a font is chosen.

const FONTS_CSS =
  "https://fonts.googleapis.com/css2" +
  "?family=Geist+Mono:wght@400" +
  "&family=JetBrains+Mono:wght@300" +
  "&family=IBM+Plex+Mono:wght@400" +
  "&family=DM+Mono:wght@400" +
  "&family=Azeret+Mono:wght@300" +
  "&family=Martian+Mono:wght@300" +
  "&family=Space+Mono" +
  "&family=Share+Tech+Mono" +
  "&family=Major+Mono+Display" +
  "&family=Doto:wght@700" +
  "&family=Space+Grotesk:wght@400" +
  "&family=Chakra+Petch:wght@500" +
  "&family=Oxanium:wght@500" +
  "&family=Tektur:wght@500" +
  "&family=Michroma" +
  "&family=Orbitron:wght@500" +
  "&display=swap";

// scale multiplies BASE_SIZE, since fonts at the same nominal size can be
// very different widths. caps is each font's starting case (C toggles it).
const CANDIDATES = [
  { name: "Page default (current CSS)", family: null },
  { name: "Geist Mono", family: '"Geist Mono"', weight: 400, caps: false, tracking: "-0.03em", scale: 0.95 },
  { name: "JetBrains Mono Light", family: '"JetBrains Mono"', weight: 300, caps: false, tracking: "-0.03em", scale: 0.95 },
  { name: "IBM Plex Mono", family: '"IBM Plex Mono"', weight: 400, caps: false, tracking: "-0.02em", scale: 0.92 },
  { name: "DM Mono", family: '"DM Mono"', weight: 400, caps: false, tracking: "-0.03em", scale: 0.95 },
  { name: "Azeret Mono Light", family: '"Azeret Mono"', weight: 300, caps: false, tracking: "-0.03em", scale: 0.88 },
  { name: "Martian Mono Light", family: '"Martian Mono"', weight: 300, caps: false, tracking: "-0.04em", scale: 0.78 },
  { name: "Space Mono", family: '"Space Mono"', weight: 400, caps: false, tracking: "-0.03em", scale: 0.9 },
  { name: "Share Tech Mono", family: '"Share Tech Mono"', weight: 400, caps: true, tracking: "0", scale: 1 },
  { name: "Major Mono Display", family: '"Major Mono Display"', weight: 400, caps: false, tracking: "-0.02em", scale: 0.8 },
  { name: "Doto (dot matrix)", family: '"Doto"', weight: 700, caps: true, tracking: "0", scale: 0.95 },
  { name: "Space Grotesk", family: '"Space Grotesk"', weight: 400, caps: false, tracking: "-0.03em", scale: 1.05 },
  { name: "Chakra Petch", family: '"Chakra Petch"', weight: 500, caps: true, tracking: "0", scale: 0.95 },
  { name: "Oxanium", family: '"Oxanium"', weight: 500, caps: true, tracking: "0", scale: 0.95 },
  { name: "Tektur", family: '"Tektur"', weight: 500, caps: true, tracking: "0", scale: 0.88 },
  { name: "Michroma", family: '"Michroma"', weight: 400, caps: true, tracking: "-0.02em", scale: 0.62 },
  { name: "Orbitron", family: '"Orbitron"', weight: 500, caps: true, tracking: "0", scale: 0.78 },
];

const BASE_SIZE = "clamp(32px, 5.5vw, 76px)";

export function createFontPreview(headingEl, reveal) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONTS_CSS;
  document.head.appendChild(link);

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed",
    top: "84px",
    left: "32px",
    zIndex: "20",
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    maxHeight: "calc(100vh - 300px)",
    overflowY: "auto",
    padding: "10px",
    borderRadius: "10px",
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(6px)",
    font: "12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#fff",
  });
  const hint = document.createElement("div");
  hint.textContent = "[ / ] step  ·  C caps  ·  R replay";
  Object.assign(hint.style, { opacity: "0.5", padding: "2px 6px 6px" });
  panel.appendChild(hint);

  const buttons = CANDIDATES.map((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index}. ${candidate.name}`;
    Object.assign(button.style, {
      all: "unset",
      cursor: "pointer",
      padding: "3px 6px",
      borderRadius: "5px",
    });
    button.addEventListener("click", () => apply(index));
    panel.appendChild(button);
    return button;
  });
  document.body.appendChild(panel);

  let current = 0;
  let caps = false;

  async function apply(index, { keepCase = false } = {}) {
    current = index;
    const candidate = CANDIDATES[index];
    if (!keepCase) caps = Boolean(candidate.caps);
    buttons.forEach((button, i) => {
      button.style.background = i === index ? "rgba(255, 255, 255, 0.18)" : "";
    });

    // The scramble reveal locks each character to its measured pixel width,
    // so unlock, swap the font, wait for it, and re-measure.
    const chars = Array.from(headingEl.querySelectorAll(".reveal-char"));
    chars.forEach((char) => {
      char.style.width = "";
      char.style.display = "";
    });

    if (candidate.family) {
      Object.assign(headingEl.style, {
        fontFamily: `${candidate.family}, monospace`,
        fontWeight: String(candidate.weight),
        letterSpacing: candidate.tracking,
        fontSize: `calc(${BASE_SIZE} * ${candidate.scale})`,
      });
      await document.fonts.load(`${candidate.weight} 40px ${candidate.family}`);
    } else {
      // Back to whatever the stylesheet says.
      Object.assign(headingEl.style, {
        fontFamily: "",
        fontWeight: "",
        letterSpacing: "",
        fontSize: "",
      });
    }
    headingEl.style.textTransform = caps ? "uppercase" : keepCase || candidate.family ? "none" : "";
    if (current !== index) return;

    const widths = chars.map((char) => char.getBoundingClientRect().width);
    chars.forEach((char, i) => {
      char.style.display = "inline-block";
      char.style.width = `${widths[i]}px`;
    });
    reveal?.play();
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "]") apply((current + 1) % CANDIDATES.length);
    if (event.key === "[") apply((current - 1 + CANDIDATES.length) % CANDIDATES.length);
    if (event.key === "c" || event.key === "C") {
      caps = !caps;
      apply(current, { keepCase: true });
    }
    if (event.key === "r" || event.key === "R") reveal?.play();
  });

  // Highlight the page default without touching the heading.
  buttons[0].style.background = "rgba(255, 255, 255, 0.18)";
}
