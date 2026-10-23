// League-style stadium around gym and tournament battles: packed stands above and below the field and a
// banner bar with the match-up. The crowd is pre-rendered once (two idle frames, two cheering frames).
(function () {
  const SW = 1900;                       // stands width in arena px: wider than the field so they fill wide screens
  const TOP = 96, BANNER = 30, BOT = 88; // top crowd, banner bar under it, bottom crowd
  const ROW = 22;                        // bleacher row height
  const SKIN = ['#f1c9a5', '#e0ac7e', '#c68a5a', '#8d5a3b', '#ffdbb8', '#b77a4e'];
  const HAIR = ['#2b1d14', '#5a3a1f', '#d9a441', '#1c1c1c', '#a33a2a', '#e8e0d0', '#3a4a8a', '#6b4a2a'];
  const SHIRT = ['#e2524a', '#3d7be0', '#f5b800', '#58b05c', '#b28cff', '#ffffff', '#ff9ec7', '#6bc5ff', '#f08a3c', '#2f3a5a', '#4ab0a0'];
  const cache = new Map();

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (R, a) => a[Math.floor(R() * a.length)];

  // One spectator, feet at (x, y). back: seen from behind (the near stands face the field, away from us).
  function person(c, p, x, y, cheer, bob, accent) {
    y -= bob;
    // arms (behind the body when down, raised in a V when cheering)
    c.fillStyle = cheer ? p.skin : p.shirt;
    if (cheer && p.arms) {
      c.save(); c.strokeStyle = p.skin; c.lineWidth = 3; c.lineCap = 'square';
      c.beginPath(); c.moveTo(x - 5, y - 12); c.lineTo(x - 9, y - 25); c.moveTo(x + 5, y - 12); c.lineTo(x + 9, y - 25); c.stroke();
      c.restore();
    } else { c.fillRect(x - 8, y - 12, 3, 9); c.fillRect(x + 5, y - 12, 3, 9); }
    // body and head
    c.fillStyle = p.shirt; c.fillRect(x - 6, y - 13, 12, 13);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 2, y - 13, 4, 13);
    c.fillStyle = p.skin; c.fillRect(x - 4, y - 22, 8, 9);
    c.fillStyle = p.hair;
    if (p.back) c.fillRect(x - 5, y - 23, 10, 8);              // back of the head
    else {
      c.fillRect(x - 5, y - 24, 10, 4);
      if (p.long) c.fillRect(x - 5, y - 21, 2, 7), c.fillRect(x + 3, y - 21, 2, 7);
      c.fillStyle = '#1a1a1a'; c.fillRect(x - 3, y - 18, 2, 2); c.fillRect(x + 1, y - 18, 2, 2);
      if (cheer) { c.fillStyle = '#7a2a2a'; c.fillRect(x - 1, y - 15, 3, 2); }
    }
    if (p.cap) { c.fillStyle = p.cap; c.fillRect(x - 5, y - 25, 10, 3); c.fillRect(x + (p.back ? -7 : 3), y - 23, 4, 2); }
    // a few fans wave signs or foam fingers
    if (p.sign && cheer) {
      c.fillStyle = '#ffffff'; c.fillRect(x - 10, y - 38, 20, 11);
      c.fillStyle = accent; c.fillRect(x - 8, y - 36, 16, 7);
    } else if (p.sign) { c.fillStyle = accent; c.fillRect(x - 7, y - 30, 14, 8); }
  }

  // Bleachers packed with people. frames: [idle0, idle1, cheer0, cheer1].
  function buildStand(h, seed, accent, back) {
    const R = rng(seed), rows = Math.floor(h / ROW);
    const people = [];
    for (let r = 0; r < rows; r++) {
      for (let x = 6 + (r % 2) * 8; x < SW; x += 15 + R() * 5) {
        if ((x % 320) < 26) continue;                      // stairway aisles
        if (R() < 0.06) continue;                          // the odd empty seat
        people.push({ x, y: (back ? 12 : 2) + (r + 1) * ROW, skin: pick(R, SKIN), hair: pick(R, HAIR), shirt: R() < 0.22 ? accent : pick(R, SHIRT),
          back, long: R() < 0.3, cap: R() < 0.15 ? pick(R, SHIRT) : null, sign: R() < 0.05, arms: R() < 0.8, ph: R() });
      }
    }
    const frames = [];
    for (let f = 0; f < 4; f++) {
      const cv = document.createElement('canvas'); cv.width = SW; cv.height = h;
      const c = cv.getContext('2d');
      // bleacher steps
      for (let r = 0; r < rows + 1; r++) {
        const y = (back ? 12 : 2) + r * ROW;
        c.fillStyle = r % 2 ? '#2a3048' : '#323a56'; c.fillRect(0, y, SW, ROW);
        c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, y, SW, 2);
      }
      for (let x = 0; x < SW; x += 320) { c.fillStyle = '#4a5370'; c.fillRect(x, 0, 24, h); c.fillStyle = 'rgba(255,255,255,0.1)'; for (let y = 4; y < h; y += 8) c.fillRect(x + 2, y, 20, 2); }
      const cheer = f >= 2;
      for (const p of people) {
        const bob = cheer ? ((p.ph + f * 0.5) % 1 < 0.5 ? 4 : 0) : ((p.ph + f * 0.5) % 1 < 0.25 ? 1 : 0);
        person(c, p, Math.round(p.x), p.y, cheer, bob, accent);
      }
      // railing / front wall
      if (back) { c.fillStyle = '#1b2033'; c.fillRect(0, 0, SW, 12); c.fillStyle = accent; c.fillRect(0, 9, SW, 3); }
      else { c.fillStyle = '#1b2033'; c.fillRect(0, h - 4, SW, 4); }
      frames.push(cv);
    }
    return frames;
  }

  // Pixel-art battle view: the world is drawn this many CSS px per art pixel (P toggles it; remembered).
  const PIXEL = 2;
  let pixelOn = true;
  try { pixelOn = localStorage.getItem('pg-pixel') !== 'off'; } catch (e) { /* storage blocked: default on */ }
  PG.battlePixel = () => (pixelOn ? PIXEL : 0);
  PG.setBattlePixel = (on) => { pixelOn = on; try { localStorage.setItem('pg-pixel', on ? 'on' : 'off'); } catch (e) { /* not remembered */ } };

  PG.Stadium = {
    TOP: TOP + BANNER, BOT,
    create(accent) {
      if (!cache.has(accent)) cache.set(accent, { accent, top: buildStand(TOP, 11, accent, false), bot: buildStand(BOT, 23, accent, true) });
      return cache.get(accent);
    },
    // Arena coordinates: the field is (0,0)-(W,H); stands sit above and below it.
    draw(ctx, st, W, H, time, cheer) {
      const i = cheer > 0.1 ? 2 + (Math.floor(time * 8) % 2) : Math.floor(time * 1.6) % 2;
      const x = W / 2 - SW / 2;
      ctx.drawImage(st.top[i], x, -TOP - BANNER);
      ctx.drawImage(st.bot[i], x, H);
      // banner bar between the top stands and the field
      ctx.fillStyle = '#0d111d'; ctx.fillRect(x, -BANNER, SW, BANNER);
      ctx.fillStyle = st.accent; ctx.fillRect(x, -BANNER, SW, 2); ctx.fillRect(x, -3, SW, 3);
    },
    // Crisp text for the banner (drawn in the sharp pass, same coordinates).
    drawTitle(ctx, W, text) {
      ctx.font = '800 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e8ecf6'; ctx.fillText(text, W / 2, -BANNER / 2);
      ctx.textBaseline = 'alphabetic';
    },
  };
})();
