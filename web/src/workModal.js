import gsap from "gsap";
import { works } from "./works.js";

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
export function createWorkModal() {
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

  function populate(work, cell) {
    titleEl.textContent = work.title;
    yearEl.textContent = work.year;
    companyEl.textContent = work.company ?? "Independent";
    // Role is optional; the whole Role column hides when a work has none.
    roleEl.textContent = work.role ?? "";
    roleItemEl.hidden = !work.role;
    summaryEl.textContent = work.summary;
    posterEl.src = cell.querySelector("img")?.src ?? "";

    calloutsEl.innerHTML = work.callouts
      .map(
        (callout, index) => `
          <article class="work-callout">
            <div class="work-callout-media" data-reveal>
              <img src="${escapeHtml(callout.image)}" alt="" loading="lazy" />
            </div>
            <div class="work-callout-text" data-reveal>
              <span class="work-callout-index">${String(index + 1).padStart(2, "0")}</span>
              <h3 class="work-callout-title">${escapeHtml(callout.title)}</h3>
              <p class="work-callout-body">${escapeHtml(callout.body)}</p>
            </div>
          </article>`,
      )
      .join("");
  }

  function measure(cell) {
    const panelStyle = getComputedStyle(panelEl);
    return {
      from: cell.getBoundingClientRect(),
      fromRadius: parseFloat(getComputedStyle(cell).borderTopLeftRadius) || 0,
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

  function open(cell) {
    if (state) return;
    const work = works[cell.dataset.work];
    if (!work) return;

    const video = cell.querySelector("video");
    state = {
      cell,
      video,
      videoParent: video?.parentNode,
      videoNext: video?.nextSibling,
      closing: false,
    };

    populate(work, cell);
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

    rects = measure(cell);
    cell.classList.add("is-lifted");

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

    revealCall?.kill();
    revealObserver.disconnect();
    gsap.killTweensOf(revealEls());

    // Closing mid-open keeps the rects the morph is already using; otherwise
    // re-measure, since the window or the card's hover width may have moved.
    const wasMorphing = morphTween?.isActive();
    morphTween?.kill();
    root.classList.add("is-animating");
    if (wasMorphing) {
      rects.from = state.cell.getBoundingClientRect();
    } else {
      rects = measure(state.cell);
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

  function finishClose() {
    const { cell, video, videoParent, videoNext } = state;
    if (video && videoParent) {
      videoParent.insertBefore(video, videoNext);
      video.pause();
    }
    cell.classList.remove("is-lifted");

    root.hidden = true;
    root.classList.remove("is-animating");
    clearMorph();
    unlockScroll();
    calloutsEl.innerHTML = "";
    state = null;

    cell.focus({ preventScroll: true });
  }

  closeEl.addEventListener("click", close);
  backdropEl.addEventListener("click", close);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return {
    open,
    close,
    isOpenFor: (cell) => state?.cell === cell,
  };
}
