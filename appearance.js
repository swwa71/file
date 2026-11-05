/* Visual transitions only; observes the existing tool title. */
(() => {
  const title = document.getElementById('current-tool-title');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const targets = ['current-tool-title', 'current-tool-description', 'options'].map(id => document.getElementById(id));
  new MutationObserver(() => {
    if (reduced.matches) return;
    targets.forEach(target => {
      if (!target || !target.animate) return;
      target.getAnimations().forEach(animation => animation.cancel());
      target.animate([{opacity:0, transform:'translateY(7px)'}, {opacity:1, transform:'translateY(0)'}], {duration:320, easing:'cubic-bezier(.22,1,.36,1)'});
    });
  }).observe(title, {childList:true, characterData:true, subtree:true});
})();
