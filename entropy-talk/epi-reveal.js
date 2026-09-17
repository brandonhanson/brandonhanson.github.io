(() => {
  const slide = document.getElementById('conditional-epi');
  if (!slide || !('IntersectionObserver' in window)) return;
  slide.classList.add('epi-reveal-ready');
  new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.intersectionRatio >= .35) slide.classList.add('epi-reveal-active');
      // Reset only once the slide has left the screen, for a clean replay on return.
      else if (!entry.isIntersecting) slide.classList.remove('epi-reveal-active');
    }
  }, { threshold: [0, .35] }).observe(slide);
})();
