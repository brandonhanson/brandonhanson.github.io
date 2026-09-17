'use strict';

const cubeVertices = Array.from({ length: 8 }, (_, i) => [(i >> 2) & 1, (i >> 1) & 1, i & 1]);
const cubeAverages = Array.from({ length: 27 }, (_, i) => [Math.floor(i / 9) / 2, Math.floor(i / 3) % 3 / 2, i % 3 / 2]);
const cubeVertexColors = ['#9a503f', '#b0812b', '#6f8548', '#347a73', '#416f91', '#796391', '#a2607b', '#6d6252'];

function cubePointColor(point) {
  const rgb = [0, 0, 0];
  cubeVertices.forEach((vertex, index) => {
    const weight = point.reduce((product, value, axis) => product * (vertex[axis] ? value : 1 - value), 1);
    const hex = cubeVertexColors[index].slice(1);
    for (let channel = 0; channel < 3; channel++) rgb[channel] += weight * parseInt(hex.slice(2 * channel, 2 * channel + 2), 16);
  });
  return `rgb(${rgb.map(Math.round).join(', ')})`;
}

function redistributeCubeProbability(probabilities, index, value) {
  if (probabilities.length !== 8 || !Number.isInteger(index) || index < 0 || index > 7 || !Number.isFinite(value)) {
    throw new RangeError('A cube needs eight probabilities, a vertex index, and a finite probability.');
  }
  const selected = Math.max(0, Math.min(1, value));
  const otherMass = probabilities.reduce((sum, p, i) => sum + (i === index ? 0 : p), 0);
  return probabilities.map((p, i) => i === index ? selected : (1 - selected) * (otherMass > 0 ? p / otherMass : 1 / 7));
}

function drawCubeVertex(probabilities, random) {
  const draw = random();
  let cumulative = 0, lastPositive = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > 0) lastPositive = i;
    cumulative += probabilities[i];
    if (draw < cumulative) return i;
  }
  // Floating-point summation can leave the CDF just below one.
  return lastPositive;
}

function sampleCubePair(px, py, random = Math.random) {
  const x = drawCubeVertex(px, random), y = drawCubeVertex(py, random);
  const sum = cubeVertices[x].map((value, i) => value + cubeVertices[y][i]);
  return { x, y, z: 9 * sum[0] + 3 * sum[1] + sum[2] };
}

function empiricalCubeEntropy(counts) {
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) return null;
  return counts.reduce((entropy, n) => {
    const p = n / total;
    return n === 0 ? entropy : entropy - p * Math.log2(p);
  }, 0);
}

// One orthographic camera for all three cubes; unequal viewing angles keep all
// 27 average locations distinct in the projection. Coordinates are never jittered.
function projectProbabilityCube([x, y, z]) {
  const yaw = 35 * Math.PI / 180, elevation = 24 * Math.PI / 180, scale = 184;
  x -= .5; y -= .5; z -= .5;
  return [180 + scale * (Math.cos(yaw) * x - Math.sin(yaw) * y),
    174 + scale * (Math.sin(elevation) * (Math.sin(yaw) * x + Math.cos(yaw) * y) - Math.cos(elevation) * z)];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cubeVertices, cubeAverages, cubeVertexColors, cubePointColor, redistributeCubeProbability, sampleCubePair, projectProbabilityCube, empiricalCubeEntropy };
}

(() => {
  if (typeof document === 'undefined') return;
  const section = document.getElementById('cube-averages');
  if (!section) return;
  const ns = 'http://www.w3.org/2000/svg';
  const rule = '#b8afa2';
  const plots = Object.fromEntries(['x', 'y', 'z'].map(key => [key, document.getElementById(`cube-${key}-plot`)]));
  const probabilities = { x: Array(8).fill(1 / 8), y: Array(8).fill(1 / 8) };
  const counts = Array(27).fill(0), controls = { x: [], y: [] }, nodes = {};
  const sampleCounts = { x: Array(8).fill(0), y: Array(8).fill(0), z: counts };
  const sampleRings = {}, gauges = {};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let count = 0, currentPair = null, visible = false, editing = false, frame = 0, lastTime = null;

  function svgElement(tag, attributes = {}, text) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function at(node, point) {
    const [x, y] = projectProbabilityCube(point);
    node.setAttribute('cx', x); node.setAttribute('cy', y);
  }
  function line(a, b, attributes = {}) {
    const [x1, y1] = projectProbabilityCube(a), [x2, y2] = projectProbabilityCube(b);
    return svgElement('line', { x1, y1, x2, y2, ...attributes });
  }
  function tuple(point) { return `(${point.map(v => v === .5 ? '½' : v).join(', ')})`; }

  // Identical semicircular scales make the three empirical entropies comparable.
  function gaugePoint(bits, radius) {
    const angle = Math.PI * (1 - bits / 5);
    return [120 + radius * Math.cos(angle), 106 - radius * Math.sin(angle)];
  }
  for (const key of ['x', 'y', 'z']) {
    const gauge = document.getElementById(`cube-${key}-entropy`);
    gauge.append(svgElement('path', { d: 'M40 106 A80 80 0 0 1 200 106', fill: 'none', stroke: rule, 'stroke-width': 1 }));
    for (let i = 0; i <= 20; i++) {
      const value = i / 4, major = i % 4 === 0;
      const [x1, y1] = gaugePoint(value, major ? 70 : 75), [x2, y2] = gaugePoint(value, 80);
      gauge.append(svgElement('line', { x1, y1, x2, y2, stroke: major ? '#625e57' : rule, 'stroke-width': 1 }));
      if (major) {
        const [x, y] = gaugePoint(value, 96);
        gauge.append(svgElement('text', { x, y: y + 4, 'text-anchor': 'middle' }, String(value)));
      }
    }
    const needle = svgElement('line', { x1: 120, y1: 106, x2: 54, y2: 106, stroke: '#302e2b', 'stroke-width': 1.8, 'stroke-linecap': 'round', visibility: 'hidden' });
    const value = svgElement('text', { x: 120, y: 142, 'text-anchor': 'middle', class: 'entropy-gauge-value' }, '— bits');
    gauge.append(needle, svgElement('circle', { cx: 120, cy: 106, r: 3, fill: '#302e2b' }), value);
    gauges[key] = { gauge, needle, value };
  }

  for (const key of ['x', 'y', 'z']) {
    const svg = plots[key];
    for (let i = 0; i < 8; i++) for (let axis = 0; axis < 3; axis++) {
      const j = i ^ (1 << (2 - axis));
      if (j <= i) continue;
      const hiddenEdge = i === 0 || j === 0;
      svg.append(line(cubeVertices[i], cubeVertices[j], { stroke: rule, 'stroke-width': 1.15,
        'stroke-dasharray': hiddenEdge ? '3 5' : '', opacity: hiddenEdge ? .65 : 1 }));
    }
    if (key === 'z') {
      for (const point of cubeAverages) {
        const guide = svgElement('circle', { r: 1.6, fill: rule, opacity: .65 });
        at(guide, point); svg.append(guide);
      }
    }
    const points = key === 'z' ? cubeAverages : cubeVertices;
    nodes[key] = points.map(point => {
      const node = svgElement('circle', { r: 0, fill: cubePointColor(point), 'fill-opacity': key === 'z' ? .48 : .25,
        stroke: cubePointColor(point), 'stroke-opacity': .65, 'stroke-width': 1 });
      at(node, point);
      svg.append(node);
      return node;
    });
    cubeVertices.forEach((point, i) => {
      const [x, y] = projectProbabilityCube(point);
      const center = svgElement('circle', { cx: x, cy: y, r: 2, fill: cubeVertexColors[i] });
      svg.append(center);
    });
    const ring = svgElement('circle', { r: 10, fill: 'none', 'stroke-width': 2, visibility: 'hidden', 'aria-hidden': 'true' });
    svg.append(ring); sampleRings[key] = ring;
  }

  const pairOverlay = svgElement('g', { visibility: 'hidden', 'aria-hidden': 'true' });
  const pairLines = {}, pairEnds = {};
  for (const key of ['x', 'y']) {
    pairLines[key] = svgElement('line', { 'stroke-width': 1.5, 'stroke-dasharray': '3 4' });
    pairEnds[key] = svgElement('circle', { r: key === 'x' ? 7 : 4, fill: '#f6f3ed', 'stroke-width': 2 });
    pairOverlay.append(pairLines[key], pairEnds[key]);
  }
  plots.z.insertBefore(pairOverlay, sampleRings.z);

  function updateSampleMarkers() {
    pairOverlay.setAttribute('visibility', currentPair ? 'visible' : 'hidden');
    for (const key of ['x', 'y', 'z']) {
      const ring = sampleRings[key];
      ring.setAttribute('visibility', currentPair ? 'visible' : 'hidden');
      if (!currentPair) continue;
      const point = (key === 'z' ? cubeAverages : cubeVertices)[currentPair[key]];
      at(ring, point);
      ring.setAttribute('stroke', cubePointColor(point));
      ring.setAttribute('r', Math.max(9, Number(nodes[key][currentPair[key]].getAttribute('r')) + 4));
    }
    if (!currentPair) return;
    const [mx, my] = projectProbabilityCube(cubeAverages[currentPair.z]);
    for (const key of ['x', 'y']) {
      const point = cubeVertices[currentPair[key]], [x, y] = projectProbabilityCube(point);
      const color = cubeVertexColors[currentPair[key]];
      at(pairEnds[key], point); pairEnds[key].setAttribute('stroke', color);
      for (const [attr, value] of Object.entries({ x1: x, y1: y, x2: mx, y2: my, stroke: color })) pairLines[key].setAttribute(attr, value);
    }
  }

  function updateInput(key) {
    probabilities[key].forEach((p, i) => {
      const percentage = p * 100;
      controls[key][i].input.value = percentage.toFixed(4);
      controls[key][i].input.style.setProperty('--probability', `${percentage}%`);
      controls[key][i].input.setAttribute('aria-valuetext', `${percentage.toFixed(1)} percent`);
      nodes[key][i].setAttribute('r', 36 * Math.sqrt(p));
    });
    plots[key].setAttribute('aria-label', `Cube ${key.toUpperCase()}. ` + probabilities[key].map((p,i) => `${cubeVertices[i].join('')}: ${(p*100).toFixed(1)} percent`).join('; '));
  }

  function renderSamples() {
    counts.forEach((n, i) => {
      nodes.z[i].setAttribute('r', n > 0 ? 27 * Math.sqrt(n / Math.max(count, 40)) : 0);
    });
    plots.z.setAttribute('aria-label', `${count} sampled averages in the cube. Circle area represents sampled frequency.`);
    for (const key of ['x', 'y', 'z']) {
      const entropy = empiricalCubeEntropy(sampleCounts[key]);
      const { gauge, needle, value } = gauges[key];
      needle.setAttribute('visibility', entropy === null ? 'hidden' : 'visible');
      value.textContent = entropy === null ? '— bits' : `${entropy.toFixed(2)} bits`;
      gauge.setAttribute('aria-label', `Empirical entropy of ${key.toUpperCase()}: ${entropy === null ? 'waiting for samples' : `${entropy.toFixed(2)} bits from ${count} samples`}. Scale 0 to 5 bits.`);
      if (entropy !== null) {
        const [x, y] = gaugePoint(entropy, 66);
        needle.setAttribute('x2', x); needle.setAttribute('y2', y);
      }
    }
    updateSampleMarkers();
  }
  function clearSamples() {
    for (const values of Object.values(sampleCounts)) values.fill(0);
    count = 0; currentPair = null; renderSamples();
  }
  function sample(n) {
    for (let i = 0; i < n; i++) {
      const pair = sampleCubePair(probabilities.x, probabilities.y);
      for (const key of ['x', 'y', 'z']) sampleCounts[key][pair[key]]++;
      currentPair = pair; count++;
    }
    renderSamples();
  }
  function tick(now) {
    if (lastTime === null || now - lastTime >= 120) { sample(1); lastTime = now; }
    frame = requestAnimationFrame(tick);
  }
  function syncPlayback() {
    cancelAnimationFrame(frame); frame = 0; lastTime = null;
    if (visible && !document.hidden && !editing) {
      if (reduced.matches) {
        if (count === 0) sample(1000);
      } else frame = requestAnimationFrame(tick);
    }
  }
  function endEdit() {
    if (!editing) return;
    editing = false; syncPlayback();
  }

  for (const key of ['x', 'y']) {
    const fieldset = document.getElementById(`cube-${key}-equalizer`);
    cubeVertices.forEach((point, index) => {
      const channel = document.createElement('div'); channel.className = 'cube-channel';
      channel.style.setProperty('--vertex-color', cubeVertexColors[index]);
      const input = document.createElement('input');
      input.id = `cube-${key}-probability-${index}`; input.type = 'range';
      input.min = 0; input.max = 100; input.step = .1; input.value = 12.5;
      input.setAttribute('aria-label', `${key.toUpperCase()} vertex ${tuple(point)} probability in percent`);
      input.setAttribute('aria-orientation', 'vertical');
      channel.append(input); fieldset.append(channel);
      controls[key].push({ input });
      input.addEventListener('pointerdown', () => { editing = true; syncPlayback(); });
      input.addEventListener('input', () => {
        probabilities[key] = redistributeCubeProbability(probabilities[key], index, Number(input.value) / 100);
        updateInput(key); clearSamples(); syncPlayback();
      });
      input.addEventListener('change', endEdit);
    });
    document.getElementById(`cube-${key}-uniform`).addEventListener('click', () => {
      probabilities[key] = Array(8).fill(1/8); updateInput(key); clearSamples(); syncPlayback();
    });
    updateInput(key);
  }
  document.addEventListener('pointerup', endEdit);
  document.addEventListener('pointercancel', endEdit);
  window.addEventListener('blur', endEdit);
  document.addEventListener('visibilitychange', syncPlayback);
  reduced.addEventListener('change', syncPlayback);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting; syncPlayback();
  }, { threshold: 0 }).observe(section);
  renderSamples(); syncPlayback();
})();
