const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function harness(saved = new Map()) {
  let width = 1440, height = 900, textHeight = 360, scroll = 0;
  let frameId = 0, resize;
  const metrics = { layoutReads: 0, writes: new Map() };
  const frames = new Map(), elements = new Map(), media = new Map();
  const events = () => ({
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn(event); },
  });
  const element = id => ({
    ...events(), id, attrs: {}, children: [], hidden: false, dataset: {},
    style: { setProperty(key, value) { this[key] = value; } },
    classList: { add() {} },
    setAttribute(key, value) {
      this.attrs[key] = value;
      metrics.writes.set(id, (metrics.writes.get(id) || 0) + 1);
    },
    append(child) { this.children.push(child); },
    querySelector() { return this.label ||= {}; },
  });
  const get = id => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) get(match[1]);
  const content = get('main');
  const contentLeft = () => width <= 640 ? 28 : Math.max(300, Math.min(width * .25 + 40, 440));
  content.getBoundingClientRect = () => ({
    left: contentLeft(),
    top: (width <= 760 ? 285 : 279) - scroll,
    width: Math.min(width <= 760 ? 580 : 665, width - contentLeft() - (width <= 760 ? 28 : Math.min(width * .11, 180))), height: textHeight,
  });
  const shadow = get('shadow');
  shadow.getBoundingClientRect = () => ({ left: contentLeft() + 32, top: 350 - scroll, width: 180, height: 24 });
  content.querySelectorAll = () => [shadow];
  const stage = get('stage');
  Object.defineProperties(stage, { clientWidth: { get: () => width }, clientHeight: { get: () => height } });
  stage.getBoundingClientRect = () => {
    metrics.layoutReads++;
    return { left: 0, top: -scroll, width, height };
  };
  get('scene').querySelectorAll = () => [...html.match(/<svg class="scene"[\s\S]*?<\/svg>/)[0].matchAll(/\bid="([^"]+)"/g)].map(m => get(m[1]));
  const document = {
    ...events(), documentElement: get('root'), hidden: false,
    getElementById: get,
    querySelector: selector => selector === 'main' ? content : get('meta'),
    createElement: () => element(''),
  };
  const window = events();
  const context = vm.createContext({
    document, window,
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    matchMedia(query) {
      if (!media.has(query)) media.set(query, { ...events(), matches: false });
      return media.get(query);
    },
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() {} },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
    vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), context, { filename: src });
  }
  return {
    get, document, saved, media, frames, metrics,
    resize(w, h, th) { width = w; height = h; textHeight = th; resize(); },
    scroll(value) { scroll = value; window.fire('scroll'); },
    pointer(x, y, type = 'mouse') {
      window.fire('pointermove', { clientX: x, clientY: y, pointerType: type, target: { closest: () => false } });
    },
    settle() {
      let tick = 0;
      while (frames.size && ++tick < 400) {
        const callbacks = [...frames.values()]; frames.clear();
        for (const fn of callbacks) fn(tick * 16);
      }
      assert.equal(frames.size, 0, 'animation settles');
    },
  };
}

function run() {
  const page = harness();
  assert.doesNotMatch(html, /color-switch|color-panel|theme-grid/);
  assert.doesNotMatch(html, /<filter\b|filter=|feGaussianBlur|feDropShadow/, 'moving artwork uses no SVG blur filters');
  assert.equal(page.get('root').dataset.theme, 'dark', 'first visit defaults to dark');
  page.get('theme-switch').fire('click');
  assert.equal(page.get('root').dataset.theme, 'light');
  assert.equal(harness(page.saved).get('root').dataset.theme, 'light', 'saved light preference survives reload');
  page.get('theme-switch').fire('click');
  assert.equal(harness(page.saved).get('root').dataset.theme, 'dark');
  assert.equal(harness(new Map([['lamp-theme', 'invalid']])).get('root').dataset.theme, 'dark');
  for (const [w, h, th] of [[1440, 900, 360], [761, 1000, 500], [760, 1000, 500], [700, 950, 480], [641, 950, 480], [640, 950, 480], [580, 950, 480], [520, 950, 480], [390, 1000, 600], [320, 1200, 800]]) {
    page.resize(w, h, th);
    let previous;
    const staticParts = ['light-pool', 'light-beam', 'beam', 'mount', 'base-joint', 'mount-shadow', ...Array.from({ length: 8 }, (_, i) => 'beam-edge-' + i)];
    const writesBefore = staticParts.map(id => page.metrics.writes.get(id));
    const readsBefore = page.metrics.layoutReads;
    for (let i = 0; i <= 10; i++) {
      const top = w <= 760 ? 285 : 279;
      page.pointer(w * i / 10, top + th * i / 10, i % 2 ? 'touch' : 'mouse');
      page.settle();
      const [bx, by, ex, ey, x, y] = page.get('arm').attrs.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      assert.ok(Math.abs(Math.hypot(ex - bx, ey - by) - 120) < .00001);
      assert.ok(Math.abs(Math.hypot(x - ex, y - ey) - 120) < .00001);
      const [jointX, jointY, jointAngle] = page.get('elbow-joint').attrs.transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      assert.equal(jointX, ex);
      assert.equal(jointY, ey);
      const radians = jointAngle * Math.PI / 180;
      assert.ok(Math.abs(-(ex - bx) * Math.sin(radians) + (ey - by) * Math.cos(radians)) < .00001, 'elbow screw slot stays perpendicular to the upper arm');
      const position = w <= 640 ? x : y;
      if (previous !== undefined) assert.ok(position > previous, 'continuous tracking');
      previous = position;
      const beam = page.get('beam').attrs;
      const [lightX, lightY] = page.get('light-source').attrs.transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      assert.ok(Math.abs(Number(beam.x1) + lightX - (w <= 640 ? x : x + 39.2)) < .00001, 'light follows the bulb horizontally');
      assert.ok(Math.abs(Number(beam.y1) + lightY - (w <= 640 ? y + 39.2 : y)) < .00001, 'light follows the bulb vertically');
      assert.equal(w <= 640 ? beam.x1 : beam.y1, w <= 640 ? beam.x2 : beam.y2);
      if (w > 640) {
        assert.ok(Number(beam.x2) > Number(beam.x1), 'left lamp shines right');
        const text = page.get('main').getBoundingClientRect();
        assert.ok(text.left - Number(beam.x1) >= 85, 'lamp has extra clearance from text');
        assert.ok(Math.min(bx, ex, x) >= 25, 'arm stays inside the left edge');
      }
    }
    assert.deepEqual(staticParts.map(id => page.metrics.writes.get(id)), writesBefore, 'animation does not rebuild beam geometry or fixed parts');
    assert.equal(page.metrics.layoutReads, readsBefore, 'pointer animation performs no layout reads');
  }
  const scrolled = harness();
  scrolled.pointer(0, 459); scrolled.settle();
  const beforeScroll = scrolled.get('arm').attrs.d;
  scrolled.scroll(120);
  scrolled.pointer(0, 339); scrolled.settle();
  assert.equal(scrolled.get('arm').attrs.d, beforeScroll, 'cached coordinates account for scrolling');
  scrolled.pointer(0, 339);
  assert.equal(scrolled.frames.size, 0, 'stationary pointer does not restart animation');
  page.pointer(0, 0);
  page.get('light-switch').fire('click');
  const frozen = page.get('arm').attrs.d;
  page.pointer(320, 800); page.settle();
  assert.equal(page.get('arm').attrs.d, frozen);
  assert.match(page.get('shadow').style['--cast'], /rgba\([^)]*, 0\.000\)/);
  page.get('light-switch').fire('click');
  const reduced = page.media.get('(prefers-reduced-motion: reduce)');
  reduced.matches = true; reduced.fire('change');
  page.pointer(0, 0); page.settle();
  assert.equal(page.get('arm').attrs.d, frozen);
  return 'Passed: dark default and saved modes, fixed arm lengths, elbow rotation, responsive tracking, touch, light/shadow switching, reduced motion, cached light geometry and scroll tracking.';
}

module.exports = run;
if (require.main === module) console.log(run());
