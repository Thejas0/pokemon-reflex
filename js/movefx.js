// Signature hit animations: every damaging move plays its own effect around the target when it lands
// (Hydro Pump's water whips, Crunch's jaws, Thunderbolt's lightning cage...). Built from a small set of
// drawing pieces, each tuned per move. Purely cosmetic.
(function () {
  const TAU = Math.PI * 2;
  const H = () => PG.FXH;
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const col = (c, a) => H().rgba(c, a);

  // Colour sets reused by several moves
  const C = {
    water: ['#2f6fe0', '#7fb6ff', '#ffffff'], fire: ['#ff4500', '#ff9a1f', '#fff0a0'], leaf: ['#3f9a3c', '#7ccf5a', '#d8ffb0'],
    volt: ['#f8d030', '#fff7b0', '#ffffff'], ice: ['#7fd8f0', '#c9f6ff', '#ffffff'], poison: ['#8a3aa8', '#c070e0', '#f0c0ff'],
    earth: ['#7a5a30', '#b8904f', '#e8d0a0'], air: ['#c8d8ff', '#ffffff', '#9fb4ff'], psy: ['#f85888', '#ffb3d1', '#ffffff'],
    bug: ['#8aa020', '#c8e040', '#f0ffa0'], rock: ['#8a7d60', '#b8a878', '#e0d4b0'], ghost: ['#4a2f78', '#8a6cc8', '#e0d0ff'],
    dragon: ['#5a2fd8', '#9a70ff', '#e0d4ff'], dark: ['#1e1626', '#5a4070', '#c0a8e0'], steel: ['#8a94b0', '#c8d0e8', '#ffffff'],
    plain: ['#b8b8a0', '#ffffff', '#fff4c0'], fight: ['#c03028', '#ff9a5a', '#fff0d0'], pink: ['#ff6fae', '#ffc2de', '#ffffff'],
  };

  // ---------------------------------------------------------------- recipes: move -> pieces
  const SIG = {
    // normal
    tackle: [['rings', 2, C.plain], ['shards', 8, C.earth, 0.6]],
    scratch: [['slashes', 3, C.plain]],
    struggle: [['rings', 1, ['#999999', '#cccccc', '#ffffff']]],
    hyper_fang: [['jaws', C.plain, 1.1]],
    quick_attack: [['wind', 4, C.air], ['flash', C.plain]],
    body_slam: [['rings', 3, C.earth, 1.3], ['shards', 12, C.earth, 1]],
    swift: [['orbit', 'star', 6, ['#ffe066', '#fff7b0', '#ffffff']], ['flash', ['#ffe066', '#fff7b0', '#ffffff']]],
    hyper_beam: [['flash', C.fire, 1.6], ['rings', 3, ['#ff9a1f', '#ffd28a', '#ffffff'], 1.4], ['shards', 14, C.fire, 1.2]],
    headbutt: [['flash', C.plain], ['orbit', 'star', 4, ['#ffe066', '#ffffff', '#ffe066'], 0.6, true]],
    extremespeed: [['wind', 6, C.air, 1.3], ['cross', C.plain]],
    rollout: [['spiral', C.earth], ['rings', 2, C.earth]],
    // fire
    ember: [['shards', 8, C.fire, 0.6], ['flash', C.fire, 0.7]],
    flamethrower: [['crescents', 2, C.fire], ['pillar', C.fire, 0.6]],
    fire_fang: [['jaws', C.fire]],
    fire_spin: [['spiral', C.fire, 1.2], ['crescents', 3, C.fire, 0.9]],
    fire_blast: [['pillar', C.fire, 1.1]],
    sacred_fire: [['pillar', ['#ffb000', '#ffe066', '#ffffff'], 1.3], ['rings', 2, ['#ffd84a', '#ffffff', '#ffd84a'], 1.2]],
    // water
    water_gun: [['splash', C.water]],
    bubble_beam: [['orbit', 'bubble', 7, C.water], ['splash', C.water, 0.6]],
    hydro_pump: [['crescents', 3, C.water, 1.3], ['splash', C.water, 1.1]],
    surf: [['crescents', 4, C.water, 1.5], ['rings', 2, C.water, 1.3]],
    swim: [['rings', 2, C.water], ['splash', C.water, 0.7]],
    octazooka: [['splash', ['#1a1a24', '#3a3a50', '#6a6a80'], 1.1], ['shards', 8, ['#1a1a24', '#3a3a50', '#6a6a80'], 0.7]],
    // grass
    vine_whip: [['crescents', 2, C.leaf, 0.8, true]],
    razor_leaf: [['orbit', 'leaf', 7, C.leaf], ['slashes', 2, C.leaf]],
    mega_drain: [['drain', C.leaf]],
    giga_drain: [['drain', C.leaf, 1.4], ['rings', 2, C.leaf]],
    solar_beam: [['pillar', ['#fff59d', '#ffffff', '#ffffff'], 1.4], ['flash', ['#fff59d', '#ffffff', '#ffffff'], 1.3]],
    petal_dance: [['orbit', 'petal', 9, C.pink, 1.2], ['crescents', 2, C.pink]],
    // electric
    thunder_shock: [['bolts', 3, C.volt]],
    thunderbolt: [['bolts', 6, C.volt, 1.1], ['rings', 1, C.volt]],
    spark: [['bolts', 3, C.volt, 0.8], ['flash', C.volt, 0.8]],
    thunder: [['pillar', C.volt, 1.2], ['bolts', 5, C.volt, 1.2]],
    zap_cannon: [['rings', 3, C.volt, 1.3], ['bolts', 8, C.volt, 1.3], ['flash', C.volt, 1.3]],
    // ice
    ice_beam: [['shards', 12, C.ice, 1], ['rings', 1, C.ice]],
    aurora_beam: [['crescents', 3, ['#7fd8f0', '#ff9ad5', '#fff59d'], 1.1], ['shards', 8, C.ice, 0.7]],
    powder_snow: [['orbit', 'star', 8, C.ice, 1], ['rings', 1, C.ice]],
    icy_wind: [['wind', 5, C.ice, 1.1], ['shards', 8, C.ice, 0.8]],
    // fighting
    karate_chop: [['slashes', 1, C.fight, 1.4], ['flash', C.fight, 0.8]],
    low_kick: [['rings', 2, C.earth, 0.8, 0.6], ['shards', 10, C.earth, 0.7]],
    cross_chop: [['cross', C.fight, 1.2]],
    dynamic_punch: [['fist', C.fight], ['rings', 2, C.fight, 1.2], ['orbit', 'star', 4, ['#ffe066', '#ffffff', '#ffe066'], 0.6, true]],
    // poison
    poison_sting: [['shards', 6, C.poison, 0.6]],
    acid: [['splash', C.poison]],
    sludge_bomb: [['splash', C.poison, 1.3], ['orbit', 'bubble', 6, C.poison]],
    // ground
    mud_slap: [['splash', C.earth, 0.8]],
    dig: [['shards', 14, C.earth, 1.1]],
    earthquake: [['rings', 3, C.earth, 1.5, 0.6], ['shards', 14, C.earth, 1.1]],
    // flying
    gust: [['wind', 4, C.air], ['crescents', 2, C.air, 0.8, true]],
    wing_attack: [['slashes', 2, C.air, 1.2]],
    aerial_ace: [['cross', C.air], ['flash', C.air]],
    hurricane: [['spiral', C.air, 1.3], ['wind', 5, C.air, 1.2]],
    steel_wing: [['slashes', 2, C.steel, 1.2], ['flash', C.steel, 0.8]],
    aeroblast: [['spiral', ['#c8d0ff', '#ffffff', '#9fb4ff'], 1.4], ['crescents', 3, ['#c8d0ff', '#ffffff', '#9fb4ff'], 1.2]],
    // psychic
    confusion: [['rings', 3, C.psy], ['orbit', 'star', 4, C.psy, 0.7, true]],
    psybeam: [['rings', 3, ['#ff6fae', '#7fd8f0', '#fff59d']], ['spiral', C.psy, 0.8]],
    psychic: [['crescents', 3, C.psy, 1.2]],
    // bug
    bug_bite: [['jaws', C.bug, 0.8]],
    leech_life: [['jaws', ['#c03028', '#ff8080', '#ffffff'], 0.8], ['drain', ['#c03028', '#ff8080', '#ffffff'], 0.8]],
    signal_beam: [['rings', 3, ['#ff6b6b', '#6bc5ff', '#ffe66d']], ['shards', 10, ['#ff6b6b', '#6bc5ff', '#ffe66d'], 0.8]],
    megahorn: [['horn', C.bug], ['flash', C.bug, 1.1]],
    // rock
    rock_throw: [['shards', 10, C.rock, 0.9]],
    rock_slide: [['shards', 14, C.rock, 1.2]],
    stone_edge: [['spikes', C.rock]],
    ancient_power: [['orbit', 'rock', 5, C.rock, 1], ['flash', C.rock]],
    // ghost
    lick: [['crescents', 1, C.ghost, 0.7, true], ['wisps', C.ghost, 0.6]],
    night_shade: [['wisps', C.ghost, 1.2], ['rings', 2, C.ghost]],
    shadow_ball: [['rings', 2, C.ghost, 1.1], ['wisps', C.ghost], ['shards', 8, C.ghost, 0.8]],
    // dragon
    dragon_rage: [['pillar', C.dragon, 1], ['crescents', 2, C.dragon]],
    dragon_pulse: [['rings', 3, C.dragon, 1.2], ['spiral', C.dragon]],
    outrage: [['crescents', 4, ['#c03028', '#9a70ff', '#ffffff'], 1.3], ['shards', 10, C.dragon, 1], ['flash', C.dragon, 1.2]],
    twister: [['spiral', C.dragon, 1.2], ['crescents', 3, C.dragon]],
    // dark
    bite: [['jaws', C.dark]],
    crunch: [['jaws', C.dark, 1.3], ['shards', 8, C.dark, 0.8]],
    pursuit: [['slashes', 2, C.dark]],
    faint_attack: [['cross', C.dark], ['flash', C.dark]],
    dark_pulse: [['rings', 4, C.dark, 1.3], ['wisps', C.dark, 0.7]],
    // steel
    metal_claw: [['slashes', 3, C.steel]],
    iron_tail: [['crescents', 1, C.steel, 1.3, true], ['rings', 2, C.steel, 1.1]],
    // added movepool (learnsets.js)
    slam: [['rings', 2, C.plain, 1.1], ['flash', C.plain, 0.8]],
    slash: [['slashes', 1, C.plain, 1.5]],
    take_down: [['rings', 2, C.plain, 1.1], ['shards', 8, C.earth, 0.8]],
    double_edge: [['flash', C.plain, 1.3], ['rings', 3, C.plain, 1.3], ['shards', 10, C.earth, 0.9]],
    thief: [['slashes', 2, C.dark], ['orbit', 'star', 3, ['#ffd700', '#fff4c0', '#ffd700'], 0.6, true]],
    mach_punch: [['fist', C.fight], ['wind', 3, C.air]],
    brick_break: [['slashes', 1, C.fight, 1.3], ['shards', 10, ['#c8a070', '#e8c890', '#ffffff'], 0.8]],
    submission: [['cross', C.fight], ['rings', 2, C.fight]],
    fire_punch: [['fist', C.fire], ['flash', C.fire, 0.9]],
    ice_punch: [['fist', C.ice], ['shards', 10, C.ice, 0.8]],
    thunder_punch: [['fist', C.volt], ['bolts', 4, C.volt, 0.8]],
    flame_wheel: [['spiral', C.fire, 0.9], ['rings', 2, C.fire]],
    waterfall: [['pillar', C.water, 1], ['splash', C.water, 1.1]],
    crabhammer: [['slashes', 1, C.water, 1.4], ['splash', C.water, 1.2]],
    absorb: [['drain', C.leaf, 0.7]],
    blizzard: [['orbit', 'star', 10, C.ice, 1.3], ['crescents', 3, C.ice, 1.3], ['shards', 12, C.ice, 1]],
    sludge: [['splash', C.poison, 0.9], ['orbit', 'bubble', 4, C.poison, 0.8]],
    bone_club: [['flash', C.earth, 0.8], ['shards', 8, C.earth, 0.7]],
    bonemerang: [['crescents', 1, ['#b8a888', '#ffffff', '#e8dcc0'], 1, true], ['flash', C.earth, 0.8]],
    peck: [['flash', C.air, 0.6]],
    drill_peck: [['spiral', C.air, 0.9], ['flash', C.air, 1]],
    fury_cutter: [['slashes', 3, C.bug, 1.1]],
    twineedle: [['shards', 6, C.bug, 0.6], ['slashes', 2, C.bug, 0.7]],
    future_sight: [['rings', 4, C.psy, 1.3], ['pillar', C.psy, 1]],
    dragon_claw: [['slashes', 3, C.dragon, 1.2], ['flash', C.dragon, 0.9]],
    dragon_breath: [['crescents', 2, C.dragon, 0.9], ['shards', 8, C.dragon, 0.7]],
  };

  // ---------------------------------------------------------------- pieces
  // a: the anim (x, y = target centre, ang = direction the attack came from, s = size), k: 0..1, f: fade 1 -> 0
  const PIECES = {
    // big curved swooshes whipping around the target (the classic "water whip" look)
    crescents(ctx, a, k, f, n, c, sc = 1, single) {
      const R = 46 * a.s * sc * (0.55 + 0.6 * ease(k));
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const base = (single ? a.ang + Math.PI * 0.6 : (i / n) * TAU) + k * 5 * (i % 2 ? -1 : 1);
        for (const [w, cc, al] of [[16 * sc, c[0], 0.45], [8 * sc, c[1], 0.9], [3, c[2], 1]]) {
          ctx.strokeStyle = col(cc, f * al); ctx.lineWidth = w;
          ctx.beginPath(); ctx.ellipse(a.x, a.y, R * (1 + i * 0.12), R * 0.7 * (1 + i * 0.12), 0, base, base + 1.5 + k); ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
    },
    // parallel claw / wing slashes across the target
    slashes(ctx, a, k, f, n, c, sc = 1) {
      const L = 70 * a.s * sc * Math.min(1, k * 4), d = a.ang + 0.9, dx = Math.cos(d), dy = Math.sin(d), px = -dy, py = dx;
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 15 * sc, x0 = a.x + px * o - dx * L / 2, y0 = a.y + py * o - dy * L / 2;
        for (const [w, cc] of [[8 * sc, col(c[0], f * 0.6)], [3, col(c[2], f)]]) {
          ctx.strokeStyle = cc; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx * L, y0 + dy * L); ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
    },
    // two rows of fangs snapping shut
    jaws(ctx, a, k, f, c, sc = 1) {
      const close = ease(Math.min(1, k * 3)), gap = (1 - close) * 34 * sc + 4, w = 52 * sc;
      for (const side of [-1, 1]) {
        const y = a.y + side * gap;
        ctx.fillStyle = col(c[0], f * 0.8);
        ctx.beginPath(); ctx.ellipse(a.x, y + side * 10 * sc, w * 0.62, 10 * sc, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = col(c[2], f);
        for (let i = 0; i < 5; i++) {
          const x = a.x - w / 2 + (i + 0.5) * (w / 5);
          ctx.beginPath(); ctx.moveTo(x - 5 * sc, y + side * 4 * sc); ctx.lineTo(x + 5 * sc, y + side * 4 * sc); ctx.lineTo(x, y - side * 12 * sc); ctx.closePath(); ctx.fill();
        }
      }
    },
    // one big fist with speed lines from the attacker's side
    fist(ctx, a, k, f, c) {
      const back = (1 - ease(Math.min(1, k * 3))) * 60, x = a.x - Math.cos(a.ang) * back, y = a.y - Math.sin(a.ang) * back;
      ctx.strokeStyle = col(c[2], f * 0.8); ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x - Math.cos(a.ang) * 40 + i * 6, y - Math.sin(a.ang) * 40 + i * 6); ctx.lineTo(x - Math.cos(a.ang) * 90 + i * 6, y - Math.sin(a.ang) * 90 + i * 6); ctx.stroke(); }
      ctx.fillStyle = col(c[1], f); ctx.strokeStyle = col(c[0], f); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x - 20, y - 18, 40, 36, 10); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - 10 + i * 10, y - 16); ctx.lineTo(x - 10 + i * 10, y - 2); ctx.stroke(); }
    },
    // a column of energy rising from the ground
    pillar(ctx, a, k, f, c, sc = 1) {
      const h = 260 * sc * ease(Math.min(1, k * 2.5)), w = 30 * sc * (1 - k * 0.5), gy = a.y + 22;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, gy - h, 0, gy);
      g.addColorStop(0, col(c[0], 0)); g.addColorStop(0.5, col(c[0], f * 0.7)); g.addColorStop(1, col(c[1], f));
      ctx.fillStyle = g; ctx.fillRect(a.x - w, gy - h, w * 2, h);
      ctx.fillStyle = col(c[2], f * 0.8); ctx.fillRect(a.x - w * 0.3, gy - h, w * 0.6, h);
      ctx.restore();
      ctx.strokeStyle = col(c[1], f); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(a.x, gy, w * 1.6, w * 0.55, 0, 0, TAU); ctx.stroke();
    },
    // pieces flying outward
    shards(ctx, a, k, f, n, c, sc = 1) {
      const R = H().seeded(a.seed);
      for (let i = 0; i < n; i++) {
        const an = R() * TAU, d = (24 + R() * 60) * sc * ease(k), sz = (4 + R() * 6) * sc;
        const x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.75 - Math.sin(Math.PI * k) * 18 * R();
        ctx.fillStyle = col(c[i % 3], f);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * sz, y + Math.sin(an) * sz); ctx.lineTo(x + Math.cos(an + 2.3) * sz * 0.5, y + Math.sin(an + 2.3) * sz * 0.5); ctx.lineTo(x + Math.cos(an - 2.3) * sz * 0.5, y + Math.sin(an - 2.3) * sz * 0.5); ctx.closePath(); ctx.fill();
      }
    },
    // a cage of crackling lightning
    bolts(ctx, a, k, f, n, c, sc = 1) {
      ctx.lineJoin = 'round';
      for (let i = 0; i < n; i++) {
        const an = (i / n) * TAU + k * 2, r = 70 * sc;
        const pts = H().zigzag(a.x + Math.cos(an) * r, a.y + Math.sin(an) * r * 0.7, a.x + Math.cos(an + 0.4) * 10, a.y + Math.sin(an + 0.4) * 8, 5, 10 * sc);
        ctx.strokeStyle = col(c[0], f * 0.6); ctx.lineWidth = 6; H().strokePts(ctx, pts);
        ctx.strokeStyle = col(c[2], f); ctx.lineWidth = 2; H().strokePts(ctx, pts);
      }
    },
    // staggered rings expanding (flattened on the floor when low)
    rings(ctx, a, k, f, n, c, sc = 1, flat = 0.75) {
      for (let i = 0; i < n; i++) {
        const kk = Math.max(0, k - i * 0.12) / (1 - i * 0.12); if (kk <= 0) continue;
        const r = (16 + 70 * ease(kk)) * sc;
        ctx.strokeStyle = col(c[i % 2], f * (1 - kk * 0.6)); ctx.lineWidth = (6 - i) * sc;
        ctx.beginPath(); ctx.ellipse(a.x, a.y + (flat < 0.7 ? 22 : 0), r, r * flat, 0, 0, TAU); ctx.stroke();
      }
    },
    // a spiral winding into the target
    spiral(ctx, a, k, f, c, sc = 1) {
      ctx.lineCap = 'round';
      for (let j = 0; j < 2; j++) {
        ctx.strokeStyle = col(c[j], f * 0.85); ctx.lineWidth = (6 - j * 3) * sc; ctx.beginPath();
        for (let i = 0; i <= 36; i++) { const u = i / 36, an = u * TAU * 2.2 + k * 9 + j * Math.PI, r = 80 * sc * (1 - u) * (1 - k * 0.4); ctx.lineTo(a.x + Math.cos(an) * r, a.y + Math.sin(an) * r * 0.7); }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    },
    // things circling the target: stars, leaves, petals, rocks, bubbles. dizzy: circle the head instead
    orbit(ctx, a, k, f, shape, n, c, sc = 1, dizzy) {
      for (let i = 0; i < n; i++) {
        const an = (i / n) * TAU + k * 7, r = dizzy ? 26 : 85 * sc * (1 - ease(k) * 0.75);
        const x = a.x + Math.cos(an) * r, y = (dizzy ? a.y - 40 : a.y) + Math.sin(an) * r * (dizzy ? 0.35 : 0.65);
        const s = (dizzy ? 6 : 8) * sc;
        ctx.fillStyle = col(c[i % 3], f);
        ctx.save(); ctx.translate(x, y); ctx.rotate(an + k * 6);
        if (shape === 'star') { H().starPath(ctx, 0, 0, 5, s, s * 0.45, 0); ctx.fill(); }
        else if (shape === 'leaf' || shape === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.5, 0, 0, TAU); ctx.fill(); }
        else if (shape === 'rock') { ctx.restore(); H().drawRock(ctx, x, y, s * 1.4, an, c[i % 3]); continue; }
        else { ctx.strokeStyle = col(c[1], f); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); ctx.fillStyle = col('#ffffff', f * 0.7); ctx.fillRect(-s * 0.4, -s * 0.5, 2, 2); }
        ctx.restore();
      }
    },
    // a big X slash
    cross(ctx, a, k, f, c, sc = 1) {
      const L = 60 * sc * Math.min(1, k * 4);
      ctx.lineCap = 'round';
      for (const d of [Math.PI / 4, -Math.PI / 4]) {
        for (const [w, cc] of [[12 * sc, col(c[0], f * 0.6)], [4, col(c[2], f)]]) {
          ctx.strokeStyle = cc; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(a.x - Math.cos(d) * L, a.y - Math.sin(d) * L); ctx.lineTo(a.x + Math.cos(d) * L, a.y + Math.sin(d) * L); ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
    },
    // a bright star-shaped flash
    flash(ctx, a, k, f, c, sc = 1) {
      const r = 50 * sc * ease(Math.min(1, k * 3));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = col(c[1], f * 0.8); H().starPath(ctx, a.x, a.y, 8, r, r * 0.4, k); ctx.fill();
      ctx.fillStyle = col(c[2], f); ctx.beginPath(); ctx.arc(a.x, a.y, r * 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    },
    // ghostly wisps curling upward
    wisps(ctx, a, k, f, c, sc = 1) {
      const R = H().seeded(a.seed + 3);
      for (let i = 0; i < 7; i++) {
        const x = a.x + (R() - 0.5) * 70 * sc, y = a.y + 20 - k * 80 * (0.6 + R() * 0.6), r = (8 + R() * 8) * sc * (1 + k);
        ctx.fillStyle = col(c[i % 2], f * 0.55); ctx.beginPath(); ctx.arc(x + Math.sin(k * 8 + i) * 8, y, r, 0, TAU); ctx.fill();
      }
    },
    // a crown of droplets thrown up and falling back
    splash(ctx, a, k, f, c, sc = 1) {
      const R = H().seeded(a.seed + 7);
      for (let i = 0; i < 14; i++) {
        const an = R() * TAU, sp = (60 + R() * 70) * sc, t = k * 0.8;
        const x = a.x + Math.cos(an) * sp * t, y = a.y + 10 + Math.sin(an) * sp * t * 0.5 - (200 * t - 380 * t * t) * sc;
        ctx.fillStyle = col(c[i % 3], f); ctx.beginPath(); ctx.ellipse(x, y, 4 * sc, 5 * sc, 0, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = col(c[1], f * 0.8); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(a.x, a.y + 22, 30 * sc * (0.5 + ease(k)), 10 * sc * (0.5 + ease(k)), 0, 0, TAU); ctx.stroke();
    },
    // a giant horn thrusting through
    horn(ctx, a, k, f, c) {
      const th = ease(Math.min(1, k * 3)), L = 110, bx = a.x - Math.cos(a.ang) * (L - th * 60), by = a.y - Math.sin(a.ang) * (L - th * 60);
      const tx = bx + Math.cos(a.ang) * L, ty = by + Math.sin(a.ang) * L, px = -Math.sin(a.ang) * 18, py = Math.cos(a.ang) * 18;
      ctx.fillStyle = col(c[1], f); ctx.strokeStyle = col(c[0], f); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bx + px, by + py); ctx.lineTo(tx, ty); ctx.lineTo(bx - px, by - py); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = col(c[2], f); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    },
    // a rank of jagged stone spikes bursting up around the target
    spikes(ctx, a, k, f, c) {
      const R = H().seeded(a.seed + 11), up = Math.sin(Math.PI * Math.min(1, k * 1.4));
      for (let i = 0; i < 7; i++) {
        const an = (i / 7) * TAU + R() * 0.4, d = 30 + R() * 30, x = a.x + Math.cos(an) * d, y = a.y + 20 + Math.sin(an) * d * 0.5, h = (40 + R() * 40) * up;
        ctx.fillStyle = col(i % 2 ? c[1] : c[0], f); ctx.strokeStyle = col('#3a3020', f); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 2, y - h); ctx.lineTo(x + 4, y - h * 0.85); ctx.lineTo(x + 10, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    },
    // curved gusts sweeping past
    wind(ctx, a, k, f, n, c, sc = 1) {
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 16, sweep = (k * 2 - 0.5) * 120 * sc;
        const ca = Math.cos(a.ang), sa = Math.sin(a.ang), px = -sa, py = ca;
        const x0 = a.x - ca * 90 + ca * sweep + px * off, y0 = a.y - sa * 90 + sa * sweep + py * off;
        ctx.strokeStyle = col(c[i % 3], f * 0.85); ctx.lineWidth = 3 * sc;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + ca * 50 + px * 14, y0 + sa * 50 + py * 14, x0 + ca * 100, y0 + sa * 100); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    },
    // energy being pulled out of the target in a spiral
    drain(ctx, a, k, f, c, sc = 1) {
      for (let i = 0; i < 10; i++) {
        const u = (k * 1.5 + i / 10) % 1, an = u * TAU * 1.5 + i, r = 20 + u * 60 * sc;
        ctx.fillStyle = col(c[i % 3], f * (1 - u)); ctx.beginPath(); ctx.arc(a.x + Math.cos(an) * r, a.y + Math.sin(an) * r * 0.6 - u * 30, 4 * sc, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = col(c[1], f * 0.7); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(a.x, a.y, 30 * sc, 20 * sc, 0, 0, TAU); ctx.stroke();
    },
  };

  PG.MOVEFX = {
    has(id) { return !!SIG[id]; },
    // Called when a damaging move lands on the target.
    hit(fx, target, mv, attacker) {
      const parts = SIG[mv.id];
      if (!parts) return false;
      const ang = attacker ? Math.atan2(target.y - attacker.y, target.x - attacker.x) : 0;
      const s = 0.85 + Math.min(150, mv.power || 40) / 220;   // stronger moves, bigger effects
      fx.anim('sig', { x: target.x, y: target.y, ang, s, parts, seed: Math.floor(Math.random() * 1e6), dur: (mv.power || 40) >= 90 ? 0.75 : 0.55 });
      return true;
    },
    draw(ctx, a, k) {
      const f = Math.min(1, (1 - k) * 2.5);
      for (const [name, ...args] of a.parts) PIECES[name](ctx, a, k, f, ...args);
      ctx.lineWidth = 1;
    },
  };
})();
