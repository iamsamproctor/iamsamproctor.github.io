import gsap from "gsap";

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
    chars.forEach((char) => applyPhase(char, DONE));
    return { play: () => {} };
  }

  let ready = false;
  let queuedPlay = false;

  const total =
    (chars.length - 1) * stagger + scrambleDuration + settleDelay;
  const proxy = { t: 0 };

  const tween = gsap.to(proxy, {
    t: total,
    duration: total,
    ease: "none",
    paused: true,
    onUpdate() {
      const now = proxy.t;
      for (let i = 0; i < chars.length; i += 1) {
        const char = chars[i];
        const start = i * stagger;

        if (now < start) {
          applyPhase(char, HIDDEN);
        } else if (now < start + scrambleDuration) {
          applyPhase(char, SCRAMBLING);
          if (now - char.lastSwap >= swapInterval) {
            char.lastSwap = now;
            char.span.textContent = randomChar(scrambleChars);
          }
        } else if (now < start + scrambleDuration + settleDelay) {
          applyPhase(char, SETTLED);
        } else {
          applyPhase(char, DONE);
        }
      }
    },
  });

  const play = () => {
    if (!ready) {
      queuedPlay = true;
      return;
    }
    chars.forEach((char) => {
      char.lastSwap = -Infinity;
    });
    tween.restart();
  };

  const finishSetup = () => {
    if (lockWidths) lockCharWidths(chars);
    chars.forEach((char) => applyPhase(char, HIDDEN));
    ready = true;
    if (queuedPlay) {
      queuedPlay = false;
      play();
    }
  };

  if (lockWidths) {
    document.fonts.ready.then(finishSetup);
  } else {
    finishSetup();
  }

  return { play };
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
