const SiteTheme = (() => {
  const root = document.documentElement;
  const listeners = new Set();

  function read(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Preferences still work for this visit. */ }
  }

  const storedMode = read('lamp-theme');
  let mode = ['light', 'dark'].includes(storedMode) ? storedMode : 'dark';

  function apply() {
    root.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', mode === 'dark' ? '#202124' : '#e9e9e9');
    for (const listener of listeners) listener();
  }

  // Run before the stylesheet is painted to restore saved colors without a flash.
  apply();

  return {
    get mode() { return mode; },
    onChange(listener) { listeners.add(listener); },
    toggleMode() {
      mode = mode === 'dark' ? 'light' : 'dark';
      save('lamp-theme', mode);
      apply();
    },
  };
})();
