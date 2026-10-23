// Sound effects and chiptune music, all synthesized with Web Audio (no audio files, works offline).
// Browsers only allow audio after a user gesture, so the context starts on the first key / tap.
(function () {
  const SAVE_KEY = 'pg-audio';
  let ac = null, master, musicGain, sfxGain, noiseBuf;
  const settings = { music: 0.35, sfx: 0.6, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage unavailable */ }

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.connect(master);
    sfxGain = ac.createGain(); sfxGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    Music.restart();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, init, { capture: true, passive: true }));

  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.05);
    musicGain.gain.setTargetAtTime(settings.music, t, 0.05);
    sfxGain.gain.setTargetAtTime(settings.sfx, t, 0.05);
  }

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // ---------- primitives ----------
  // A tone with a quick attack and exponential decay. slide: frequency to glide to.
  function tone(freq, dur, { type = 'square', vol = 0.2, slide, at = 0, attack = 0.005, out = sfxGain, detune = 0 } = {}) {
    if (!ac) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Filtered noise burst (whooshes, hits, explosions, drums). sweep: filter frequency to glide to.
  function noise(dur, { vol = 0.3, filter = 'lowpass', freq = 1200, sweep, q = 1, at = 0, out = sfxGain, attack = 0.003 } = {}) {
    if (!ac) return;
    const t = ac.currentTime + at;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const arp = (notes, step, opts) => notes.forEach((n, i) => tone(midi(n), opts.dur || step * 1.6, { ...opts, at: (opts.at || 0) + i * step }));

  // ---------- sound effects ----------
  const lastPlay = {};
  const throttle = (key, ms) => { const now = performance.now(); if (lastPlay[key] && now - lastPlay[key] < ms) return true; lastPlay[key] = now; return false; };

  // The sound of each type's attack.
  const TYPE_SFX = {
    fire: () => { noise(0.45, { filter: 'bandpass', freq: 600, sweep: 2600, vol: 0.35, q: 0.8 }); tone(140, 0.3, { type: 'sawtooth', vol: 0.08, slide: 80 }); },
    water: () => { for (let i = 0; i < 3; i++) tone(500 + i * 120, 0.12, { type: 'sine', vol: 0.18, slide: 900 + i * 150, at: i * 0.06 }); noise(0.25, { filter: 'highpass', freq: 2500, vol: 0.12 }); },
    grass: () => { noise(0.3, { filter: 'highpass', freq: 3000, sweep: 6000, vol: 0.18 }); tone(700, 0.15, { type: 'triangle', vol: 0.1, slide: 1100 }); },
    electric: () => { for (let i = 0; i < 5; i++) tone(900 + Math.random() * 900, 0.05, { type: 'square', vol: 0.09, at: i * 0.035 }); noise(0.2, { filter: 'highpass', freq: 4000, vol: 0.15 }); },
    ice: () => { tone(1568, 0.4, { type: 'sine', vol: 0.12 }); tone(2093, 0.4, { type: 'sine', vol: 0.09, at: 0.05 }); tone(2637, 0.5, { type: 'triangle', vol: 0.06, at: 0.1 }); },
    fighting: () => { noise(0.12, { filter: 'lowpass', freq: 900, vol: 0.4 }); tone(180, 0.12, { type: 'square', vol: 0.12, slide: 90 }); },
    poison: () => { for (let i = 0; i < 4; i++) tone(240 + Math.random() * 160, 0.1, { type: 'sine', vol: 0.16, slide: 480, at: i * 0.07 }); },
    ground: () => { noise(0.5, { filter: 'lowpass', freq: 400, sweep: 80, vol: 0.5 }); tone(70, 0.4, { type: 'sine', vol: 0.3, slide: 40 }); },
    flying: () => noise(0.4, { filter: 'bandpass', freq: 400, sweep: 2400, vol: 0.3, q: 2 }),
    psychic: () => { tone(400, 0.45, { type: 'sine', vol: 0.15, slide: 1000 }); tone(404, 0.45, { type: 'sine', vol: 0.12, slide: 1010, detune: 30 }); },
    bug: () => { for (let i = 0; i < 6; i++) tone(220, 0.04, { type: 'square', vol: 0.08, at: i * 0.03 }); },
    rock: () => { noise(0.25, { filter: 'lowpass', freq: 600, vol: 0.45 }); tone(110, 0.2, { type: 'triangle', vol: 0.2, slide: 60 }); },
    ghost: () => { tone(300, 0.6, { type: 'triangle', vol: 0.14, slide: 120 }); tone(305, 0.6, { type: 'sine', vol: 0.1, slide: 118 }); },
    dragon: () => { tone(110, 0.5, { type: 'sawtooth', vol: 0.16, slide: 220 }); noise(0.5, { filter: 'bandpass', freq: 300, sweep: 1200, vol: 0.25 }); },
    normal: () => { noise(0.1, { filter: 'bandpass', freq: 1500, vol: 0.25 }); tone(500, 0.08, { type: 'square', vol: 0.08, slide: 300 }); },
  };

  const SFX = {
    // a move being used
    move(mv) {
      if (throttle('move', 40)) return;
      switch (mv.kind) {
        case 'buff': arp([60, 64, 67, 72], 0.06, { type: 'square', vol: 0.1 }); return;
        case 'debuff': arp([72, 67, 64, 60], 0.06, { type: 'square', vol: 0.1 }); return;
        case 'heal': arp([72, 76, 79, 84, 88], 0.07, { type: 'triangle', vol: 0.15 }); return;
        case 'none': tone(300, 0.2, { type: 'sine', vol: 0.15, slide: 600 }); tone(600, 0.2, { type: 'sine', vol: 0.12, slide: 300, at: 0.2 }); return;
        case 'melee': case 'dash': noise(0.18, { filter: 'bandpass', freq: 800, sweep: 3000, vol: 0.22, q: 1.5 }); break;
        case 'projectile': tone(900, 0.18, { type: 'square', vol: 0.06, slide: 400 }); break;
        case 'strike': tone(300, mv.delay || 0.8, { type: 'triangle', vol: 0.1, slide: 900 }); break;
        case 'area': noise(0.5, { filter: 'lowpass', freq: 300, sweep: 1500, vol: 0.3 }); break;
      }
      (TYPE_SFX[mv.type] || TYPE_SFX.normal)();
    },
    // damage landed; eff = type effectiveness
    hit(eff, contact) {
      if (throttle('hit', 50)) return;
      noise(0.14, { filter: 'lowpass', freq: contact ? 1400 : 2200, vol: eff === 0 ? 0.1 : 0.35 });
      tone(160, 0.15, { type: 'sine', vol: 0.3, slide: 50 });
      if (eff > 1) { tone(880, 0.08, { type: 'square', vol: 0.12, at: 0.05 }); tone(1320, 0.12, { type: 'square', vol: 0.12, at: 0.11 }); }
      else if (eff > 0 && eff < 1) tone(220, 0.15, { type: 'triangle', vol: 0.1, slide: 160, at: 0.04 });
    },
    boom() { if (throttle('boom', 80)) return; noise(0.6, { filter: 'lowpass', freq: 900, sweep: 60, vol: 0.55 }); tone(90, 0.5, { type: 'sine', vol: 0.4, slide: 35 }); },
    poison() { if (throttle('tick', 120)) return; tone(330, 0.1, { type: 'sine', vol: 0.12, slide: 200 }); },
    burn() { if (throttle('tick', 120)) return; noise(0.12, { filter: 'bandpass', freq: 1500, vol: 0.15 }); },
    faint() { tone(500, 0.7, { type: 'square', vol: 0.12, slide: 70 }); tone(250, 0.7, { type: 'triangle', vol: 0.12, slide: 40 }); },
    sendOut() { noise(0.2, { filter: 'highpass', freq: 3000, vol: 0.18 }); arp([67, 74], 0.07, { type: 'square', vol: 0.09 }); },
    throwBall() { noise(0.3, { filter: 'bandpass', freq: 600, sweep: 2000, vol: 0.2, q: 2 }); },
    shake() { tone(1200, 0.04, { type: 'square', vol: 0.12 }); tone(900, 0.05, { type: 'square', vol: 0.1, at: 0.06 }); },
    caught() { arp([72, 76, 79, 84], 0.09, { type: 'square', vol: 0.14 }); tone(midi(84), 0.6, { type: 'triangle', vol: 0.15, at: 0.36 }); },
    breakFree() { noise(0.2, { filter: 'highpass', freq: 1500, vol: 0.25 }); tone(400, 0.2, { type: 'square', vol: 0.1, slide: 150 }); },
    victory() {
      const n = [[67, 0], [67, 0.12], [67, 0.24], [72, 0.36], [76, 0.66], [74, 0.84], [79, 1.02]];
      n.forEach(([m, at], i) => tone(midi(m), i === n.length - 1 ? 0.8 : 0.22, { type: 'square', vol: 0.13, at }));
      [48, 55, 60].forEach((m, i) => tone(midi(m), 1.6, { type: 'triangle', vol: 0.12, at: i * 0.36 }));
    },
    defeat() { arp([64, 62, 60, 55], 0.22, { type: 'triangle', vol: 0.14, dur: 0.4 }); },
    levelUp() { arp([72, 76, 79, 84, 79, 84], 0.07, { type: 'square', vol: 0.12 }); },
    heal() { [[71, 0], [71, 0.18], [71, 0.36], [67, 0.54], [76, 0.72], [74, 0.9]].forEach(([m, at]) => tone(midi(m), 0.3, { type: 'square', vol: 0.11, at })); },
    coin() { tone(midi(83), 0.08, { type: 'square', vol: 0.12 }); tone(midi(88), 0.35, { type: 'square', vol: 0.12, at: 0.08 }); },
    click() { if (throttle('click', 30)) return; tone(1100, 0.04, { type: 'square', vol: 0.06 }); },
    talk() { if (throttle('talk', 45)) return; tone(700 + Math.random() * 200, 0.03, { type: 'square', vol: 0.04 }); },
    door() { tone(midi(64), 0.12, { type: 'triangle', vol: 0.15 }); tone(midi(71), 0.2, { type: 'triangle', vol: 0.15, at: 0.1 }); },
    error() { tone(150, 0.2, { type: 'square', vol: 0.12 }); },
    clash() { this.boom(); tone(1500, 0.3, { type: 'sine', vol: 0.12, slide: 400 }); },
    // crowd roar: a swell of filtered noise
    cheer(amount = 0.6) {
      if (throttle('cheer', 600)) return;
      noise(1.2, { filter: 'bandpass', freq: 900, sweep: 1600, vol: 0.12 + amount * 0.18, q: 0.6, attack: 0.15 });
      noise(0.9, { filter: 'highpass', freq: 3000, vol: 0.05 + amount * 0.06, attack: 0.1, at: 0.1 });
    },
    badge() { this.victory(); arp([84, 88, 91, 96], 0.1, { type: 'triangle', vol: 0.12, at: 1.6 }); },
  };

  // ---------- music ----------
  // Each track: bpm, chord roots per bar (MIDI), an 8-steps-per-bar melody (MIDI or 0 = rest),
  // a bass pattern of chord tones, and a drum pattern (k = kick, s = snare, h = hat).
  const N = (s) => s.split(' ').map(x => x === '.' ? 0 : +x);
  const TRACKS = {
    world: { bpm: 118, lead: 'square', leadVol: 0.055, roots: [48, 45, 41, 43],
      melody: N('72 76 79 76 77 81 79 . 76 79 84 83 81 79 76 . 77 81 84 81 79 76 74 . 76 74 72 74 76 . 72 .'),
      bass: [0, 7, 12, 7], drums: 'k.h.s.h.k.h.s.hh' },
    night: { bpm: 84, lead: 'triangle', leadVol: 0.07, roots: [45, 41, 43, 40],
      melody: N('69 . 72 . 76 . 74 72 . 69 . 72 74 . . . 72 . 76 . 79 . 77 76 . 74 . 72 71 . . .'),
      bass: [0, 7, 12, 7], drums: '' },
    town: { bpm: 96, lead: 'triangle', leadVol: 0.08, roots: [53, 50, 46, 48],
      melody: N('77 . 81 79 77 . 74 . 77 . 81 84 82 . 81 . 79 . 77 74 72 . 74 . 77 76 74 72 77 . . .'),
      bass: [0, 7, 12, 7], drums: 'k...s...k.k.s...' },
    battle: { bpm: 152, lead: 'square', leadVol: 0.05, roots: [45, 41, 43, 40],
      melody: N('69 72 76 81 79 76 72 76 65 69 72 77 76 72 69 72 67 71 74 79 77 74 71 74 68 71 76 80 81 80 76 71'),
      bass: [0, 12, 0, 12], drums: 'k.hsk.hsk.hskkhs' },
    gym: { bpm: 164, lead: 'sawtooth', leadVol: 0.04, roots: [50, 46, 48, 45],
      melody: N('74 . 77 74 81 . 79 77 70 . 74 70 77 . 76 74 72 . 76 72 79 . 77 76 73 76 81 . 85 . 81 .'),
      bass: [0, 0, 12, 0], drums: 'kkhsk.hskkhsk.ss' },
    league: { bpm: 170, lead: 'square', leadVol: 0.055, roots: [43, 39, 41, 38],
      melody: N('79 . 82 86 84 82 79 . 75 . 79 82 80 79 75 . 77 . 81 84 82 81 77 . 74 78 81 86 . 84 . .'),
      bass: [0, 12, 0, 12], drums: 'k.hsk.hsk.hskkss' },
  };

  const Music = {
    track: null, step: 0, nextTime: 0, timer: null,
    play(name) {
      if (name === this.track) return;
      this.track = name;
      this.step = 0;
      if (ac) this.nextTime = ac.currentTime + 0.1;
    },
    restart() {
      clearInterval(this.timer);
      if (!ac) return;
      this.nextTime = ac.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 25);
    },
    schedule() {
      const tr = TRACKS[this.track];
      if (!tr || !ac || settings.muted || settings.music <= 0) { if (ac) this.nextTime = ac.currentTime + 0.05; return; }
      const stepDur = 60 / tr.bpm / 2; // 8th notes
      while (this.nextTime < ac.currentTime + 0.15) {
        this.playStep(tr, this.step, this.nextTime, stepDur);
        this.step = (this.step + 1) % 32;
        this.nextTime += stepDur;
      }
    },
    playStep(tr, step, t, sd) {
      const bar = Math.floor(step / 8), root = tr.roots[bar % tr.roots.length];
      const at = t - ac.currentTime;
      const m = tr.melody[step];
      if (m) tone(midi(m), sd * 1.7, { type: tr.lead, vol: tr.leadVol, at, out: musicGain, attack: 0.01 });
      if (step % 2 === 0) tone(midi(root + tr.bass[(step / 2) % tr.bass.length] - 12), sd * 1.8, { type: 'triangle', vol: 0.12, at, out: musicGain, attack: 0.01 });
      if (step % 4 === 0) { // soft chord pad
        for (const iv of [0, 4, 7]) tone(midi(root + 12 + iv + ((bar % 2 && tr.lead !== 'triangle') ? 0 : 0)), sd * 3.5, { type: 'sine', vol: 0.025, at, out: musicGain, attack: 0.05 });
      }
      const d = tr.drums[step % 16];
      if (d === 'k') tone(150, 0.12, { type: 'sine', vol: 0.3, slide: 45, at, out: musicGain });
      else if (d === 's') noise(0.12, { filter: 'bandpass', freq: 1800, vol: 0.14, at, out: musicGain });
      else if (d === 'h') noise(0.04, { filter: 'highpass', freq: 7000, vol: 0.05, at, out: musicGain });
    },
  };

  PG.Audio = {
    settings, SFX, Music,
    sfx(name, ...args) { try { if (ac && !settings.muted && SFX[name]) SFX[name](...args); } catch (e) { /* never let audio break the game */ } },
    music(name) { Music.play(name); },
    set(key, value) { settings[key] = value; save(); applyVolumes(); },
    toggleMute() { settings.muted = !settings.muted; save(); applyVolumes(); return settings.muted; },
  };
})();
