// A single quote that fills the black beat between the hallway fading out
// and Selected Works rising in. Each visit to that beat shows a random quote;
// lingering there crossfades to another every so often.
//
// Scroll position drives the overall fade (see setVisibility, called once
// per frame from main.js); the crossfade between quotes is a CSS transition
// on the inner block.

const CYCLE_SECONDS = 9; // how long a quote holds before crossfading to another
const SWAP_SECONDS = 1.2; // must match the .quote-interstitial-inner transition

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
}

export function createQuoteInterstitial(el, quotes) {
  const innerEl = el.querySelector(".quote-interstitial-inner");
  const textEl = el.querySelector(".quote-interstitial-text");
  const authorEl = el.querySelector(".quote-interstitial-author");

  // Only quotes whose attribution has been vetted.
  const pool = quotes.filter((quote) => quote.display_enabled);
  let currentIndex = -1;
  let shownAt = 0;
  let swapTimer = null;
  let wasShowing = false;

  function pickNext() {
    if (pool.length < 2) return 0;
    let index;
    do {
      index = Math.floor(Math.random() * pool.length);
    } while (index === currentIndex);
    return index;
  }

  function render(index) {
    currentIndex = index;
    const { quote, author } = pool[index];
    // Line breaks in verse are stored as " / ".
    textEl.innerHTML = quote.split(/\s*\/\s*/).map(escapeHtml).join("<br />");
    authorEl.textContent = author;
    shownAt = performance.now();
  }

  function crossfade() {
    innerEl.classList.add("is-swapping");
    swapTimer = setTimeout(() => {
      render(pickNext());
      innerEl.classList.remove("is-swapping");
      swapTimer = null;
    }, SWAP_SECONDS * 1000);
  }

  if (pool.length) render(pickNext());

  // visibility: 0-1 from scroll position.
  function setVisibility(visibility) {
    if (!pool.length) return;
    el.style.opacity = String(visibility);
    el.style.transform = `translateY(${(1 - visibility) * 12}px)`;

    const isShowing = visibility > 0.6;
    if (isShowing && !swapTimer && performance.now() - shownAt > CYCLE_SECONDS * 1000) {
      crossfade();
    }
    if (isShowing && !wasShowing) shownAt = performance.now();

    // Once it has fully faded away, line up a different quote for next time.
    if (visibility === 0 && wasShowing && !swapTimer) {
      render(pickNext());
      wasShowing = false;
    }
    if (isShowing) wasShowing = true;
  }

  return { setVisibility };
}
