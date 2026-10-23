// Ultimate attacks: every type gets its own cut-in backdrop, incoming visuals, impact and aftermath.
// Purely cosmetic; the damage still comes from the strike created in battle.js.
(function () {
  const TAU = Math.PI * 2;
  const H = () => PG.FXH;   // drawing helpers shared by vfx.js (rgba, glow, zigzag, drawRock...)
  const rand = (a, b) => a + Math.random() * (b - a);
  const ease = (k) => 1 - Math.pow(1 - k, 3);

  // [main, light, dark] per type: cut-in colours and title gradient
  const PAL = {
    normal: ['#c8c8a0', '#ffffff', '#6d6d4e'], fire: ['#ff6a00', '#ffe066', '#7a1400'], water: ['#3f8cff', '#bfe3ff', '#0b2a6b'],
    grass: ['#5fcf4a', '#e6ffb0', '#1d5a14'], electric: ['#ffd400', '#fffbe0', '#5a4a00'], ice: ['#7fe0ff', '#ffffff', '#1d5f7a'],
    fighting: ['#e0402c', '#ffd2a0', '#5a0e06'], poison: ['#b04cd0', '#f0b8ff', '#3a0f4a'], ground: ['#d8a84a', '#fff0c0', '#5a3a10'],
    flying: ['#9db4ff', '#ffffff', '#2c3f8a'], psychic: ['#ff5c9a', '#ffd6e8', '#6a0f3a'], bug: ['#a8c020', '#f0ffa0', '#3a4a00'],
    rock: ['#b8a038', '#f5e6b0', '#4a3f15'], ghost: ['#8a6cc8', '#e0d0ff', '#1e1238'], dragon: ['#7a4cff', '#d8c8ff', '#1c0a5a'],
    dark: ['#6a5040', '#d0b8a8', '#0c0806'], steel: ['#b8c0d8', '#ffffff', '#3a4258'],
  };
  const pal = (type) => PAL[type] || PAL.normal;

  // ---------------------------------------------------------------- cut-in backdrops (screen space)
  // a: overall alpha, t: time, k: 0..1 progress of the cut-in
  const BG = {
    normal(ctx, w, h, t, k, P) { speedLines(ctx, w, h, t, P[1], 48, 0.5); },
    fighting(ctx, w, h, t, k, P) {
      const cx = w / 2, cy = h / 2, n = 28;           // manga burst: alternating wedges
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + t * 0.6, a1 = a0 + TAU / n * 0.55;
        ctx.fillStyle = i % 2 ? hexa(P[0], 0.55) : hexa(P[1], 0.25);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * w, cy + Math.sin(a0) * w); ctx.lineTo(cx + Math.cos(a1) * w, cy + Math.sin(a1) * w); ctx.fill();
      }
      speedLines(ctx, w, h, t, '#ffffff', 30, 0.7);
    },
    fire(ctx, w, h, t, k, P) {
      const g = ctx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, hexa(P[0], 0.85)); g.addColorStop(0.6, hexa(P[2], 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let layer = 0; layer < 3; layer++) {     // flame tongues licking up from the bottom
        ctx.fillStyle = [P[2], P[0], P[1]][layer];
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w + 40; x += 40) {
          const fl = Math.sin(x * 0.03 + t * (6 + layer * 2) + layer) * 0.5 + 0.5;
          ctx.lineTo(x - 20, h - h * (0.32 - layer * 0.09) * (0.6 + fl * 0.6)); ctx.lineTo(x, h - h * 0.08 * (2 - layer));
        }
        ctx.lineTo(w, h); ctx.fill();
      }
      embers(ctx, w, h, t, [P[1], P[0]], -1);
    },
    water(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.6); ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {                  // rolling wave bands
        const y = h * (0.2 + i * 0.12);
        ctx.strokeStyle = hexa(i % 2 ? P[1] : P[0], 0.55); ctx.lineWidth = 10 - i;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 5 + i) * 18);
        ctx.stroke();
      }
      embers(ctx, w, h, t, [P[1]], -1, 'bubble');
    },
    grass(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.45); ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 46; i++) {                 // petals and leaves spiralling around the centre
        const a = i * 2.4 + t * 1.6, r = ((i * 37) % 100) / 100 * Math.max(w, h) * 0.6 + 40;
        const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r * 0.7;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a * 2);
        ctx.fillStyle = i % 3 ? P[0] : '#ff9ad5';
        ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    },
    electric(ctx, w, h, t, k, P) {
      ctx.fillStyle = 'rgba(20,18,0,0.6)'; ctx.fillRect(0, 0, w, h);
      const R = H().seeded(Math.floor(t * 14));       // bolts re-strike 14 times a second
      ctx.lineJoin = 'round';
      for (let i = 0; i < 6; i++) {
        const x = R() * w, pts = H().zigzag(x, 0, x + (R() - 0.5) * 300, h, 9, 40);
        ctx.strokeStyle = hexa(P[0], 0.5); ctx.lineWidth = 12; H().strokePts(ctx, pts);
        ctx.strokeStyle = P[1]; ctx.lineWidth = 3; H().strokePts(ctx, pts);
      }
    },
    ice(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.45); ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 18; i++) {                 // crystal shards fanning out
        const a = (i / 18) * TAU + 0.2, L = Math.max(w, h) * (0.35 + ((i * 7) % 5) * 0.08) * ease(Math.min(1, k * 3));
        ctx.fillStyle = hexa(i % 2 ? P[0] : P[1], 0.5);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - 0.05) * 60, cy + Math.sin(a - 0.05) * 60);
        ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); ctx.lineTo(cx + Math.cos(a + 0.05) * 60, cy + Math.sin(a + 0.05) * 60); ctx.fill();
      }
      embers(ctx, w, h, t, ['#ffffff'], 1);
    },
    poison(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.55); ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {                 // acid dripping from the top
        const x = (i + 0.5) * w / 16, L = 60 + ((i * 53) % 90) + Math.sin(t * 3 + i) * 25;
        ctx.fillStyle = P[0]; ctx.fillRect(x - 9, 0, 18, L);
        ctx.beginPath(); ctx.arc(x, L, 12, 0, TAU); ctx.fill();
        const dy = ((t * 260 + i * 70) % (h - L)) + L + 20;
        ctx.beginPath(); ctx.arc(x, dy, 6, 0, TAU); ctx.fill();
      }
      embers(ctx, w, h, t, [P[1], P[0]], -1, 'bubble');
    },
    ground(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.55); ctx.fillRect(0, 0, w, h);
      const R = H().seeded(7); ctx.strokeStyle = P[0]; ctx.lineJoin = 'round';
      for (let i = 0; i < 8; i++) {                  // fissures tearing across the screen
        const y = R() * h; ctx.lineWidth = 3 + R() * 5;
        H().strokePts(ctx, H().zigzag(-20, y, w * ease(Math.min(1, k * 2.5)), y + (R() - 0.5) * 120, 12, 18));
      }
      for (let i = 0; i < 14; i++) {                 // chunks thrown up
        const x = ((i * 137) % w), y = h - ((t * 300 + i * 90) % (h * 1.2));
        H().drawRock(ctx, x, y, 12 + (i % 4) * 6, t * 3 + i, P[0]);
      }
    },
    flying(ctx, w, h, t, k, P) {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, hexa(P[2], 0.6)); g.addColorStop(1, hexa(P[0], 0.4));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) {                 // gusts sweeping across
        const y = (i * 61) % h, x = ((t * 1400 + i * 233) % (w + 600)) - 300;
        ctx.strokeStyle = hexa(P[1], 0.6); ctx.lineWidth = 3 + (i % 3) * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 150, y - 30, x + 300, y + 10); ctx.stroke();
      }
      ctx.lineCap = 'butt';
    },
    psychic(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.5); ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 9; i++) {                  // rings pulsing out of the mind's eye
        const r = ((t * 260 + i * 90) % 810);
        ctx.strokeStyle = hexa(i % 2 ? P[0] : P[1], 0.6 * (1 - r / 810)); ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      }
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.8);
      for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.strokeStyle = hexa(P[1], 0.35); ctx.lineWidth = 2; ctx.strokeRect(-140, -140, 280, 280); }
      ctx.restore();
    },
    bug(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.5); ctx.fillRect(0, 0, w, h);
      const s = 46, hh = s * Math.sqrt(3) / 2;       // honeycomb drifting past
      ctx.strokeStyle = hexa(P[0], 0.5); ctx.lineWidth = 3;
      for (let row = -1; row < h / hh + 1; row++) for (let col = -1; col < w / (s * 1.5) + 1; col++) {
        const x = col * s * 1.5 + ((t * 60) % (s * 1.5)), y = row * hh * 2 + (col % 2 ? hh : 0);
        ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(x + Math.cos(i * TAU / 6) * s * 0.55, y + Math.sin(i * TAU / 6) * s * 0.55); ctx.closePath(); ctx.stroke();
      }
      speedLines(ctx, w, h, t, P[1], 24, 0.4);
    },
    rock(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.55); ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) {                 // boulders raining down
        const x = ((i * 173) % w), y = ((t * 500 + i * 120) % (h + 200)) - 100;
        H().drawRock(ctx, x, y, 20 + (i % 3) * 14, t * 2 + i, P[0]);
      }
    },
    ghost(ctx, w, h, t, k, P) {
      ctx.fillStyle = 'rgba(10,4,24,0.7)'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) {                 // spirits drifting with glowing eyes
        const x = (i * 157 + Math.sin(t * 1.5 + i) * 40) % w, y = h - ((t * 120 + i * 80) % (h + 120)) + 60;
        ctx.fillStyle = hexa(P[0], 0.45);
        ctx.beginPath(); ctx.arc(x, y, 26, Math.PI, 0);
        for (let j = 0; j <= 4; j++) ctx.lineTo(x + 26 - j * 13, y + 30 + (j % 2 ? -8 : 4) + Math.sin(t * 8 + j) * 3);
        ctx.fill();
        ctx.fillStyle = P[1]; ctx.beginPath(); ctx.arc(x - 9, y - 4, 4, 0, TAU); ctx.arc(x + 9, y - 4, 4, 0, TAU); ctx.fill();
      }
    },
    dragon(ctx, w, h, t, k, P) {
      ctx.fillStyle = hexa(P[2], 0.55); ctx.fillRect(0, 0, w, h);
      for (let j = 0; j < 2; j++) {                  // two serpentine dragons coiling
        for (let i = 0; i < 40; i++) {
          const u = i / 40, a = t * 2.4 + u * 7 + j * Math.PI;
          const x = w / 2 + Math.cos(a) * (w * 0.42) * (1 - u * 0.4), y = h / 2 + Math.sin(a * 1.3) * h * 0.35;
          ctx.fillStyle = hexa(j ? P[1] : P[0], 0.8 * (1 - u));
          ctx.beginPath(); ctx.arc(x, y, 26 * (1 - u * 0.7), 0, TAU); ctx.fill();
        }
      }
      embers(ctx, w, h, t, [P[1], '#ff9de2'], -1);
    },
    dark(ctx, w, h, t, k, P) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 60; i++) {                 // matter spiralling into a black hole
        const u = ((t * 0.5 + i / 60) % 1), r = (1 - u) * Math.max(w, h) * 0.7, a = i * 2.1 + u * 6;
        ctx.fillStyle = hexa(i % 2 ? '#a070ff' : P[1], u);
        ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 4, 4);
      }
      ctx.strokeStyle = hexa('#a070ff', 0.8); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(cx, cy, 150, 40, -0.2, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, TAU); ctx.fill();
    },
    steel(ctx, w, h, t, k, P) {
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, hexa(P[2], 0.7)); g.addColorStop(0.5, hexa(P[0], 0.4)); g.addColorStop(1, hexa(P[2], 0.7));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      gear(ctx, w * 0.15, h * 0.3, 120, t * 1.2, hexa(P[1], 0.35));
      gear(ctx, w * 0.85, h * 0.7, 150, -t, hexa(P[1], 0.35));
      gear(ctx, w * 0.5, h * 1.0, 200, t * 0.7, hexa(P[0], 0.3));
      speedLines(ctx, w, h, t, P[1], 20, 0.35);
    },
  };

  // ---------------------------------------------------------------- incoming (arena space, k: 0..1 until impact)
  const AIR = {
    normal(ctx, s, k, t, P) { comet(ctx, s, k, P[1], P[0], 26); },
    fire(ctx, s, k, t, P, fx) {
      comet(ctx, s, k, '#fff3b0', '#ff6a00', 40);
      if (Math.random() < 0.8) { const [x, y] = cometPos(s, k); fx.emit({ x: x + rand(-15, 15), y, vx: rand(-40, 40), vy: -80, life: 0.4, size: 16, color: '#ff8c00', add: true, grow: -30 }); }
    },
    water(ctx, s, k, t, P) {
      for (let i = 0; i < 5; i++) {                  // whirlpool rising into a vortex column
        const y = s.y - i * 34 * k, r = s.r * (0.9 - i * 0.12) * (0.5 + k * 0.5);
        ctx.strokeStyle = hexa(i % 2 ? P[1] : P[0], 0.75); ctx.lineWidth = 6 - i * 0.6;
        ctx.beginPath(); ctx.ellipse(s.x, y, r, r * 0.35, 0, t * 8 + i, t * 8 + i + 4.5); ctx.stroke();
      }
    },
    grass(ctx, s, k, t, P) {
      const n = 8, open = 1 - k;                     // a giant bud closing over the target
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + t * 0.5, d = s.r * (0.3 + open * 0.6);
        ctx.save(); ctx.translate(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.6); ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = hexa(i % 2 ? '#ff9ad5' : P[0], 0.85);
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 46, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    },
    electric(ctx, s, k, t, P) {
      const cy = s.y - 230;                          // a storm cloud gathering
      ctx.fillStyle = `rgba(30,30,50,${0.4 + k * 0.5})`;
      for (const [dx, dy, r] of [[-70, 0, 46], [-25, -22, 58], [30, -10, 54], [75, 4, 42], [0, 14, 48]]) { ctx.beginPath(); ctx.arc(s.x + dx, cy + dy, r, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = P[0]; ctx.lineWidth = 3;
      for (let i = 0; i < 1 + k * 4; i++) H().strokePts(ctx, H().zigzag(s.x + rand(-80, 80), cy + 30, s.x + rand(-s.r, s.r), cy + 60 + k * 140, 5, 12));
    },
    ice(ctx, s, k, t, P) {
      const y = s.y - (1 - ease(k)) * 420;           // a giant icicle plunging down
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 30 + k * 40, 10 + k * 14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = hexa(P[0], 0.9); ctx.strokeStyle = P[1]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s.x - 34, y - 170); ctx.lineTo(s.x + 34, y - 170); ctx.lineTo(s.x + 8, y - 20); ctx.lineTo(s.x, y); ctx.lineTo(s.x - 8, y - 20); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hexa(P[1], 0.7); ctx.beginPath(); ctx.moveTo(s.x - 18, y - 165); ctx.lineTo(s.x - 4, y - 165); ctx.lineTo(s.x - 2, y - 40); ctx.closePath(); ctx.fill();
    },
    fighting(ctx, s, k, t, P) {
      for (let i = 0; i < 8; i++) {                  // fists closing in from every side
        const a = (i / 8) * TAU, d = s.r * 1.6 * (1 - ease(k)) + 30;
        const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d * 0.7;
        H().glow(ctx, x, y, 34, P[0], 0.6);
        ctx.fillStyle = P[1]; ctx.strokeStyle = P[2]; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill(); ctx.stroke();
        for (let f = 0; f < 3; f++) { ctx.beginPath(); ctx.moveTo(x + Math.cos(a + Math.PI) * 4 - 6 + f * 6, y - 8); ctx.lineTo(x + Math.cos(a + Math.PI) * 4 - 6 + f * 6, y + 2); ctx.stroke(); }
      }
    },
    poison(ctx, s, k, t, P, fx) {
      ctx.fillStyle = `rgba(60,10,70,${0.25 + k * 0.35})`;   // a toxic cloud raining acid
      for (const [dx, r] of [[-60, 44], [0, 56], [60, 44]]) { ctx.beginPath(); ctx.arc(s.x + dx, s.y - 220, r, 0, TAU); ctx.fill(); }
      if (Math.random() < 0.9) fx.emit({ x: s.x + rand(-s.r * 0.8, s.r * 0.8), y: s.y - 190, vx: 0, vy: 420, life: 0.5, size: 4, color: P[1], g: 300, drag: 0, shape: 'dot' });
    },
    ground(ctx, s, k, t, P) {
      const R = H().seeded(Math.floor(s.x * 3 + s.y));   // the ground bulging and splitting
      ctx.strokeStyle = hexa(P[2], 0.9); ctx.lineWidth = 4;
      for (let i = 0; i < 10; i++) { const a = R() * TAU; H().strokePts(ctx, [[s.x, s.y], [s.x + Math.cos(a) * s.r * k * 0.6, s.y + Math.sin(a) * s.r * k * 0.4], [s.x + Math.cos(a + 0.25) * s.r * k * 1.1, s.y + Math.sin(a + 0.25) * s.r * k * 0.75]]); }
      ctx.fillStyle = hexa(P[0], 0.7); ctx.beginPath(); ctx.ellipse(s.x, s.y + Math.sin(t * 50) * 3, 30 + k * 40, 12 + k * 14, 0, Math.PI, TAU); ctx.fill();
    },
    flying(ctx, s, k, t, P) {
      for (let i = 0; i < 9; i++) {                  // a tornado touching down
        const y = s.y - i * 34, r = (20 + i * 14) * (0.4 + k * 0.6);
        ctx.strokeStyle = hexa(i % 2 ? P[1] : P[0], 0.7); ctx.lineWidth = 5;
        ctx.beginPath(); ctx.ellipse(s.x + Math.sin(t * 6 + i * 0.6) * 10, y, r, r * 0.3, 0, t * 10 + i, t * 10 + i + 4); ctx.stroke();
      }
    },
    psychic(ctx, s, k, t, P) {
      const x = s.x, y = s.y - 200, open = ease(Math.min(1, k * 1.4));   // a giant eye opening overhead
      H().glow(ctx, x, y, 120, P[0], 0.5);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = P[2]; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, y, 90, 50 * open + 1, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 90, 50 * open + 1, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = P[0]; ctx.beginPath(); ctx.arc(x + (s.x - x) * 0.05, y + 6, 32, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1a0010'; ctx.beginPath(); ctx.arc(x, y + 8, 14, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = hexa(P[0], 0.6); ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(x, y + 50); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.setLineDash([]);
    },
    bug(ctx, s, k, t, P) {
      for (let i = 0; i < 18; i++) {                 // a swarm spiralling in
        const a = t * 9 + i * (TAU / 18), d = s.r * (1.2 - k * 0.9) * (0.7 + (i % 3) * 0.15);
        const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d * 0.6 - 20;
        ctx.fillStyle = P[0]; ctx.beginPath(); ctx.ellipse(x, y, 7, 4, a, 0, TAU); ctx.fill();
        ctx.fillStyle = hexa(P[1], 0.7); ctx.beginPath(); ctx.ellipse(x, y - 4, 6, 3, a + Math.sin(t * 60) * 0.8, 0, TAU); ctx.fill();
      }
    },
    rock(ctx, s, k, t, P) {
      const y = s.y - (1 - ease(k)) * 440;           // one colossal boulder
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.35})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, 40 + k * 50, 14 + k * 18, 0, 0, TAU); ctx.fill();
      H().drawRock(ctx, s.x, y - 50, 80, t * 3, P[0]);
    },
    ghost(ctx, s, k, t, P) {
      ctx.fillStyle = `rgba(20,8,40,${0.3 + k * 0.5})`;   // a shadow pool, hands reaching out of it
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (0.4 + k * 0.6), s.r * (0.25 + k * 0.35), 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3, x = s.x + Math.cos(a) * s.r * 0.55, y = s.y + Math.sin(a) * s.r * 0.35, hgt = 60 * ease(k) * (0.7 + (i % 2) * 0.4);
        ctx.strokeStyle = hexa(P[0], 0.85); ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(t * 5 + i) * 12, y - hgt * 0.5, x + (s.x - x) * 0.3, y - hgt); ctx.stroke();
        ctx.lineWidth = 3; for (let f = -1; f <= 1; f++) { ctx.beginPath(); ctx.moveTo(x + (s.x - x) * 0.3, y - hgt); ctx.lineTo(x + (s.x - x) * 0.3 + f * 8, y - hgt - 12); ctx.stroke(); }
        ctx.lineCap = 'butt';
      }
    },
    dragon(ctx, s, k, t, P) {
      for (let i = 0; i < 26; i++) {                 // a spectral dragon coiling down onto the target
        const u = i / 26, a = t * 6 - u * 5, d = s.r * (1.1 - k * 0.6) * (1 - u * 0.3);
        const x = s.x + Math.cos(a) * d, y = s.y - (1 - k) * 160 * (1 - u) + Math.sin(a) * d * 0.5;
        ctx.fillStyle = hexa(i === 0 ? P[1] : P[0], 0.9 - u * 0.6);
        ctx.beginPath(); ctx.arc(x, y, (i === 0 ? 22 : 16) * (1 - u * 0.6), 0, TAU); ctx.fill();
        if (i === 0) { ctx.fillStyle = '#ffde59'; ctx.beginPath(); ctx.arc(x + 6, y - 5, 4, 0, TAU); ctx.fill(); }
      }
    },
    dark(ctx, s, k, t, P, fx) {
      const y = s.y - 150, r = 20 + ease(k) * 50;   // a black hole tearing open overhead
      ctx.strokeStyle = hexa('#a070ff', 0.8); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(s.x, y, r * 2.2, r * 0.6, Math.sin(t) * 0.2, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(s.x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexa(P[1], 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, y, r + 3, 0, TAU); ctx.stroke();
      if (Math.random() < 0.8) { const a = rand(0, TAU), d = 220; fx.emit({ x: s.x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6, vx: 0, vy: 0, life: 0.6, size: 3, color: '#a070ff', home: { x: s.x, y }, add: true }); }
    },
    steel(ctx, s, k, t, P) {
      const y = s.y - (1 - ease(k)) * 380;           // a giant drill spinning down
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 30 + k * 40, 10 + k * 14, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(s.x, y);
      const g = ctx.createLinearGradient(-40, 0, 40, 0); g.addColorStop(0, P[2]); g.addColorStop(0.5, P[1]); g.addColorStop(1, P[2]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-42, -150); ctx.lineTo(42, -150); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexa(P[2], 0.9); ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const yy = -140 + ((i * 30 + t * 300) % 150), half = 42 * (-yy / 150); ctx.beginPath(); ctx.moveTo(-half, yy); ctx.lineTo(half, yy + 14); ctx.stroke(); }
      ctx.restore();
    },
  };

  // ---------------------------------------------------------------- impact (particles, shake, decals) + aftermath anim
  const LAND = {
    normal(fx, s, P) { fx.burst(s.x, s.y, 40, { speed: 420, life: 0.6, size: 6, color: [P[1], P[0]], shape: 'star', add: true }); return 'scorch'; },
    fire(fx, s, P) {
      fx.burst(s.x, s.y, 60, { speed: 460, life: 0.8, size: 12, color: ['#ff4500', '#ff8c00', '#ffd23f'], add: true, grow: -12 });
      fx.burst(s.x, s.y, 12, { speed: 90, life: 1.2, size: 20, color: '#3a3a3a', shape: 'smoke', grow: 40, vy: -60 });
      return 'scorch';
    },
    water(fx, s, P) { fx.burst(s.x, s.y, 60, { ang: -Math.PI / 2, spread: 1.2, speed: 520, life: 0.9, size: 7, color: [P[0], P[1], '#ffffff'], g: 900, drag: 0.5 }); return 'puddle'; },
    grass(fx, s, P) { fx.burst(s.x, s.y, 50, { speed: 380, life: 1.1, size: 9, color: [P[0], '#ff9ad5', P[1]], shape: 'leaf', drag: 1.5 }); return null; },
    electric(fx, s, P) { fx.burst(s.x, s.y, 50, { speed: 480, life: 0.35, size: 3, color: [P[0], '#ffffff'], shape: 'spark', add: true, drag: 5 }); return 'scorch'; },
    ice(fx, s, P) { fx.burst(s.x, s.y, 50, { speed: 420, life: 0.9, size: 8, color: [P[0], P[1], '#ffffff'], shape: 'shard', drag: 2 }); return 'frost'; },
    fighting(fx, s, P) { fx.burst(s.x, s.y, 40, { speed: 500, life: 0.4, size: 6, color: [P[0], P[1]], shape: 'star', add: true, drag: 4 }); return 'crack'; },
    poison(fx, s, P) {
      fx.burst(s.x, s.y, 40, { speed: 300, life: 0.8, size: 8, color: [P[0], P[1], '#6b2a6b'], g: 500, vy: -200, drag: 1 });
      fx.burst(s.x, s.y, 12, { speed: 80, life: 1.4, size: 22, color: '#7a3a8a', shape: 'smoke', grow: 40, vy: -30 });
      return 'sludge';
    },
    ground(fx, s, P) {
      fx.burst(s.x, s.y, 50, { ang: -Math.PI / 2, spread: 1.3, speed: 520, life: 1, size: 9, color: [P[0], P[2], '#8a6d3b'], shape: 'rock', g: 1100, drag: 0.4 });
      fx.burst(s.x, s.y, 10, { speed: 120, life: 1.2, size: 24, color: '#c8b48c', shape: 'smoke', grow: 40 });
      return 'crack';
    },
    flying(fx, s, P) { fx.burst(s.x, s.y, 40, { speed: 500, life: 0.8, size: 8, color: [P[1], P[0]], shape: 'feather', drag: 1.5 }); return null; },
    psychic(fx, s, P) { fx.burst(s.x, s.y, 50, { speed: 420, life: 0.8, size: 9, color: [P[0], P[1], '#ffffff'], shape: 'shard', add: true, drag: 1.5 }); return null; },
    bug(fx, s, P) { fx.burst(s.x, s.y, 50, { speed: 440, life: 0.7, size: 6, color: [P[0], P[1]], shape: 'leaf', drag: 2 }); return 'crack'; },
    rock(fx, s, P) {
      fx.burst(s.x, s.y, 50, { ang: -Math.PI / 2, spread: 1.5, speed: 480, life: 1, size: 12, color: [P[0], '#857b68', '#6f6758'], shape: 'rock', g: 1000, drag: 0.4 });
      fx.burst(s.x, s.y, 10, { speed: 120, life: 1.2, size: 26, color: '#d8ccb0', shape: 'smoke', grow: 40 });
      return 'crack';
    },
    ghost(fx, s, P) { for (let i = 0; i < 24; i++) fx.emit({ x: s.x + rand(-s.r * 0.7, s.r * 0.7), y: s.y + rand(-s.r * 0.4, s.r * 0.4), vx: rand(-20, 20), vy: rand(-180, -60), life: rand(0.8, 1.3), size: rand(10, 18), color: Math.random() < 0.5 ? '#2a1840' : P[0], shape: 'wisp', grow: 14 }); return null; },
    dragon(fx, s, P) { fx.burst(s.x, s.y, 60, { speed: 480, life: 0.8, size: 10, color: [P[0], P[1], '#ff9de2'], add: true, grow: -10 }); return 'scorch'; },
    dark(fx, s, P) { fx.burst(s.x, s.y, 50, { speed: 520, life: 0.7, size: 7, color: ['#a070ff', '#2a1a3a', P[1]], shape: 'shard', add: false, drag: 2 }); return 'hole'; },
    steel(fx, s, P) { fx.burst(s.x, s.y, 50, { speed: 520, life: 0.6, size: 7, color: [P[0], P[1], '#ffffff'], shape: 'shard', drag: 2.5 }); fx.burst(s.x, s.y, 30, { speed: 600, life: 0.3, size: 3, color: ['#ffd23f', '#ffffff'], shape: 'spark', add: true, drag: 5 }); return 'crack'; },
  };

  // Aftermath drawn for ~1s after impact (arena space). k: 0..1, fade: 1 → 0 at the end.
  const BOOM = {
    normal(ctx, a, k, f, P) { ring(ctx, a, k, P[1], 10, 1.3); H().starPath(ctx, a.x, a.y, 8, a.r * 0.9 * ease(k), a.r * 0.35 * ease(k), k); ctx.fillStyle = hexa(P[1], f * 0.6); ctx.fill(); },
    fire(ctx, a, k, f, P) {
      ctx.globalCompositeOperation = 'lighter';     // a fire dome and a pillar of flame
      H().glow(ctx, a.x, a.y, a.r * 1.4 * ease(k), '#ff6a00', f * 0.8);
      const g = ctx.createLinearGradient(0, a.y - 380, 0, a.y); g.addColorStop(0, 'rgba(255,80,0,0)'); g.addColorStop(1, hexa('#ffd23f', f * 0.8));
      ctx.fillStyle = g; const pw = 60 * (1 - k * 0.5);
      ctx.beginPath(); ctx.moveTo(a.x - pw, a.y); ctx.quadraticCurveTo(a.x - pw * 0.4, a.y - 200, a.x + Math.sin(k * 20) * 10, a.y - 380 * ease(k)); ctx.quadraticCurveTo(a.x + pw * 0.4, a.y - 200, a.x + pw, a.y); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ring(ctx, a, k, '#ff8c00', 8, 1.2);
    },
    water(ctx, a, k, f, P) {
      const hgt = 340 * Math.sin(Math.PI * Math.min(1, k * 1.2));   // a geyser that rises and falls
      const g = ctx.createLinearGradient(0, a.y - hgt, 0, a.y); g.addColorStop(0, hexa(P[1], f)); g.addColorStop(1, hexa(P[0], f * 0.8));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.x - 50, a.y); ctx.lineTo(a.x - 26, a.y - hgt); ctx.quadraticCurveTo(a.x, a.y - hgt - 30, a.x + 26, a.y - hgt); ctx.lineTo(a.x + 50, a.y); ctx.fill();
      ring(ctx, a, k, P[1], 6, 1.3); ring(ctx, a, Math.max(0, k - 0.15), P[0], 4, 1.0);
    },
    grass(ctx, a, k, f, P) {
      const n = 10, open = ease(Math.min(1, k * 1.5));  // a giant flower blooming
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + k;
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
        ctx.fillStyle = hexa(i % 2 ? '#ff9ad5' : '#ffc4e6', f * 0.9);
        ctx.beginPath(); ctx.ellipse(a.r * 0.5 * open, 0, a.r * 0.45 * open, 26 * open + 1, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = hexa('#ffd23f', f); ctx.beginPath(); ctx.arc(a.x, a.y, 26 * open, 0, TAU); ctx.fill();
    },
    electric(ctx, a, k, f, P) {
      ctx.lineJoin = 'round';                        // repeated bolts and a crackling dome
      if (k < 0.7) for (let i = 0; i < 3; i++) {
        const pts = H().zigzag(a.x + rand(-a.r, a.r), a.y - 420, a.x + rand(-a.r * 0.5, a.r * 0.5), a.y, 10, 26);
        ctx.strokeStyle = hexa(P[0], f * 0.6); ctx.lineWidth = 12; H().strokePts(ctx, pts);
        ctx.strokeStyle = hexa('#ffffff', f); ctx.lineWidth = 4; H().strokePts(ctx, pts);
      }
      ctx.strokeStyle = hexa(P[0], f); ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const an = rand(0, TAU); H().strokePts(ctx, H().zigzag(a.x, a.y, a.x + Math.cos(an) * a.r * ease(k), a.y + Math.sin(an) * a.r * 0.7 * ease(k), 4, 10)); }
    },
    ice(ctx, a, k, f, P) {
      const R = H().seeded(a.seed), up = ease(Math.min(1, k * 2.5));   // ice spikes erupting outward
      for (let i = 0; i < 12; i++) {
        const an = (i / 12) * TAU + R() * 0.3, d = a.r * (0.35 + R() * 0.6), x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.6, hh = (50 + R() * 60) * up;
        ctx.fillStyle = hexa(P[0], f * 0.9); ctx.strokeStyle = hexa(P[1], f); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x, y - hh); ctx.lineTo(x + 14, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ring(ctx, a, k, P[1], 5, 1.2);
    },
    fighting(ctx, a, k, f, P) {
      const s = ease(Math.min(1, k * 2));            // a huge comic POW and shockwaves
      ctx.fillStyle = hexa(P[1], f); ctx.strokeStyle = hexa(P[2], f); ctx.lineWidth = 5;
      H().starPath(ctx, a.x, a.y - 30, 12, 110 * s, 60 * s, 0.2); ctx.fill(); ctx.stroke();
      ctx.font = `900 italic ${Math.round(46 * s) + 1}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = hexa(P[0], f); ctx.fillText('POW!', a.x, a.y - 30); ctx.textBaseline = 'alphabetic';
      ring(ctx, a, k, P[0], 8, 1.4); ring(ctx, a, Math.max(0, k - 0.12), '#ffffff', 4, 1.1);
    },
    poison(ctx, a, k, f, P) {
      for (let i = 0; i < 7; i++) {                  // a bubbling toxic cloud
        const an = i * 0.9 + k, r = (40 + (i % 3) * 18) * ease(Math.min(1, k * 2));
        ctx.fillStyle = hexa(i % 2 ? P[0] : '#6b2a6b', f * 0.55);
        ctx.beginPath(); ctx.arc(a.x + Math.cos(an) * 60 * k, a.y - 40 - k * 60 + Math.sin(an) * 30, r, 0, TAU); ctx.fill();
      }
      ring(ctx, a, k, P[1], 5, 1.1);
    },
    ground(ctx, a, k, f, P) {
      const R = H().seeded(a.seed), up = Math.sin(Math.PI * Math.min(1, k * 1.3));   // earth spikes thrust up
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * TAU + R() * 0.4, d = a.r * (0.3 + R() * 0.7), x = a.x + Math.cos(an) * d, y = a.y + Math.sin(an) * d * 0.6, hh = (40 + R() * 70) * up;
        ctx.fillStyle = hexa(i % 2 ? P[0] : '#8a6d3b', f); ctx.strokeStyle = hexa(P[2], f); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x - 4, y - hh); ctx.lineTo(x + 6, y - hh * 0.9); ctx.lineTo(x + 18, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    },
    flying(ctx, a, k, f, P) {
      ctx.lineCap = 'round';                         // crossing wind blades
      for (let i = 0; i < 4; i++) {
        const an = i * Math.PI / 4 + 0.3, L = a.r * 1.3 * ease(Math.min(1, k * 2.5));
        ctx.strokeStyle = hexa(i % 2 ? P[1] : P[0], f); ctx.lineWidth = 10 * (1 - k) + 2;
        ctx.beginPath(); ctx.moveTo(a.x - Math.cos(an) * L, a.y - Math.sin(an) * L * 0.7); ctx.quadraticCurveTo(a.x, a.y - 20, a.x + Math.cos(an) * L, a.y + Math.sin(an) * L * 0.7); ctx.stroke();
      }
      ctx.lineCap = 'butt'; ring(ctx, a, k, P[1], 4, 1.4);
    },
    psychic(ctx, a, k, f, P) {
      const R = H().seeded(a.seed);                  // reality shattering like glass
      ctx.strokeStyle = hexa('#ffffff', f); ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const an = R() * TAU; H().strokePts(ctx, [[a.x, a.y], [a.x + Math.cos(an) * a.r * 0.5, a.y + Math.sin(an) * a.r * 0.5], [a.x + Math.cos(an + 0.2) * a.r * 1.2 * ease(k), a.y + Math.sin(an + 0.2) * a.r * 1.2 * ease(k)]]); }
      for (let i = 0; i < 3; i++) ring(ctx, a, Math.max(0, k - i * 0.1), i % 2 ? P[1] : P[0], 6 - i, 1.2 + i * 0.2);
    },
    bug(ctx, a, k, f, P) {
      ctx.lineCap = 'round';                         // a whirling spiral slash
      for (let j = 0; j < 3; j++) {
        ctx.strokeStyle = hexa(j % 2 ? P[1] : P[0], f); ctx.lineWidth = 8 - j * 2;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const u = i / 40, an = u * TAU * 2 + k * 10 + j * 2.1, r = a.r * u * ease(k); ctx.lineTo(a.x + Math.cos(an) * r, a.y + Math.sin(an) * r * 0.6); }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    },
    rock(ctx, a, k, f, P) {
      const R = H().seeded(a.seed);                  // the boulder shattering into chunks
      for (let i = 0; i < 8; i++) {
        const an = R() * TAU, d = a.r * ease(k) * (0.4 + R() * 0.6);
        ctx.globalAlpha = f; H().drawRock(ctx, a.x + Math.cos(an) * d, a.y + Math.sin(an) * d * 0.6 - Math.sin(Math.PI * k) * 60, 22 + R() * 14, an + k * 4, P[0]); ctx.globalAlpha = 1;
      }
      ring(ctx, a, k, P[1], 6, 1.3);
    },
    ghost(ctx, a, k, f, P) {
      const hgt = 360 * ease(Math.min(1, k * 2));    // a pillar of dark spirits with a grinning face
      const g = ctx.createLinearGradient(0, a.y - hgt, 0, a.y); g.addColorStop(0, hexa(P[0], 0)); g.addColorStop(1, hexa('#2a1840', f * 0.85));
      ctx.fillStyle = g; ctx.fillRect(a.x - 70, a.y - hgt, 140, hgt);
      const fy = a.y - hgt * 0.6;
      ctx.fillStyle = hexa(P[1], f); ctx.beginPath(); ctx.ellipse(a.x - 22, fy, 10, 14, 0.3, 0, TAU); ctx.ellipse(a.x + 22, fy, 10, 14, -0.3, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexa(P[1], f); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.x, fy + 14, 26, 0.2, Math.PI - 0.2); ctx.stroke();
    },
    dragon(ctx, a, k, f, P) {
      ctx.globalCompositeOperation = 'lighter';      // draconic nova
      H().glow(ctx, a.x, a.y, a.r * 1.5 * ease(k), P[0], f * 0.9);
      ctx.fillStyle = hexa(P[1], f * 0.8); H().starPath(ctx, a.x, a.y, 6, a.r * 1.1 * ease(k), a.r * 0.3 * ease(k), k * 3); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ring(ctx, a, k, '#ff9de2', 6, 1.4);
    },
    dark(ctx, a, k, f, P) {
      if (k < 0.35) {                                // implodes into a black disk, then bursts
        const r = a.r * (1 - k / 0.35);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#a070ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.x, a.y, r + 4, 0, TAU); ctx.stroke();
      } else {
        const kk = (k - 0.35) / 0.65;
        ring(ctx, a, kk, '#a070ff', 12, 1.6); ring(ctx, a, Math.max(0, kk - 0.1), '#000000', 18, 1.3);
      }
    },
    steel(ctx, a, k, f, P) {
      gear(ctx, a.x, a.y, a.r * 0.8 * ease(Math.min(1, k * 2)), k * 6, hexa(P[0], f * 0.7));   // a gear-shaped shockwave
      ring(ctx, a, k, P[1], 8, 1.4); ring(ctx, a, Math.max(0, k - 0.1), '#ffd23f', 3, 1.1);
    },
  };

  // ---------------------------------------------------------------- small drawing helpers
  function hexa(hex, a) { return H().rgba(hex, a); }
  function ring(ctx, a, k, color, width, scale) {
    if (k <= 0) return;
    ctx.strokeStyle = hexa(color, Math.min(1, (1 - k) * 2)); ctx.lineWidth = width;
    ctx.beginPath(); ctx.ellipse(a.x, a.y, a.r * scale * ease(k), a.r * scale * ease(k) * 0.7, 0, 0, TAU); ctx.stroke();
  }
  function speedLines(ctx, w, h, t, color, n, alpha) {
    const cx = w / 2, cy = h / 2, R = H().seeded(Math.floor(t * 20));
    ctx.strokeStyle = hexa(color, alpha); ctx.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, r0 = Math.max(w, h) * (0.25 + R() * 0.2), r1 = Math.max(w, h);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
    }
  }
  function embers(ctx, w, h, t, colors, dir, shape) {
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + Math.sin(t * 2 + i) * 30) % w, span = h + 40;
      const y = dir < 0 ? h + 20 - ((t * (120 + (i % 5) * 40) + i * 53) % span) : ((t * (90 + (i % 5) * 30) + i * 53) % span) - 20;
      ctx.fillStyle = colors[i % colors.length];
      if (shape === 'bubble') { ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 4 + (i % 4) * 2, 0, TAU); ctx.stroke(); }
      else ctx.fillRect(x, y, 3 + (i % 3), 3 + (i % 3));
    }
  }
  function gear(ctx, x, y, r, rot, color) {
    const teeth = 12;
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = rot + (i / (teeth * 2)) * TAU, a1 = rot + ((i + 1) / (teeth * 2)) * TAU, rr = i % 2 ? r : r * 1.18;
      ctx.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr); ctx.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
    }
    ctx.closePath(); ctx.moveTo(x + r * 0.4, y); ctx.arc(x, y, r * 0.4, 0, TAU, true); ctx.fill('evenodd');
  }
  function cometPos(s, k) { const e = ease(k); return [s.x - 360 * (1 - e), s.y - 420 * (1 - e)]; }
  function comet(ctx, s, k, core, color, size) {
    const [x, y] = cometPos(s, k);
    ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.3})`; ctx.beginPath(); ctx.ellipse(s.x, s.y, size * (0.8 + k), size * (0.3 + k * 0.4), 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const tail = ctx.createLinearGradient(x - 220, y - 260, x, y); tail.addColorStop(0, hexa(color, 0)); tail.addColorStop(1, hexa(color, 0.85));
    ctx.strokeStyle = tail; ctx.lineWidth = size * 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 220, y - 260); ctx.lineTo(x, y); ctx.stroke(); ctx.lineCap = 'butt';
    H().glow(ctx, x, y, size * 2.6, color, 0.7);
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, size * 0.7, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  PG.ULT = {
    pal,
    // Full-screen backdrop behind the cut-in portrait.
    backdrop(ctx, type, w, h, t, k) { (BG[type] || BG.normal)(ctx, w, h, t, k, pal(type)); },
    // While the ultimate is incoming.
    air(ctx, s, k, t, fx) { const ty = s.move.type; (AIR[ty] || AIR.normal)(ctx, s, k, t, pal(ty), fx); },
    // On impact: particles, decal, flash, shake, crowd and a ~1s aftermath anim.
    land(fx, s) {
      const ty = s.move.type, P = pal(ty);
      const decal = (LAND[ty] || LAND.normal)(fx, s, P);
      if (decal) fx.decal(decal, s.x, s.y, s.r * 0.9, 5);
      fx.anim('ult', { ut: ty, x: s.x, y: s.y, r: s.r, seed: Math.floor(Math.random() * 1e6), dur: 1.1 });
      fx.screenFlash(P[1], 0.6);
      fx.shake(16);
    },
    boom(ctx, a, k) { const P = pal(a.ut); (BOOM[a.ut] || BOOM.normal)(ctx, a, k, Math.min(1, (1 - k) * 2.5), P); },
  };
})();
