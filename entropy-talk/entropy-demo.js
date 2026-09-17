(() => {
  const plot = document.getElementById('binary-entropy-plot');
  const entropyReadout = document.getElementById('entropy-value');
  const questionEntropyReadout = document.getElementById('question-entropy');
  let count = 50;
  if (!plot) return;
  const ns = 'http://www.w3.org/2000/svg';
  const entropy = p => p === 0 || p === 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
  const point = p => [56 + 556 * p, 588 - 556 * entropy(p)];
  document.getElementById('entropy-curve').setAttribute('d', Array.from({ length: 201 }, (_, i) => {
    const [x, y] = point(i / 200);
    return `${i ? 'L' : 'M'}${x},${y}`;
  }).join(' '));

  // Seeded initial positions; repulsion and a weak central force settle each swarm.
  const swarms = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let animation = 0, remaining = 0;
  function makeSwarm(id, seed) {
    const svg = document.getElementById(id);
    const positions = [];
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 100; i++) {
      let best, bestDistance = -1;
      for (let j = 0; j < 50; j++) {
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random());
        const candidate = [170 + 146 * radius * Math.cos(angle), 120 + 96 * radius * Math.sin(angle)];
        const distance = positions.length ? Math.min(...positions.map(([x, y]) => (x - candidate[0]) ** 2 + (y - candidate[1]) ** 2)) : 1;
        if (distance > bestDistance) { best = candidate; bestDistance = distance; }
      }
      positions.push(best);
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', best[0]); dot.setAttribute('cy', best[1]); dot.setAttribute('r', '4.5');
      svg.append(dot);
    }
    swarms.push({ svg, nodes: positions.map(([x, y], i) => ({ x, y, vx: 0, vy: 0, dot: svg.children[i] })), count: 0 });
    return svg;
  }
  function step() {
    for (const swarm of swarms) {
      const nodes = swarm.nodes.slice(0, swarm.count);
      for (const a of nodes) {
        a.vx += (170 - a.x) * .002;
        a.vy += (120 - a.y) * .003;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const squared = Math.max(dx * dx + dy * dy, 1);
          const force = 28 / (squared * Math.sqrt(squared));
          a.vx += dx * force; a.vy += dy * force;
          b.vx -= dx * force; b.vy -= dy * force;
        }
      }
      for (const a of nodes) {
        a.vx *= .82; a.vy *= .82;
        a.x = Math.max(10, Math.min(330, a.x + a.vx));
        a.y = Math.max(10, Math.min(230, a.y + a.vy));
      }
    }
  }
  function draw() {
    for (const swarm of swarms) for (const a of swarm.nodes.slice(0, swarm.count)) {
      a.dot.setAttribute('cx', a.x); a.dot.setAttribute('cy', a.y);
    }
  }
  function animate() {
    step(); draw();
    animation = --remaining > 0 ? requestAnimationFrame(animate) : 0;
  }
  function settle() {
    cancelAnimationFrame(animation);
    if (reducedMotion.matches) {
      for (let i = 0; i < 240; i++) step();
      draw(); animation = 0;
    } else {
      remaining = 240;
      animation = requestAnimationFrame(animate);
    }
  }
  const brown = makeSwarm('brown-swarm', 41);
  const blue = makeSwarm('blue-swarm', 127);
  function update() {
    const p = count / 100;
    for (const [svg, n, colour] of [[brown, count, 'brown'], [blue, 100 - count, 'blue']]) {
      [...svg.children].forEach((dot, i) => { dot.style.display = i < n ? '' : 'none'; });
      svg.setAttribute('aria-label', `${n} people with ${colour} eyes`);
      document.getElementById(`${colour}-ratio`).textContent = `${n} / 100`;
      swarms.find(swarm => swarm.svg === svg).count = n;
    }
    const [x, y] = point(p);
    document.getElementById('entropy-marker').setAttribute('cx', x);
    document.getElementById('entropy-marker').setAttribute('cy', y);
    document.getElementById('entropy-marker-guide').setAttribute('d', `M${x},588V${y}`);
    const bits = entropy(p).toFixed(2);
    if (entropyReadout) entropyReadout.textContent = `${bits} bits`;
    if (questionEntropyReadout) questionEntropyReadout.textContent = bits;
    document.getElementById('binary-axis-marker').setAttribute('cx', x);
    document.getElementById('entropy-horizontal-guide').setAttribute('d', `M56,${y}H${x}`);
    document.getElementById('expected-population').textContent = (100 * (p * p + (1 - p) ** 2)).toFixed(2);
    plot.setAttribute('aria-label', `${p.toFixed(2)}; ${count} brown eyes and ${100 - count} blue eyes`);
    settle();
  }
  let dragging = false;
  function choose(e) {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(plot.getScreenCTM().inverse());
    count = Math.round(100 * Math.max(0, Math.min(1, (pt.x - 56) / 556)));
    update();
  }
  plot.addEventListener('pointerdown', e => { dragging = true; plot.setPointerCapture(e.pointerId); choose(e); });
  plot.addEventListener('pointermove', e => { if (dragging) choose(e); });
  plot.addEventListener('pointerup', () => { dragging = false; });
  plot.addEventListener('pointercancel', () => { dragging = false; });
  update();
})();

