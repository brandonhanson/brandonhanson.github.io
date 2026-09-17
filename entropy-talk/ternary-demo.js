(() => {
  const entropy = ps => ps.reduce((h, p) => h - (p > 0 ? p * Math.log2(p) : 0), 0);
  // Isometric embedding of (p_b, p_u, p_g), whose sum is one.
  // Distances in the probability plane retain their Euclidean scale.
  const vertices = [[Math.SQRT1_2, -1 / Math.sqrt(6)], [-Math.SQRT1_2, -1 / Math.sqrt(6)], [0, Math.sqrt(2 / 3)]];
  const axisX = -.88, axisY = -1 / Math.sqrt(6);
  const unitScale = 230, tilt = .45, cameraDistance = 4;
  const xyz = (ps, height = entropy(ps)) => [ps.reduce((x, p, i) => x + p * vertices[i][0], 0), ps.reduce((y, p, i) => y + p * vertices[i][1], 0), height];
  function project([x, y, z]) {
    // Preserve depth convergence in the base, with vertical entropy uprights.
    const vertical = -y * Math.sin(tilt) + z;
    const distance = cameraDistance - y * Math.cos(tilt);
    const scale = unitScale * cameraDistance / distance;
    return [375 + scale * x, 435 - scale * vertical, distance];
  }
  function probabilitiesAt(x, y, clamp = true) {
    const [a, b, c] = vertices.map(([vx, vy]) => project([vx, vy, 0]));
    const denominator = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    const u = ((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/denominator;
    const v = ((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/denominator;
    const screenWeights = [u, v, 1-u-v];
    if (!clamp && screenWeights.some(weight => weight < -.025)) return null;
    // Screen barycentric coordinates must be divided by camera distance.
    // Otherwise the selected probabilities drift under perspective.
    const weights = screenWeights.map((weight, i) => Math.max(0, weight) / [a, b, c][i][2]);
    const sum = weights.reduce((total, weight) => total + weight, 0);
    return weights.map(weight => weight / sum);
  }
  function roundCounts(weights) {
    const result = weights.map(weight => Math.floor(100 * weight));
    const remainder = 100 - result.reduce((sum, n) => sum + n, 0);
    const order = weights.map((weight, i) => [100 * weight - result[i], i]).sort((a, b) => b[0] - a[0]);
    for (let i = 0; i < remainder; i++) result[order[i][1]]++;
    return result;
  }
  function entropyCalculation(counts) {
    const terms = [0, 2, 1].map(i => {
      const p = (counts[i] / 100).toFixed(2);
      const ink = ['#835b3f', '#416f91', '#55734d'][i];
      // Keep the same space at zero without displaying an undefined logarithm.
      const term = counts[i] === 0 ? '0.00\\phantom{\\log_2(1/1.00)}' : `${p}\\log_2(1/${p})`;
      return `\\textcolor{${ink}}{${term}}`;
    });
    return `=${terms.join('+')}`;
  }
  if (typeof module !== 'undefined') module.exports = { entropy, vertices, xyz, project, probabilitiesAt, roundCounts, entropyCalculation };
  if (typeof document === 'undefined') return;
  const surface = document.getElementById('ternary-surface');
  if (!surface) return;
  const ns = 'http://www.w3.org/2000/svg';
  const colours = ['brown', 'blue', 'green'];
  const inks = ['#835b3f', '#416f91', '#55734d'];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let counts = [34, 33, 33], frame = 0, steps = 0;

  // Anchor each swarm just outside its vertex in the same projected scene.
  const swarmOffsets = [[185, -50], [-185, -50], [0, 90]];
  colours.forEach((colour, i) => {
    const p = project([...vertices[i], 0]);
    const population = document.getElementById(`ternary-${colour}-population`);
    population.style.setProperty('--swarm-x', `${(p[0] + swarmOffsets[i][0] + 125) / 10}%`);
    population.style.setProperty('--swarm-y', `${(p[1] + swarmOffsets[i][1] + 25) / 7.9}%`);
  });
  function element(tag, attrs, text) {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  const mesh = [];
  const divisions = 24;
  const at = (i, j) => xyz([i / divisions, j / divisions, 1 - (i + j) / divisions]);
  for (let i = 0; i < divisions; i++) for (let j = 0; j < divisions - i; j++) {
    mesh.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
    if (i + j < divisions - 1) mesh.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  }
  function drawSurface() {
    surface.replaceChildren();
    const triangles = mesh.map(tri => tri.map(project)).sort((a, b) => b.reduce((s, p) => s + p[2], 0) - a.reduce((s, p) => s + p[2], 0));
    for (const tri of triangles) surface.append(element('polygon', { points: tri.map(p => p.slice(0, 2).join(',')).join(' '), fill: '#e9e3d8', stroke: '#8c8579', 'stroke-width': '.55', 'stroke-linejoin': 'round' }));
    const axis = project([axisX, axisY, 0]), top = project([axisX, axisY, Math.log2(3)]);
    surface.append(element('path', { id: 'ternary-entropy-axis', d: `M${axis[0]},${axis[1]}L${top[0]},${top[1]}`, stroke: '#625e57', fill: 'none' }));
    for (const h of [0, 1, Math.log2(3)]) {
      const p = project([axisX, axisY, h]);
      surface.append(element('text', { x: p[0] - 8, y: p[1] + 5, 'text-anchor': 'end' }, h === 0 ? '0' : h === 1 ? '1' : '1.585'));
    }
    const ps = counts.map(n => n / 100), base = project(xyz(ps, 0)), marker = project(xyz(ps));
    surface.append(element('path', { d: `M${base[0]},${base[1]}L${marker[0]},${marker[1]}`, stroke: '#302e2b', 'stroke-dasharray': '3 4', fill: 'none' }));
    surface.append(element('polygon', { id: 'ternary-base-triangle', points: vertices.map(([x,y]) => project([x,y,0]).slice(0,2).join(',')).join(' '), fill: '#f6f3ed', 'fill-opacity': .18, stroke: '#625e57', 'stroke-width': 1 }));
    vertices.forEach(([x, y], i) => {
      const p = project([x, y, 0]);
      surface.append(element('circle', { cx: p[0], cy: p[1], r: 4, fill: inks[i] }));
    });
    surface.append(element('circle', { cx: base[0], cy: base[1], r: 5, fill: '#f6f3ed', stroke: '#302e2b', 'stroke-width': 2 }));
    const axisPoint = project([axisX, axisY, entropy(ps)]);
    surface.append(element('path', { id: 'ternary-entropy-guide', d: `M${marker[0]},${marker[1]}L${axisPoint[0]},${axisPoint[1]}`, stroke: '#625e57', 'stroke-dasharray': '3 4', fill: 'none' }));
    surface.append(element('circle', { cx: marker[0], cy: marker[1], r: 6, fill: '#302e2b', stroke: '#f6f3ed', 'stroke-width': 2 }));
  }
  function drawHistogram() {
    const histogram = document.getElementById('ternary-histogram');
    histogram.replaceChildren();
    histogram.setAttribute('aria-label', `Eye-colour proportions: ${colours.map((colour, i) => `${colour} ${(counts[i] / 100).toFixed(2)}`).join(', ')}.`);
    colours.forEach((colour, i) => {
      const x = 72 + i * 88, height = counts[i] * 2.1;
      histogram.append(element('rect', { id: `ternary-${colour}-bar`, x: x - 25, y: 250 - height, width: 50, height, fill: inks[i], 'fill-opacity': .8 }));
    });
  }
  // Repelling particles retain their positions between probability changes.
  const swarms = colours.map((colour, group) => {
    const svg = document.getElementById(`ternary-${colour}-swarm`);
    return Array.from({ length: 100 }, (_, i) => {
      const angle = i * 2.39996 + group, r = 8 * Math.sqrt(i + 1);
      const dot = element('circle', { r: 4, fill: inks[group] }); svg.append(dot);
      return { x: 170 + r * Math.cos(angle), y: 90 + .65 * r * Math.sin(angle), vx: 0, vy: 0, dot };
    });
  });
  function step() {
    swarms.forEach((swarm, group) => {
      const nodes = swarm.slice(0, counts[group]);
      for (const a of nodes) { a.vx += (170 - a.x) * .002; a.vy += (90 - a.y) * .005; }
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = Math.max(1, dx * dx + dy * dy), f = 24 / (d2 * Math.sqrt(d2));
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      for (const a of nodes) { a.vx *= .82; a.vy *= .82; a.x = Math.max(8, Math.min(332, a.x + a.vx)); a.y = Math.max(8, Math.min(172, a.y + a.vy)); }
    });
  }
  function paintDots() { swarms.forEach((swarm, group) => swarm.slice(0, counts[group]).forEach(a => { a.dot.setAttribute('cx', a.x); a.dot.setAttribute('cy', a.y); })); }
  function animate() { step(); paintDots(); frame = --steps > 0 ? requestAnimationFrame(animate) : 0; }
  function update() {
    colours.forEach((colour, i) => {
      document.getElementById(`ternary-${colour}-ratio`).textContent = `${counts[i]} / 100`;
      document.getElementById(`ternary-${colour}-swarm`).setAttribute('aria-label', `${counts[i]} people with ${colour} eyes`);
      swarms[i].forEach((a, j) => { a.dot.style.display = j < counts[i] ? '' : 'none'; });
    });
    document.getElementById('ternary-entropy').textContent = entropy(counts.map(n => n / 100)).toFixed(2);
    const calculation = document.getElementById('ternary-entropy-substitution');
    if (typeof katex !== 'undefined') {
      calculation.innerHTML = katex.renderToString(entropyCalculation(counts), { throwOnError: true, trust: false });
    } else {
      calculation.textContent = counts.map(n => n ? `${(n / 100).toFixed(2)} log2(1/${(n / 100).toFixed(2)})` : '0.00').join(' + ');
    }
    drawSurface(); drawHistogram(); cancelAnimationFrame(frame);
    if (reducedMotion.matches) { for (let i = 0; i < 240; i++) step(); paintDots(); } else { paintDots(); steps = 240; frame = requestAnimationFrame(animate); }
  }
  const selector = surface;
  function choose(e, clamp = true) {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(selector.getScreenCTM().inverse());
    const weights = probabilitiesAt(pt.x, pt.y, clamp);
    if (!weights) return false;
    counts = roundCounts(weights);
    update();
    return true;
  }
  let selecting = false;
  selector.addEventListener('pointerdown', e => { selecting = choose(e, false); if (selecting) selector.setPointerCapture(e.pointerId); });
  selector.addEventListener('pointermove', e => { if (selecting) choose(e); });
  selector.addEventListener('pointerup', () => { selecting = false; });
  selector.addEventListener('pointercancel', () => { selecting = false; });
  update();
})();
