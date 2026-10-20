import gsap from "gsap";
import { works } from "./works.js";
import { playCloseSound } from "./uiSound.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const OPEN_DURATION = reduceMotion ? 0.01 : 0.9;
const CLOSE_DURATION = reduceMotion ? 0.01 : 0.75;
const REVEAL_DELAY = reduceMotion ? 0 : 0.5; // s into the open morph before text starts rising

const lerp = (a, b, t) => a + (b - a) * t;

function lerpRect(a, b, t) {
  const left = lerp(a.left, b.left, t);
  const top = lerp(a.top, b.top, t);
  const width = lerp(a.width, b.width, t);
  const height = lerp(a.height, b.height, t);
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
}

// Body copy is plain text, except [label](https://...) becomes an outside link.
function renderInline(value) {
  return escapeHtml(value).replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
}

// The modal grows out of the clicked card in two layers, both driven by one
// 0 -> 1 progress value:
//  - the panel is clip-path inset down to the card's rect, then unclipped
//    out to its full size;
//  - the hero (which holds the card's own <video>, moved over so playback
//    never restarts) is uniformly scaled and clipped to match the in-between
//    rect the same way object-fit: cover would, so its framing lines up with
//    the card at the start and never stretches on the way out.
// Once the morph settles, every inline style is cleared and plain CSS takes
// over again, so resizing while the modal is open behaves normally.
//
// It lives inside the menu modal (see gameMenu.js) as its deepest screen, so
// its panel is the menu's panel and the menu's bar does the closing. onOpen
// and onClose tell the menu when it opens or starts to close, and onClosed
// when it has finished closing.
//
// It normally grows out of the card that was clicked, but open() can be
// given another rect to grow out of and shrink back into, e.g. a work's
// picture on the gallery wall (see galleryExplore.js).
export function createWorkModal({
  onOpen = () => {},
  onClose = () => {},
  onClosed = () => {},
} = {}) {
  const root = document.querySelector(".work-modal");
  const backdropEl = root.querySelector(".work-modal-backdrop");
  const panelEl = root.querySelector(".work-modal-panel");
  const scrollEl = root.querySelector(".work-modal-scroll");
  const heroEl = root.querySelector(".work-modal-hero");
  const posterEl = root.querySelector(".work-modal-poster");
  const closeEl = root.querySelector(".work-modal-close");
  const titleEl = root.querySelector(".work-modal-title");
  const yearEl = root.querySelector(".work-modal-year");
  const companyEl = root.querySelector(".work-modal-company");
  const roleItemEl = root.querySelector(".work-modal-role-item");
  const roleEl = root.querySelector(".work-modal-role");
  const summaryEl = root.querySelector(".work-modal-summary");
  const calloutsEl = root.querySelector(".work-modal-callouts");
  const statsEl = root.querySelector(".work-modal-stats");
  const statsListEl = root.querySelector(".work-modal-stats-list");
  const statsNoteEl = root.querySelector(".work-modal-stats-note");
  const linkEl = root.querySelector(".work-modal-link");
  const linkLabelEl = root.querySelector(".work-modal-link-label");
  const toolsEl = root.querySelector(".work-modal-tools");
  const toolsListEl = root.querySelector(".work-modal-tools-list");

  const progress = { value: 0 };
  let rects = null;
  let state = null;
  let morphTween = null;
  let revealCall = null;

  const revealObserver = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      if (!entering.length) return;
      entering.forEach((el) => revealObserver.unobserve(el));
      gsap.to(entering, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
      });
    },
    { root: scrollEl, rootMargin: "0px 0px -8% 0px" },
  );

  const revealEls = () => Array.from(root.querySelectorAll("[data-reveal]"));

  // Section videos load only as they scroll near (about half a screen
  // ahead) and pause once they're well out of view, so opening a work
  // doesn't start downloading every clip at once.
  const sectionVideoObserver = new IntersectionObserver(
    (entries) => {
      for (const { target: video, isIntersecting } of entries) {
        if (isIntersecting) {
          if (!video.src) video.src = video.dataset.src;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }
    },
    { root: scrollEl, rootMargin: "50% 0px" },
  );

  const sectionVideos = () => Array.from(calloutsEl.querySelectorAll("video"));

  // Stops the section videos and drops what they've loaded.
  function unloadSectionVideos() {
    sectionVideoObserver.disconnect();
    for (const video of sectionVideos()) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  }

  function populate(work, cell) {
    titleEl.textContent = work.title;
    yearEl.textContent = work.year;
    companyEl.textContent = work.company ?? "Independent";
    // Role is optional; the whole Role column hides when a work has none.
    roleEl.textContent = work.role ?? "";
    roleItemEl.hidden = !work.role;
    // Stats are optional: big numbers between the title bar and the summary.
    const stats = work.stats ?? [];
    statsEl.hidden = stats.length === 0;
    statsListEl.innerHTML = stats
      .map(({ value, label }) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
      .join("");
    statsNoteEl.textContent = work.statsNote ?? "";
    statsNoteEl.hidden = !work.statsNote;
    // An optional outside link, e.g. where to get the game.
    linkEl.hidden = !work.link;
    linkEl.href = work.link?.url ?? "";
    linkLabelEl.textContent = work.link?.label ?? "";
    summaryEl.textContent = work.summary;
    // Tools are optional too: a name, or { name, use } to say what for.
    const tools = work.tools ?? [];
    toolsEl.hidden = tools.length === 0;
    toolsListEl.innerHTML = tools
      .map((tool) => {
        const { name, use } = typeof tool === "string" ? { name: tool } : tool;
        return `<li>${escapeHtml(name)}${
          use ? ` <span class="work-modal-tools-use">&middot; ${escapeHtml(use)}</span>` : ""
        }</li>`;
      })
      .join("");
    posterEl.src = cell.querySelector("img")?.src ?? "";

    // Sides alternate by section, counted in JS so a pull quote between
    // sections doesn't throw the alternation off.
    calloutsEl.innerHTML = work.callouts
      .map(
        (callout, index) => `
          <article class="work-callout${index % 2 ? " is-flipped" : ""}">
            <div class="work-callout-media" data-reveal>${renderMedia(callout)}</div>
            <div class="work-callout-text" data-reveal>
              <span class="work-callout-index">${String(index + 1).padStart(2, "0")}</span>
              <h3 class="work-callout-title">${escapeHtml(callout.title)}</h3>
              ${[callout.body]
                .flat()
                .map((para) => `<p class="work-callout-body">${renderInline(para)}</p>`)
                .join("")}
              ${callout.more ? renderMore(callout.more) : ""}
            </div>
          </article>
          ${callout.quote ? renderQuote(callout.quote) : ""}`,
      )
      .join("");
  }

  // A section's video, else its image, else nothing: the media box's grey
  // background stands in as a placeholder.
  function renderMedia({ video, image }) {
    if (video) {
      const poster = image ? ` poster="${escapeHtml(image)}"` : "";
      return `<video data-src="${escapeHtml(video)}"${poster} muted loop playsinline preload="none"></video>`;
    }
    if (image) return `<img src="${escapeHtml(image)}" alt="" loading="lazy" />`;
    return "";
  }

  // Optional reading tucked under a section: a native <details> the reader
  // can open for the technical deep dive.
  function renderMore(more) {
    return `
      <details class="work-callout-more">
        <summary>
          <span class="work-callout-more-icon" aria-hidden="true"></span>
          ${escapeHtml(more.label ?? "Learn more")}
        </summary>
        <div class="work-callout-more-body">
          ${[more.body]
            .flat()
            .map((para) => `<p class="work-callout-body">${renderInline(para)}</p>`)
            .join("")}
        </div>
      </details>`;
  }

  // An optional pull quote after a section, set as its own full-width band
  // the way a magazine lifts a line out of the article.
  function renderQuote(quote) {
    return `
      <blockquote class="work-quote" data-reveal>
        <p>${renderInline(quote)}</p>
      </blockquote>`;
  }

  // Where it grows out of and shrinks back into: the card, or the rect
  // open() was given instead.
  function originRect() {
    return state.fromRect ? state.fromRect() : state.cell.getBoundingClientRect();
  }

  function measure() {
    const panelStyle = getComputedStyle(panelEl);
    return {
      from: originRect(),
      fromRadius: state.fromRect ? 0 : parseFloat(getComputedStyle(state.cell).borderTopLeftRadius) || 0,
      panel: panelEl.getBoundingClientRect(),
      panelRadius: parseFloat(panelStyle.borderTopLeftRadius) || 0,
      hero: heroEl.getBoundingClientRect(),
    };
  }

  function renderMorph() {
    const t = progress.value;
    const { from, fromRadius, panel, panelRadius, hero } = rects;

    const p = lerpRect(from, panel, t);
    panelEl.style.clipPath =
      `inset(${p.top - panel.top}px ${panel.right - p.right}px ` +
      `${panel.bottom - p.bottom}px ${p.left - panel.left}px ` +
      `round ${lerp(fromRadius, panelRadius, t)}px)`;

    const h = lerpRect(from, hero, t);
    const scale = Math.max(h.width / hero.width, h.height / hero.height);
    const dx = h.left + h.width / 2 - (hero.left + hero.width / 2);
    const dy = h.top + h.height / 2 - (hero.top + hero.height / 2);
    const insetX = (hero.width - h.width / scale) / 2;
    const insetY = (hero.height - h.height / scale) / 2;
    heroEl.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    heroEl.style.clipPath = `inset(${insetY}px ${insetX}px round ${lerp(fromRadius, 0, t) / scale}px)`;
  }

  function clearMorph() {
    panelEl.style.clipPath = "";
    heroEl.style.transform = "";
    heroEl.style.clipPath = "";
  }

  function lockScroll() {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    document.body.style.paddingRight = scrollbarWidth ? `${scrollbarWidth}px` : "";
  }

  function unlockScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.paddingRight = "";
  }

  // fromRect: optional function returning the rect to grow out of and
  // shrink back into, instead of the card's.
  function open(cell, { fromRect = null } = {}) {
    if (state) return;
    const work = works[cell.dataset.work];
    if (!work) return;

    const video = cell.querySelector("video");
    state = {
      cell,
      video,
      videoParent: video?.parentNode,
      videoNext: video?.nextSibling,
      fromRect,
      closing: false,
    };

    populate(work, cell);
    sectionVideos().forEach((el) => sectionVideoObserver.observe(el));
    onOpen(work);
    lockScroll();
    root.hidden = false;
    root.classList.add("is-animating");
    scrollEl.scrollTop = 0;

    // Moving the element (rather than cloning it) keeps the exact frame the
    // card was showing, so the video reads as one continuous shot.
    if (video) {
      heroEl.appendChild(video);
      video.preload = "auto";
      video.play().catch(() => {});
    }

    rects = measure();
    if (!fromRect) cell.classList.add("is-lifted");

    progress.value = 0;
    renderMorph();
    gsap.set(revealEls(), { opacity: 0, y: 28 });
    gsap.set(closeEl, { opacity: 0 });

    gsap.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
    morphTween = gsap.to(progress, {
      value: 1,
      duration: OPEN_DURATION,
      ease: "power3.inOut",
      onUpdate: renderMorph,
      onComplete: () => {
        root.classList.remove("is-animating");
        clearMorph();
      },
    });

    revealCall = gsap.delayedCall(REVEAL_DELAY, () => {
      gsap.to(closeEl, { opacity: 1, duration: 0.5, ease: "power2.out" });
      revealEls().forEach((el) => revealObserver.observe(el));
    });

    closeEl.focus({ preventScroll: true });
  }

  function close() {
    if (!state || state.closing) return;
    state.closing = true;
    onClose();
    playCloseSound();

    revealCall?.kill();
    revealObserver.disconnect();
    gsap.killTweensOf(revealEls());

    // Closing mid-open keeps the rects the morph is already using; otherwise
    // re-measure, since the window or the card's hover width may have moved.
    const wasMorphing = morphTween?.isActive();
    morphTween?.kill();
    root.classList.add("is-animating");
    if (wasMorphing) {
      rects.from = originRect();
    } else {
      rects = measure();
      progress.value = 1;
    }

    gsap.to([closeEl, ...revealEls()], { opacity: 0, duration: 0.25, ease: "power2.out" });
    gsap.to(backdropEl, { opacity: 0, duration: 0.6, delay: 0.15, ease: "power2.inOut" });
    morphTween = gsap.to(progress, {
      value: 0,
      duration: CLOSE_DURATION,
      ease: "power3.inOut",
      onUpdate: renderMorph,
      onComplete: finishClose,
    });
  }

  function finishClose({ refocus = true } = {}) {
    const { cell, video, videoParent, videoNext, fromRect } = state;
    if (video && videoParent) {
      videoParent.insertBefore(video, videoNext);
      video.pause();
    }
    cell.classList.remove("is-lifted");

    root.hidden = true;
    root.classList.remove("is-animating");
    clearMorph();
    unlockScroll();
    unloadSectionVideos();
    calloutsEl.innerHTML = "";
    state = null;

    // Back to the card it came from, unless it came from somewhere else
    // (focusing a card also starts its preview video).
    if (refocus && !fromRect) cell.focus({ preventScroll: true });
    onClosed();
  }

  // Closes at once, with no morph, e.g. when the whole menu is being closed
  // around it.
  function closeImmediately() {
    if (!state) return;
    if (!state.closing) onClose();
    revealCall?.kill();
    revealObserver.disconnect();
    gsap.killTweensOf(revealEls());
    morphTween?.kill();
    finishClose({ refocus: false });
  }

  closeEl.addEventListener("click", close);
  backdropEl.addEventListener("click", close);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return {
    open,
    close,
    closeImmediately,
    isOpen: () => state !== null,
    isOpenFor: (cell) => state?.cell === cell,
  };
}
