function initializeSilhouetteDemo(prefix, { diagonal = false, pure = false } = {}) {
  const mask = window.blueJaysMask;
  const canvas = document.getElementById(prefix + '-samples');
  if (!mask || !canvas) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pixels = mask.runs.flatMap(([y, start, end]) => Array.from({ length: end - start }, (_, i) => [start + i, y]));
  const total = 10000;
  const duration = 9000 * (10000 / 5000) ** (1 / 1.7);
  const holdDuration = 3000;
  const signalNoiseSigma = 4;
  // Preserve the later comparison of numerical intrinsic entropies.
  const sigma = diagonal ? Math.sqrt(2 * Math.PI * Math.E) * signalNoiseSigma ** 2 : signalNoiseSigma;
  const canvases = pure ? [canvas] : [canvas, document.getElementById(prefix + '-noise'), document.getElementById(prefix + '-sum')];
  const animated = !pure;
  const displays = canvases.map(c => c.getContext('2d'));
  const buffers = animated ? canvases.map(c => {
    const buffer = document.createElement('canvas');
    buffer.width = c.width; buffer.height = c.height;
    return buffer;
  }) : canvases;
  const contexts = buffers.map(c => c.getContext('2d'));
  const blue = '#416f91', red = '#a54438', purple = '#795585';
  const motionDuration = 750;
  let pending = [], focus = null;
  let points, noise, count = 0, elapsed = 0, last = null, frame = 0, visible = false;
  let cycleIndex = 0;
  let direction = Math.PI / 4;
  let scalarNoise = [];
  const guide = diagonal ? document.getElementById('noise-angle-guide') : null;

  function addUntil(n) {
    if (animated && n > count) {
      pending.push({ first: count, end: n, born: elapsed });
      if (!focus || elapsed - focus.born >= motionDuration) focus = { index: count, born: elapsed };
    }
    for (; count < n; count++) {
      const [x, y] = points[count];
      const [zx, zy] = pure ? [0, 0] : noise[count];
      const positions = pure ? [[x, y]] : [[x, y], [zx, zy], [x + zx, y + zy]];
      positions.forEach(([px, py], i) => {
        if (animated && i === 2) return;
        const ctx = contexts[i];
        const transform = ctx.getTransform();
        const screenX = transform.a * px + transform.e;
        const screenY = transform.d * py + transform.f;
        if (screenX < 0 || screenX > canvases[i].width || screenY < 0 || screenY > canvases[i].height) return;
        ctx.beginPath(); ctx.arc(px, py, .55, 0, Math.PI * 2); ctx.fill();
      });
    }
    // Internal progress supports checks without a visible sample counter.
    canvases.forEach(c => { c.dataset.sampleCount = String(count); });
  }

  function drawPoint(ctx, x, y, color, radius = .55) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  }

  // Hold at X briefly, then apply the actual sampled vector Z (no display rescaling).
  function displacement(age) {
    const t = Math.max(0, Math.min(1, (age - 200) / 450));
    return t * t * (3 - 2 * t);
  }

  function renderMotion(finish = false) {
    if (!animated) return;
    pending = pending.filter(batch => {
      if (!finish && elapsed - batch.born < motionDuration) return true;
      for (let j = batch.first; j < batch.end; j++) {
        drawPoint(contexts[2], points[j][0] + noise[j][0], points[j][1] + noise[j][1], purple);
      }
      return false;
    });
    displays.forEach((ctx, i) => {
      ctx.resetTransform();
      ctx.clearRect(0, 0, canvases[i].width, canvases[i].height);
      ctx.drawImage(buffers[i], 0, 0);
      ctx.setTransform(contexts[i].getTransform());
    });
    for (const batch of pending) {
      const t = displacement(elapsed - batch.born);
      for (let j = batch.first; j < batch.end; j++) {
        drawPoint(displays[2], points[j][0] + t * noise[j][0], points[j][1] + t * noise[j][1], t === 0 ? blue : purple);
      }
    }
    if (!finish && focus && elapsed - focus.born < motionDuration) {
      const [x, y] = points[focus.index], [zx, zy] = noise[focus.index];
      const t = displacement(elapsed - focus.born);
      drawPoint(displays[0], x, y, blue, 2.4);
      drawPoint(displays[1], zx, zy, red, 2.4);
      drawPoint(displays[2], x + t * zx, y + t * zy, t === 0 ? blue : purple, 2.4);
    }
  }

  function startCycle() {
    // Matching cycle indices share the same signal samples in all three slides.
    let seed = 1729 + cycleIndex++;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Uniform occupied pixels plus uniform subpixel jitter give uniform area samples.
    points = Array.from({ length: total }, () => {
      const [x, y] = pixels[Math.floor(random() * pixels.length)];
      return [x + random() - mask.width / 2, y + random() - mask.height / 2];
    });
    scalarNoise = [];
    noise = pure ? [] : Array.from({ length: total }, () => {
      // Box-Muller gives independent Gaussian coordinates before diagonal projection.
      const radius = sigma * Math.sqrt(-2 * Math.log(1 - random()));
      const angle = 2 * Math.PI * random();
      const normal = radius * Math.cos(angle);
      scalarNoise.push(normal);
      return diagonal ? [normal * Math.cos(direction), -normal * Math.sin(direction)] : [normal, radius * Math.sin(angle)];
    });
    count = 0; elapsed = 0; pending = []; focus = null;
    canvases.forEach((c, i) => {
      const ctx = contexts[i];
      ctx.resetTransform(); ctx.clearRect(0, 0, c.width, c.height);
      const padding = pure ? 32 : 60;
      const scale = Math.min(c.width / (mask.width + padding), c.height / (mask.height + padding));
      ctx.translate(c.width / 2, c.height / 2); ctx.scale(scale, scale);
      ctx.fillStyle = '#302e2b';
    });
    addUntil(0);
    renderMotion();
  }

  function tick(now) {
    frame = 0;
    if (last !== null) elapsed += now - last;
    last = now;
    if (elapsed >= duration + holdDuration + (animated ? motionDuration : 0)) startCycle();
    addUntil(Math.min(total, Math.floor(total * Math.min(elapsed / duration, 1) ** 1.7)));
    renderMotion();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = null;
    if (!visible || document.hidden) return;
    if (reduced.matches) {
      addUntil(total);
      renderMotion(true);
      elapsed = duration;
    } else frame = requestAnimationFrame(tick);
  }

  if (guide) {
    const cx = 375, cy = 324, radius = 250;
    const ticks = Array.from({ length: 72 }, (_, i) => {
      const a = i * Math.PI / 36, inner = radius - (i % 6 === 0 ? 18 : 8);
      return `<line x1="${cx + inner * Math.cos(a)}" y1="${cy - inner * Math.sin(a)}" x2="${cx + radius * Math.cos(a)}" y2="${cy - radius * Math.sin(a)}"/>`;
    }).join('');
    guide.innerHTML = `<circle cx="375" cy="324" r="270" fill="transparent"/>
      <g fill="none" stroke="currentColor" stroke-width="1" opacity=".5"><circle cx="375" cy="324" r="250"/>${ticks}</g>
      <line class="noise-direction" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 7"/>
      <circle class="noise-angle-handle" r="9" fill="#a54438"/>
      <text x="375" y="625" text-anchor="middle"></text>`;
    const axis = guide.querySelector('.noise-direction');
    const handle = guide.querySelector('.noise-angle-handle');
    const label = guide.querySelector('text');
    function updateGuide() {
      const dx = radius * Math.cos(direction), dy = -radius * Math.sin(direction);
      for (const [key, value] of Object.entries({ x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy })) axis.setAttribute(key, value);
      handle.setAttribute('cx', cx + dx); handle.setAttribute('cy', cy + dy);
      const degrees = Math.round(direction * 180 / Math.PI) % 360;
      label.textContent = `${degrees}°`;
      guide.setAttribute('aria-valuenow', degrees);
    }
    function rotate(angle) {
      direction = (angle + Math.PI * 2) % (Math.PI * 2);
      noise = scalarNoise.map(t => [t * Math.cos(direction), -t * Math.sin(direction)]);
      // Reproject existing draws rather than mixing different noise directions.
      for (const i of [1, 2]) {
        const ctx = contexts[i], transform = ctx.getTransform();
        ctx.resetTransform(); ctx.clearRect(0, 0, canvases[i].width, canvases[i].height); ctx.setTransform(transform);
      }
      const settled = pending.length ? pending[0].first : count;
      for (let j = 0; j < count; j++) {
        drawPoint(contexts[1], noise[j][0], noise[j][1], '#302e2b');
        if (j < settled) drawPoint(contexts[2], points[j][0] + noise[j][0], points[j][1] + noise[j][1], purple);
      }
      renderMotion(reduced.matches);
      updateGuide();
    }
    let pointer = null;
    function move(event) {
      const bounds = guide.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * 750 / bounds.width - cx;
      const y = cy - (event.clientY - bounds.top) * 648 / bounds.height;
      if (Math.hypot(x, y) > 12) rotate(Math.atan2(y, x));
    }
    guide.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      pointer = event.pointerId; guide.setPointerCapture(pointer); move(event);
    });
    guide.addEventListener('pointermove', event => { if (event.pointerId === pointer) move(event); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) guide.addEventListener(name, () => { pointer = null; });
    guide.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      rotate(direction + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1) * Math.PI / 180);
    });
    updateGuide();
  }

  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }, { threshold: .25 }).observe(canvas);
  startCycle();
  sync();
}
initializeSilhouetteDemo('observation', { pure: true });
initializeSilhouetteDemo('silhouette');
initializeSilhouetteDemo('horizontal', { diagonal: true });
