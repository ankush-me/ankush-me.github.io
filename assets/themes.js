const SiteTheme = (() => {
  const root = document.documentElement;
  const listeners = new Set();

  function read(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Preferences still work for this visit. */ }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch { /* Nothing was saved. */ }
  }

  // With no saved choice, follow the system setting, including when it changes.
  const system = matchMedia('(prefers-color-scheme: dark)');
  const systemMode = () => system.matches ? 'dark' : 'light';
  const storedMode = read('lamp-theme');
  let saved = ['light', 'dark'].includes(storedMode) ? storedMode : null;
  let mode = saved || systemMode();

  function apply() {
    root.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', mode === 'dark' ? '#202124' : '#eeece6');
    for (const listener of listeners) listener();
  }

  system.addEventListener('change', () => {
    if (saved) return;
    mode = systemMode();
    apply();
  });

  // Run before the stylesheet is painted to restore saved colors without a flash.
  apply();

  return {
    get mode() { return mode; },
    onChange(listener) { listeners.add(listener); },
    toggleMode() {
      mode = mode === 'dark' ? 'light' : 'dark';
      // Toggling back to the system's mode drops the override so it keeps following the system.
      saved = mode === systemMode() ? null : mode;
      if (saved) save('lamp-theme', saved); else remove('lamp-theme');
      apply();
    },
  };
})();
