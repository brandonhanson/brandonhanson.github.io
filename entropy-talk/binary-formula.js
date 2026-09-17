(() => {
  function readGroup(source, start) {
    if (source[start] !== '{') throw new Error('Expected a braced formula term.');
    let depth = 0;
    for (let i = start; i < source.length; i++) {
      if (source[i] === '\\') { i++; continue; }
      if (source[i] === '{') depth++;
      if (source[i] === '}' && --depth === 0) {
        return { body: source.slice(start + 1, i), end: i + 1 };
      }
    }
    throw new Error('Unclosed group in the binary formula.');
  }

  function makeStages(source) {
    const terms = [];
    const pattern = /\\(?:overbrace|underbrace)\s*\{/g;
    let match;
    while ((match = pattern.exec(source))) {
      const base = readGroup(source, pattern.lastIndex - 1);
      let cursor = base.end;
      while (/\s/.test(source[cursor] ?? '') && cursor < source.length) cursor++;
      if (!['^', '_'].includes(source[cursor])) throw new Error('Missing brace description.');
      cursor++;
      while (/\s/.test(source[cursor] ?? '') && cursor < source.length) cursor++;
      const label = readGroup(source, cursor);
      terms.push({ start: match.index, end: label.end, body: base.body,
        annotated: source.slice(match.index, label.end) });
      pattern.lastIndex = label.end;
    }
    if (terms.length !== 4) throw new Error('The slider requires four annotated terms.');
    return terms.map((_, active) => {
      // Reserve the full equation's height/depth so the baseline never moves.
      let tex = `\\vphantom{${source}}${source.slice(0, terms[0].start)}`;
      terms.forEach((term, index) => {
        if (index) {
          const separator = source.slice(terms[index - 1].end, term.start);
          tex += separator.replace(/\+/g, index <= active
            ? '\\mathord{+}' : '\\mathord{\\phantom{+}}');
        }
        // Keep identical brace geometry at every step; only visibility changes.
        const state = index === active ? 'current' : index < active ? 'revealed' : 'hidden';
        tex += `\\mathord{\\htmlClass{formula-term formula-term-${state}}{${term.annotated}}}`;
      });
      return tex + source.slice(terms.at(-1).end);
    });
  }

  if (typeof module !== 'undefined') module.exports = { makeStages };
  if (typeof document === 'undefined') return;
  const formula = document.getElementById('binary-formula');
  const slider = document.getElementById('binary-formula-step');
  if (!formula || !slider || typeof katex === 'undefined') return;
  const source = formula.textContent.trim().replace(/^\$\$|\$\$$/g, '').trim();
  const descriptions = [
    'Probability of observing brown eyes',
    'Number of halvings of the candidate population upon observing brown eyes',
    'Probability of observing blue eyes',
    'Number of halvings of the candidate population upon observing blue eyes',
  ];
  try {
    const stages = makeStages(source).map(tex => katex.renderToString(tex, {
      displayMode: true, throwOnError: true, strict: 'ignore',
      trust: context => context.command === '\\htmlClass',
    }));
    const description = document.getElementById('formula-step-description');
    const ticks = document.querySelectorAll('.formula-step-ticks span');
    function update() {
      const index = Number(slider.value) - 1;
      formula.innerHTML = stages[index];
      formula.querySelectorAll('.clap > .katex-inner').forEach(annotation => {
        annotation.classList.add('math-annotation');
      });
      const message = `Step ${index + 1} of 4: ${descriptions[index]}`;
      slider.setAttribute('aria-valuetext', message);
      description.textContent = message;
      ticks.forEach((tick, i) => {
        if (i === index) tick.setAttribute('aria-current', 'step');
        else tick.removeAttribute('aria-current');
      });
    }
    slider.disabled = false;
    slider.addEventListener('input', update);
    update();
  } catch (error) {
    // Keep the authored equation available if an edit cannot be staged.
    console.error('Could not initialize the binary formula slider:', error);
  }
})();
