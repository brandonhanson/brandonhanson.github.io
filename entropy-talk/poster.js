const button = document.querySelector('.fullscreen-button');
const label = button.querySelector('span');
const status = document.querySelector('#presentation-status');

// Keep content in HTML. The timeline is generated from its sections on load.
const slides = [...document.querySelectorAll('#poster > .slide')];
const navigation = document.querySelector('.section-navigation');
const timeline = document.querySelector('.section-timeline');
const previous = document.querySelector('#previous-section');
const next = document.querySelector('#next-section');
const counter = document.querySelector('.section-count');
const chapterLabel = document.querySelector('.chapter-label');
let chapter = 'Title';
const chapters = slides.map(slide => {
  if (slide.dataset.chapter) chapter = slide.dataset.chapter;
  return chapter;
});
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let current = 0;

window.renderPosterMath = (element = document.querySelector('#poster')) => {
  if (typeof window.renderMathInElement !== 'function') {
    status.textContent = 'Math rendering could not load. Check that the assets/katex folder is present, then reload.';
    return;
  }
  window.renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
    trust: false,
    errorColor: '#9b302c',
  });
  // Zero-width math labels share a reusable visual style after KaTeX renders.
  element.querySelectorAll('.clap > .katex-inner').forEach(annotation => {
    annotation.classList.add('math-annotation');
  });
};
window.renderPosterMath();

const stops = slides.map((slide, index) => {
  const heading = slide.querySelector('h1, h2');
  if (heading) heading.tabIndex = -1;
  const name = slide.dataset.title || heading?.textContent.trim() || `Section ${index + 1}`;
  const item = document.createElement('li');
  const stop = document.createElement('button');
  stop.type = 'button';
  stop.className = 'timeline-stop';
  if (slide.dataset.chapterNumber) {
    stop.classList.add('chapter-stop');
    stop.dataset.chapterNumber = slide.dataset.chapterNumber;
  }
  stop.setAttribute('aria-label', name);
  stop.setAttribute('aria-controls', slide.id);
  stop.title = name;
  const stopLabel = document.createElement('span');
  stopLabel.className = 'timeline-label';
  stopLabel.textContent = name;
  stop.append(stopLabel);
  stop.addEventListener('click', () => goTo(index));
  item.append(stop);
  timeline.append(item);
  return stop;
});

function setCurrent(index) {
  current = index;
  stops.forEach((stop, i) => {
    if (i === index) stop.setAttribute('aria-current', 'step');
    else stop.removeAttribute('aria-current');
  });
  previous.disabled = index === 0;
  next.disabled = index === slides.length - 1;
  counter.textContent = `${index + 1} / ${slides.length}`;
  chapterLabel.textContent = chapters[index];
  const activeBounds = stops[index].getBoundingClientRect();
  const timelineBounds = timeline.getBoundingClientRect();
  if (activeBounds.top < timelineBounds.top) timeline.scrollTop -= timelineBounds.top - activeBounds.top;
  else if (activeBounds.bottom > timelineBounds.bottom) timeline.scrollTop += activeBounds.bottom - timelineBounds.bottom;
}

function goTo(index, smooth = true) {
  const destination = Math.max(0, Math.min(slides.length - 1, index));
  const slide = slides[destination];
  setCurrent(destination);
  slide.scrollIntoView({ behavior: smooth && !reducedMotion.matches ? 'smooth' : 'instant', block: 'start' });
  slide.querySelector('h1, h2')?.focus({ preventScroll: true });
  status.textContent = `${destination + 1} of ${slides.length}: ${stops[destination].title}`;
}

previous.addEventListener('click', () => goTo(current - 1));
next.addEventListener('click', () => goTo(current + 1));
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="slider"], canvas')) return;
  const directions = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
  if (event.key in directions) {
    event.preventDefault();
    goTo(current + directions[event.key]);
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    goTo(event.key === 'Home' ? 0 : slides.length - 1);
  }
});

let scheduled = false;
function syncScroll() {
  let visible = 0;
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].getBoundingClientRect().top <= window.innerHeight * .4) visible = i;
  }
  setCurrent(visible);
  scheduled = false;
}
window.addEventListener('scroll', () => {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(syncScroll);
  }
}, { passive: true });
window.addEventListener('resize', syncScroll);
window.addEventListener('hashchange', () => {
  const index = slides.findIndex(slide => `#${slide.id}` === location.hash);
  if (index >= 0) goTo(index);
});
navigation.hidden = slides.length < 2;
syncScroll();

if (document.fullscreenEnabled) {
  button.hidden = false;
  button.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      status.textContent = 'Fullscreen is unavailable. You can use your browser’s fullscreen command instead.';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    label.textContent = active ? 'Exit fullscreen' : 'Present fullscreen';
    button.setAttribute('aria-pressed', String(active));
  });
  button.setAttribute('aria-pressed', 'false');
}
