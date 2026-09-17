// Exact Bernoulli calculation; exported for numerical checks outside the browser.
function bernoulliGap(p, q) {
  const h2 = t => t === 0 || t === 1 ? 0 : -t * Math.log2(t) - (1 - t) * Math.log2(1 - t);
  const a = p * (1 - q), b = (1 - p) * q;
  const disagreement = a + b;
  const conditional = disagreement === 0 ? 0 : disagreement * h2(a / disagreement);
  const bound = (h2(p) + h2(q)) / 4;
  return { conditional, bound, gap: bound - conditional, disagreement };
}
// Perspective depth depends on the ground plane, keeping verticals upright.
function projectBernoulli(p, q, z = 0) {
  const depth = 1 + .18 * (p + q - 1);
  return [330 + 230 * (p - q) / depth, 350 + (130 * (1 - p - q) - 800 * z) / depth];
}
function unprojectBernoulli(x, y) {
  const v = (y - 350) / 130;
  const sum = 1 - v / (1 + .18 * v);
  const depth = 1 + .18 * (sum - 1);
  const difference = (x - 330) * depth / 230;
  return [(sum + difference) / 2, (sum - difference) / 2];
}
if (typeof module !== 'undefined') module.exports = { bernoulliGap, projectBernoulli, unprojectBernoulli };

if (typeof document !== 'undefined') (() => {
  const svg = document.getElementById('bernoulli-surface');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';
  const ink = '#302e2b', muted = '#625e57', paper = '#f6f3ed';
  const project = projectBernoulli;
  const element = (tag, attrs, text) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const path = points => points.map((point, i) => `${i ? 'L' : 'M'}${point.join(',')}`).join('');
  const label = (x, y, text, anchor = 'middle') => element('text', { x, y, 'text-anchor': anchor, fill: muted }, text);
  const square = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([p, q]) => project(p, q));
  svg.append(element('polygon', { points: square.map(pt => pt.join(',')).join(' '), fill: '#eee9e0', stroke: '#d6d0c6' }));
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    svg.append(element('path', { d: path([project(t, 0), project(t, 1)]) + path([project(0, t), project(1, t)]), fill: 'none', stroke: '#d6d0c6', 'stroke-width': .7 }));
  }
  const triangles = [], n = 32;
  const point = (i, j) => [i / n, j / n, bernoulliGap(i / n, j / n).gap];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    triangles.push([point(i, j), point(i + 1, j), point(i, j + 1)]);
    triangles.push([point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)]);
  }
  // Draw the distant rows first. The mesh is static while the marker moves.
  triangles.sort((a, b) => b.reduce((s, pt) => s + pt[0] + pt[1], 0) - a.reduce((s, pt) => s + pt[0] + pt[1], 0));
  for (const triangle of triangles) {
    const polygon = element('polygon', {
      points: triangle.map(pt => project(...pt).join(',')).join(' '),
      fill: '#e7ded0', 'fill-opacity': .92, stroke: '#9a8d7b', 'stroke-width': .5, 'stroke-linejoin': 'round',
    });
    svg.append(polygon);
  }
  const axis = z => project(-.13, 1, z);
  const verticalAxis = element('path', { d: path([axis(0), axis(.25)]), stroke: muted, fill: 'none' });
  svg.append(verticalAxis);
  svg.append(element('path', { d: path([...square, square[0]]), stroke: muted, 'stroke-width': 1.1, fill: 'none' }));
  const stem = element('path', { stroke: ink, 'stroke-dasharray': '4 5', fill: 'none' });
  const heightGuide = element('path', { stroke: muted, 'stroke-dasharray': '4 5', fill: 'none', opacity: .65 });
  const baseMarker = element('circle', { r: 6, fill: paper, stroke: ink, 'stroke-width': 2 });
  const surfaceMarker = element('circle', { r: 6, fill: ink, stroke: paper, 'stroke-width': 2 });
  const axisReadout = label(0, 0, '', 'end');
  axisReadout.setAttribute('class', 'bernoulli-axis-readout');
  axisReadout.setAttribute('stroke', paper);
  axisReadout.setAttribute('stroke-width', '5');
  axisReadout.setAttribute('paint-order', 'stroke');
  const axisTick = element('path', { stroke: ink, 'stroke-width': 1.5, fill: 'none' });
  svg.append(heightGuide, stem, baseMarker, surfaceMarker, axisTick, axisReadout);

  const binaryEntropy = t => t <= 0 || t >= 1 ? 0 : -t * Math.log2(t) - (1 - t) * Math.log2(1 - t);
  const smallGraphs = [
    ['hx', '#416f91'], ['hy', '#835b3f'], ['hconditional', '#795585'],
  ].map(([key, color]) => {
    const chart = document.getElementById(`bernoulli-${key}-graph`);
    const projectSmall = (t, h) => [36 + 300 * t, 116 - 98 * h];
    chart.append(element('path', { d: 'M36,18V116H336', stroke: '#b8afa2', fill: 'none' }));
    const curve = element('path', { fill: 'none', stroke: color, 'stroke-width': 1.8 });
    const guide = element('path', { fill: 'none', stroke: color, opacity: .4, 'stroke-dasharray': '3 4' });
    const marker = element('circle', { r: 4, fill: color, stroke: paper, 'stroke-width': 1.5 });
    chart.append(curve, guide, marker);
    return { key, chart, projectSmall, curve, guide, marker };
  });

  function update(p, q) {
    const value = bernoulliGap(p, q);
    const base = project(p, q), top = project(p, q, value.gap);
    stem.setAttribute('d', path([base, top]));
    const [axisX, axisY] = axis(value.gap);
    heightGuide.setAttribute('d', path([top, [axisX, axisY]]));
    axisReadout.setAttribute('x', axisX - 10);
    axisReadout.setAttribute('y', axisY + 6);
    axisReadout.textContent = `${Math.max(0, value.gap).toFixed(3)} bits`;
    axisTick.setAttribute('d', `M${axisX - 4},${axisY}h8`);
    [baseMarker, surfaceMarker].forEach((marker, i) => {
      marker.setAttribute('cx', [base, top][i][0]);
      marker.setAttribute('cy', [base, top][i][1]);
    });
    for (const graph of smallGraphs) {
      const fn = graph.key === 'hconditional' ? t => bernoulliGap(t, q).conditional : binaryEntropy;
      const selected = graph.key === 'hy' ? q : p;
      const height = fn(selected);
      graph.curve.setAttribute('d', path(Array.from({ length: 201 }, (_, i) => graph.projectSmall(i / 200, fn(i / 200)))));
      const [x, y] = graph.projectSmall(selected, height);
      graph.marker.setAttribute('cx', x); graph.marker.setAttribute('cy', y);
      graph.guide.setAttribute('d', `M36,${y}H${x}V116`);
      graph.chart.setAttribute('aria-label', `${graph.key === 'hx' ? 'H(X)' : graph.key === 'hy' ? 'H(Y)' : 'H(X given X+Y)'}: ${height.toFixed(3)} bits at p=${p.toFixed(2)}, q=${q.toFixed(2)}`);
    }
    svg.setAttribute('aria-label', `Bernoulli gap surface. p ${p.toFixed(2)}, q ${q.toFixed(2)}. Remaining uncertainty ${value.conditional.toFixed(3)} bits; bound ${value.bound.toFixed(3)} bits; gap ${value.gap.toFixed(3)} bits.`);
  }
  let dragging = false;
  function choose(event, starting = false) {
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    let [p, q] = unprojectBernoulli(pt.x, pt.y);
    if (!Number.isFinite(p) || !Number.isFinite(q)) return false;
    if (starting && (p < -.02 || p > 1.02 || q < -.02 || q > 1.02)) return false;
    p = Math.round(Math.max(0, Math.min(1, p)) * 100) / 100;
    q = Math.round(Math.max(0, Math.min(1, q)) * 100) / 100;
    update(p, q);
    return true;
  }
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !choose(event, true)) return;
    dragging = true;
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', event => { if (dragging) choose(event); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => svg.addEventListener(type, () => { dragging = false; }));
  update(.5, .5);
})();
