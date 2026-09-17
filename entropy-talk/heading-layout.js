/* Pack display lines using the font's ink, rather than a fixed negative leading. */
(() => {
  const SCALE = 100;

  function wrapWords(text, measure, width) {
    const lines = [];
    let line = '';
    for (const word of text.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function packLines(lines, width, xHeight, align = 'left', offsetRange = 80) {
    const stride = Math.ceil(width) + 4;
    const occupied = new Set();
    const placements = [];
    const origin = line => align === 'center' ? (width - line.width) / 2
      : align === 'right' ? width - line.width : 0;
    const collides = (line, x, baseline) => line.ink.some(([px, py]) =>
      occupied.has((py + baseline + SCALE) * stride + px + x + 2));

    for (const [index, line] of lines.entries()) {
      const previous = placements.at(-1);
      const minimum = previous
        ? previous.baseline + Math.ceil(lines[index - 1].descent + xHeight)
        : 0;
      const base = origin(line);
      const preferred = base + (index % 2 ? 24 : 0);
      const offsets = [];
      for (let x = Math.max(0, Math.floor(base - offsetRange));
        x <= Math.min(width - line.width, Math.ceil(base + offsetRange)); x += 2) {
        offsets.push(x);
      }
      if (!offsets.length) offsets.push(Math.max(0, Math.floor(base)));
      offsets.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));

      let placement;
      // If no horizontal offset works, relax the leading until the ink clears.
      for (let baseline = minimum; !placement; baseline += 1) {
        for (const x of offsets) {
          if (!collides(line, x, baseline)) {
            placement = { x, baseline };
            break;
          }
        }
      }
      placements.push(placement);
      for (const [px, py] of line.ink) {
        // A small clearance protects thin serifs from visually touching.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            occupied.add((py + placement.baseline + dy + SCALE) * stride
              + px + placement.x + dx + 2);
          }
        }
      }
    }
    return placements;
  }

  if (typeof module !== 'undefined') module.exports = { wrapWords, packLines };
  if (typeof document === 'undefined') return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const headings = [...document.querySelectorAll(
    '#talk-title, .content-panel:not(.question-panel) h2'
  )].map(element => {
    const visible = element.cloneNode(true);
    visible.querySelectorAll('.visually-hidden').forEach(node => node.remove());
    return {
      element,
      html: element.innerHTML,
      label: element.getAttribute('aria-label'),
      width: element.style.width,
      fontSize: element.style.fontSize,
      text: element.textContent.replace(/\s+/g, ' ').trim(),
      groups: element.id === 'talk-title' || element.hasAttribute('data-heading-lines')
        ? [...visible.children].map(line => line.textContent.trim())
        : [visible.textContent.trim()],
    };
  });

  function layoutHeadings() {
    for (const heading of headings) {
      const { element } = heading;
      element.innerHTML = heading.html;
      element.style.width = heading.width;
      element.style.fontSize = heading.fontSize;
      element.classList.remove('stacked-heading');
      if (heading.label === null) element.removeAttribute('aria-label');
      else element.setAttribute('aria-label', heading.label);
    }
    // Read original widths before introducing the tighter stacks.
    const sizes = headings.map(({ element }) => ({
      width: element.getBoundingClientRect().width,
      style: getComputedStyle(element),
    }));
    headings.forEach((heading, index) => {
      const { element } = heading;
      const { width, style } = sizes[index];
      let fontSize = parseFloat(style.fontSize);
      let available = width / fontSize * SCALE;
      if (!available) return;
      const font = `${style.fontStyle} ${style.fontWeight} ${SCALE}px ${style.fontFamily}`;
      const tracking = (parseFloat(style.letterSpacing) || 0) / fontSize * SCALE;
      const setFont = () => {
        context.font = font;
        context.letterSpacing = `${tracking}px`;
        context.textBaseline = 'alphabetic';
      };
      setFont();
      const measure = text => context.measureText(text).width;
      // Fit an unbreakable word instead of abandoning the entire tight stack.
      const widestWord = Math.max(...heading.groups.flatMap(group =>
        group.split(/\s+/).map(measure)));
      if (widestWord > available) {
        fontSize = width / (widestWord + 8) * SCALE;
        element.style.fontSize = `${fontSize}px`;
        available = width / fontSize * SCALE;
      }
      const texts = heading.groups.flatMap(group => wrapWords(group, measure, available));
      if (texts.length < 2 || texts.some(text => measure(text) > available)) return;
      const xHeight = context.measureText('x').actualBoundingBoxAscent;
      const lines = texts.map(text => {
        setFont();
        const metrics = context.measureText(text);
        canvas.width = Math.ceil(metrics.width) + 8;
        canvas.height = SCALE * 2;
        setFont();
        context.fillText(text, 4, SCALE);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const ink = [];
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] > 48) ink.push([x - 4, y - SCALE]);
          }
        }
        return { width: Math.ceil(metrics.width), descent: metrics.actualBoundingBoxDescent, ink };
      });
      const offsetRange = (parseFloat(style.getPropertyValue('--heading-stagger-range')) || .8) * SCALE;
      const placements = packLines(lines, available, xHeight, style.textAlign, offsetRange);
      element.replaceChildren();
      element.classList.add('stacked-heading');
      element.style.width = `${width}px`;
      element.setAttribute('aria-label', heading.text);
      texts.forEach((text, lineIndex) => {
        const span = document.createElement('span');
        span.className = 'heading-line';
        span.textContent = text;
        span.setAttribute('aria-hidden', 'true');
        const current = placements[lineIndex];
        span.style.setProperty('--line-offset', `${current.x / SCALE}em`);
        if (lineIndex) {
          const gap = current.baseline - placements[lineIndex - 1].baseline;
          span.style.setProperty('--line-rise', `${gap / SCALE - 1}em`);
        }
        element.append(span);
      });
    });
  }

  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layoutHeadings);
  });
  document.fonts.ready.then(layoutHeadings);
})();
