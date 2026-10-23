// Keyboard + touch input. Movement is an analog axis; actions are edge-triggered.
(function () {
  const keys = new Set();
  const queued = new Set();
  const touchHeld = new Set(); // actions held down on on-screen buttons
  const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const JOY_RADIUS = 55;

  const KEY_ACTIONS = {
    // Number keys pick a move in battle and a party slot in the overworld.
    '1': ['move0', 'slot0'], '2': ['move1', 'slot1'], '3': ['move2', 'slot2'], '4': ['move3', 'slot3'],
    '5': 'slot4', '6': 'slot5',
    'j': 'move0', 'k': 'move1', 'l': 'move2', ';': 'move3',
    'q': 'ball', 'b': 'ballnext', 'c': 'bike', 'n': 'map', 'tab': 'dodge', 'u': 'ult', 'e': 'switch', 'r': 'run',
    'escape': 'menu', 'm': 'map', 'v': 'view', 'p': 'pixel',
    'enter': 'interact', ' ': 'interact',
  };

  const keyName = (ev) => ev.key.toLowerCase();

  window.addEventListener('keydown', (ev) => {
    const k = keyName(ev);
    if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
    if (!keys.has(k) && KEY_ACTIONS[k]) [].concat(KEY_ACTIONS[k]).forEach(a => queued.add(a));
    keys.add(k);
    if (k.startsWith('arrow') || k === ' ' || k === 'tab') ev.preventDefault();   // Tab dodges instead of moving focus
  });
  window.addEventListener('keyup', (ev) => { keys.delete(keyName(ev)); keys.delete(ev.key.toLowerCase()); });
  window.addEventListener('blur', () => keys.clear());

  function setupJoystick(zoneEl, baseEl, knobEl) {
    zoneEl.addEventListener('pointerdown', (ev) => {
      if (joy.active) return;
      joy.active = true;
      joy.id = ev.pointerId;
      joy.ox = ev.clientX; joy.oy = ev.clientY;
      joy.x = 0; joy.y = 0;
      zoneEl.setPointerCapture(ev.pointerId);
      baseEl.style.display = 'block';
      baseEl.style.left = (ev.clientX - JOY_RADIUS) + 'px';
      baseEl.style.top = (ev.clientY - JOY_RADIUS) + 'px';
      knobEl.style.transform = 'translate(0px, 0px)';
      ev.preventDefault();
    });
    zoneEl.addEventListener('pointermove', (ev) => {
      if (!joy.active || ev.pointerId !== joy.id) return;
      let dx = ev.clientX - joy.ox, dy = ev.clientY - joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_RADIUS) { dx *= JOY_RADIUS / d; dy *= JOY_RADIUS / d; }
      joy.x = dx / JOY_RADIUS; joy.y = dy / JOY_RADIUS;
      knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = (ev) => {
      if (ev.pointerId !== joy.id) return;
      joy.active = false; joy.x = 0; joy.y = 0;
      baseEl.style.display = 'none';
    };
    zoneEl.addEventListener('pointerup', end);
    zoneEl.addEventListener('pointercancel', end);
  }

  PG.Input = {
    setupJoystick,
    axis() {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x || y) {
        const d = Math.hypot(x, y);
        return { x: x / d, y: y / d };
      }
      if (joy.active) {
        const d = Math.hypot(joy.x, joy.y);
        if (d < 0.15) return { x: 0, y: 0 };
        return { x: joy.x, y: joy.y };
      }
      return { x: 0, y: 0 };
    },
    trigger(action) { queued.add(action); },
    // On-screen buttons that can be held (charging moves): press on pointerdown, release on pointerup.
    press(action) { queued.add(action); touchHeld.add(action); },
    release(action) { touchHeld.delete(action); },
    // Is the action held right now (keyboard key down or on-screen button pressed)?
    held(action) {
      if (touchHeld.has(action)) return true;
      for (const k of keys) { const a = KEY_ACTIONS[k]; if (a === action || (Array.isArray(a) && a.includes(action))) return true; }
      return false;
    },
    consume(action) {
      if (queued.has(action)) { queued.delete(action); return true; }
      return false;
    },
    clear() { queued.clear(); },
    releaseAll() { touchHeld.clear(); },
  };
})();
