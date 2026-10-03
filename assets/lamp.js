function createLamp({ stage, scene, content, isDark }) {
  const length1 = 120, length2 = 120, scale = .8;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const shadows = [...content.querySelectorAll('.shadow')];
  const parts = Object.fromEntries([...scene.querySelectorAll('[id]')].map(element => [element.id, element]));
  const $ = id => parts[id];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const translate = (id, x, y) => $(id).setAttribute('transform', `translate(${x} ${y})`);
  let width, height, topMounted, base, trackingRange, inputRange, aimX, aimY, textSize, bounds = [];
  let current = .35, target = .35, frame = 0, lastTime = null, enabled = true;
  let stageRect, lightGeometry;

  // Mirror the side-mounted elbow; keep the top-mounted pose unchanged.
  function pose(x, y) {
    const dx = x - base.x, dy = y - base.y, distance = Math.hypot(dx, dy);
    if (distance <= Math.abs(length1 - length2) + .01 || distance >= length1 + length2 - .01) return null;
    const angle = Math.atan2(dy, dx);
    const bend = Math.acos(clamp((length1 ** 2 + distance ** 2 - length2 ** 2) / (2 * length1 * distance), -1, 1));
    const upperAngle = angle + (topMounted ? bend : -bend);
    return { x: base.x + length1 * Math.cos(upperAngle), y: base.y + length1 * Math.sin(upperAngle) };
  }

  function pointOnTrack(progress) {
    return {
      x: trackingRange.left + progress * (trackingRange.right - trackingRange.left),
      y: trackingRange.top + progress * (trackingRange.bottom - trackingRange.top),
    };
  }

  function measure() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    topMounted = width <= 640;
    scene.setAttribute('viewBox', `0 0 ${width} ${height}`);
    stageRect = stage.getBoundingClientRect();
    bounds = shadows.map(element => {
      const rect = element.getBoundingClientRect();
      return { element, x: rect.left - stageRect.left + rect.width / 2, y: rect.top - stageRect.top + rect.height / 2 };
    });
    const rect = content.getBoundingClientRect();
    const left = rect.left - stageRect.left;
    const top = rect.top - stageRect.top;
    const middle = top + rect.height / 2;
    inputRange = { top, bottom: top + rect.height };
    base = { x: left - 265, y: middle };
    let headX;
    if (topMounted) {
      base = { x: width / 2, y: 85 };
      const travel = Math.min(110, width / 2 - 45);
      headX = base.x;
      trackingRange = { left: base.x - travel, right: base.x + travel, top: 175, bottom: 175 };
    } else {
      headX = base.x + 140;
      trackingRange = { left: headX, right: headX, top: Math.max(75, middle - 160), bottom: Math.min(height - 80, middle + 160) };
    }
    aimX = left + rect.width * (headX >= left + rect.width / 2 ? .35 : .65);
    aimY = middle;
    textSize = { width: rect.width, height: rect.height };
    $('mount').setAttribute('transform', `translate(${base.x} ${base.y}) scale(${scale})`);
    translate('base-joint', base.x, base.y);
    translate('mount-shadow', base.x, base.y);
    const reference = pointOnTrack(current);
    lightGeometry = buildLight(reference.x, reference.y);
    draw();
    scene.classList.add('ready');
  }

  function drawArm(x, headY, elbow) {
    const path = `M${base.x} ${base.y} L${elbow.x} ${elbow.y} L${x} ${headY}`;
    $('arm-outline').setAttribute('d', path); $('arm').setAttribute('d', path);
    $('arm-highlight').setAttribute('d', path);
    $('arm-shadow').setAttribute('d', path);
    const cableSide = topMounted ? 1 : -1;
    $('cable').setAttribute('d', `M${base.x + cableSide * 9} ${base.y} Q${elbow.x + cableSide * 35} ${(base.y + elbow.y) / 2} ${elbow.x + cableSide * 8} ${elbow.y + 12} Q${(x + elbow.x) / 2} ${(headY + elbow.y) / 2 + 24} ${x} ${headY + 10}`);
    const upperAngle = Math.atan2(elbow.y - base.y, elbow.x - base.x) * 180 / Math.PI;
    $('elbow-joint').setAttribute('transform', `translate(${elbow.x} ${elbow.y}) rotate(${upperAngle})`);
  }

  // The beam shape only changes on resize; pointer motion translates it as a unit.
  function buildLight(x, headY) {
    // Side dock shines horizontally; the top dock shines down onto the text.
    const ux = topMounted ? 0 : aimX < x ? -1 : 1, uy = topMounted ? 1 : 0;
    const angle = Math.atan2(uy, ux);
    const nx = -uy, ny = ux;
    const tilt = angle * 180 / Math.PI - 90;
    const sourceX = x + ux * 49 * scale;
    const sourceY = headY + uy * 49 * scale;
    const distance = topMounted ? Math.abs(aimY - sourceY) : Math.abs(aimX - sourceX);
    const beamLength = distance + Math.hypot(textSize.width, textSize.height) * .55;
    const endX = sourceX + ux * beamLength, endY = sourceY + uy * beamLength;
    const poolX = sourceX + ux * beamLength * .55;
    const poolY = sourceY + uy * beamLength * .55;
    const pool = $('light-pool');
    pool.setAttribute('cx', poolX); pool.setAttribute('cy', poolY);
    pool.setAttribute('rx', beamLength * .55); pool.setAttribute('ry', beamLength * .4);
    pool.setAttribute('transform', `rotate(${angle * 180 / Math.PI} ${poolX} ${poolY})`);
    const aperture = 26 * scale, spread = beamLength * .65;
    // Feather the cone with translucent bands instead of a live blur filter.
    for (let i = 0; i < 8; i++) {
      const inset = i * 3;
      const near = Math.max(2, aperture - inset), far = spread - inset;
      $('beam-edge-' + i).setAttribute('d', `M${sourceX + nx * near} ${sourceY + ny * near} L${endX + nx * far} ${endY + ny * far} Q${endX + ux * 100} ${endY + uy * 100} ${endX - nx * far} ${endY - ny * far} L${sourceX - nx * near} ${sourceY - ny * near}Z`);
    }
    const gradient = $('beam');
    gradient.setAttribute('x1', sourceX); gradient.setAttribute('y1', sourceY);
    gradient.setAttribute('x2', endX); gradient.setAttribute('y2', endY);
    return { x, headY, tilt, sourceX, sourceY, ux, uy, nx, ny, beamLength, aperture };
  }

  function drawLight(x, headY) {
    const dx = x - lightGeometry.x, dy = headY - lightGeometry.headY;
    translate('light-source', dx, dy);
    const headTransform = `translate(${x} ${headY}) rotate(${lightGeometry.tilt}) scale(${scale})`;
    $('head').setAttribute('transform', headTransform);
    $('head-shadow').setAttribute('transform', headTransform);
    return { ...lightGeometry, sourceX: lightGeometry.sourceX + dx, sourceY: lightGeometry.sourceY + dy };
  }

  function drawShadows({ sourceX, sourceY, ux, uy, nx, ny, beamLength, aperture }) {
    const dark = isDark();
    const shadowColor = dark ? '0, 0, 0' : '78, 61, 30';
    const nearOpacity = dark ? .95 : .30, farOpacity = dark ? .45 : .12;
    const nearBlur = dark ? 1 : 2.5, farBlur = dark ? 5 : 7;
    const offsetScale = 1.15;
    for (const {element, x: tx, y: ty} of bounds) {
      const dx = tx - sourceX, dy = ty - sourceY;
      const alongBeam = dx * ux + dy * uy;
      const acrossBeam = Math.abs(dx * nx + dy * ny);
      const coneWidth = aperture + Math.max(0, alongBeam) * .65;
      const illumination = alongBeam > 0 ? clamp((coneWidth - acrossBeam) / (coneWidth * .35), 0, 1) : 0;
      const strength = enabled ? illumination * Math.max(0, 1 - Math.hypot(dx, dy) / (beamLength * 1.2)) : 0;
      const sx = clamp(dx / 85, -8, 8) * offsetScale, sy = clamp(dy / 100, -7, 7) * offsetScale;
      element.style.setProperty('--cast', `${sx.toFixed(2)}px ${sy.toFixed(2)}px ${nearBlur}px rgba(${shadowColor}, ${(strength * nearOpacity).toFixed(3)}), ${(sx * 2).toFixed(2)}px ${(sy * 2).toFixed(2)}px ${farBlur}px rgba(${shadowColor}, ${(strength * farOpacity).toFixed(3)})`);
    }
  }

  function draw() {
    if (!trackingRange) return;
    const { x, y } = pointOnTrack(current);
    const elbow = pose(x, y);
    if (!elbow) return;
    drawArm(x, y, elbow);
    drawShadows(drawLight(x, y));
  }

  function freeze() {
    cancelAnimationFrame(frame);
    frame = 0;
    target = current;
  }

  function canMove() {
    return enabled && !document.hidden && !reducedMotion.matches;
  }

  function animate(time) {
    frame = 0;
    if (!canMove()) return;
    const dt = lastTime === null ? 16 : clamp(time - lastTime, 0, 50);
    lastTime = time;
    current += (target - current) * (1 - Math.exp(-dt / 180));
    const travel = Math.hypot(trackingRange.right - trackingRange.left, trackingRange.bottom - trackingRange.top);
    if (Math.abs(target - current) * travel < .25) current = target;
    draw();
    if (current !== target) frame = requestAnimationFrame(animate);
  }

  function schedule() {
    if (frame || !canMove() || current === target) return;
    lastTime = null;
    frame = requestAnimationFrame(animate);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });
  window.addEventListener('scroll', () => { stageRect = stage.getBoundingClientRect(); }, { passive: true, capture: true });
  reducedMotion.addEventListener('change', freeze);
  $('arm-highlight').setAttribute('transform', 'translate(-2 -2)');
  $('beam').setAttribute('gradientUnits', 'userSpaceOnUse');
  const observer = new ResizeObserver(measure);
  observer.observe(stage);
  observer.observe(content);
  if (document.fonts) document.fonts.ready.then(measure);
  measure();

  return {
    get enabled() { return enabled; },
    redraw: draw,
    setEnabled(value) {
      enabled = value;
      freeze();
      $('light').style.opacity = enabled ? '1' : '0';
      $('bulb').setAttribute('fill', enabled ? 'var(--light-color)' : 'var(--lamp-low)');
      draw();
    },
    followPointer(event) {
      if (!canMove()) return;
      const progress = topMounted
        ? (event.clientX - stageRect.left) / width
        : (event.clientY - stageRect.top - inputRange.top) / (inputRange.bottom - inputRange.top);
      target = clamp(progress, 0, 1);
      schedule();
    },
  };
}
