// Battle visuals: themed arenas, particles, and a distinct look for every move
// (projectile shapes, melee swings, dash trails, area waves, strike telegraphs, status auras).
// Purely cosmetic: nothing in here affects damage, hitboxes or timing.
(function () {
  const TAU = Math.PI * 2;
  const ARENA_W = 900, ARENA_H = 560;
  const MAX_PARTICLES = 500;

  // ---------- helpers ----------
  function rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
  }
  function shade(hex, amt) {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const out = c.map(v => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hashStr(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  const typeColor = (t) => PG.TYPES[t].color;

  // Jagged polyline between two points (lightning, cracks).
  function zigzag(x1, y1, x2, y2, segs, amp) {
    const pts = [[x1, y1]];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i < segs; i++) {
      const k = i / segs, o = rand(-amp, amp);
      pts.push([x1 + dx * k + nx * o, y1 + dy * k + ny * o]);
    }
    pts.push([x2, y2]);
    return pts;
  }
  function strokePts(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  function starPath(ctx, x, y, points, outer, inner, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : outer, a = rot + (i / (points * 2)) * TAU;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  // ---------- which look each move uses (falls back to its type) ----------
  const PROJ_LOOK = {
    swift: 'star', hyper_beam: 'hyperbeam', ember: 'fireball', flamethrower: 'flame', fire_blast: 'fireblast', water_gun: 'droplet',
    bubble_beam: 'bubble', hydro_pump: 'jet', razor_leaf: 'leaf', mega_drain: 'drain', solar_beam: 'solar',
    thunder_shock: 'spark', thunderbolt: 'bolt', ice_beam: 'icebeam', aurora_beam: 'aurora', poison_sting: 'needle',
    acid: 'glob', mud_slap: 'mud', gust: 'wind', confusion: 'psyring', psybeam: 'psybeam', signal_beam: 'signal',
    rock_throw: 'rock', stone_edge: 'edge', shadow_ball: 'shadow', dragon_rage: 'dragonfire', dragon_pulse: 'dragonpulse',
    dark_pulse: 'shadow', ancient_power: 'rock', giga_drain: 'drain', octazooka: 'mud', icy_wind: 'wind', aeroblast: 'wind',
    absorb: 'drain', sludge: 'glob', bone_club: 'rock', bonemerang: 'rock', twineedle: 'needle', dragon_breath: 'dragonfire',
  };
  const PROJ_BY_TYPE = {
    normal: 'orb', fire: 'fireball', water: 'droplet', grass: 'leaf', electric: 'spark', ice: 'icebeam', fighting: 'orb',
    poison: 'glob', ground: 'mud', flying: 'wind', psychic: 'psyring', bug: 'signal', rock: 'rock', ghost: 'shadow', dragon: 'dragonfire',
  };
  const MELEE_LOOK = {
    tackle: 'tackle', scratch: 'claw', bite: 'fang', hyper_fang: 'fang', fire_fang: 'fang', bug_bite: 'fang', leech_life: 'fang',
    karate_chop: 'chop', low_kick: 'kick', vine_whip: 'vine', wing_attack: 'wing', lick: 'tongue',
    crunch: 'fang', metal_claw: 'claw', pursuit: 'claw', struggle: 'tackle', iron_tail: 'chop', dynamic_punch: 'tackle',
    slam: 'tackle', slash: 'claw', thief: 'claw', brick_break: 'chop', fire_punch: 'tackle', ice_punch: 'tackle', thunder_punch: 'tackle',
    crabhammer: 'chop', peck: 'fang', fury_cutter: 'claw', dragon_claw: 'claw',
  };
  const DASH_LOOK = {
    quick_attack: 'quick', body_slam: 'slam', spark: 'spark', cross_chop: 'cross', aerial_ace: 'ace', swim: 'swim',
    faint_attack: 'ace', steel_wing: 'ace', headbutt: 'slam', extremespeed: 'quick', rollout: 'slam', outrage: 'cross', megahorn: 'slam',
    take_down: 'slam', double_edge: 'slam', mach_punch: 'quick', submission: 'cross', flame_wheel: 'slam', waterfall: 'swim', drill_peck: 'ace',
  };
  const AREA_LOOK = { fire_spin: 'firespin', surf: 'wave', earthquake: 'quake', hurricane: 'hurricane', petal_dance: 'hurricane', twister: 'hurricane', blizzard: 'hurricane' };
  const STRIKE_LOOK = {
    thunder: 'thunder', sludge_bomb: 'sludge', dig: 'dig', rock_slide: 'rockslide',
    psychic: 'psychic', night_shade: 'nightshade', zap_cannon: 'thunder', sacred_fire: 'fireblast', future_sight: 'psychic',
  };
  const STAT_COLOR = { atk: '#ff7a45', def: '#5aa9ff', spd: '#7be07b' };

  // ---------- arenas ----------
  // theme: gym type ('gym:rock') or wild biome ('grass' | 'forest' | 'sand' | 'rock' | 'water' | 'town').
  const THEMES = {
    grass:  { name: 'meadow',   base: '#6cbc57', edge: '#3f7f34', out: '#1f3a1c' },
    forest: { name: 'forest',   base: '#4b8a45', edge: '#1f4a24', out: '#122716' },
    sand:   { name: 'beach',    base: '#e6d29a', edge: '#3f8fd0', out: '#1e3f5c' },
    rock:   { name: 'mountain', base: '#9b917c', edge: '#5c5446', out: '#26231d' },
    water:  { name: 'lake',     base: '#62b36c', edge: '#3a83c9', out: '#173048' },
    town:   { name: 'plaza',    base: '#c8b48c', edge: '#7c6a4c', out: '#2a2419' },
    league: { name: 'league',   base: '#2a1f4a', edge: '#c9a227', out: '#0e0a1c' },
    ocean:  { name: 'ocean',    base: '#2f73b8', edge: '#1b4a7d', out: '#0d2440' },
  };
  const AMBIENT = {
    meadow: 'petal', forest: 'firefly', beach: 'spray', mountain: 'dust', lake: 'firefly', plaza: 'petal', gym: 'sparkle', ocean: 'spray', league: 'sparkle',
  };

  // stadium: gym / tournament battles get stands around the field (stadium.js) instead of the top band.
  function buildArena(themeKey, stadium) {
    const S = 2; // render at 2x so it stays crisp on high-DPI screens
    const cv = document.createElement('canvas');
    cv.width = ARENA_W * S; cv.height = ARENA_H * S;
    const c = cv.getContext('2d');
    c.scale(S, S);
    const R = seeded(hashStr(themeKey));
    const isGym = themeKey.startsWith('gym:');
    const gymType = isGym ? themeKey.slice(4) : null;
    const th = isGym ? { name: 'gym', base: shade(typeColor(gymType), -0.15), edge: shade(typeColor(gymType), -0.55), out: '#14161d' } : (THEMES[themeKey] || THEMES.grass);

    c.fillStyle = th.base;
    c.fillRect(0, 0, ARENA_W, ARENA_H);

    const dots = (n, fn) => { for (let i = 0; i < n; i++) fn(R() * ARENA_W, R() * ARENA_H, i); };
    const floor = isGym && gymType === 'water' ? 'ocean' : th.name;   // the water gym is a pool
    switch (floor) {
      case 'meadow': {
        for (let x = 0; x < ARENA_W; x += 90) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, 0, 45, ARENA_H); }
        dots(260, (x, y) => {
          c.strokeStyle = R() < 0.5 ? 'rgba(40,100,30,0.55)' : 'rgba(150,220,110,0.5)'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(x - 3, y + 4); c.lineTo(x - 1, y - 3); c.moveTo(x, y + 4); c.lineTo(x + 2, y - 4); c.moveTo(x + 3, y + 4); c.lineTo(x + 5, y - 2); c.stroke();
        });
        dots(45, (x, y) => { c.fillStyle = pick(['#fff', '#ffe066', '#ff9ec7', '#c7b3ff']); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; c.beginPath(); c.arc(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5, 2, 0, TAU); c.fill(); } c.fillStyle = '#f7b500'; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); });
        break;
      }
      case 'forest': {
        dots(14, (x, y) => { c.fillStyle = 'rgba(110,80,40,0.28)'; c.beginPath(); c.ellipse(x, y, 40 + R() * 50, 20 + R() * 25, R() * 3, 0, TAU); c.fill(); });
        dots(170, (x, y) => { c.fillStyle = pick(['#c9782e', '#a5512a', '#d9a441', '#6a9a3a']); c.save(); c.translate(x, y); c.rotate(R() * TAU); c.beginPath(); c.ellipse(0, 0, 4, 2, 0, 0, TAU); c.fill(); c.restore(); });
        // canopy shadows around the border
        for (let i = 0; i < 70; i++) {
          const t = i / 70, side = i % 4;
          const x = side < 2 ? t * ARENA_W : (side === 2 ? -10 : ARENA_W + 10);
          const y = side === 0 ? -15 : side === 1 ? ARENA_H + 15 : t * ARENA_H;
          c.fillStyle = `rgba(10,40,15,${0.35 + R() * 0.25})`;
          c.beginPath(); c.arc(x + (R() - 0.5) * 60, y + (R() - 0.5) * 20, 40 + R() * 35, 0, TAU); c.fill();
        }
        break;
      }
      case 'beach': {
        for (let y = 30; y < ARENA_H; y += 22) {
          c.strokeStyle = 'rgba(160,130,70,0.25)'; c.lineWidth = 2; c.beginPath();
          for (let x = 0; x <= ARENA_W; x += 10) c.lineTo(x, y + Math.sin(x / 40 + y) * 4);
          c.stroke();
        }
        dots(30, (x, y) => { c.fillStyle = pick(['#fff3e0', '#ffccbc', '#f8bbd0']); c.beginPath(); c.arc(x, y, 5, Math.PI, TAU); c.fill(); c.strokeStyle = 'rgba(120,80,60,0.5)'; c.lineWidth = 1; c.stroke(); });
        // shoreline along the top
        c.fillStyle = '#3f8fd0'; c.beginPath(); c.moveTo(0, 0);
        for (let x = 0; x <= ARENA_W; x += 15) c.lineTo(x, 26 + Math.sin(x / 55) * 8);
        c.lineTo(ARENA_W, 0); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 4; c.beginPath();
        for (let x = 0; x <= ARENA_W; x += 15) c.lineTo(x, 26 + Math.sin(x / 55) * 8);
        c.stroke();
        break;
      }
      case 'mountain': {
        // flagstone slabs
        for (let y = 0; y < ARENA_H; y += 56) {
          const off = (y / 56) % 2 ? 40 : 0;
          for (let x = -off; x < ARENA_W; x += 80) {
            c.fillStyle = shade('#9b917c', (R() - 0.5) * 0.18);
            c.beginPath(); c.roundRect(x + 2, y + 2, 76, 52, 8); c.fill();
          }
        }
        dots(16, (x, y) => { c.strokeStyle = 'rgba(40,35,25,0.45)'; c.lineWidth = 1.5; const pts = []; let px = x, py = y; for (let k = 0; k < 5; k++) { pts.push([px, py]); px += (R() - 0.5) * 40; py += (R() - 0.5) * 40; } strokePts(c, pts); });
        dots(90, (x, y) => { c.fillStyle = pick(['#6f6758', '#b9ae97', '#857b68']); c.beginPath(); c.ellipse(x, y, 3 + R() * 4, 2 + R() * 3, R() * 3, 0, TAU); c.fill(); });
        break;
      }
      case 'lake': {
        dots(200, (x, y) => { c.strokeStyle = 'rgba(40,100,40,0.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + 2, y - 4); c.stroke(); });
        // water strip along the bottom with lily pads
        c.fillStyle = '#3a83c9'; c.beginPath(); c.moveTo(0, ARENA_H);
        for (let x = 0; x <= ARENA_W; x += 15) c.lineTo(x, ARENA_H - 30 + Math.sin(x / 70) * 8);
        c.lineTo(ARENA_W, ARENA_H); c.fill();
        for (let i = 0; i < 9; i++) {
          const x = 40 + R() * (ARENA_W - 80), y = ARENA_H - 14 + R() * 8;
          c.fillStyle = '#3f9a4a'; c.beginPath(); c.arc(x, y, 9, 0.4, TAU - 0.4); c.lineTo(x, y); c.fill();
          if (R() < 0.4) { c.fillStyle = '#ffb3d1'; c.beginPath(); c.arc(x + 2, y - 2, 3, 0, TAU); c.fill(); }
        }
        dots(10, (x, y) => { c.fillStyle = 'rgba(70,140,210,0.35)'; c.beginPath(); c.ellipse(x, y, 24 + R() * 20, 9 + R() * 6, 0, 0, TAU); c.fill(); });
        break;
      }
      case 'league': {
        // championship dirt field: scuffed, stained and pebbly (the chalk lines are worn, see below)
        c.fillStyle = '#8c6e4c'; c.fillRect(0, 0, ARENA_W, ARENA_H);
        dots(150, (x, y) => { c.fillStyle = R() < 0.5 ? 'rgba(58,40,22,0.16)' : 'rgba(186,154,110,0.14)'; c.beginPath(); c.ellipse(x, y, 20 + R() * 70, 10 + R() * 34, R() * 3, 0, TAU); c.fill(); });
        dots(520, (x, y) => { c.fillStyle = R() < 0.6 ? 'rgba(70,50,30,0.55)' : 'rgba(205,180,140,0.6)'; c.fillRect(x, y, 2 + R() * 2, 2 + R() * 2); });
        dots(18, (x, y) => {
          c.strokeStyle = 'rgba(48,34,20,0.45)'; c.lineWidth = 1.5;
          let px = x, py = y; c.beginPath(); c.moveTo(px, py);
          for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 40; py += (R() - 0.5) * 24; c.lineTo(px, py); }
          c.stroke();
        });
        // bleached sun patches
        dots(5, (x, y) => { const g = c.createRadialGradient(x, y, 0, x, y, 140); g.addColorStop(0, 'rgba(230,205,160,0.18)'); g.addColorStop(1, 'rgba(230,205,160,0)'); c.fillStyle = g; c.fillRect(x - 140, y - 140, 280, 280); });
        break;
      }
      case 'ocean': {
        // deep water with patches of halftone dots and streaks of foam
        const deep = c.createLinearGradient(0, 0, ARENA_W, ARENA_H);
        deep.addColorStop(0, '#2659bd'); deep.addColorStop(1, '#183f8f');
        c.fillStyle = deep; c.fillRect(0, 0, ARENA_W, ARENA_H);
        for (let y = 0; y < ARENA_H; y += 9) for (let x = (y / 9) % 2 ? 4.5 : 0; x < ARENA_W; x += 9) {
          const k = Math.sin(x / 150 + 1.3) * Math.cos(y / 120) * 0.5 + 0.5 - 0.4;
          if (k <= 0) continue;
          c.fillStyle = 'rgba(130,180,255,0.32)'; c.beginPath(); c.arc(x, y, Math.min(3.4, k * 6), 0, TAU); c.fill();
        }
        dots(80, (x, y) => { c.fillStyle = 'rgba(225,238,255,0.5)'; c.fillRect(x, y, 10 + R() * 28, 2); });
        break;
      }
      case 'plaza': {
        for (let y = 0; y < ARENA_H; y += 20) {
          const off = (y / 20) % 2 ? 20 : 0;
          for (let x = -off; x < ARENA_W; x += 40) { c.fillStyle = shade('#c8b48c', (R() - 0.5) * 0.12); c.fillRect(x + 1, y + 1, 38, 18); }
        }
        break;
      }
      case 'gym': {
        const tile = 60;
        for (let y = 0; y < ARENA_H; y += tile) for (let x = 0; x < ARENA_W; x += tile) {
          c.fillStyle = ((x + y) / tile) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
          c.fillRect(x, y, tile, tile);
        }
        // polished sheen
        const sheen = c.createLinearGradient(0, 0, ARENA_W, ARENA_H);
        sheen.addColorStop(0, 'rgba(255,255,255,0.12)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0.08)');
        c.fillStyle = sheen; c.fillRect(0, 0, ARENA_W, ARENA_H);
        // emblem
        const col = typeColor(gymType);
        c.save(); c.translate(ARENA_W / 2, ARENA_H / 2);
        c.fillStyle = rgba(col, 0.35); c.beginPath(); c.arc(0, 0, 110, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 110, 0, TAU); c.stroke();
        c.lineWidth = 10; c.beginPath(); c.moveTo(-110, 0); c.lineTo(-36, 0); c.moveTo(36, 0); c.lineTo(110, 0); c.stroke();
        c.beginPath(); c.arc(0, 0, 36, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(0, 0, 18, 0, TAU); c.fill();
        c.restore();
        // corner floodlights
        for (const [x, y] of [[0, 0], [ARENA_W, 0], [0, ARENA_H], [ARENA_W, ARENA_H]]) {
          const g = c.createRadialGradient(x, y, 0, x, y, 260);
          g.addColorStop(0, 'rgba(255,250,220,0.28)'); g.addColorStop(1, 'rgba(255,250,220,0)');
          c.fillStyle = g; c.fillRect(0, 0, ARENA_W, ARENA_H);
        }
        break;
      }
    }

    // gyms and the League: spectator stands along the top edge
    if (!stadium && (isGym || th.name === 'league')) {
      const sg = c.createLinearGradient(0, 0, 0, 44);
      sg.addColorStop(0, '#0c0e16'); sg.addColorStop(1, '#22283a');
      c.fillStyle = sg; c.fillRect(0, 0, ARENA_W, 44);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = 12; y < 44; y += 11) c.fillRect(0, y, ARENA_W, 2);
      c.fillStyle = isGym ? typeColor(gymType) : '#c9a227';
      c.fillRect(0, 42, ARENA_W, 4);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 46, ARENA_W, 6);
    }
    // battle-court chalk: border, halfway line, centre circle, team spawn rings
    // (in stadiums the chalk is drawn on its own layer and scuffed, so it looks played on)
    const worn = stadium && floor !== 'ocean';
    const chalk = worn ? document.createElement('canvas') : cv;
    if (worn) { chalk.width = cv.width; chalk.height = cv.height; }
    const k2 = worn ? chalk.getContext('2d') : c;
    if (worn) k2.scale(S, S);
    k2.strokeStyle = 'rgba(255,255,255,0.55)'; k2.lineWidth = 4;
    k2.strokeRect(10, 10, ARENA_W - 20, ARENA_H - 20);
    k2.beginPath(); k2.moveTo(ARENA_W / 2, 10); k2.lineTo(ARENA_W / 2, ARENA_H - 10); k2.stroke();
    if (!isGym || worn) { k2.beginPath(); k2.arc(ARENA_W / 2, ARENA_H / 2, 70, 0, TAU); k2.stroke(); }
    if (worn) {
      k2.strokeStyle = 'rgba(255,255,255,0.75)';
      for (const x of [10, ARENA_W - 10]) { k2.beginPath(); k2.arc(x, ARENA_H / 2, 120, x < ARENA_W / 2 ? -Math.PI / 2 : Math.PI / 2, x < ARENA_W / 2 ? Math.PI / 2 : Math.PI * 1.5); k2.stroke(); }
      k2.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) { k2.fillStyle = `rgba(0,0,0,${0.3 + R() * 0.7})`; k2.beginPath(); k2.ellipse(R() * ARENA_W, R() * ARENA_H, 4 + R() * 22, 3 + R() * 10, R() * 3, 0, TAU); k2.fill(); }
      c.globalAlpha = 0.85; c.drawImage(chalk, 0, 0, ARENA_W, ARENA_H); c.globalAlpha = 1;
    }
    for (const [x, col] of [[180, '#4aa3ff'], [ARENA_W - 180, '#ff5a5a']]) {
      c.fillStyle = rgba(col, 0.12); c.strokeStyle = rgba(col, 0.55); c.lineWidth = 3;
      c.beginPath(); c.ellipse(x, ARENA_H / 2 + 24, 60, 22, 0, 0, TAU); c.fill(); c.stroke();
    }
    // raised rim
    c.strokeStyle = stadium ? '#1b2033' : rgba(/^#/.test(th.edge) ? th.edge : '#333333', 0.9); c.lineWidth = 10;
    c.strokeRect(0, 0, ARENA_W, ARENA_H);
    // vignette
    const vg = c.createRadialGradient(ARENA_W / 2, ARENA_H / 2, ARENA_H * 0.35, ARENA_W / 2, ARENA_H / 2, ARENA_W * 0.65);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = vg; c.fillRect(0, 0, ARENA_W, ARENA_H);
    return { canvas: cv, name: th.name, water: floor === 'ocean', out: stadium ? '#0b0e18' : th.out, accent: isGym ? typeColor(gymType) : th.name === 'league' ? '#ffd700' : '#ffffff' };
  }

  // ---------- the per-battle effects system ----------
  class BattleFx {
    // opts.dark / opts.warm: time-of-day lighting for outdoor battles
    constructor(theme, opts = {}) {
      this.theme = theme;
      this.arena = buildArena(theme, !!opts.stadium);
      // gym / tournament battles: stands full of people around the field (opts.stadium may name the accent colour)
      this.stadium = opts.stadium ? PG.Stadium.create(typeof opts.stadium === 'string' ? opts.stadium : this.arena.accent) : null;
      // this battle's own copy of the floor, which collects craters, cracks and scorch marks
      this.ground = document.createElement('canvas');
      this.ground.width = this.arena.canvas.width; this.ground.height = this.arena.canvas.height;
      this.ground.getContext('2d').drawImage(this.arena.canvas, 0, 0);
      this.dark = opts.dark || 0;
      this.warm = opts.warm || 0;
      this.cheerT = 0;
      this.live = buildLive(theme, this.arena, !!opts.stadium);
      this.particles = [];
      this.anims = [];    // short scripted animations (swings, waves, bolts...)
      this.decals = [];   // ground marks under the fighters (scorch, cracks, puddles)
      this.ghosts = [];   // dash afterimages
      this.shakeAmt = 0;
      this.flash = null;  // { color, a }
      this.hitStop = 0;
      this.time = 0;
      this.ambient = [];
      const kind = AMBIENT[this.arena.name];
      for (let i = 0; i < 22; i++) this.ambient.push(this.newAmbient(kind, true));
    }

    // ---------- core ----------
    emit(p) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      p.max = p.life;
      p.rot = p.rot ?? Math.random() * TAU;
      this.particles.push(p);
      return p;
    }
    burst(x, y, n, opt) {
      for (let i = 0; i < n; i++) {
        const a = opt.ang !== undefined ? opt.ang + rand(-(opt.spread ?? Math.PI), opt.spread ?? Math.PI) : Math.random() * TAU;
        const sp = rand(opt.speed * 0.4, opt.speed);
        this.emit({
          x: x + rand(-(opt.jitter || 0), opt.jitter || 0), y: y + rand(-(opt.jitter || 0), opt.jitter || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (opt.vy || 0),
          life: rand(opt.life * 0.6, opt.life), size: rand(opt.size * 0.6, opt.size),
          color: Array.isArray(opt.color) ? pick(opt.color) : opt.color, shape: opt.shape || 'dot',
          g: opt.g || 0, drag: opt.drag ?? 2, add: opt.add, vr: rand(-8, 8), grow: opt.grow || 0,
        });
      }
    }
    anim(type, props) { const a = { type, t: props.dur, max: props.dur, ...props }; this.anims.push(a); return a; }
    decal(type, x, y, r, dur = 3.5) { this.decals.push({ type, x, y, r, t: dur, max: dur, seed: Math.random() * 1000 }); }
    shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
    screenFlash(color, a) { this.flash = { color, a }; }

    update(dt) {
      this.time += dt;
      for (const p of this.particles) {
        p.life -= dt;
        if (p.home) {
          // drain motes fly back to whoever drained the HP
          const dx = p.home.x - p.x, dy = p.home.y - p.y, d = Math.hypot(dx, dy) || 1;
          p.vx += (dx / d) * 1400 * dt; p.vy += (dy / d) * 1400 * dt;
          if (d < 20) p.life = 0;
        }
        p.vy += (p.g || 0) * dt;
        const d = Math.max(0, 1 - (p.drag ?? 2) * dt);
        p.vx *= d; p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += (p.vr || 0) * dt;
        p.size += (p.grow || 0) * dt;
      }
      this.particles = this.particles.filter(p => p.life > 0 && p.size > 0.2);
      for (const a of this.anims) { a.t -= dt; if (a.tick) a.tick(a, dt); }
      this.anims = this.anims.filter(a => a.t > 0);
      for (const d of this.decals) d.t -= dt;
      this.decals = this.decals.filter(d => d.t > 0);
      for (const g of this.ghosts) g.t -= dt;
      this.ghosts = this.ghosts.filter(g => g.t > 0);
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
      if (this.flash) { this.flash.a -= dt * 2.5; if (this.flash.a <= 0) this.flash = null; }
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.cheerT = Math.max(0, this.cheerT - dt);
      const kind = AMBIENT[this.arena.name];
      for (const m of this.ambient) {
        m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
        if (kind === 'firefly') { m.vx += Math.sin(m.t * 1.7 + m.s) * 12 * dt; m.vy += Math.cos(m.t * 1.3 + m.s) * 12 * dt; }
        if (m.x < -20 || m.x > ARENA_W + 20 || m.y < -20 || m.y > ARENA_H + 20) Object.assign(m, this.newAmbient(kind, false));
      }
    }

    newAmbient(kind, anywhere) {
      const x = anywhere ? Math.random() * ARENA_W : -10, y = Math.random() * ARENA_H;
      const s = Math.random() * 10;
      switch (kind) {
        case 'petal':   return { kind, x, y, vx: rand(20, 45), vy: rand(4, 16), t: 0, s, color: pick(['#ffd1e8', '#fff', '#ffe9a8']) };
        case 'firefly': return { kind, x: Math.random() * ARENA_W, y, vx: rand(-10, 10), vy: rand(-10, 10), t: 0, s, color: '#e9ff8a' };
        case 'spray':   return { kind, x, y, vx: rand(60, 110), vy: rand(-4, 4), t: 0, s, color: '#ffffff' };
        case 'dust':    return { kind, x, y, vx: rand(10, 30), vy: rand(-6, 6), t: 0, s, color: '#e8dcc0' };
        default:        return { kind, x: Math.random() * ARENA_W, y: anywhere ? y : ARENA_H + 10, vx: rand(-5, 5), vy: rand(-30, -12), t: 0, s, color: this.arena.accent };
      }
    }

    // ---------- hooks called by the battle ----------
    sendOut(x, y) {
      PG.Audio.sfx('sendOut');
      this.burst(x, y, 18, { speed: 260, life: 0.5, size: 5, color: ['#ffffff', '#ffe9a8'], add: true, shape: 'star', drag: 4 });
      this.anim('ring', { x, y, r0: 10, r1: 70, color: '#ffffff', width: 5, dur: 0.4 });
    }

    // Visuals when a move starts. ang = aim angle, target = defending fighter.
    cast(f, target, mv, ang) {
      const col = typeColor(mv.type);
      const mx = f.x + Math.cos(ang) * 30, my = f.y + Math.sin(ang) * 30;
      switch (mv.kind) {
        case 'projectile':
          this.burst(mx, my, 6, { ang, spread: 0.6, speed: 160, life: 0.25, size: 5, color: col, add: true });
          if (mv.power >= 110) { this.shake(5); this.anim('ring', { x: mx, y: my, r0: 8, r1: 44, color: col, width: 4, dur: 0.3 }); }
          break;
        case 'area': this.areaFx(f, mv); break;
        case 'buff': this.buffFx(f, mv); break;
        case 'debuff': this.debuffFx(f, target, mv, ang); break;
        case 'heal':
          this.anim('ring', { x: f.x, y: f.y, r0: 50, r1: 10, color: '#7fdc7f', width: 4, dur: 0.5 });
          for (let i = 0; i < 14; i++) this.emit({ x: f.x + rand(-30, 30), y: f.y + rand(-10, 30), vx: 0, vy: rand(-90, -50), life: rand(0.6, 1), size: rand(5, 8), color: pick(['#7fdc7f', '#c8ffb0']), shape: 'plus', drag: 0.5, add: true });
          break;
        case 'none':
          f.hop = 0.6;
          this.burst(f.x, f.y + 20, 10, { ang: -Math.PI / 2, spread: 1, speed: 220, life: 0.6, size: 4, color: ['#6890f0', '#bfe0ff'], g: 600, drag: 0.5 });
          break;
      }
    }

    projectileSpawned(pr) {
      pr.look = PROJ_LOOK[pr.move.id] || PROJ_BY_TYPE[pr.move.type] || 'orb';
      pr.age = 0; pr.seed = Math.random() * 100; pr.ox = pr.x; pr.oy = pr.y; pr.emitT = 0;
    }

    // Trail particles for a projectile in flight.
    projectileTick(pr, dt) {
      pr.age += dt;
      pr.emitT -= dt;
      if (pr.emitT > 0) return;
      pr.emitT = 0.016;
      const sp = Math.hypot(pr.vx, pr.vy) || 1, ux = pr.vx / sp, uy = pr.vy / sp;
      const back = (k) => ({ x: pr.x - ux * pr.size * k + rand(-3, 3), y: pr.y - uy * pr.size * k + rand(-3, 3) });
      const s = pr.size;
      switch (pr.look) {
        case 'fireball': case 'flame': case 'fireblast': {
          const n = pr.look === 'flame' ? 3 : 1;
          for (let i = 0; i < n; i++) this.emit({ ...back(0.5), vx: -ux * 60 + rand(-30, 30), vy: -uy * 60 + rand(-50, 10), life: rand(0.2, pr.look === 'flame' ? 0.45 : 0.3), size: s * rand(0.5, 0.9), color: pick(['#ff4500', '#ff8c00', '#ffd23f']), shape: 'dot', add: true, grow: -s * 1.5 });
          if (Math.random() < 0.15) this.emit({ ...back(1), vx: 0, vy: -30, life: 0.5, size: s * 0.6, color: '#555555', shape: 'smoke', grow: 12 });
          break;
        }
        case 'dragonfire': case 'dragonpulse':
          this.emit({ ...back(0.5), vx: -ux * 50 + rand(-40, 40), vy: -uy * 50 + rand(-40, 40), life: 0.35, size: s * 0.8, color: pick(['#7038f8', '#a070ff', '#4fc3f7']), shape: 'dot', add: true, grow: -s * 1.6 });
          break;
        case 'droplet': case 'jet':
          this.emit({ ...back(0.6), vx: -ux * 40 + rand(-50, 50), vy: -uy * 40 + rand(-50, 50), life: 0.35, size: rand(2, 4), color: pick(['#6890f0', '#bfe0ff', '#ffffff']), g: 300, drag: 1 });
          break;
        case 'bubble':
          if (Math.random() < 0.3) this.emit({ ...back(1), vx: rand(-20, 20), vy: rand(-30, -10), life: 0.5, size: rand(2, 4), color: '#bfe6ff', shape: 'bubble' });
          break;
        case 'leaf': case 'drain':
          if (Math.random() < 0.35) this.emit({ ...back(0.8), vx: rand(-20, 20), vy: rand(-20, 20), life: 0.4, size: rand(2, 3), color: pick(['#78c850', '#b6f08a']), shape: 'dot', add: true });
          break;
        case 'solar': case 'hyperbeam':
          this.emit({ ...back(0.2), vx: rand(-60, 60), vy: rand(-60, 60), life: 0.35, size: rand(3, 6), color: pick(pr.look === 'solar' ? ['#fff59d', '#ffffff'] : ['#ffb347', '#ffffff']), shape: 'star', add: true });
          break;
        case 'spark': case 'bolt': case 'signal':
          if (Math.random() < 0.6) this.emit({ ...back(0.3), vx: rand(-160, 160), vy: rand(-160, 160), life: 0.15, size: 2, color: pick(pr.look === 'signal' ? ['#ff6b6b', '#6bc5ff', '#ffe66d'] : ['#f8d030', '#ffffff']), shape: 'spark', add: true, drag: 6 });
          break;
        case 'icebeam': case 'aurora':
          if (Math.random() < 0.5) this.emit({ ...back(0.5), vx: rand(-30, 30), vy: rand(-30, 30), life: 0.5, size: rand(3, 5), color: pick(['#98d8d8', '#ffffff', '#c9f6ff']), shape: 'shard', vr: 6 });
          break;
        case 'glob': case 'needle':
          if (Math.random() < 0.3) this.emit({ ...back(0.6), vx: rand(-10, 10), vy: 0, life: 0.5, size: rand(2, 4), color: '#a040a0', g: 400, drag: 1 });
          break;
        case 'mud': case 'rock': case 'edge':
          if (Math.random() < 0.3) this.emit({ ...back(0.6), vx: rand(-30, 30), vy: rand(-30, 0), life: 0.4, size: rand(2, 4), color: pick(['#8a6d3b', '#b8a038', '#6b5a35']), g: 300, drag: 1 });
          break;
        case 'wind':
          if (Math.random() < 0.5) this.emit({ ...back(1), vx: -ux * 80 + rand(-30, 30), vy: -uy * 80 + rand(-30, 30), life: 0.3, size: 2, color: '#ffffff', shape: 'spark', drag: 3 });
          break;
        case 'psyring': case 'psybeam':
          if (Math.random() < 0.3) this.emit({ ...back(0.5), vx: 0, vy: 0, life: 0.35, size: s * 0.6, color: '#f85888', shape: 'ring', grow: 40 });
          break;
        case 'shadow':
          this.emit({ ...back(0.6), vx: rand(-15, 15), vy: rand(-35, -10), life: 0.6, size: s * 0.7, color: pick(['#2a1840', '#705898']), shape: 'wisp', grow: 8 });
          break;
        case 'star':
          if (Math.random() < 0.5) this.emit({ ...back(0.8), vx: rand(-20, 20), vy: rand(-20, 20), life: 0.4, size: rand(3, 5), color: pick(['#ffe66d', '#ffffff']), shape: 'star', add: true });
          break;
        default:
          if (Math.random() < 0.4) this.emit({ ...back(0.6), vx: 0, vy: 0, life: 0.25, size: s * 0.5, color: typeColor(pr.move.type), shape: 'dot', add: true, grow: -s });
      }
    }

    // A melee swing. hx, hy: where it lands (the target if it connected).
    swing(f, mv, ang, hx, hy, connected) {
      const look = MELEE_LOOK[mv.id] || 'claw';
      this.anim('melee', { look, x: hx, y: hy, fx: f.x, fy: f.y, ang, color: typeColor(mv.type), id: mv.id, dur: look === 'vine' || look === 'tongue' ? 0.32 : 0.28, connected });
      if (!connected) return;
      if (look === 'fang' && mv.id === 'fire_fang') this.burst(hx, hy, 10, { speed: 160, life: 0.4, size: 6, color: ['#ff4500', '#ffd23f'], add: true, vy: -40 });
      if (look === 'fang' && mv.id === 'leech_life') this.drainFx(hx, hy, f, '#ff5a6e');
      if (look === 'kick') this.burst(hx, hy + 20, 10, { ang: -Math.PI / 2, spread: 1.4, speed: 160, life: 0.5, size: 5, color: '#c8b48c', shape: 'smoke', grow: 10 });
    }

    // Afterimages and trails while a fighter dashes.
    dashTick(f, mv, dt) {
      f.ghostT = (f.ghostT || 0) - dt;
      if (f.ghostT <= 0) {
        f.ghostT = 0.035;
        this.ghosts.push({ species: f.mon.species, x: f.x, y: f.y, flip: Math.cos(f.facing) > 0, t: 0.25, max: 0.25, color: typeColor(mv.type) });
      }
      const look = DASH_LOOK[mv.id] || (mv.melee ? 'lunge' : 'quick');
      const back = Math.atan2(-f.dash.vy, -f.dash.vx);
      if (look === 'spark') this.burst(f.x, f.y, 2, { speed: 220, life: 0.15, size: 2, color: ['#f8d030', '#ffffff'], shape: 'spark', add: true, drag: 6, jitter: 20 });
      else if (look === 'swim') this.burst(f.x, f.y + 10, 3, { ang: back, spread: 0.9, speed: 200, life: 0.45, size: 4, color: ['#6890f0', '#bfe0ff', '#ffffff'], g: 400, vy: -80, drag: 1 });
      else if (look === 'slam') this.burst(f.x, f.y + 26, 1, { ang: back, spread: 0.6, speed: 90, life: 0.5, size: 8, color: '#b9a98a', shape: 'smoke', grow: 16 });
      else if (look === 'cross') this.burst(f.x, f.y, 2, { ang: back, spread: 0.4, speed: 200, life: 0.25, size: 5, color: ['#c03028', '#ff8a50'], add: true });
      else this.burst(f.x, f.y, 1, { ang: back, spread: 0.25, speed: 260, life: 0.2, size: 2, color: '#ffffff', shape: 'spark', drag: 2 });
    }

    dashHit(f, target, mv) {
      const look = DASH_LOOK[mv.id];
      const ang = Math.atan2(target.y - f.y, target.x - f.x);
      if (look === 'cross') this.anim('cross', { x: target.x, y: target.y, color: '#ff6a3d', dur: 0.35 });
      else if (look === 'slam') { this.anim('ring', { x: target.x, y: target.y + 20, r0: 10, r1: 90, color: '#e8dcc0', width: 8, dur: 0.35 }); this.shake(8); }
      else if (look === 'ace') this.anim('slash', { x: target.x, y: target.y, ang, color: '#ffffff', len: 140, dur: 0.25 });
      else if (look === 'spark') this.anim('bolts', { x: target.x, y: target.y, color: '#f8d030', r: 60, dur: 0.3 });
      else if (look === 'swim') this.anim('area', { look: 'wave', x: target.x, y: target.y, r: 70, color: '#6890f0', dur: 0.4, owner: f });
      else this.anim('pow', { x: target.x, y: target.y, color: '#ffffff', dur: 0.25 });
    }

    areaFx(f, mv) {
      const look = AREA_LOOK[mv.id] || 'ring';
      const col = typeColor(mv.type), R = mv.radius;
      this.anim('area', { look, x: f.x, y: f.y, r: R, color: col, dur: look === 'quake' ? 0.7 : 0.6, owner: f });
      switch (look) {
        case 'firespin':
          for (let i = 0; i < 40; i++) {
            const a = Math.random() * TAU, r = rand(R * 0.3, R);
            this.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, vx: Math.cos(a + Math.PI / 2) * 260, vy: Math.sin(a + Math.PI / 2) * 260 - 40, life: rand(0.35, 0.6), size: rand(6, 11), color: pick(['#ff4500', '#ff8c00', '#ffd23f']), add: true, grow: -14, drag: 1.5 });
          }
          break;
        case 'wave':
          for (let i = 0; i < 36; i++) {
            const a = (i / 36) * TAU;
            this.emit({ x: f.x + Math.cos(a) * 30, y: f.y + Math.sin(a) * 30, vx: Math.cos(a) * R * 1.6, vy: Math.sin(a) * R * 1.6 - 60, life: 0.55, size: rand(3, 5), color: pick(['#bfe6ff', '#ffffff', '#6890f0']), g: 250, drag: 2 });
          }
          break;
        case 'quake':
          this.shake(16);
          this.decal('crack', f.x, f.y + 20, R);
          for (let i = 0; i < 26; i++) {
            const a = Math.random() * TAU, r = rand(20, R);
            this.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, vx: rand(-40, 40), vy: rand(-320, -160), life: rand(0.5, 0.8), size: rand(4, 8), color: pick(['#8a6d3b', '#b8a038', '#6b5a35']), shape: 'rock', g: 900, drag: 0.3 });
          }
          break;
        case 'hurricane':
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * TAU, r = rand(20, R);
            this.emit({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, vx: Math.cos(a + 1.3) * 380, vy: Math.sin(a + 1.3) * 380, life: rand(0.4, 0.7), size: rand(4, 7), color: pick(['#ffffff', '#d9ccff', '#78c850']), shape: pick(['leaf', 'feather']), drag: 1.2 });
          }
          break;
        default:
          this.burst(f.x, f.y, 24, { speed: R * 2, life: 0.4, size: 5, color: col, add: true });
      }
    }

    strikeSpawned(s) {
      s.look = s.move.ult ? 'ult' : STRIKE_LOOK[s.move.id] || 'generic';
      s.ox = s.owner.x; s.oy = s.owner.y;
      if (s.look === 'rockslide') s.rocks = [0, 1, 2, 3].map(() => ({ dx: rand(-s.r * 0.6, s.r * 0.6), dy: rand(-s.r * 0.5, s.r * 0.5), lag: rand(0, 0.15), size: rand(14, 22) }));
    }

    strikeLand(s) {
      const col = typeColor(s.move.type);
      const { x, y, r } = s;
      const ty = s.move.type;
      if (ty === 'fire' || ty === 'electric') this.scar('scorch', x, y, r * 0.7);
      else if (['ground', 'rock', 'normal', 'fighting', 'steel', 'dragon', 'dark'].includes(ty)) this.scar('crater', x, y, r * (s.move.ult ? 0.32 : 0.24));
      switch (s.look) {
        case 'ult': PG.ULT.land(this, s); break;
        case 'fireblast':
          this.anim('fivestar', { x, y, r: r * 1.2, dur: 0.55 });
          this.decal('scorch', x, y, r);
          this.burst(x, y, 30, { speed: 320, life: 0.6, size: 9, color: ['#ff4500', '#ff8c00', '#ffd23f'], add: true, grow: -10 });
          this.burst(x, y, 8, { speed: 60, life: 1, size: 14, color: '#4a4a4a', shape: 'smoke', grow: 30, vy: -40 });
          this.shake(9);
          break;
        case 'thunder':
          this.anim('skybolt', { x, y, color: '#f8d030', dur: 0.3 });
          this.screenFlash('#fffbe0', 0.55);
          this.decal('scorch', x, y, r * 0.6);
          this.burst(x, y, 24, { speed: 360, life: 0.3, size: 3, color: ['#f8d030', '#ffffff'], shape: 'spark', add: true, drag: 5 });
          this.shake(11);
          break;
        case 'sludge':
          this.decal('sludge', x, y, r * 0.9);
          this.burst(x, y, 22, { speed: 260, life: 0.6, size: 6, color: ['#a040a0', '#d070d0', '#6b2a6b'], g: 500, vy: -120, drag: 1 });
          for (let i = 0; i < 8; i++) this.emit({ x: x + rand(-r * 0.6, r * 0.6), y: y + rand(-r * 0.4, r * 0.4), vx: 0, vy: rand(-30, -10), life: rand(0.6, 1.2), size: rand(3, 6), color: '#d070d0', shape: 'bubble' });
          this.shake(5);
          break;
        case 'dig':
          this.decal('hole', x, y, r * 0.7);
          this.burst(x, y, 26, { ang: -Math.PI / 2, spread: 0.9, speed: 420, life: 0.8, size: 7, color: ['#8a6d3b', '#b8a038', '#6b5a35'], shape: 'rock', g: 1100, drag: 0.4 });
          this.burst(x, y, 6, { speed: 80, life: 0.9, size: 16, color: '#c8b48c', shape: 'smoke', grow: 25 });
          this.shake(10);
          break;
        case 'rockslide':
          this.decal('crack', x, y, r * 0.8);
          for (const rk of s.rocks) this.burst(x + rk.dx, y + rk.dy, 8, { ang: -Math.PI / 2, spread: 1.4, speed: 260, life: 0.6, size: 6, color: ['#b8a038', '#857b68', '#6f6758'], shape: 'rock', g: 900, drag: 0.4 });
          this.burst(x, y, 6, { speed: 80, life: 0.8, size: 16, color: '#d8ccb0', shape: 'smoke', grow: 25 });
          this.shake(10);
          break;
        case 'psychic':
          for (let i = 0; i < 3; i++) this.anim('ring', { x, y, r0: 10 + i * 10, r1: r * (1.1 + i * 0.25), color: '#f85888', width: 5 - i, dur: 0.4 + i * 0.12 });
          this.burst(x, y, 18, { speed: 220, life: 0.5, size: 5, color: ['#f85888', '#ffb3d1', '#ffffff'], shape: 'star', add: true });
          this.screenFlash('#f85888', 0.2);
          break;
        case 'nightshade':
          this.anim('pillar', { x, y, r, color: '#705898', dur: 0.5 });
          for (let i = 0; i < 16; i++) this.emit({ x: x + rand(-r * 0.6, r * 0.6), y: y + rand(-r * 0.3, r * 0.3), vx: rand(-10, 10), vy: rand(-120, -50), life: rand(0.6, 1), size: rand(8, 14), color: pick(['#2a1840', '#705898']), shape: 'wisp', grow: 10 });
          break;
        default:
          this.anim('ring', { x, y, r0: r * 0.3, r1: r, color: col, width: 6, dur: 0.3 });
          this.burst(x, y, 16, { speed: 240, life: 0.4, size: 5, color: col, add: true });
      }
    }

    // Two attacks collided. cancel: both destroyed (big boom); otherwise the winner punches through.
    clash(x, y, win, lose, cancel) {
      const ca = typeColor(win.type), cb = typeColor(lose.type);
      if (cancel) {
        this.anim('pow', { x, y, color: '#ffd84a', dur: 0.4 });
        this.anim('ring', { x, y, r0: 10, r1: 110, color: '#ffffff', width: 7, dur: 0.4 });
        this.anim('ring', { x, y, r0: 5, r1: 70, color: ca, width: 5, dur: 0.35 });
        this.burst(x, y, 22, { speed: 380, life: 0.5, size: 6, color: [ca, cb, '#ffffff'], add: true, grow: -6 });
        this.burst(x, y, 8, { speed: 70, life: 1, size: 18, color: '#666666', shape: 'smoke', grow: 30, vy: -30 });
        this.screenFlash('#ffffff', 0.35);
        this.shake(12);
        this.hitStop = Math.max(this.hitStop, 0.07);
      } else {
        this.anim('ring', { x, y, r0: 8, r1: 60, color: ca, width: 5, dur: 0.3 });
        this.burst(x, y, 14, { speed: 260, life: 0.4, size: 5, color: [cb, '#ffffff'], add: true });
        this.burst(x, y, 8, { speed: 160, life: 0.3, size: 4, color: ca, add: true });
        this.shake(5);
      }
    }

    // Damage landed. contact = melee/dash hit.
    impact(target, mv, eff, contact, attacker) {
      const { x, y } = target;
      const col = typeColor(mv.type);
      const big = mv.power >= 90;
      const n = big ? 16 : 10;
      switch (mv.type) {
        case 'fire':     this.burst(x, y, n, { speed: 240, life: 0.45, size: 7, color: ['#ff4500', '#ff8c00', '#ffd23f'], add: true, grow: -8, vy: -40 }); break;
        case 'water':    this.burst(x, y, n, { speed: 260, life: 0.5, size: 4, color: ['#6890f0', '#bfe0ff', '#ffffff'], g: 500, vy: -100, drag: 1 }); break;
        case 'grass':    this.burst(x, y, n, { speed: 200, life: 0.6, size: 6, color: ['#78c850', '#4caf50', '#b6f08a'], shape: 'leaf', drag: 2 }); break;
        case 'electric':
          this.burst(x, y, n, { speed: 340, life: 0.2, size: 3, color: ['#f8d030', '#ffffff'], shape: 'spark', add: true, drag: 5 }); this.anim('bolts', { x, y, color: '#f8d030', r: 50, dur: 0.2 });
          this.anim('crackweb', { x, y: y + 22, r: big ? 120 : 80, seed: Math.random() * 1000, dur: 0.5 });
          break;
        case 'ice':      this.burst(x, y, n, { speed: 240, life: 0.5, size: 6, color: ['#98d8d8', '#ffffff', '#c9f6ff'], shape: 'shard', drag: 2 }); break;
        case 'fighting': this.anim('pow', { x, y, color: '#ffd84a', dur: 0.3 }); this.burst(x, y, 8, { speed: 300, life: 0.2, size: 3, color: '#ffffff', shape: 'spark', drag: 4 }); break;
        case 'poison':   this.burst(x, y, n, { speed: 150, life: 0.6, size: 5, color: ['#a040a0', '#d070d0'], shape: 'bubble', vy: -40 }); break;
        case 'ground':   this.burst(x, y, n, { speed: 220, life: 0.5, size: 5, color: ['#8a6d3b', '#e0c068'], g: 600, vy: -120, drag: 1 }); break;
        case 'flying':   this.burst(x, y, n, { speed: 200, life: 0.7, size: 7, color: ['#ffffff', '#d9ccff'], shape: 'feather', drag: 2, g: 60 }); break;
        case 'psychic':  this.anim('ring', { x, y, r0: 10, r1: 60, color: '#f85888', width: 4, dur: 0.3 }); this.burst(x, y, 8, { speed: 160, life: 0.4, size: 4, color: '#ffb3d1', shape: 'star', add: true }); break;
        case 'bug':      this.burst(x, y, n, { speed: 220, life: 0.4, size: 4, color: ['#a8b820', '#e0f060'], add: true }); break;
        case 'rock':     this.burst(x, y, n, { speed: 240, life: 0.6, size: 6, color: ['#b8a038', '#857b68'], shape: 'rock', g: 700, vy: -150, drag: 0.5 }); break;
        case 'ghost':    this.burst(x, y, n, { speed: 90, life: 0.7, size: 9, color: ['#2a1840', '#705898'], shape: 'wisp', grow: 10, vy: -30 }); break;
        case 'dragon':   this.burst(x, y, n, { speed: 260, life: 0.45, size: 7, color: ['#7038f8', '#a070ff', '#4fc3f7'], add: true, grow: -8 }); break;
        default:         this.burst(x, y, n, { speed: 240, life: 0.3, size: 5, color: ['#ffffff', col], shape: 'star', add: true });
      }
      if (contact) this.anim('ring', { x, y, r0: 15, r1: 55, color: '#ffffff', width: 4, dur: 0.18 });
      if (!mv.ult) PG.MOVEFX.hit(this, target, mv, attacker);   // the move's own signature effect
      if (big || eff > 1) this.scar(mv.type === 'fire' ? 'scorch' : 'cracks', x, y + 22, 40);   // heavy hits mark the floor
      if (eff > 1) { this.anim('ring', { x, y, r0: 20, r1: 90, color: '#ffd84a', width: 5, dur: 0.35 }); this.shake(8); }
      this.shake(contact ? 6 : big ? 5 : 3);
      if (mv.drain && attacker && !contact) this.drainFx(x, y, attacker, '#7fdc7f');
    }

    // Motes that drift from the target back to the attacker.
    drainFx(x, y, attacker, color) {
      for (let i = 0; i < 10; i++) {
        const p = this.emit({ x: x + rand(-15, 15), y: y + rand(-15, 15), vx: 0, vy: 0, life: rand(0.5, 0.8), size: rand(3, 5), color, shape: 'dot', add: true, drag: 0 });
        p.home = attacker;
      }
    }

    buffFx(f, mv) {
      const col = STAT_COLOR[mv.stat] || '#7fdc7f';
      if (mv.id === 'harden') this.anim('shell', { owner: f, color: '#dfe8ff', dur: 0.5 });
      else if (mv.id === 'bulk_up') this.burst(f.x, f.y + 20, 20, { ang: -Math.PI / 2, spread: 0.5, speed: 200, life: 0.6, size: 7, color: ['#c03028', '#ff7a45', '#ffd23f'], add: true, grow: -8, jitter: 25 });
      this.anim('ring', { x: f.x, y: f.y + 20, r0: 20, r1: 60, color: col, width: 4, dur: 0.45 });
      for (let i = 0; i < 6; i++) this.emit({ x: f.x + rand(-30, 30), y: f.y + rand(0, 30), vx: 0, vy: -110, life: rand(0.5, 0.8), size: 9, color: col, shape: 'arrow', drag: 0.5 });
    }

    debuffFx(f, target, mv, ang) {
      const col = STAT_COLOR[mv.stat] || '#ff8080';
      if (mv.id === 'growl') this.anim('soundwave', { x: f.x, y: f.y, ang, color: '#ffffff', dur: 0.5 });
      else if (mv.id === 'sand_attack') this.burst(f.x + Math.cos(ang) * 30, f.y + Math.sin(ang) * 30, 30, { ang, spread: 0.35, speed: 520, life: 0.45, size: 3, color: ['#e0c068', '#c8a850', '#f5e3a8'], drag: 2.5 });
      else if (mv.id === 'string_shot') this.anim('threads', { fx: f.x, fy: f.y, owner: f, target, dur: 0.6 });
      this.anim('ring', { x: target.x, y: target.y, r0: 60, r1: 15, color: col, width: 4, dur: 0.4 });
      for (let i = 0; i < 5; i++) this.emit({ x: target.x + rand(-28, 28), y: target.y - 30 + rand(-10, 10), vx: 0, vy: 80, life: rand(0.5, 0.7), size: 9, color: '#ff6b6b', shape: 'arrowdown', drag: 0.5 });
    }

    // ---------- drawing ----------
    shakeOffset() {
      if (this.shakeAmt <= 0) return [0, 0];
      return [rand(-this.shakeAmt, this.shakeAmt) * 0.6, rand(-this.shakeAmt, this.shakeAmt) * 0.6];
    }

    drawArena(ctx) {
      ctx.drawImage(this.ground, 0, 0, ARENA_W, ARENA_H);
      drawLive(ctx, this.live, this.time, this);
    }

    // Permanent battle damage on the floor, kept until the battle ends. Water doesn't scar.
    scar(kind, x, y, r) {
      if (this.arena.water) return;
      const c = this.ground.getContext('2d'), R = seeded(Math.floor(x * 31 + y * 17 + r * 7));
      c.save(); c.scale(this.ground.width / ARENA_W, this.ground.height / ARENA_H);
      if (kind === 'crater') {
        for (let i = 0; i < 12; i++) {                      // dirt thrown out of the hole
          const a = R() * TAU, d = r * (1.1 + R() * 0.7);
          c.fillStyle = R() < 0.5 ? 'rgba(52,38,24,0.5)' : 'rgba(120,96,66,0.45)';
          c.beginPath(); c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 3 + R() * 6, 2 + R() * 3, a, 0, TAU); c.fill();
        }
        c.fillStyle = 'rgba(70,52,34,0.45)'; c.beginPath(); c.ellipse(x, y, r * 1.3, r * 0.82, 0, 0, TAU); c.fill();   // raised rim
        const g = c.createRadialGradient(x, y + r * 0.1, 0, x, y, r);
        g.addColorStop(0, 'rgba(18,12,8,0.95)'); g.addColorStop(0.7, 'rgba(34,24,15,0.85)'); g.addColorStop(1, 'rgba(50,36,22,0.4)');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(230,205,170,0.28)'; c.lineWidth = 2;   // lit lower lip
        c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, 0.15, Math.PI - 0.15); c.stroke();
        kind = 'cracks'; r *= 1.8;
      }
      if (kind === 'cracks') {
        c.strokeStyle = 'rgba(28,20,12,0.55)'; c.lineWidth = 2; c.lineJoin = 'round';
        for (let i = 0; i < 7; i++) {
          const a = R() * TAU; let px = x + Math.cos(a) * r * 0.3, py = y + Math.sin(a) * r * 0.2;
          c.beginPath(); c.moveTo(px, py);
          for (let k = 0; k < 4; k++) { px += Math.cos(a + (R() - 0.5) * 0.9) * r * 0.22; py += Math.sin(a + (R() - 0.5) * 0.9) * r * 0.14; c.lineTo(px, py); }
          c.stroke();
        }
      } else if (kind === 'scorch') {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(22,14,8,0.6)'); g.addColorStop(1, 'rgba(22,14,8,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.65, 0, 0, TAU); c.fill();
      }
      c.restore();
    }

    // The crowd roars on big moments (super-effective hits, KOs, ultimates).
    cheer(amount = 0.6) {
      if (!this.live.crowd && !this.stadium) return;
      this.cheerT = Math.min(2.5, this.cheerT + amount * 2);
      if (amount >= 0.6) for (let i = 0; i < 18; i++) {
        this.emit({ x: Math.random() * ARENA_W, y: this.stadium ? -4 : 30, vx: (Math.random() - 0.5) * 80, vy: 40 + Math.random() * 60, life: 1.6, size: 4, color: pick(['#ffd34d', '#ff6b6b', '#6bc5ff', '#7be07b', '#ffffff', this.arena.accent]), shape: 'shard', g: 120, drag: 0.6, vr: 10 });
      }
      PG.Audio.sfx('cheer', amount);
    }

    // Night / dusk lighting for outdoor battles: darken the ground but keep a spotlight on each fighter.
    drawLighting(ctx, fighters) {
      if (this.warm > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(255,140,60,${this.warm * 1.4})`; ctx.fillRect(0, 0, ARENA_W, ARENA_H); ctx.restore();
      }
      if (this.dark < 0.03) return;
      const lc = this.lightCv || (this.lightCv = document.createElement('canvas'));
      lc.width = ARENA_W / 2; lc.height = ARENA_H / 2;
      const g = lc.getContext('2d');
      g.fillStyle = `rgba(10,18,48,${Math.min(0.6, this.dark * 1.15)})`; g.fillRect(0, 0, lc.width, lc.height);
      g.globalCompositeOperation = 'destination-out';
      for (const f of fighters) {
        if (!f || f.mon.fainted) continue;
        const gr = g.createRadialGradient(f.x / 2, (f.y + 10) / 2, 4, f.x / 2, (f.y + 10) / 2, 70);
        gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(f.x / 2, (f.y + 10) / 2, 70, 0, TAU); g.fill();
      }
      ctx.drawImage(lc, 0, 0, ARENA_W, ARENA_H);
      // moonlight from the top-right corner
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const mg = ctx.createRadialGradient(ARENA_W - 60, -40, 10, ARENA_W - 60, -40, 520);
      mg.addColorStop(0, `rgba(150,180,255,${0.22 * this.dark * 2})`); mg.addColorStop(1, 'rgba(150,180,255,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.restore();
    }

    drawAmbient(ctx) {
      if (this.arena.name === 'league') {
        // two sweeping stadium spotlights
        ctx.globalCompositeOperation = 'lighter';
        for (const [sx, ph] of [[60, 0], [ARENA_W - 60, Math.PI]]) {
          const a = Math.PI / 2 + Math.sin(this.time * 0.6 + ph) * 0.55;
          const ex = sx + Math.cos(a) * 700, ey = -40 + Math.sin(a) * 700;
          const g = ctx.createLinearGradient(sx, -40, ex, ey);
          g.addColorStop(0, 'rgba(255,240,190,0.34)'); g.addColorStop(1, 'rgba(255,240,190,0)');
          ctx.fillStyle = g;
          const nx = -Math.sin(a), ny = Math.cos(a);
          ctx.beginPath(); ctx.moveTo(sx - nx * 6, -40 - ny * 6); ctx.lineTo(ex - nx * 120, ey - ny * 120); ctx.lineTo(ex + nx * 120, ey + ny * 120); ctx.lineTo(sx + nx * 6, -40 + ny * 6); ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      for (const m of this.ambient) {
        if (m.kind === 'firefly' || m.kind === 'sparkle') {
          const a = 0.35 + 0.35 * Math.sin(m.t * 3 + m.s);
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, m.x, m.y, 7, m.color, a);
          ctx.globalCompositeOperation = 'source-over';
        } else if (m.kind === 'petal') {
          ctx.fillStyle = rgba(m.color, 0.8);
          ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.t * 2 + m.s); ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 2, 0, 0, TAU); ctx.fill(); ctx.restore();
        } else if (m.kind === 'spray') {
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - 18, m.y); ctx.stroke();
        } else {
          ctx.fillStyle = rgba(m.color, 0.35);
          ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, TAU); ctx.fill();
        }
      }
    }

    // Scorch marks, cracks and puddles, drawn under everything else.
    drawDecals(ctx) {
      for (const d of this.decals) {
        const a = Math.min(1, d.t / 1.2);
        const R = seeded(d.seed);
        switch (d.type) {
          case 'scorch': {
            const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
            g.addColorStop(0, `rgba(20,10,5,${0.55 * a})`); g.addColorStop(1, 'rgba(20,10,5,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, 0, 0, TAU); ctx.fill();
            break;
          }
          case 'crack': {
            ctx.strokeStyle = `rgba(40,28,15,${0.7 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
            for (let i = 0; i < 8; i++) {
              const ang = (i / 8) * TAU + R(), len = d.r * (0.5 + R() * 0.5);
              let px = d.x, py = d.y; ctx.beginPath(); ctx.moveTo(px, py);
              for (let k = 1; k <= 5; k++) { px = d.x + Math.cos(ang + (R() - 0.5) * 0.5) * len * k / 5; py = d.y + Math.sin(ang + (R() - 0.5) * 0.5) * len * k / 5 * 0.7; ctx.lineTo(px, py); }
              ctx.stroke();
            }
            ctx.lineCap = 'butt';
            break;
          }
          case 'sludge':
            ctx.fillStyle = `rgba(110,40,120,${0.5 * a})`;
            ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.6, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = `rgba(210,120,220,${0.35 * a})`;
            ctx.beginPath(); ctx.ellipse(d.x - d.r * 0.2, d.y - d.r * 0.1, d.r * 0.4, d.r * 0.2, 0, 0, TAU); ctx.fill();
            break;
          case 'hole':
            ctx.fillStyle = `rgba(60,40,20,${0.6 * a})`;
            ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = `rgba(20,12,5,${0.6 * a})`;
            ctx.beginPath(); ctx.ellipse(d.x, d.y + 3, d.r * 0.6, d.r * 0.3, 0, 0, TAU); ctx.fill();
            break;
          case 'puddle':
            ctx.fillStyle = `rgba(60,130,230,${0.35 * a})`;
            ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = `rgba(200,235,255,${0.5 * a})`; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(d.x - d.r * 0.2, d.y - d.r * 0.1, d.r * 0.35, d.r * 0.15, 0, 0, TAU); ctx.stroke();
            break;
          case 'frost': {
            ctx.fillStyle = `rgba(220,245,255,${0.45 * a})`;
            ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.6, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = `rgba(150,210,240,${0.6 * a})`; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU + R(); ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(ang) * d.r * 0.9, d.y + Math.sin(ang) * d.r * 0.55); ctx.stroke(); }
            break;
          }
        }
      }
    }

    drawGhosts(ctx) {
      for (const g of this.ghosts) {
        ctx.globalAlpha = 0.35 * (g.t / g.max);
        PG.drawMon(ctx, g.species, g.x, g.y - 8, 96, g.flip);
      }
      ctx.globalAlpha = 1;
    }

    // Telegraph for a strike that hasn't landed yet (drawn on the ground, under fighters).
    drawStrikeGround(ctx, s) {
      const k = 1 - s.t / s.max;
      const col = typeColor(s.move.type);
      // gameplay-readable danger zone
      ctx.fillStyle = rgba(col, 0.1 + k * 0.22);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      ctx.save();
      ctx.setLineDash([12, 8]); ctx.lineDashOffset = -this.time * 40;
      ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = rgba('#ffffff', 0.5 + k * 0.4); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * k, 0, TAU); ctx.stroke();
      switch (s.look) {
        case 'dig': {
          const R = seeded(Math.floor(s.x * 7 + s.y));
          ctx.strokeStyle = rgba('#3d2b14', 0.4 + k * 0.4); ctx.lineWidth = 2.5;
          for (let i = 0; i < 6; i++) { const a = R() * TAU; strokePts(ctx, [[s.x, s.y], [s.x + Math.cos(a) * s.r * k * 0.5, s.y + Math.sin(a) * s.r * k * 0.4], [s.x + Math.cos(a + 0.3) * s.r * k * 0.9, s.y + Math.sin(a + 0.3) * s.r * k * 0.7]]); }
          const bump = Math.sin(this.time * 40) * 2 * k;
          ctx.fillStyle = rgba('#8a6d3b', 0.6); ctx.beginPath(); ctx.ellipse(s.x, s.y + bump, 18 + k * 10, 8 + k * 4, 0, Math.PI, TAU); ctx.fill();
          break;
        }
        case 'nightshade':
          ctx.fillStyle = rgba('#1a0f2e', 0.25 + k * 0.45);
          ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (0.3 + k * 0.7), s.r * (0.2 + k * 0.5), 0, 0, TAU); ctx.fill();
          break;
        case 'psychic':
          for (let i = 0; i < 3; i++) {
            const rr = s.r * (1 - ((k * 2 + i / 3) % 1));
            ctx.strokeStyle = rgba('#f85888', 0.6); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, TAU); ctx.stroke();
          }
          break;
        case 'fireblast': case 'rockslide': {
          // shadows of what is falling, growing as it gets closer
          const list = s.look === 'rockslide' ? s.rocks : [{ dx: 0, dy: 0, lag: 0, size: 22 }];
          for (const rk of list) {
            const kk = Math.max(0, Math.min(1, (k - rk.lag) / (1 - rk.lag)));
            ctx.fillStyle = `rgba(0,0,0,${0.15 + kk * 0.3})`;
            ctx.beginPath(); ctx.ellipse(s.x + rk.dx, s.y + rk.dy, rk.size * (0.4 + kk * 0.8), rk.size * (0.2 + kk * 0.35), 0, 0, TAU); ctx.fill();
          }
          break;
        }
      }
    }

    // Parts of a pending strike that are in the air (drawn above fighters).
    drawStrikeAir(ctx, s) {
      const k = 1 - s.t / s.max;
      switch (s.look) {
        case 'ult': PG.ULT.air(ctx, s, k, this.time, this); break;
        case 'fireblast': {
          const y = s.y - (1 - k) * 320, r = 14 + k * 12;
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, s.x, y, r * 2.4, '#ff6a00', 0.5);
          ctx.fillStyle = '#ff8c00'; ctx.beginPath(); ctx.arc(s.x, y, r, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(s.x, y, r * 0.5, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          if (Math.random() < 0.7) this.emit({ x: s.x + rand(-8, 8), y: y - r * 0.5, vx: rand(-20, 20), vy: -100, life: 0.3, size: r * 0.6, color: pick(['#ff4500', '#ffd23f']), add: true, grow: -20 });
          break;
        }
        case 'thunder': {
          const cy = s.y - 210;
          ctx.fillStyle = `rgba(40,40,60,${0.25 + k * 0.45})`;
          for (const [dx, dy, r] of [[-30, 0, 34], [0, -14, 42], [32, 2, 32], [10, 12, 30]]) { ctx.beginPath(); ctx.arc(s.x + dx, cy + dy, r, 0, TAU); ctx.fill(); }
          if (Math.random() < 0.25 + k * 0.4) {
            ctx.strokeStyle = 'rgba(248,208,48,0.8)'; ctx.lineWidth = 2;
            strokePts(ctx, zigzag(s.x + rand(-30, 30), cy + 20, s.x + rand(-40, 40), cy + 60, 4, 8));
          }
          break;
        }
        case 'sludge': {
          const px = s.ox + (s.x - s.ox) * k, py = s.oy + (s.y - s.oy) * k - Math.sin(Math.PI * k) * 140;
          const wob = 1 + Math.sin(this.time * 20) * 0.12;
          ctx.fillStyle = '#7a2f7a'; ctx.beginPath(); ctx.ellipse(px, py, 14 * wob, 14 / wob, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#d070d0'; ctx.beginPath(); ctx.arc(px - 4, py - 4, 5, 0, TAU); ctx.fill();
          if (Math.random() < 0.4) this.emit({ x: px, y: py + 8, vx: 0, vy: 0, life: 0.4, size: 3, color: '#a040a0', g: 500, drag: 0 });
          break;
        }
        case 'rockslide':
          for (const rk of s.rocks) {
            const kk = Math.max(0, Math.min(1, (k - rk.lag) / (1 - rk.lag)));
            if (kk <= 0) continue;
            drawRock(ctx, s.x + rk.dx, s.y + rk.dy - (1 - kk) * 340, rk.size, this.time * 4 + rk.dx, '#9b8a5a');
          }
          break;
      }
    }

    drawParticles(ctx) {
      for (const p of this.particles) {
        const a = Math.max(0, Math.min(1, p.life / p.max * 1.5));
        ctx.globalAlpha = a;
        if (p.add) ctx.globalCompositeOperation = 'lighter';
        drawParticle(ctx, p);
        if (p.add) ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }

    drawAnims(ctx) {
      for (const a of this.anims) drawAnim(ctx, a, 1 - a.t / a.max, this);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1;
    }

    drawFlash(ctx) {
      if (!this.flash) return;
      ctx.fillStyle = rgba(this.flash.color, this.flash.a);
      ctx.fillRect(-50, -50, ARENA_W + 100, ARENA_H + 100);
    }

    drawProjectile(ctx, pr) {
      drawProjectile(ctx, pr, this.time);
    }
  }

  // ---------- shape painters ----------
  function drawRock(ctx, x, y, size, rot, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, r = size * (0.75 + ((i * 37) % 10) / 40); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-size * 0.25, -size * 0.25, size * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawParticle(ctx, p) {
    const s = p.size;
    switch (p.shape) {
      case 'spark':
        ctx.strokeStyle = p.color; ctx.lineWidth = s;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
        break;
      case 'leaf':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,60,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke();
        ctx.restore();
        break;
      case 'feather':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.32, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(80,70,120,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-s * 1.2, 0); ctx.lineTo(s, 0); ctx.stroke();
        ctx.restore();
        break;
      case 'shard':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s * 1.3); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      case 'rock':
        drawRock(ctx, p.x, p.y, s, p.rot, p.color);
        break;
      case 'star':
        ctx.fillStyle = p.color; starPath(ctx, p.x, p.y, 4, s, s * 0.35, p.rot); ctx.fill();
        break;
      case 'bubble':
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.3, 0, TAU); ctx.fill();
        break;
      case 'smoke':
        ctx.fillStyle = rgba(p.color.length === 7 ? p.color : '#888888', 0.35);
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
        break;
      case 'wisp':
        ctx.fillStyle = rgba(p.color, 0.5);
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.stroke();
        break;
      case 'plus':
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - s / 2, p.y - s / 6, s, s / 3); ctx.fillRect(p.x - s / 6, p.y - s / 2, s / 3, s);
        break;
      case 'arrow': case 'arrowdown': {
        const d = p.shape === 'arrow' ? -1 : 1;
        ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x - s * 0.6, p.y - d * s * 0.3); ctx.lineTo(p.x, p.y + d * s * 0.3); ctx.lineTo(p.x + s * 0.6, p.y - d * s * 0.3); ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      default:
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
    }
  }

  // Beam body from the projectile back toward where it was fired.
  function beamTail(pr, len) {
    const sp = Math.hypot(pr.vx, pr.vy) || 1;
    const travelled = Math.hypot(pr.x - pr.ox, pr.y - pr.oy);
    const L = Math.min(travelled, len);
    return [pr.x - (pr.vx / sp) * L, pr.y - (pr.vy / sp) * L];
  }
  function beam(ctx, pr, len, layers) {
    const [tx, ty] = beamTail(pr, len);
    ctx.lineCap = 'round';
    for (const [w, c] of layers) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(pr.x, pr.y); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    return [tx, ty];
  }

  function drawProjectile(ctx, pr, time) {
    const s = pr.size, dir = Math.atan2(pr.vy, pr.vx), age = pr.age;
    switch (pr.look) {
      case 'fireblast': {
        // the five-armed "大" flame: head, two arms and two legs of fire around a white-hot core, spinning as it flies
        const fl = 1 + Math.sin(age * 30 + pr.seed) * 0.1, rot = age * 5;
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, pr.x, pr.y, s * 3.2, '#ff6a00', 0.55);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        const arms = [-Math.PI / 2, -Math.PI / 2 + 1.35, -Math.PI / 2 - 1.35, Math.PI / 2 - 0.55, Math.PI / 2 + 0.55];
        for (const [w, c] of [[s * 0.95, '#d93000'], [s * 0.6, '#ff8c1a'], [s * 0.28, '#fff3b0']]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath();
          for (const a of arms) { const L = s * 1.55 * fl * (a === arms[0] ? 0.85 : 1); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + Math.cos(a + rot) * L, pr.y + Math.sin(a + rot) * L); }
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(pr.x, pr.y, s * 0.32, 0, TAU); ctx.fill();
        break;
      }
      case 'fireball': case 'flame': case 'dragonfire': case 'dragonpulse': {
        const dragon = pr.look.startsWith('dragon');
        const [outer, mid, core] = dragon ? ['#7038f8', '#a070ff', '#e0d4ff'] : ['#ff6a00', '#ffa030', '#fff3b0'];
        const fl = 1 + Math.sin(age * 40 + pr.seed) * 0.12;
        // additive halo, but a normally-blended body so the colour still reads on bright floors
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, pr.x, pr.y, s * 2.4, outer, 0.45);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = mid; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, s * 1.2 * fl, s * 1.0 / fl, dir, 0, TAU); ctx.fill();
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(pr.x, pr.y, s * 0.55, 0, TAU); ctx.fill();
        if (pr.look === 'dragonpulse') {
          ctx.strokeStyle = rgba('#4fc3f7', 0.8); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(pr.x, pr.y, s * 1.7, s * 0.7, age * 8, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(pr.x, pr.y, s * 1.7, s * 0.7, -age * 8, 0, TAU); ctx.stroke();
        }
        break;
      }
      case 'droplet': {
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(dir);
        ctx.fillStyle = '#4a78e0';
        ctx.beginPath(); ctx.arc(0, 0, s, Math.PI / 2, -Math.PI / 2, true); ctx.quadraticCurveTo(-s * 1.2, -s * 0.6, -s * 2.6, 0); ctx.quadraticCurveTo(-s * 1.2, s * 0.6, 0, s); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(s * 0.2, -s * 0.35, s * 0.35, s * 0.2, 0, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'bubble': {
        const sp = Math.hypot(pr.vx, pr.vy) || 1, wob = Math.sin(age * 14 + pr.seed) * 7;
        const x = pr.x + (-pr.vy / sp) * wob, y = pr.y + (pr.vx / sp) * wob, r = s * (1 + Math.sin(age * 9) * 0.1);
        ctx.fillStyle = 'rgba(104,144,240,0.25)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); ctx.fill();
        break;
      }
      case 'jet': {
        // a long twisting torrent: two strands wobbling around each other, with a white core
        const [tx, ty] = beamTail(pr, 320);
        const dx = pr.x - tx, dy = pr.y - ty, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const [w, col, ph] of [[s * 2.4, 'rgba(36,84,200,0.5)', 0], [s * 1.2, 'rgba(96,160,255,0.9)', 0], [s * 1.0, 'rgba(120,180,255,0.9)', Math.PI], [s * 0.45, '#ffffff', 0], [s * 0.35, '#e6f4ff', Math.PI]]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
          for (let i = 0; i <= 20; i++) {
            const u = i / 20, wob = Math.sin(u * L / 55 - age * 22 + ph) * s * 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.15));
            ctx.lineTo(tx + dx * u + nx * wob, ty + dy * u + ny * wob);
          }
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const a = age * 10 + i * 1.6; ctx.beginPath(); ctx.arc(pr.x + Math.cos(a) * s * 0.8, pr.y + Math.sin(a) * s * 0.8, s * 0.3, 0, TAU); ctx.fill(); }
        break;
      }
      case 'leaf':
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(age * 18 + pr.seed);
        ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(0, 0, s * 1.6, s * 0.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8be06a'; ctx.beginPath(); ctx.ellipse(0, -s * 0.15, s * 1.3, s * 0.3, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#1f5f1f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-s * 1.6, 0); ctx.lineTo(s * 1.6, 0); ctx.stroke();
        ctx.restore();
        break;
      case 'drain':
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, pr.x, pr.y, s * 2, '#78c850', 0.6);
        ctx.fillStyle = '#c8ffb0'; ctx.beginPath(); ctx.arc(pr.x, pr.y, s * 0.6, 0, TAU); ctx.fill();
        for (let i = 0; i < 4; i++) { const a = age * 9 + (i / 4) * TAU; ctx.fillStyle = '#b6f08a'; ctx.beginPath(); ctx.arc(pr.x + Math.cos(a) * s * 1.4, pr.y + Math.sin(a) * s * 1.4, 2.5, 0, TAU); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'solar':
        ctx.globalCompositeOperation = 'lighter';
        beam(ctx, pr, 240, [[s * 1.8, 'rgba(255,245,157,0.35)'], [s * 1.0, 'rgba(255,245,157,0.7)'], [s * 0.4, '#ffffff']]);
        glow(ctx, pr.x, pr.y, s * 2, '#fff59d', 0.8);
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'hyperbeam':
        ctx.globalCompositeOperation = 'lighter';
        beam(ctx, pr, 300, [[s * 2.2, 'rgba(255,140,40,0.35)'], [s * 1.2, 'rgba(255,200,90,0.75)'], [s * 0.45, '#ffffff']]);
        glow(ctx, pr.x, pr.y, s * 2.4, '#ffb347', 0.85);
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'spark':
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, pr.x, pr.y, s * 2.2, '#f8d030', 0.7);
        ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; strokePts(ctx, zigzag(pr.x, pr.y, pr.x + Math.cos(a) * s * 2.2, pr.y + Math.sin(a) * s * 2.2, 3, 3)); }
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'bolt': {
        const [tx, ty] = beamTail(pr, 210);
        const pts = zigzag(tx, ty, pr.x, pr.y, 9, s * 1.1);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(248,208,48,0.55)'; ctx.lineWidth = s * 1.1; strokePts(ctx, pts);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.3; strokePts(ctx, pts);
        glow(ctx, pr.x, pr.y, s * 2.4, '#f8d030', 0.8);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineJoin = 'miter';
        break;
      }
      case 'icebeam': {
        ctx.globalCompositeOperation = 'lighter';
        beam(ctx, pr, 200, [[s * 1.4, 'rgba(152,216,216,0.45)'], [s * 0.5, '#e8ffff']]);
        ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(age * 5);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-s * 1.2, 0); ctx.lineTo(s * 1.2, 0); ctx.stroke(); }
        ctx.restore();
        break;
      }
      case 'aurora': {
        const [tx, ty] = beamTail(pr, 220);
        const g = ctx.createLinearGradient(tx, ty, pr.x, pr.y);
        for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsla(${(time * 240 + i * 70) % 360},90%,70%,0.85)`);
        ctx.lineCap = 'round';
        ctx.strokeStyle = g; ctx.lineWidth = s * 1.3;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(pr.x, pr.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = s * 0.35; ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'needle':
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(dir);
        ctx.strokeStyle = '#7a2f7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-s * 3.5, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = '#e8d0ff'; ctx.beginPath(); ctx.moveTo(s * 1.5, 0); ctx.lineTo(-s * 0.3, -s * 0.6); ctx.lineTo(-s * 0.3, s * 0.6); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      case 'glob': {
        const w = 1 + Math.sin(age * 22 + pr.seed) * 0.15;
        ctx.fillStyle = '#7a2f7a'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, s * 1.1 * w, s * 1.1 / w, dir, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c060c0'; ctx.beginPath(); ctx.ellipse(pr.x, pr.y, s * 0.8 * w, s * 0.7 / w, dir, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(pr.x - s * 0.3, pr.y - s * 0.3, s * 0.25, 0, TAU); ctx.fill();
        break;
      }
      case 'mud':
        drawRock(ctx, pr.x, pr.y, s * 1.05, age * 6, '#7a5a2e');
        ctx.fillStyle = 'rgba(60,40,15,0.6)'; ctx.beginPath(); ctx.arc(pr.x + s * 0.3, pr.y + s * 0.2, s * 0.35, 0, TAU); ctx.fill();
        break;
      case 'rock':
        drawRock(ctx, pr.x, pr.y, s * 1.05, age * 7 + pr.seed, '#b8a038');
        break;
      case 'edge':
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(dir);
        ctx.fillStyle = '#8f8270'; ctx.beginPath(); ctx.moveTo(s * 1.8, 0); ctx.lineTo(-s * 0.6, -s * 0.8); ctx.lineTo(-s * 1.2, 0); ctx.lineTo(-s * 0.6, s * 0.8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d6ccb8'; ctx.beginPath(); ctx.moveTo(s * 1.8, 0); ctx.lineTo(-s * 0.6, -s * 0.8); ctx.lineTo(-s * 0.2, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
        for (let i = 0; i < 3; i++) { const a = age * 10 + i * 2.1; drawRock(ctx, pr.x + Math.cos(a) * s * 1.5, pr.y + Math.sin(a) * s * 1.5, 3, a, '#b8a038'); }
        break;
      case 'wind': {
        ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(dir);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const sp = age * 14;
        ctx.beginPath(); ctx.arc(0, 0, s * 1.3, sp, sp + 2.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, s * 0.8, sp + Math.PI, sp + Math.PI + 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(200,190,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-s * 0.6, 0, s * 1.6, -0.9, 0.9); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.restore();
        break;
      }
      case 'psyring': case 'psybeam': {
        if (pr.look === 'psybeam') {
          const [tx, ty] = beamTail(pr, 200);
          const L = Math.hypot(pr.x - tx, pr.y - ty) || 1, ux = (pr.x - tx) / L, uy = (pr.y - ty) / L;
          for (const [col, ph] of [['#f85888', 0], ['#b070ff', Math.PI]]) {
            ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
            for (let d = 0; d <= L; d += 6) { const o = Math.sin(d / 14 - time * 20 + ph) * s * 0.7; ctx.lineTo(tx + ux * d - uy * o, ty + uy * d + ux * o); }
            ctx.stroke();
          }
        }
        for (let i = 0; i < 3; i++) {
          const k = (age * 2.5 + i / 3) % 1;
          ctx.strokeStyle = rgba('#f85888', 1 - k); ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, s * (0.4 + k * 1.4), 0, TAU); ctx.stroke();
        }
        ctx.fillStyle = '#ffb3d1'; ctx.beginPath(); ctx.arc(pr.x, pr.y, s * 0.45, 0, TAU); ctx.fill();
        break;
      }
      case 'signal': {
        const [tx, ty] = beamTail(pr, 190);
        const cols = ['#ff6b6b', '#6bc5ff', '#ffe66d'];
        ctx.lineCap = 'round'; ctx.lineWidth = s * 0.9;
        const L = Math.hypot(pr.x - tx, pr.y - ty) || 1, seg = 22, off = (time * 200) % (seg * 3);
        for (let d = -off, i = 0; d < L; d += seg, i++) {
          const a = Math.max(0, d), b = Math.min(L, d + seg - 6);
          if (b <= a) continue;
          ctx.strokeStyle = cols[i % 3];
          ctx.beginPath(); ctx.moveTo(tx + (pr.x - tx) * a / L, ty + (pr.y - ty) * a / L); ctx.lineTo(tx + (pr.x - tx) * b / L, ty + (pr.y - ty) * b / L); ctx.stroke();
        }
        ctx.lineCap = 'butt';
        glow(ctx, pr.x, pr.y, s * 1.8, '#ffffff', 0.7);
        break;
      }
      case 'shadow': {
        glow(ctx, pr.x, pr.y, s * 2.2, '#705898', 0.6);
        const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, s);
        g.addColorStop(0, '#0d0618'); g.addColorStop(0.7, '#3a2560'); g.addColorStop(1, '#8a6cc0');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pr.x, pr.y, s, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(200,170,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, s * 1.15, age * 6, age * 6 + 1.5); ctx.stroke();
        break;
      }
      case 'star':
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, pr.x, pr.y, s * 2, '#ffe66d', 0.5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffe66d'; starPath(ctx, pr.x, pr.y, 5, s * 1.4, s * 0.6, age * 10); ctx.fill();
        ctx.fillStyle = '#ffffff'; starPath(ctx, pr.x, pr.y, 5, s * 0.6, s * 0.25, age * 10); ctx.fill();
        break;
      default: {
        const col = typeColor(pr.move.type);
        ctx.fillStyle = rgba(col, 0.35);
        ctx.beginPath(); ctx.arc(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, s * 1.3, 0, TAU); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pr.x, pr.y, s, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(pr.x - s * 0.3, pr.y - s * 0.3, s * 0.35, 0, TAU); ctx.fill();
      }
    }
    ctx.lineWidth = 1;
  }

  // k: 0 -> 1 progress through the animation.
  function drawAnim(ctx, a, k, fx) {
    const fade = Math.min(1, (1 - k) * 3);
    switch (a.type) {
      case 'ult': PG.ULT.boom(ctx, a, k); break;
      case 'sig': PG.MOVEFX.draw(ctx, a, k); break;
      case 'crackweb': {
        // electricity crazing across the floor like cracked glass
        const R = seeded(a.seed), grow = Math.min(1, k * 4);
        ctx.lineJoin = 'round';
        for (let i = 0; i < 11; i++) {
          const ang = (i / 11) * TAU + R() * 0.4, len = a.r * (0.6 + R() * 0.5) * grow, pts = [[a.x, a.y]];
          for (let j = 1; j <= 5; j++) { const d = len * j / 5; pts.push([a.x + Math.cos(ang + (R() - 0.5) * 0.5) * d, a.y + Math.sin(ang + (R() - 0.5) * 0.5) * d * 0.6]); }
          ctx.strokeStyle = rgba('#f8d030', fade * 0.6); ctx.lineWidth = 4; strokePts(ctx, pts);
          ctx.strokeStyle = rgba('#ffffff', fade); ctx.lineWidth = 1.5; strokePts(ctx, pts);
        }
        ctx.strokeStyle = rgba('#fff7c0', fade * 0.7); ctx.lineWidth = 1.2;
        for (const q of [0.35, 0.65]) { ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * q * grow, a.r * q * 0.6 * grow, 0, 0, TAU); ctx.stroke(); }
        break;
      }
      case 'ring':
        ctx.strokeStyle = rgba(a.color, fade); ctx.lineWidth = a.width || 4;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r0 + (a.r1 - a.r0) * (1 - (1 - k) * (1 - k)), 0, TAU); ctx.stroke();
        break;
      case 'pow':
        ctx.fillStyle = rgba(a.color, fade); ctx.strokeStyle = rgba('#c03028', fade); ctx.lineWidth = 3;
        starPath(ctx, a.x, a.y, 8, 22 + k * 22, 10 + k * 10, 0.3); ctx.fill(); ctx.stroke();
        break;
      case 'slash': {
        const L = a.len * Math.min(1, k * 3);
        ctx.strokeStyle = rgba(a.color, fade); ctx.lineWidth = 6 * fade + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x - Math.cos(a.ang) * L / 2, a.y - Math.sin(a.ang) * L / 2); ctx.lineTo(a.x + Math.cos(a.ang) * L / 2, a.y + Math.sin(a.ang) * L / 2); ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'cross': {
        const L = 60 * Math.min(1, k * 3);
        ctx.lineCap = 'round';
        for (const [w, c] of [[12, rgba(a.color, fade)], [4, rgba('#ffffff', fade)]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(a.x - L, a.y - L); ctx.lineTo(a.x + L, a.y + L); ctx.moveTo(a.x + L, a.y - L); ctx.lineTo(a.x - L, a.y + L); ctx.stroke();
        }
        ctx.lineCap = 'butt';
        break;
      }
      case 'bolts':
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(a.color, fade); ctx.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) { const ang = Math.random() * TAU; strokePts(ctx, zigzag(a.x, a.y, a.x + Math.cos(ang) * a.r, a.y + Math.sin(ang) * a.r, 4, 8)); }
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'skybolt': {
        const pts = zigzag(a.x + rand(-20, 20), -20, a.x, a.y, 12, 26);
        ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(a.color, fade * 0.6); ctx.lineWidth = 16; strokePts(ctx, pts);
        ctx.strokeStyle = rgba('#ffffff', fade); ctx.lineWidth = 5; strokePts(ctx, pts);
        glow(ctx, a.x, a.y, 70, a.color, fade * 0.8);
        ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = 'miter';
        break;
      }
      case 'fivestar': {
        // the classic Fire Blast kanji-like five-armed blaze
        const r = a.r * Math.min(1, k * 2.5);
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [w, c] of [[26, rgba('#ff4500', fade * 0.8)], [14, rgba('#ffa030', fade)], [5, rgba('#fff3b0', fade)]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath();
          for (let i = 0; i < 5; i++) { const ang = -Math.PI / 2 + (i / 5) * TAU; ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.75); }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
        break;
      }
      case 'pillar': {
        const h = 220 * Math.min(1, k * 3);
        const g = ctx.createLinearGradient(a.x, a.y - h, a.x, a.y);
        g.addColorStop(0, rgba(a.color, 0)); g.addColorStop(1, rgba('#1a0f2e', 0.8 * fade));
        ctx.fillStyle = g; ctx.fillRect(a.x - a.r * 0.6, a.y - h, a.r * 1.2, h);
        break;
      }
      case 'shell': {
        const o = a.owner;
        ctx.strokeStyle = rgba(a.color, fade); ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU + k; ctx.beginPath(); ctx.arc(o.x, o.y, 44, ang, ang + 0.7); ctx.stroke(); }
        ctx.fillStyle = rgba('#ffffff', 0.25 * fade); ctx.beginPath(); ctx.arc(o.x, o.y, 44, 0, TAU); ctx.fill();
        break;
      }
      case 'soundwave':
        ctx.strokeStyle = rgba(a.color, fade * 0.9); ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const r = 40 + ((k * 260 + i * 60) % 220);
          ctx.beginPath(); ctx.arc(a.x, a.y, r, a.ang - 0.45, a.ang + 0.45); ctx.stroke();
        }
        break;
      case 'threads': {
        const t = a.target, o = a.owner, reach = Math.min(1, k * 2.5);
        ctx.strokeStyle = rgba('#ffffff', fade * 0.9); ctx.lineWidth = 1.5;
        for (let i = -2; i <= 2; i++) {
          const ex = o.x + (t.x - o.x) * reach + i * 6, ey = o.y + (t.y - o.y) * reach + i * 4;
          ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.quadraticCurveTo((o.x + ex) / 2, (o.y + ey) / 2 - 30 + i * 10, ex, ey); ctx.stroke();
        }
        if (reach >= 1) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const ang = (i / 6) * TAU; ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(ang) * 34, t.y + Math.sin(ang) * 34); } ctx.stroke(); ctx.beginPath(); ctx.arc(t.x, t.y, 18, 0, TAU); ctx.stroke(); }
        break;
      }
      case 'melee': drawMelee(ctx, a, k, fade); break;
      case 'area': drawArea(ctx, a, k, fade, fx); break;
    }
    ctx.lineWidth = 1;
  }

  function drawMelee(ctx, a, k, fade) {
    const { x, y, ang, color } = a;
    ctx.lineCap = 'round';
    switch (a.look) {
      case 'claw': {
        const L = 70 * Math.min(1, k * 3.5), dx = Math.cos(ang + 0.9), dy = Math.sin(ang + 0.9);
        const px = -dy, py = dx;
        for (let i = -1; i <= 1; i++) {
          const ox = x + px * i * 14, oy = y + py * i * 14;
          for (const [w, c] of [[7, rgba(color, fade)], [2.5, rgba('#ffffff', fade)]]) {
            ctx.strokeStyle = c; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(ox - dx * 35, oy - dy * 35); ctx.lineTo(ox - dx * 35 + dx * L, oy - dy * 35 + dy * L); ctx.stroke();
          }
        }
        break;
      }
      case 'fang': {
        const tint = { fire_fang: '#ff8c00', bug_bite: '#c8e060', leech_life: '#ff5a6e' }[a.id] || '#ffffff';
        const gap = 34 * Math.max(0, 1 - k * 1.8);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = rgba(tint, fade); ctx.strokeStyle = rgba('#333333', fade * 0.6); ctx.lineWidth = 1.5;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const tx = -30 + i * 15, by = side * (gap + 4);
            ctx.moveTo(tx - 7, by); ctx.lineTo(tx, by - side * 16); ctx.lineTo(tx + 7, by);
          }
          ctx.fill(); ctx.stroke();
          ctx.strokeStyle = rgba(color, fade); ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(0, side * (gap + 40), 42, side > 0 ? -Math.PI * 0.8 : Math.PI * 0.2, side > 0 ? -Math.PI * 0.2 : Math.PI * 0.8); ctx.stroke();
          ctx.strokeStyle = rgba('#333333', fade * 0.6); ctx.lineWidth = 1.5;
        }
        ctx.restore();
        break;
      }
      case 'chop': {
        // a blade-hand swooping down onto the target
        const sweep = -1.6 + k * 2.4;
        ctx.save(); ctx.translate(x, y - 10);
        for (const [w, c] of [[14, rgba(color, fade * 0.8)], [5, rgba('#ffffff', fade)]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.arc(0, -10, 50, Math.max(-Math.PI * 0.9, sweep - 1.2), sweep); ctx.stroke();
        }
        ctx.restore();
        if (k > 0.45) { ctx.fillStyle = rgba('#ffd84a', fade); starPath(ctx, x, y, 6, 26, 10, k); ctx.fill(); }
        break;
      }
      case 'kick': {
        const sweep = Math.PI * 0.15 + k * Math.PI * 0.7;
        ctx.save(); ctx.translate(x, y + 18); ctx.scale(1, 0.45);
        for (const [w, c] of [[16, rgba(color, fade * 0.8)], [5, rgba('#ffffff', fade)]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.arc(0, 0, 70, sweep - 1.4, sweep); ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'vine': {
        const ext = Math.sin(Math.min(1, k * 1.4) * Math.PI);
        const ex = a.fx + (x - a.fx) * Math.max(ext, k < 0.5 ? ext : 1), ey = a.fy + (y - a.fy) * Math.max(ext, k < 0.5 ? ext : 1);
        const nx = -(y - a.fy), ny = x - a.fx, nl = Math.hypot(nx, ny) || 1;
        const bend = Math.sin(k * Math.PI * 2) * 50;
        const cx = (a.fx + ex) / 2 + (nx / nl) * bend, cy = (a.fy + ey) / 2 + (ny / nl) * bend;
        for (const [w, c] of [[8, rgba('#1f5f1f', fade)], [5, rgba('#4caf50', fade)]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(a.fx, a.fy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
        }
        ctx.fillStyle = rgba('#8be06a', fade);
        ctx.beginPath(); ctx.ellipse(ex, ey, 9, 4, ang, 0, TAU); ctx.fill();
        if (a.connected && k > 0.4 && k < 0.7) { ctx.fillStyle = rgba('#ffffff', fade); starPath(ctx, x, y, 4, 18, 5, 0); ctx.fill(); }
        break;
      }
      case 'wing': {
        ctx.save(); ctx.translate(a.fx, a.fy); ctx.rotate(ang);
        const sweep = -1.2 + k * 2.4, R = Math.hypot(x - a.fx, y - a.fy);
        for (let i = 0; i < 6; i++) {
          const fa = sweep - i * 0.16;
          if (fa < -1.2) continue;
          ctx.save(); ctx.rotate(fa); ctx.translate(R * 0.75, 0); ctx.rotate(Math.PI / 2);
          ctx.fillStyle = rgba(i % 2 ? '#ffffff' : '#d9ccff', fade * (1 - i * 0.12));
          ctx.beginPath(); ctx.ellipse(0, 0, 22, 7, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        break;
      }
      case 'tongue': {
        const ext = Math.sin(k * Math.PI);
        const ex = a.fx + (x - a.fx) * ext, ey = a.fy + (y - a.fy) * ext;
        const cx = (a.fx + ex) / 2, cy = (a.fy + ey) / 2 - 30 * ext;
        ctx.strokeStyle = rgba('#d04878', fade); ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(a.fx, a.fy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke();
        ctx.strokeStyle = rgba('#ff8fb8', fade); ctx.lineWidth = 6; ctx.stroke();
        break;
      }
      default: { // tackle: a body-blow shockwave
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = rgba('#ffffff', fade); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(-20, 0, 20 + k * 30, -0.9, 0.9); ctx.stroke();
        ctx.strokeStyle = rgba(color, fade); ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) { const la = i * 0.35; ctx.beginPath(); ctx.moveTo(Math.cos(la) * 20, Math.sin(la) * 20); ctx.lineTo(Math.cos(la) * (30 + k * 30), Math.sin(la) * (30 + k * 30)); ctx.stroke(); }
        ctx.restore();
      }
    }
    ctx.lineCap = 'butt';
  }

  function drawArea(ctx, a, k, fade, fx) {
    const { x, y, r, color } = a;
    const ease = 1 - (1 - k) * (1 - k);
    switch (a.look) {
      case 'firespin': {
        ctx.globalCompositeOperation = 'lighter';
        for (let ring = 0; ring < 2; ring++) {
          const rr = r * (0.55 + ring * 0.45) * ease;
          for (let i = 0; i < 20; i++) {
            const ang = (i / 20) * TAU + fx.time * (ring ? 5 : -7);
            const fxp = x + Math.cos(ang) * rr, fyp = y + Math.sin(ang) * rr * 0.8;
            ctx.fillStyle = rgba(i % 2 ? '#ff8c00' : '#ffd23f', fade * 0.85);
            ctx.beginPath(); ctx.moveTo(fxp - 7, fyp); ctx.quadraticCurveTo(fxp, fyp - 30, fxp + 7, fyp); ctx.fill();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'wave': {
        const rr = r * ease;
        ctx.fillStyle = rgba('#4a78e0', 0.35 * fade);
        ctx.strokeStyle = rgba('#4a78e0', 0.8 * fade); ctx.lineWidth = 20;
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) { const ang = (i / 48) * TAU; const w = rr + Math.sin(ang * 8 + fx.time * 10) * 5; ctx.lineTo(x + Math.cos(ang) * w, y + Math.sin(ang) * w * 0.8); }
        ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', 0.9 * fade); ctx.lineWidth = 4; ctx.stroke();
        break;
      }
      case 'quake': {
        ctx.strokeStyle = rgba('#e8dcc0', fade * 0.8); ctx.lineWidth = 10;
        for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(x, y + 20, r * Math.min(1, ease * (1.2 - i * 0.3)), r * 0.6 * Math.min(1, ease * (1.2 - i * 0.3)), 0, 0, TAU); ctx.stroke(); }
        break;
      }
      case 'hurricane': {
        ctx.lineCap = 'round';
        for (let arm = 0; arm < 3; arm++) {
          ctx.strokeStyle = rgba(arm % 2 ? '#ffffff' : '#d9ccff', fade * 0.85); ctx.lineWidth = 5;
          ctx.beginPath();
          for (let i = 0; i <= 30; i++) {
            const t = i / 30, ang = arm * (TAU / 3) + t * 5 + fx.time * 9, rr = r * ease * t;
            ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8);
          }
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        break;
      }
      default:
        ctx.strokeStyle = rgba(color, fade); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(x, y, r * ease, 0, TAU); ctx.stroke();
    }
  }

  // Tag every move with its id so looks can be keyed by move.
  for (const [id, m] of Object.entries(PG.MOVES)) m.id = id;

  // ---------- live arena decor ----------
  // Precomputed (seeded) decor for each arena; drawLive animates it every frame.
  function buildLive(theme, arena, stadium) {
    const R = seeded(hashStr(theme + ':live'));
    const isGym = theme.startsWith('gym:'), type = isGym ? theme.slice(4) : null;
    const L = { name: arena.name, type, items: [] };
    const rand = (a, b) => a + R() * (b - a);
    if (!stadium && (isGym || arena.name === 'league')) {
      L.crowd = [];
      const cols = ['#e2524a', '#3d7be0', '#f5b800', '#7be07b', '#b28cff', '#ffffff', '#ff9ec7', '#6bc5ff'];
      for (let row = 0; row < 3; row++) for (let x = 8 + row * 6; x < ARENA_W; x += 13 + R() * 5) {
        L.crowd.push({ x, y: 13 + row * 11, c: cols[Math.floor(R() * cols.length)], ph: R() * 6, sp: 3 + R() * 3, sign: R() < 0.12 });
      }
      L.banners = [];
      for (let i = 0; i < 7; i++) L.banners.push({ x: 70 + i * ((ARENA_W - 140) / 6), ph: R() * 6 });
    }
    const edge = (n, f) => { for (let i = 0; i < n; i++) f(i); };
    switch (isGym ? type : arena.name) {
      // ---- outdoor arenas ----
      case 'meadow': case 'plaza':
        edge(70, () => L.items.push({ k: 'blade', x: R() * ARENA_W, y: R() < 0.5 ? rand(14, 30) : rand(ARENA_H - 22, ARENA_H - 8), h: rand(10, 20), ph: R() * 6, c: R() < 0.5 ? '#3f8f3d' : '#6cbf54' }));
        edge(8, () => L.items.push({ k: 'bush', x: R() < 0.5 ? rand(10, 60) : rand(ARENA_W - 60, ARENA_W - 10), y: rand(60, ARENA_H - 60), r: rand(18, 30), ph: R() * 6 }));
        break;
      case 'forest':
        edge(5, (i) => L.items.push({ k: 'ray', x: 120 + i * 170 + rand(-40, 40), w: rand(40, 80), ph: R() * 6 }));
        edge(50, () => L.items.push({ k: 'blade', x: R() * ARENA_W, y: R() < 0.5 ? rand(18, 34) : rand(ARENA_H - 24, ARENA_H - 10), h: rand(10, 18), ph: R() * 6, c: '#2f6b33' }));
        break;
      case 'beach':
        L.items.push({ k: 'waves' });
        break;
      case 'lake':
        L.items.push({ k: 'lakeshine' });
        edge(16, () => L.items.push({ k: 'reed', x: R() * ARENA_W, y: ARENA_H - rand(26, 34), h: rand(18, 30), ph: R() * 6 }));
        break;
      case 'mountain':
        edge(7, () => L.items.push({ k: 'crag', x: R() < 0.5 ? rand(0, 40) : rand(ARENA_W - 40, ARENA_W), y: rand(40, ARENA_H - 30), r: rand(20, 36) }));
        break;
      case 'ocean':
        // floating Poké Ball rafts, bobbing buoys and foam streaks drifting past
        for (const [x, y, r] of [[118, 92, 54], [ARENA_W - 128, ARENA_H - 86, 60], [ARENA_W - 104, 74, 38]]) L.items.push({ k: 'raft', x, y, r, ph: R() * 6 });
        edge(7, (i) => L.items.push({ k: 'buoy', x: rand(40, ARENA_W - 40), y: i % 2 ? rand(30, 110) : rand(ARENA_H - 110, ARENA_H - 30), ph: R() * 6 }));
        edge(28, () => L.items.push({ k: 'streak', x: R() * ARENA_W, y: R() * ARENA_H, w: rand(14, 44), sp: rand(12, 34) }));
        break;
      // ---- gyms by type ----
      case 'fire': {
        // glowing lava pools hugging the edges, clear of the fighting lanes
        edge(6, (i) => L.items.push({ k: 'lava', x: i < 3 ? rand(40, 110) : rand(ARENA_W - 110, ARENA_W - 40), y: 120 + (i % 3) * rand(110, 140), rx: rand(26, 40), ry: rand(12, 18), ph: R() * 6 }));
        edge(4, (i) => L.items.push({ k: 'torch', x: i < 2 ? 26 : ARENA_W - 26, y: i % 2 ? ARENA_H - 40 : 80 }));
        break;
      }
      case 'water':
        // floating Poké Ball rafts, bobbing buoys and foam streaks drifting past
        for (const [x, y, r] of [[118, 92, 54], [ARENA_W - 128, ARENA_H - 86, 60], [ARENA_W - 104, 74, 38]]) L.items.push({ k: 'raft', x, y, r, ph: R() * 6 });
        edge(7, (i) => L.items.push({ k: 'buoy', x: rand(40, ARENA_W - 40), y: i % 2 ? rand(30, 110) : rand(ARENA_H - 110, ARENA_H - 30), ph: R() * 6 }));
        edge(28, () => L.items.push({ k: 'streak', x: R() * ARENA_W, y: R() * ARENA_H, w: rand(14, 44), sp: rand(12, 34) }));
        break;
      case 'electric': {
        edge(8, () => { const pts = [[R() < 0.5 ? 0 : ARENA_W, rand(70, ARENA_H - 20)]]; for (let k = 0; k < 5; k++) { const [x, y] = pts[pts.length - 1]; pts.push(k % 2 ? [x, y + rand(-80, 80)] : [x + (x < ARENA_W / 2 ? 1 : -1) * rand(50, 140), y]); } L.items.push({ k: 'circuit', pts, ph: R() }); });
        break;
      }
      case 'ice':
        edge(40, () => L.items.push({ k: 'sparkle', x: R() * ARENA_W, y: rand(60, ARENA_H - 10), ph: R() * 6 }));
        edge(8, () => L.items.push({ k: 'frost', x: R() * ARENA_W, y: rand(70, ARENA_H - 20), r: rand(30, 70) }));
        break;
      case 'ghost': case 'dark':
        edge(10, () => L.items.push({ k: 'fog', x: R() * ARENA_W, y: rand(70, ARENA_H), r: rand(70, 140), sp: rand(6, 16), ph: R() * 6 }));
        edge(6, (i) => L.items.push({ k: 'candle', x: i < 3 ? 20 : ARENA_W - 20, y: 90 + (i % 3) * 170, ph: R() * 6 }));
        break;
      case 'poison':
        edge(4, (i) => L.items.push({ k: 'vat', x: i % 2 ? ARENA_W - 40 : 40, y: i < 2 ? 90 : ARENA_H - 50, ph: R() * 6 }));
        break;
      case 'psychic':
        L.items.push({ k: 'runes' });
        break;
      case 'grass': case 'bug':
        edge(10, (i) => L.items.push({ k: 'planter', x: i < 5 ? 18 : ARENA_W - 18, y: 80 + (i % 5) * 100, ph: R() * 6 }));
        break;
      case 'steel':
        edge(4, (i) => L.items.push({ k: 'gear', x: i % 2 ? ARENA_W - 34 : 34, y: i < 2 ? 88 : ARENA_H - 40, r: rand(22, 30), dir: i % 2 ? 1 : -1 }));
        break;
      case 'flying':
        edge(5, () => L.items.push({ k: 'cloud', y: rand(80, ARENA_H - 60), sp: rand(18, 40), ph: R() * ARENA_W, r: rand(60, 110) }));
        break;
      case 'dragon':
        edge(4, (i) => L.items.push({ k: 'torch', x: i < 2 ? 26 : ARENA_W - 26, y: i % 2 ? ARENA_H - 40 : 80, col: '#b28cff' }));
        edge(2, (i) => L.items.push({ k: 'statue', x: i ? ARENA_W - 60 : 60, y: ARENA_H / 2 }));
        break;
      case 'ground': case 'rock':
        edge(6, () => L.items.push({ k: 'crag', x: R() < 0.5 ? rand(0, 40) : rand(ARENA_W - 40, ARENA_W), y: rand(70, ARENA_H - 30), r: rand(18, 30) }));
        break;
      case 'fighting':
        L.items.push({ k: 'mats' });
        break;
    }
    if (arena.name === 'league') L.items.push({ k: 'pyro' });
    return L;
  }

  function drawLive(ctx, L, t, fx) {
    for (const it of L.items) {
      switch (it.k) {
        case 'blade': {
          const sw = Math.sin(t * 2 + it.ph) * 3;
          ctx.strokeStyle = it.c; ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.quadraticCurveTo(it.x + sw * 0.4, it.y - it.h * 0.6, it.x + sw, it.y - it.h); ctx.stroke();
          ctx.lineCap = 'butt';
          break;
        }
        case 'bush': {
          const b = Math.sin(t * 1.5 + it.ph) * 1.5;
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + it.r * 0.7, it.r, it.r * 0.35, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3f8f3d'; ctx.beginPath(); ctx.arc(it.x + b, it.y, it.r, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5aae4c'; ctx.beginPath(); ctx.arc(it.x - it.r * 0.3 + b, it.y - it.r * 0.3, it.r * 0.6, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.arc(it.x + it.r * 0.3 + b, it.y - it.r * 0.2, 3, 0, TAU); ctx.arc(it.x - it.r * 0.1 + b, it.y + it.r * 0.3, 3, 0, TAU); ctx.fill();
          break;
        }
        case 'ray': {
          const a = 0.07 + 0.05 * Math.sin(t * 0.6 + it.ph);
          const g = ctx.createLinearGradient(it.x, 0, it.x + 160, ARENA_H);
          g.addColorStop(0, `rgba(255,250,200,${a})`); g.addColorStop(1, 'rgba(255,250,200,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(it.x, 0); ctx.lineTo(it.x + it.w, 0); ctx.lineTo(it.x + it.w + 200, ARENA_H); ctx.lineTo(it.x + 200, ARENA_H); ctx.closePath(); ctx.fill();
          break;
        }
        case 'waves': {
          for (let i = 0; i < 2; i++) {
            const k = (t * 0.25 + i * 0.5) % 1, y = 22 + Math.sin(k * Math.PI) * 18;
            ctx.strokeStyle = `rgba(255,255,255,${0.7 * Math.sin(k * Math.PI)})`; ctx.lineWidth = 3;
            ctx.beginPath(); for (let x = 0; x <= ARENA_W; x += 15) ctx.lineTo(x, y + Math.sin(x / 55 + i) * 8); ctx.stroke();
          }
          break;
        }
        case 'lakeshine': {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
          for (let i = 0; i < 10; i++) { const x = ((i * 97 + t * 20) % (ARENA_W + 60)) - 30, y = ARENA_H - 18 + Math.sin(t * 2 + i) * 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke(); }
          break;
        }
        case 'reed': {
          const sw = Math.sin(t * 1.8 + it.ph) * 3;
          ctx.strokeStyle = '#4f7d36'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(it.x, it.y + it.h); ctx.quadraticCurveTo(it.x + sw * 0.5, it.y + it.h * 0.4, it.x + sw, it.y); ctx.stroke();
          ctx.fillStyle = '#7a5530'; ctx.beginPath(); ctx.ellipse(it.x + sw, it.y + 4, 2.5, 6, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'crag': {
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(it.x + 4, it.y + it.r * 0.6, it.r, it.r * 0.35, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#7d715e'; ctx.beginPath(); ctx.moveTo(it.x - it.r, it.y + it.r * 0.5); ctx.lineTo(it.x - it.r * 0.5, it.y - it.r * 0.6); ctx.lineTo(it.x + it.r * 0.2, it.y - it.r); ctx.lineTo(it.x + it.r, it.y + it.r * 0.5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(it.x - it.r * 0.5, it.y - it.r * 0.6); ctx.lineTo(it.x + it.r * 0.2, it.y - it.r); ctx.lineTo(it.x, it.y - it.r * 0.2); ctx.closePath(); ctx.fill();
          break;
        }
        case 'streak': {
          const x = ((it.x + t * it.sp) % (ARENA_W + 60)) - 30;
          ctx.fillStyle = 'rgba(225,238,255,0.55)'; ctx.fillRect(x, it.y, it.w, 2);
          break;
        }
        case 'raft': {
          const b = Math.sin(t * 1.6 + it.ph) * 2, x = it.x, y = it.y + b, rx = it.r, ry = it.r * 0.55;
          ctx.strokeStyle = 'rgba(200,225,255,0.35)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(x, it.y + 8, rx * 1.18 + Math.sin(t * 2 + it.ph) * 3, ry * 1.2, 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(8,24,60,0.4)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 9, rx, ry, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#6b4426'; ctx.beginPath(); ctx.ellipse(x, y + 5, rx, ry, 0, 0, TAU); ctx.fill();   // side of the raft
          ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
          ctx.fillStyle = '#9a6a3c'; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
          for (let py = y - ry; py < y + ry; py += 8) { ctx.fillStyle = '#b07d4a'; ctx.fillRect(x - rx, py, rx * 2, 5); ctx.fillStyle = '#6b4426'; ctx.fillRect(x - rx, py + 6, rx * 2, 1.5); }
          ctx.strokeStyle = 'rgba(240,215,180,0.7)'; ctx.lineWidth = 2;   // Poké Ball emblem
          ctx.beginPath(); ctx.ellipse(x, y, rx * 0.36, ry * 0.36, 0, 0, TAU); ctx.moveTo(x - rx * 0.36, y); ctx.lineTo(x + rx * 0.36, y); ctx.stroke();
          ctx.fillStyle = 'rgba(240,215,180,0.7)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 3, 0, 0, TAU); ctx.fill();
          ctx.restore();
          for (let i = 0; i < 22; i++) {                     // red-and-white checked rim
            ctx.strokeStyle = i % 2 ? '#ffffff' : '#d93a3a'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.ellipse(x, y, rx - 2, ry - 2, 0, (i / 22) * TAU, ((i + 1) / 22) * TAU); ctx.stroke();
          }
          break;
        }
        case 'buoy': {
          const b = Math.sin(t * 2.2 + it.ph) * 2.5, x = it.x, y = it.y + b;
          ctx.strokeStyle = 'rgba(200,225,255,0.4)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(x, it.y + 6, 11 + Math.sin(t * 3 + it.ph) * 2, 4, 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
          ctx.fillStyle = '#d93a3a'; ctx.beginPath(); ctx.arc(x, y, 7, Math.PI, 0); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x - 4, y - 5, 2, 2);
          break;
        }
        case 'swell': {
          ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
          for (let i = 0; i < 6; i++) { const y = ((i * 100 + t * 25) % (ARENA_H + 40)) - 20; ctx.beginPath(); for (let x = 0; x <= ARENA_W; x += 14) ctx.lineTo(x, y + Math.sin(x / 50 + t + i) * 7); ctx.stroke(); }
          break;
        }
        case 'lava': {
          const a = 0.7 + 0.3 * Math.sin(t * 2.2 + it.ph);
          ctx.fillStyle = 'rgba(40,14,6,0.75)';                       // scorched rocky rim
          ctx.beginPath(); ctx.ellipse(it.x, it.y, it.rx + 7, it.ry + 5, 0, 0, Math.PI * 2); ctx.fill();
          const g = ctx.createRadialGradient(it.x, it.y, 2, it.x, it.y, it.rx);
          g.addColorStop(0, `rgba(255,236,150,${a})`); g.addColorStop(0.45, `rgba(255,140,30,${a})`); g.addColorStop(1, 'rgba(190,40,10,0.95)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(it.x, it.y, it.rx, it.ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.globalCompositeOperation = 'lighter';       // heat glow
          ctx.fillStyle = `rgba(255,100,20,${0.12 * a})`;
          ctx.beginPath(); ctx.ellipse(it.x, it.y, it.rx * 1.8, it.ry * 2.2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          const b = (t * 0.7 + it.ph) % 1;                             // a bubble that swells and pops
          ctx.strokeStyle = `rgba(255,230,160,${0.8 * (1 - b)})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(it.x + Math.sin(it.ph * 7) * it.rx * 0.4, it.y, 2 + b * 5, 0, Math.PI * 2); ctx.stroke();
          if (Math.random() < 0.03) fx.emit({ x: it.x + (Math.random() - 0.5) * it.rx, y: it.y, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 40, life: 1, size: 2.5, color: pick(['#ff8c00', '#ffd23f']), add: true, drag: 0.5 });
          break;
        }
        case 'torch': {
          const fl = 1 + Math.sin(t * 13 + it.x) * 0.15, col = it.col || '#ff8c00';
          ctx.fillStyle = '#3a3040'; ctx.fillRect(it.x - 4, it.y, 8, 22);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          glow(ctx, it.x, it.y - 6, 40, col, 0.45);
          ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(it.x, it.y - 6, 7 * fl, 13 * fl, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.ellipse(it.x, it.y - 3, 3, 6 * fl, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case 'lane':
          ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 20;
          ctx.beginPath(); ctx.moveTo(14, it.y); ctx.lineTo(ARENA_W - 14, it.y); ctx.stroke(); ctx.setLineDash([]);
          break;
        case 'ripple': {
          const k = (t * 0.4 + it.ph) % 1;
          ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - k)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(it.x, it.y, 6 + k * 50, (6 + k * 50) * 0.5, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'circuit': {
          ctx.strokeStyle = 'rgba(30,30,0,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); it.pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.stroke();
          ctx.strokeStyle = 'rgba(248,208,48,0.35)'; ctx.lineWidth = 2; ctx.stroke();
          // a pulse travelling along the line
          let total = 0; const segs = [];
          for (let i = 1; i < it.pts.length; i++) { const d = Math.hypot(it.pts[i][0] - it.pts[i - 1][0], it.pts[i][1] - it.pts[i - 1][1]); segs.push(d); total += d; }
          let pos = ((t * 0.35 + it.ph) % 1) * total;
          for (let i = 1; i < it.pts.length; i++) {
            if (pos <= segs[i - 1]) { const k = pos / segs[i - 1]; const x = it.pts[i - 1][0] + (it.pts[i][0] - it.pts[i - 1][0]) * k, y = it.pts[i - 1][1] + (it.pts[i][1] - it.pts[i - 1][1]) * k; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 14, '#f8d030', 0.9); ctx.restore(); break; }
            pos -= segs[i - 1];
          }
          break;
        }
        case 'sparkle': {
          const tw = Math.pow(Math.max(0, Math.sin(t * 2.5 + it.ph)), 8);
          if (tw > 0.05) { ctx.fillStyle = `rgba(255,255,255,${tw})`; ctx.fillRect(it.x - 4, it.y - 0.75, 8, 1.5); ctx.fillRect(it.x - 0.75, it.y - 4, 1.5, 8); }
          break;
        }
        case 'frost': {
          const g = ctx.createRadialGradient(it.x, it.y, 2, it.x, it.y, it.r);
          g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(it.x, it.y, it.r, it.r * 0.6, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'fog': {
          const x = ((it.x + t * it.sp) % (ARENA_W + it.r * 2)) - it.r;
          const g = ctx.createRadialGradient(x, it.y, 4, x, it.y, it.r);
          g.addColorStop(0, `rgba(170,150,210,${0.12 + 0.05 * Math.sin(t + it.ph)})`); g.addColorStop(1, 'rgba(170,150,210,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, it.y, it.r, it.r * 0.45, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'candle': {
          const fl = 1 + Math.sin(t * 11 + it.ph) * 0.2;
          ctx.fillStyle = '#e8e0d0'; ctx.fillRect(it.x - 4, it.y, 8, 16);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          glow(ctx, it.x, it.y - 4, 30, '#b28cff', 0.4);
          ctx.fillStyle = '#c9b0ff'; ctx.beginPath(); ctx.ellipse(it.x, it.y - 4, 3 * fl, 7 * fl, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case 'vat': {
          ctx.fillStyle = '#3a2a40'; roundRectPath(ctx, it.x - 24, it.y - 10, 48, 30, 6); ctx.fill();
          ctx.fillStyle = '#8a3a9a'; ctx.beginPath(); ctx.ellipse(it.x, it.y - 8, 22, 7, 0, 0, TAU); ctx.fill();
          for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3 + it.ph) % 1; ctx.strokeStyle = `rgba(220,150,240,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x - 10 + i * 10, it.y - 10 - k * 14, 2 + k * 4, 0, TAU); ctx.stroke(); }
          break;
        }
        case 'runes': {
          ctx.save(); ctx.translate(ARENA_W / 2, ARENA_H / 2 + 10);
          ctx.strokeStyle = `rgba(248,88,136,${0.35 + 0.15 * Math.sin(t * 2)})`; ctx.lineWidth = 3;
          ctx.rotate(t * 0.3); ctx.beginPath(); ctx.arc(0, 0, 130, 0, TAU); ctx.stroke();
          ctx.font = 'bold 18px system-ui'; ctx.fillStyle = 'rgba(255,180,220,0.55)'; ctx.textAlign = 'center';
          for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i / 12 * TAU); ctx.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'[i], 0, -138); ctx.restore(); }
          ctx.rotate(-t * 0.7); ctx.strokeStyle = 'rgba(248,88,136,0.3)'; ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * TAU; ctx.lineTo(Math.cos(a) * 90, Math.sin(a) * 90); } ctx.stroke();
          ctx.restore();
          break;
        }
        case 'planter': {
          const sw = Math.sin(t * 1.6 + it.ph) * 2;
          ctx.fillStyle = '#6b4a2a'; ctx.fillRect(it.x - 12, it.y, 24, 18);
          ctx.fillStyle = '#3f8f3d';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(it.x - 8 + i * 5 + sw, it.y - 6 - (i % 2) * 5, 5, 9, (i - 1.5) * 0.4, 0, TAU); ctx.fill(); }
          break;
        }
        case 'gear': {
          ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(t * 0.8 * it.dir);
          ctx.fillStyle = '#8a92a6';
          ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = i % 2 ? it.r : it.r + 7; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#5d6577'; ctx.beginPath(); ctx.arc(0, 0, it.r * 0.45, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        }
        case 'cloud': {
          const x = ((it.ph + t * it.sp) % (ARENA_W + it.r * 3)) - it.r * 1.5;
          ctx.fillStyle = 'rgba(30,40,70,0.12)';
          ctx.beginPath(); ctx.ellipse(x, it.y, it.r, it.r * 0.4, 0, 0, TAU); ctx.ellipse(x + it.r * 0.6, it.y + 10, it.r * 0.6, it.r * 0.3, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'statue': {
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(it.x + 4, it.y + 40, 26, 8, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5a4a7a'; roundRectPath(ctx, it.x - 18, it.y + 10, 36, 30, 4); ctx.fill();
          ctx.fillStyle = '#7a6a9a';
          ctx.beginPath(); ctx.moveTo(it.x - 14, it.y + 12); ctx.quadraticCurveTo(it.x - 20, it.y - 30, it.x, it.y - 44); ctx.quadraticCurveTo(it.x + 10, it.y - 30, it.x + 4, it.y - 20); ctx.lineTo(it.x + 16, it.y + 12); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(it.x + 2, it.y - 36, 2.5, 0, TAU); ctx.fill();
          break;
        }
        case 'mats':
          ctx.strokeStyle = 'rgba(80,40,20,0.35)'; ctx.lineWidth = 3;
          for (let x = 60; x < ARENA_W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 52); ctx.lineTo(x, ARENA_H - 10); ctx.stroke(); }
          for (let y = 140; y < ARENA_H; y += 120) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(ARENA_W - 10, y); ctx.stroke(); }
          break;
        case 'pyro': {
          for (const sx of [40, ARENA_W - 40]) for (const sy of [70, ARENA_H - 30]) {
            if ((Math.floor(t * 1.3 + sx) % 4) === 0 || fx.cheerT > 0.5) {
              ctx.save(); ctx.globalCompositeOperation = 'lighter';
              const fl = 0.8 + Math.random() * 0.4;
              ctx.fillStyle = 'rgba(255,140,40,0.65)'; ctx.beginPath(); ctx.ellipse(sx, sy - 22 * fl, 8, 24 * fl, 0, 0, TAU); ctx.fill();
              ctx.fillStyle = 'rgba(255,240,180,0.8)'; ctx.beginPath(); ctx.ellipse(sx, sy - 14 * fl, 4, 12 * fl, 0, 0, TAU); ctx.fill();
              ctx.restore();
            }
          }
          break;
        }
      }
    }
    ctx.lineWidth = 1;
    // crowd in the stands: they bob, and jump with arms up when they cheer
    if (L.crowd) {
      const ch = Math.min(1, fx.cheerT);
      for (const c of L.crowd) {
        const bob = Math.abs(Math.sin(t * c.sp + c.ph)) * (1.2 + ch * 5);
        const y = c.y - bob;
        ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(c.x, y + 6, 4.2, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(c.x, y, 3, 0, TAU); ctx.fill();
        if (ch > 0.15 && Math.sin(c.ph * 7) > -0.3) { ctx.strokeStyle = '#e8c4a0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c.x - 3, y + 3); ctx.lineTo(c.x - 6, y - 5); ctx.moveTo(c.x + 3, y + 3); ctx.lineTo(c.x + 6, y - 5); ctx.stroke(); }
        if (c.sign) { ctx.fillStyle = fx.arena.accent; ctx.fillRect(c.x - 7, y - 12 - bob, 14, 7); }
      }
      // banners hanging from the stands
      for (const b of L.banners) {
        const sw = Math.sin(t * 2 + b.ph) * 4;
        ctx.fillStyle = fx.arena.accent;
        ctx.beginPath(); ctx.moveTo(b.x - 12, 44); ctx.lineTo(b.x + 12, 44); ctx.lineTo(b.x + sw * 0.6, 74); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(b.x + sw * 0.2, 54, 4, 0, TAU); ctx.fill();
      }
      ctx.lineWidth = 1;
    }
  }

  function roundRectPath(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  PG.BattleFx = BattleFx;
  PG.FXH = { rgba, glow, zigzag, strokePts, starPath, drawRock, seeded };   // shared with ults.js
  PG.ARENA = { W: ARENA_W, H: ARENA_H };
})();
