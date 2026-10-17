import gsap from "gsap";
import { playRevealSound } from "./revealSound.js";

const SCRAMBLE_CHARS = "!<>-_\\/[]{}=+*^?#%@$&01234567890'\";:";

const HIDDEN = 0;
const SCRAMBLING = 1;
const SETTLED = 2;
const DONE = 3;

function randomChar(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function applyPhase(char, phase) {
  if (char.phase === phase) return;
  char.phase = phase;

  if (phase === HIDDEN) {
    char.span.className = "reveal-char";
  } else if (phase === SCRAMBLING) {
    char.span.className = "reveal-char is-on";
  } else if (phase === SETTLED) {
    char.span.className = "reveal-char is-on";
    char.span.textContent = char.value;
  } else {
    char.span.className = "reveal-char is-on is-done";
    char.span.textContent = char.value;
  }
}

function lockCharWidths(chars) {
  const widths = chars.map((char) => char.span.getBoundingClientRect().width);
  chars.forEach((char, i) => {
    char.span.style.display = "inline-block";
    char.span.style.textAlign = "center";
    char.span.style.width = `${widths[i]}px`;
  });
}

export function createTextReveal(
  el,
  {
    stagger = 0.028,
    scrambleDuration = 0.5,
    swapInterval = 0.055,
    settleDelay = 0.14,
    scrambleChars = SCRAMBLE_CHARS,
    lockWidths = false,
    hideSpeed = 2, // how much faster hide() runs the scramble back out than it came in
  } = {},
) {
  const text = el.textContent.replace(/\s+/g, " ").trim();
  const fragment = document.createDocumentFragment();
  const chars = [];

  // Characters are grouped into word wrappers so that locking their widths
  // cannot introduce mid-word line breaks: inline-block boxes are atomic
  // inlines, and lines may otherwise break between any two of them.
  let word = null;

  for (const value of text) {
    if (value === " ") {
      word = null;
      fragment.appendChild(document.createTextNode(" "));
      continue;
    }
    if (!word) {
      word = document.createElement("span");
      word.className = "reveal-word";
      fragment.appendChild(word);
    }
    const span = document.createElement("span");
    span.className = "reveal-char";
    span.textContent = value;
    word.appendChild(span);
    chars.push({ span, value, phase: DONE, lastSwap: -Infinity });
  }

  el.textContent = "";
  el.appendChild(fragment);

  if (lockWidths) {
    el.classList.add("is-proportional");
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // No scramble: the text is simply there, or cut away at once.
    chars.forEach((char) => applyPhase(char, DONE));
    return {
      play: () => {},
      show: () => chars.forEach((char) => applyPhase(char, DONE)),
      hide: () => chars.forEach((char) => applyPhase(char, HIDDEN)),
    };
  }

  let ready = false;
  let queued = null; // play or show, asked for before setup finished

  const total =
    (chars.length - 1) * stagger + scrambleDuration + settleDelay;
  const proxy = { t: 0 };

  const render = (now) => {
    for (let i = 0; i < chars.length; i += 1) {
      const char = chars[i];
      const start = i * stagger;

      if (now < start) {
        applyPhase(char, HIDDEN);
      } else if (now < start + scrambleDuration) {
        applyPhase(char, SCRAMBLING);
        // abs: when scrubbed, time can run backwards.
        if (Math.abs(now - char.lastSwap) >= swapInterval) {
          char.lastSwap = now;
          char.span.textContent = randomChar(scrambleChars);
        }
      } else if (now < start + scrambleDuration + settleDelay) {
        applyPhase(char, SETTLED);
      } else {
        applyPhase(char, DONE);
      }
    }
  };

  let tween = null;
  let heading = 0; // the point in the scramble it's at or on its way to

  const runTo = (target, speed) => {
    heading = target;
    tween?.kill();
    tween = gsap.to(proxy, {
      t: target,
      duration: Math.abs(target - proxy.t) / speed,
      ease: "none",
      onUpdate: () => render(proxy.t),
    });
  };

  // Scrambles the text in from wherever it is, through to the end. Does
  // nothing if it's already in or on its way in, so it can be called freely.
  const show = () => {
    if (!ready) {
      queued = show;
      return;
    }
    if (heading === total) return;
    chars.forEach((char) => {
      char.lastSwap = -Infinity;
    });
    playRevealSound(el, total - proxy.t);
    runTo(total, 1);
  };

  // Scrambles it back out from wherever it is, last character first.
  const hide = () => {
    if (!ready) {
      queued = null; // setup leaves it hidden
      return;
    }
    if (heading === 0) return;
    runTo(0, hideSpeed);
  };

  // The whole scramble in from nothing, even if it's already showing.
  const play = () => {
    if (!ready) {
      queued = play;
      return;
    }
    proxy.t = 0;
    heading = 0;
    show();
  };

  const finishSetup = () => {
    if (lockWidths) lockCharWidths(chars);
    chars.forEach((char) => applyPhase(char, HIDDEN));
    ready = true;
    queued?.();
    queued = null;
  };

  if (lockWidths) {
    // fonts.ready can resolve before a not-yet-requested face has loaded, so
    // load the element's own font explicitly before measuring glyph widths.
    const cs = getComputedStyle(el);
    const loads = (cs.fontFamily || "")
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 1)
      .map((family) =>
        document.fonts.load(`${cs.fontWeight} ${cs.fontSize} ${family}`, text),
      );
    Promise.all(loads)
      .catch(() => {})
      .then(() => document.fonts.ready)
      .then(finishSetup);
  } else {
    finishSetup();
  }

  return { play, show, hide };
}

export function revealOnEnter(el, options) {
  const reveal = createTextReveal(el, options);

  let armed = true;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          armed = true;
        } else if (armed && entry.intersectionRatio >= 0.4) {
          armed = false;
          reveal.play();
        }
      });
    },
    { threshold: [0, 0.4] },
  );

  observer.observe(el);
  return reveal;
}
