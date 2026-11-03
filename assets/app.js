(() => {
  const $ = id => document.getElementById(id);
  const lamp = createLamp({
    stage: $('stage'),
    scene: $('scene'),
    content: document.querySelector('main'),
    isDark: () => SiteTheme.mode === 'dark',
  });
  const modeButton = $('theme-switch');
  const lightButton = $('light-switch');

  function updateThemeControls() {
    modeButton.setAttribute('aria-pressed', String(SiteTheme.mode === 'dark'));
    modeButton.title = SiteTheme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    lamp.redraw();
  }

  modeButton.addEventListener('click', () => SiteTheme.toggleMode());
  lightButton.addEventListener('click', () => {
    lamp.setEnabled(!lamp.enabled);
    lightButton.setAttribute('aria-pressed', String(lamp.enabled));
    lightButton.title = lamp.enabled ? 'Turn lamp off' : 'Turn lamp on';
  });
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch' || !event.target.closest('a, button')) lamp.followPointer(event);
  }, { passive: true });
  window.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && !event.target.closest('a, button')) lamp.followPointer(event);
  }, { passive: true });

  SiteTheme.onChange(updateThemeControls);
  updateThemeControls();
  $('controls').hidden = false;
})();
