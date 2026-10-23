// Walk-in gyms: each gym is a small tile map with a story, gym trainers and a type-themed challenge.
// The leader only battles once their trainers are beaten and the gym's challenge is solved.
//
// Layout legend (15 x 12 tiles):
//   #  wall          .  floor        _  exit mat       L  leader        G  gym guide
//   1-3 gym trainers (challenge you when you walk up to them)
//   D  gate that opens when every trainer is beaten
//   K  gate that opens when the gym's puzzle is solved
//   S  switch / valve / trash can (depends on the puzzle)   Q  quiz statue   N  notice board
//   R rock  M machine  F brazier  W water  B hedge   (decor, solid)
//   I  invisible wall (shows up once you bump into it)
//   X/x Y/y Z/z V/v U/u  linked warp pads (step on one to arrive at its partner)
(function () {
  const { SPECIES } = PG;
  const TS = 40, COLS = 15, ROWS = 12;
  const W = COLS * TS, H = ROWS * TS;
  const R = 12; // player collision radius
  const SOLID = new Set('#LG123DKSQNRMFWBI'.split(''));
  const PADS = 'XYZVU';

  // ---------- per-gym plans ----------
  const PLANS = {
    pewter: {
      puzzle: 'none', floor: ['#b9ac92', '#b2a58b'], wall: '#6f6553',
      layout: [
        '###############',
        '#R....RLR....R#',
        '#.............#',
        '######DDD######',
        '#R...........R#',
        '#...R..2..R...#',
        '#.............#',
        '#RR..#####..RR#',
        '#.....1.......#',
        '#.R.........R.#',
        '#....G........#',
        '#######_#######',
      ],
      intro: ["Hey, champ in the making! Welcome to Pewter Gym.", "Brock trains rock-hard Pokémon. Water and Grass moves crack them open!", "His trainers guard the stone gate. Beat them both and it will roll aside."],
      hint: ['Beat both trainers and the stone gate opens. Water and Grass moves work wonders here.'],
      trainers: [
        { title: 'Camper', name: 'Liam', team: [['geodude', 10]], lines: ['Brock taught me that a rock never runs. Neither do I!'] },
        { title: 'Hiker', name: 'Dan', team: [['sandshrew', 11], ['geodude', 11]], lines: ["I climbed every mountain around here. You're just a pebble!"] },
      ],
      leaderIntro: ["I'm Brock, Pewter's Gym Leader.", 'My rock-hard willpower is shown in my Pokémon. Show me what you’ve got!'],
      leaderLose: ['I took you for granted... As proof of your victory, here is the Boulder Badge!'],
    },
    cerulean: {
      puzzle: 'valves', floor: ['#cfe6f5', '#c3ddef'], wall: '#3c7fb8',
      layout: [
        '###############',
        '#WWW...L...WWW#',
        '#WWW.......WWW#',
        '#KKKKKKKKKKKKK#',
        '#S...W...W...S#',
        '#....W.2.W....#',
        '#WWW.W...W.WWW#',
        '#....W...W....#',
        '#.1..WW.WW..3.#',
        '#.............#',
        '#....G........#',
        '#######_#######',
      ],
      intro: ['Welcome to Cerulean Gym! Misty fights from behind a flooded channel.', 'Turn the two valves on the far left and right to drain it.', 'Electric and Grass moves will make her Water Pokémon sweat.'],
      hint: ['Both valves (left and right walls) must be open to drain the channel.'],
      trainers: [
        { title: 'Swimmer', name: 'Luis', team: [['horsea', 16]], lines: ['Splash! You walked right into my lane!'] },
        { title: 'Swimmer', name: 'Diana', team: [['goldeen', 16], ['shellder', 17]], lines: ["Misty's the best swimmer around. I'm second best!"] },
        { title: 'Picnicker', name: 'Ana', team: [['psyduck', 17]], lines: ['My Psyduck has a headache... and so will you!'] },
      ],
      leaderIntro: ["So you drained my pool, huh? I'm Misty!", "My policy is an all-out offensive with Water-type Pokémon. Let's go!"],
      leaderLose: ["Wow! You're too much! All right, you can have the Cascade Badge."],
    },
    vermilion: {
      puzzle: 'trash', floor: ['#d9d6c8', '#cfccbd'], wall: '#5a5a62',
      layout: [
        '###############',
        '#M....M.M....M#',
        '#......L......#',
        '#KKKKKKKKKKKKK#',
        '#.S.S.S.S.S.S.#',
        '#.............#',
        '#.S.S.S.S.S.S.#',
        '#......2......#',
        '#.1.........3.#',
        '#.............#',
        '#....G........#',
        '#######_#######',
      ],
      intro: ["Lt. Surge locked himself behind an electric barrier. Classic Surge.", 'He hid the two power switches in these trash cans. Search them!', 'Ground moves shrug off his Electric attacks completely.'],
      hint: ['Two of the twelve trash cans hide switches. Find both to cut the power.'],
      trainers: [
        { title: 'Engineer', name: 'Bob', team: [['voltorb', 22], ['magnemite', 22]], lines: ['I wired this whole gym. Watch your step... ZAP!'] },
        { title: 'Gentleman', name: 'Tucker', team: [['pikachu', 23]], lines: ['A true gentleman always carries a Pikachu.'] },
        { title: 'Rocker', name: 'Luca', team: [['voltorb', 23], ['electabuzz', 24]], lines: ['Turn it up to eleven, baby!'] },
      ],
      leaderIntro: ["Hey, kid! You found my switches? Not bad for a little twerp!", "I'm Lt. Surge! Electric Pokémon saved me during the war. They'll zap you just the same!"],
      leaderLose: ["Whoa! You're the real deal, kid! Take the Thunder Badge!"],
    },
    celadon: {
      puzzle: 'none', floor: ['#cfe8c0', '#c4e0b4'], wall: '#4a7d3a',
      layout: [
        '###############',
        '#BBBBB.L.BBBBB#',
        '#B...........B#',
        '#BBBBBBDBBBBBB#',
        '#B.B.......B.B#',
        '#B.B.BBBBB.B.B#',
        '#B...B.2.B...B#',
        '#BBB.B...B.BBB#',
        '#B...BB.BB...B#',
        '#B.1.......B.B#',
        '#B...G.....B.B#',
        '#######_#######',
      ],
      intro: ['Welcome to the Celadon Gym garden. Mind the hedges, they make a maze.', "Erika's Grass Pokémon wilt against Fire, Ice, Flying and Poison moves.", 'Beat her trainers and the flower gate before her will open.'],
      hint: ['Find a way through the hedges and beat both trainers to open the flower gate.'],
      trainers: [
        { title: 'Beauty', name: 'Lola', team: [['oddish', 27], ['bellsprout', 27]], lines: ['Flowers are lovely, but their thorns hurt!'] },
        { title: 'Lass', name: 'Kay', team: [['gloom', 28], ['tangela', 28]], lines: ['Erika says a garden needs patience. I have none!'] },
      ],
      leaderIntro: ['Hello... Lovely weather, isn’t it? I’m Erika.', 'I am a student of the art of flower arranging. Shall we?'],
      leaderLose: ['Oh! I concede defeat. You are remarkably strong. Please take the Rainbow Badge.'],
    },
    fuchsia: {
      puzzle: 'invisible', floor: ['#d9cde3', '#cfc2da'], wall: '#5d3f72',
      layout: [
        '###############',
        '#......L......#',
        '#.IIIIIIIIIII.#',
        '#.I.........I.#',
        '#.I.IIIIIII.I.#',
        '#...I..2..I...#',
        '#IIII.III.III.#',
        '#.1.I.....I...#',
        '#.I.III.III.I.#',
        '#.I.........I.#',
        '#.III.G...III.#',
        '#######_#######',
      ],
      intro: ['Fuchsia Gym is full of invisible walls. Ninja stuff!', 'Bump into one and it shows itself. Feel your way to Koga.', 'Psychic and Ground moves hit his Poison Pokémon hard.'],
      hint: ['The walls are invisible until you bump into them. Try the outer edges.'],
      trainers: [
        { title: 'Juggler', name: 'Kirk', team: [['koffing', 32], ['grimer', 32]], lines: ['Now you see me, now you poison!'] },
        { title: 'Tamer', name: 'Edgar', team: [['arbok', 33], ['golbat', 33]], lines: ['My snakes never miss a meal.'] },
      ],
      leaderIntro: ['Fwahahaha! A mere child found the way through my walls?', 'I am Koga. Despair at my poison techniques!'],
      leaderLose: ['Humph! You have proven your worth. Here, take the Soul Badge!'],
    },
    saffron: {
      puzzle: 'teleport', floor: ['#ecd3e2', '#e4c8d9'], wall: '#7a3f66',
      layout: [
        '###############',
        '#......L......#',
        '#.z.........U.#',
        '###############',
        '#x....Z#y.....#',
        '#.....1#...V..#',
        '#......#..2...#',
        '###############',
        '#.X.......Y.v.#',
        '#...........u.#',
        '#....G........#',
        '#######_#######',
      ],
      intro: ["Saffron Gym is a maze of warp pads. Sabrina sees everything that happens here.", 'Step on a glowing pad and you appear at its twin. Only one route reaches her.', 'Bug, Ghost and Dark-ish moves rattle her Psychic Pokémon.'],
      hint: ['Each pad has a matching twin of the same colour. Explore the side rooms to find the route up.'],
      trainers: [
        { title: 'Psychic', name: 'Johan', team: [['kadabra', 37]], lines: ['I saw you coming three warps ago.'] },
        { title: 'Channeler', name: 'Amy', team: [['haunter', 37], ['drowzee', 37]], lines: ['The spirits whisper your name...'] },
      ],
      leaderIntro: ['I had a vision of your arrival.', 'I am Sabrina. I dislike fighting, but if you wish, I will show you my powers!'],
      leaderLose: ["I'm shocked... but a loss is a loss. Take the Marsh Badge."],
    },
    cinnabar: {
      puzzle: 'quiz', floor: ['#ead0b8', '#e2c4aa'], wall: '#8a3a1c',
      layout: [
        '###############',
        '#F.....L.....F#',
        '#.............#',
        '#KKKKKKKKKKKKK#',
        '#....Q...Q....#',
        '#F...........F#',
        '#......Q......#',
        '#..1.......2..#',
        '#F...........F#',
        '#.............#',
        '#....G........#',
        '#######_#######',
      ],
      intro: ["Blaine is a hothead and a quizmaster. Answer his three statues to put out the fire wall.", 'Get one wrong and a trainer jumps out to fight you!', 'Water, Ground and Rock moves douse his Fire Pokémon.'],
      hint: ['All three statues must be answered correctly to put out the fire wall.'],
      trainers: [
        { title: 'Super Nerd', name: 'Erik', team: [['ponyta', 42], ['growlithe', 42]], lines: ['I memorised every answer! ...I think.'] },
        { title: 'Burglar', name: 'Quinn', team: [['vulpix', 43], ['magmar', 43]], lines: ['Hand over your Badges... I mean, battle me!'] },
      ],
      quizTrainer: { title: 'Burglar', name: 'Ramon', team: [['charmeleon', 42], ['ponyta', 42]], lines: ['Wrong answer! Time to pay up!'] },
      quiz: [
        { q: 'Which type is super effective against Fire?', options: ['Water', 'Grass', 'Ice'], answer: 0 },
        { q: 'Which Pokémon evolves into Arcanine?', options: ['Ponyta', 'Growlithe', 'Vulpix'], answer: 1 },
        { q: 'Fire moves are NOT very effective against which type?', options: ['Bug', 'Ice', 'Rock'], answer: 2 },
      ],
      leaderIntro: ['Hah! You answered my quiz? Then you have the brains. But do you have the fire?', "I am Blaine! Red-hot leader of Cinnabar Gym! You'd better have Burn Heal!"],
      leaderLose: ['I have burned down to nothing! Not even ashes remain! You have earned the Volcano Badge!'],
    },
    viridian: {
      puzzle: 'order', floor: ['#c9b894', '#bfae89'], wall: '#4a3b26',
      layout: [
        '###############',
        '#R....RLR....R#',
        '#.............#',
        '#KKKKKKKKKKKKK#',
        '#S....#.#....S#',
        '#.1...#.#...2.#',
        '#.....#S#.....#',
        '#.............#',
        '#..R.....3.R..#',
        '#N............#',
        '#....G........#',
        '#######_#######',
      ],
      intro: ['This is the Viridian Gym... the last one. Its leader is a mystery.', 'Three switches open the earth gate, but only in the right order. The notice board knows it.', 'Water, Grass and Ice moves bury his Ground Pokémon.'],
      hint: ['Read the notice board in the corner, then press the switches in that order. A mistake resets them.'],
      symbols: ['◆', '▲', '●'],      // switches in reading order (top-left first)
      order: [2, 0, 1],              // press ●, then ◆, then ▲
      notice: 'Ground rules: ● comes first, then ◆, and ▲ last.',
      trainers: [
        { title: 'Cooltrainer', name: 'Yuji', team: [['sandslash', 48], ['marowak', 48]], lines: ['The boss is watching. I will not lose!'] },
        { title: 'Black Belt', name: 'Kiyo', team: [['machoke', 49], ['onix', 48]], lines: ['Hyaaah! My fists are harder than the ground!'] },
        { title: 'Cooltrainer', name: 'Warren', team: [['rhyhorn', 49], ['nidoqueen', 49]], lines: ['You made it this far? Impressive. It ends here.'] },
      ],
      leaderIntro: ['Fwahaha! Welcome to my hideout... I mean, my gym.', "I am Giovanni, the strongest Gym Leader of all. Now, let's see what you're made of!"],
      leaderLose: ['Ha! That was a truly intense fight. You have won! As proof, here is the Earth Badge!'],
    },
  };

  const PAD_COLORS = { X: '#ff7ac8', Y: '#7ad3ff', Z: '#ffd35a', V: '#9cff7a', U: '#c49cff' };

  // ---------- dialogue & quiz boxes ----------
  // lines: strings or { who, text }. Resolves when the last line is dismissed (click / Enter / Space).
  function say(lines, who) {
    const UI = PG.UI;
    lines = lines.map(l => typeof l === 'string' ? { who, text: l } : l);
    return new Promise(res => {
      let i = 0, shown = 0, timer = 0;
      const box = UI.modal(`<div class="dlg-who"></div><p class="dlg-text"></p>
        <button class="btn primary dlg-next" data-enter>▼ <kbd>Enter</kbd></button>`, { cls: 'dialog' });
      document.getElementById('modal-root').classList.add('dialog-root');
      const whoEl = box.querySelector('.dlg-who'), textEl = box.querySelector('.dlg-text'), btn = box.querySelector('.dlg-next');
      const show = () => {
        const l = lines[i];
        whoEl.textContent = l.who || '';
        whoEl.style.display = l.who ? '' : 'none';
        shown = 0; clearInterval(timer);
        timer = setInterval(() => {
          shown = Math.min(l.text.length, shown + 2);
          if (shown % 4 === 0) PG.Audio.sfx('talk');
          textEl.textContent = l.text.slice(0, shown);
          if (shown >= l.text.length) clearInterval(timer);
        }, 22);
      };
      const next = () => {
        if (shown < lines[i].text.length) { shown = lines[i].text.length; textEl.textContent = lines[i].text; clearInterval(timer); return; }
        i++;
        if (i >= lines.length) { clearInterval(timer); document.getElementById('modal-root').classList.remove('dialog-root'); UI.closeModal(); res(); return; }
        show();
      };
      btn.onclick = next;
      box.addEventListener('click', (e) => { if (e.target !== btn && !btn.contains(e.target)) next(); });
      show();
    });
  }

  // A question with clickable answers. Resolves with the chosen index.
  function choose(question, options, who) {
    const UI = PG.UI;
    return new Promise(res => {
      const box = UI.modal(`${who ? `<div class="dlg-who">${who}</div>` : ''}<p class="dlg-text">${question}</p>
        <div class="dlg-choices">${options.map((o, i) => `<button class="btn" data-i="${i}">${String.fromCharCode(65 + i)}. ${o}</button>`).join('')}</div>`, { cls: 'dialog' });
      document.getElementById('modal-root').classList.add('dialog-root');
      box.onclick = (e) => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        document.getElementById('modal-root').classList.remove('dialog-root');
        UI.closeModal();
        res(+b.dataset.i);
      };
    });
  }

  // ---------- the walk-in gym ----------
  class GymInterior {
    constructor(gymIndex, game) {
      this.kind = 'gym';
      this.gymIndex = gymIndex;
      this.gym = PG.gyms()[gymIndex];
      this.plan = PLANS[this.gym.id];
      this.L = { title: this.gym.name };
      this.grid = this.plan.layout.map(r => r.split(''));
      this.time = 0;
      this.near = null;
      this.cooldown = 0.4;
      this.busy = false;      // a dialogue / battle is being set up
      this.revealed = new Set();
      this.bump = new Map();  // invisible wall -> time it was revealed
      this.flash = 0;         // gate-open flash
      // where things are
      this.trainers = []; this.switches = []; this.quizzes = []; this.pads = {};
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const c = this.grid[y][x];
        if ('123'.includes(c)) this.trainers[+c - 1] = { x, y };
        if (c === 'S') this.switches.push({ x, y });
        if (c === 'Q') this.quizzes.push({ x, y });
        if (c === 'L') this.leader = { x, y };
        if (c === 'G') this.guide = { x, y };
        if (c === 'N') this.noticeAt = { x, y };
        if (c === '_') this.exit = { x, y };
        if (PADS.includes(c.toUpperCase()) && c !== '.' && /[A-Za-z]/.test(c) && PADS.includes(c.toUpperCase()) && !SOLID.has(c)) {
          (this.pads[c] = { x, y });
        }
      }
      this.p = { x: (this.exit.x + 0.5) * TS, y: (this.exit.y - 0.5) * TS, dir: 'up', walk: 0, moving: false };
      this.drawProxy = { player: this.p, tile: () => -1, drawTallGrass() {} };
      this.game = game;
      // saved progress for this gym
      const all = game.state.gymProgress || (game.state.gymProgress = {});
      this.prog = all[this.gym.id] || (all[this.gym.id] = { beaten: [], solved: ['none', 'teleport', 'invisible', 'dark', 'ice'].includes(this.plan.puzzle), on: [], found: [], quiz: [], seq: [] });
      if (this.plan.puzzle === 'trash' && !this.prog.trash) {
        const n = this.switches.length, a = Math.floor(Math.random() * n);
        let b = Math.floor(Math.random() * (n - 1)); if (b >= a) b++;
        this.prog.trash = [a, b];
      }
      if (game.state.badges.includes(this.gym.id)) {
        this.prog.solved = true; this.prog.beaten = this.plan.trainers.map((_, i) => i);
        // gym already cleared: show every invisible wall so walking back out is easy
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (this.grid[y][x] === 'I') this.revealed.add(x + ',' + y);
      }
    }

    // ---------- state ----------
    trainersDone() { return this.plan.trainers.every((_, i) => this.prog.beaten.includes(i)); }
    gateOpen(c) { return c === 'D' ? this.trainersDone() : c === 'K' ? this.prog.solved : false; }
    tileAt(px, py) {
      const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
      return this.grid[ty][tx];
    }
    solidTile(c, tx, ty) {
      if (c === 'D' || c === 'K') return !this.gateOpen(c);
      if ('123'.includes(c)) return true;
      return SOLID.has(c);
    }
    blocked(px, py) {
      for (const [ox, oy] of [[-R, -R * 0.5], [R, -R * 0.5], [-R, R], [R, R]]) {
        const x = px + ox, y = py + oy, tx = Math.floor(x / TS), ty = Math.floor(y / TS);
        const c = this.tileAt(x, y);
        if (this.solidTile(c, tx, ty)) {
          if (c === 'I') { const k = tx + ',' + ty; if (!this.revealed.has(k)) { this.revealed.add(k); this.bump.set(k, this.time); } }
          return true;
        }
      }
      return false;
    }

    // ---------- update ----------
    update(dt, game) {
      this.time += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.flash = Math.max(0, this.flash - dt);
      if (this.busy) return;
      if (!this.prog.introSeen) { this.prog.introSeen = true; this.run(() => say(this.plan.intro, 'Gym Guide')); return; }
      if (game.pendingGymLines) { const l = game.pendingGymLines; game.pendingGymLines = null; this.run(() => say(l, this.gym.leader)); return; }

      const I = PG.Input, p = this.p, a = I.axis();
      p.moving = !!(a.x || a.y);
      if (this.updateIce(dt, a)) { /* sliding on ice: input ignored */ }
      else if (p.moving) {
        const sp = 170;
        const nx = p.x + a.x * sp * dt, ny = p.y + a.y * sp * dt;
        if (!this.blocked(nx, p.y)) p.x = nx;
        if (!this.blocked(p.x, ny)) p.y = ny;
        p.walk += dt * 12;
        if (Math.abs(a.x) > Math.abs(a.y)) p.dir = a.x > 0 ? 'right' : 'left';
        else p.dir = a.y > 0 ? 'down' : 'up';
      }
      // leave through the door
      if (p.y > (this.exit.y + 0.6) * TS) { game.enterWorld(); return; }

      // warp pads
      const here = this.tileAt(p.x, p.y);
      if (PADS.includes(here.toUpperCase()) && /[A-Za-z]/.test(here) && !SOLID.has(here)) {
        if (!p.onPad) {
          const twin = here === here.toUpperCase() ? here.toLowerCase() : here.toUpperCase();
          const t = this.pads[twin];
          if (t) { p.x = (t.x + 0.5) * TS; p.y = (t.y + 0.5) * TS; this.flash = 0.35; }
        }
        p.onPad = true;
      } else p.onPad = false;

      // gym trainers challenge you when you walk up to them
      for (let i = 0; i < this.trainers.length; i++) {
        const t = this.trainers[i];
        if (!t || this.prog.beaten.includes(i) || this.cooldown > 0) continue;
        if (Math.hypot((t.x + 0.5) * TS - p.x, (t.y + 0.5) * TS - p.y) < TS * 1.45) { this.challenge(i); return; }
      }

      // what can be used from here
      this.near = this.findNear();
      PG.UI.setInteriorPrompt(this.near);
      if (I.consume('interact') && this.near && this.cooldown <= 0) this.use(this.near);
    }

    findNear() {
      const p = this.p, cands = [];
      const add = (pos, st) => { if (!pos) return; const d = Math.hypot((pos.x + 0.5) * TS - p.x, (pos.y + 0.5) * TS - p.y); if (d < TS * 1.4) cands.push({ d, ...st, x: pos.x, y: pos.y }); };
      add(this.leader, { id: 'leader', icon: '🏅', label: `Talk to ${this.gym.leader}` });
      add(this.guide, { id: 'guide', icon: '💬', label: 'Talk to the Gym Guide' });
      add(this.noticeAt, { id: 'notice', icon: '📜', label: 'Read the notice board' });
      const pz = this.plan.puzzle;
      this.switches.forEach((s, i) => add(s, { id: 'switch', i, icon: pz === 'trash' ? '🗑️' : pz === 'valves' ? '🔧' : '🔘',
        label: pz === 'trash' ? (this.plan.searchLabel || 'Search the trash can') : pz === 'valves' ? 'Turn the valve' : `Press the ${this.plan.symbols[i]} switch` }));
      this.quizzes.forEach((q, i) => { if (!this.prog.quiz.includes(i)) add(q, { id: 'quiz', i, icon: '❓', label: 'Answer the quiz statue' }); });
      cands.sort((a, b) => a.d - b.d);
      return cands[0] || null;
    }

    // Ice floor ('C'): step onto it and you slide in a straight line until something stops you.
    // Returns true while the player is sliding (or just got launched), so normal walking is skipped.
    updateIce(dt, a) {
      const p = this.p;
      const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
      const onIce = this.grid[ty] && this.grid[ty][tx] === 'C';
      const free = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && !this.solidTile(this.grid[y][x], x, y);
      if (!p.slide) {
        if (!onIce || !(a.x || a.y)) return false;
        // choose a cardinal direction from the input
        const d = Math.abs(a.x) > Math.abs(a.y) ? [Math.sign(a.x), 0] : [0, Math.sign(a.y)];
        if (!free(tx + d[0], ty + d[1])) return false;
        p.slide = { dx: d[0], dy: d[1], tx, ty };
        p.x = (tx + 0.5) * TS; p.y = (ty + 0.5) * TS;
        p.dir = d[0] > 0 ? 'right' : d[0] < 0 ? 'left' : d[1] > 0 ? 'down' : 'up';
      }
      const sl = p.slide, speed = 300 * dt;
      const tgx = (sl.tx + sl.dx + 0.5) * TS, tgy = (sl.ty + sl.dy + 0.5) * TS;
      const dist = Math.hypot(tgx - p.x, tgy - p.y);
      if (dist > speed) { p.x += sl.dx * speed; p.y += sl.dy * speed; return true; }
      // reached the next tile's centre
      p.x = tgx; p.y = tgy; sl.tx += sl.dx; sl.ty += sl.dy;
      if (Math.random() < 0.5) PG.Audio.sfx('click');
      const here = this.grid[sl.ty][sl.tx];
      if (here !== 'C' || !free(sl.tx + sl.dx, sl.ty + sl.dy)) p.slide = null; // off the ice, or bumped into something
      return true;
    }

    // Run an async interaction while freezing the gym.
    async run(fn) {
      this.busy = true;
      PG.UI.setInteriorPrompt(null);
      try { await fn(); } finally { this.busy = false; this.cooldown = Math.max(this.cooldown, 0.3); PG.Input.clear(); }
    }

    challenge(i) {
      const t = this.plan.trainers[i];
      this.run(async () => {
        await say(t.lines, `${t.title} ${t.name}`);
        if (!this.game.startGymTrainerBattle(this, t, i)) this.cooldown = 3; // team fainted: give the player room to leave
      });
    }

    use(st) {
      const g = this.game, plan = this.plan, pz = plan.puzzle, prog = this.prog;
      switch (st.id) {
        case 'guide': this.run(() => say(prog.solved && this.trainersDone() ? ['The way is clear! Go show the leader what you can do.'] : plan.hint, 'Gym Guide')); break;
        case 'notice': this.run(() => say([plan.notice], 'Notice board')); break;
        case 'leader':
          this.run(async () => {
            if (g.state.badges.includes(this.gym.id)) {
              const pick = await choose(`You already have the ${this.gym.badge}. Want a rematch?`, ['Rematch!', 'Not now'], this.gym.leader);
              if (pick !== 0) return;
            } else if (!this.trainersDone()) {
              await say(['Not so fast! Defeat my gym trainers first, then we can talk.'], this.gym.leader); return;
            } else await say(plan.leaderIntro, this.gym.leader);
            g.openGym(this.gymIndex);
          });
          break;
        case 'switch': this.run(() => this.useSwitch(st.i)); break;
        case 'quiz': this.run(() => this.useQuiz(st.i)); break;
      }
    }

    async useSwitch(i) {
      const pz = this.plan.puzzle, prog = this.prog;
      if (prog.solved && pz !== 'valves') { await say(['It has already done its job.']); return; }
      if (pz === 'valves') {
        if (prog.on.includes(i)) { await say(['This valve is already open. Water is gushing out!']); return; }
        prog.on.push(i);
        if (prog.on.length >= this.switches.length) { prog.solved = true; this.flash = 0.35; await say(['You turned the valve... The channel drains with a great WHOOSH! The way to Misty is open.']); }
        else await say(['You turned the valve. The water level dropped a little... one more to go!']);
      } else if (pz === 'trash') {
        const which = prog.trash.indexOf(i);
        if (which < 0 || prog.found.includes(i)) { await say([prog.found.includes(i) ? 'You already flipped this switch.' : "Nope! There's only trash here."]); return; }
        prog.found.push(i);
        if (prog.found.length >= 2) { prog.solved = true; this.flash = 0.35; await say(['There\'s a switch under the trash! You pressed it... The second electric lock opened. The barrier is down!']); }
        else await say(["There's a switch under the trash! You pressed it. The first electric lock opened! Find the other one."]);
      } else if (pz === 'order') {
        const want = this.plan.order[prog.seq.length];
        if (i === want) {
          prog.seq.push(i);
          if (prog.seq.length >= this.plan.order.length) { prog.solved = true; this.flash = 0.35; await say([`You pressed ${this.plan.symbols[i]}... The ground rumbles and the earth gate sinks away!`]); }
          else await say([`You pressed ${this.plan.symbols[i]}. Click! Something moved deep underground.`]);
        } else {
          prog.seq = [];
          await say([`You pressed ${this.plan.symbols[i]}... BZZT! Wrong order. All the switches reset.`]);
        }
      }
      this.game.save();
    }

    async useQuiz(i) {
      const q = this.plan.quiz[i];
      const pick = await choose(q.q, q.options, 'Quiz statue');
      if (pick === q.answer) {
        this.prog.quiz.push(i);
        const left = this.plan.quiz.length - this.prog.quiz.length;
        if (!left) { this.prog.solved = true; this.flash = 0.35; await say(['Correct! The fire wall flickers... and goes out! The way to Blaine is open.']); }
        else await say([`Correct! ${left} statue${left > 1 ? 's' : ''} left.`]);
        this.game.save();
      } else {
        const t = this.plan.quizTrainer;
        await say(['Wrong answer!', ...t.lines], `${t.title} ${t.name}`);
        if (!this.game.startGymTrainerBattle(this, t, -1)) this.cooldown = 3;
      }
    }

    // after a battle started from this gym (result: 'win' | 'lose')
    onReturn(result, trainerIndex) {
      if (result === 'win' && trainerIndex >= 0 && !this.prog.beaten.includes(trainerIndex)) this.prog.beaten.push(trainerIndex);
      if (result === 'win' && trainerIndex >= 0 && this.trainersDone() && this.grid.some(r => r.includes('D'))) this.flash = 0.35;
      // stand back a little so the same trainer/statue doesn't trigger again instantly
      this.cooldown = 0.6;
      if (this.game.state.badges.includes(this.gym.id))
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (this.grid[y][x] === 'I') this.revealed.add(x + ',' + y);
    }

    // ---------- drawing ----------
    draw(ctx, vw, vh, game) {
      const scale = Math.min(vw / W, (vh - 10) / H);
      const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
      ctx.fillStyle = '#12141c'; ctx.fillRect(0, 0, vw, vh);
      ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
      const plan = this.plan, t = this.time, type = PG.TYPES[this.gym.type].color;

      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const c = this.grid[y][x], px = x * TS, py = y * TS;
        ctx.fillStyle = plan.floor[(x + y) & 1];
        ctx.fillRect(px, py, TS, TS);
        switch (c) {
          case '#':
            ctx.fillStyle = plan.wall; ctx.fillRect(px, py, TS, TS);
            ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(px, py, TS, 4);
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px, py + TS - 5, TS, 5);
            break;
          case 'C': {
            const g2 = ctx.createLinearGradient(px, py, px + TS, py + TS);
            g2.addColorStop(0, '#dff4ff'); g2.addColorStop(1, '#a9dcf5');
            ctx.fillStyle = g2; ctx.fillRect(px, py, TS, TS);
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(px + 6, py + 30); ctx.lineTo(px + 16, py + 20); ctx.moveTo(px + 22, py + 14); ctx.lineTo(px + 30, py + 6); ctx.stroke();
            ctx.lineWidth = 1;
            break;
          }
          case '_':
            ctx.fillStyle = type; ctx.fillRect(px + 2, py + 6, TS - 4, TS - 6);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('EXIT', px + TS / 2, py + TS / 2 + 6);
            break;
          case 'R': rock(ctx, px, py); break;
          case 'M':
            ctx.fillStyle = '#444b5a'; roundRect(ctx, px + 4, py + 4, TS - 8, TS - 6, 5); ctx.fill();
            ctx.fillStyle = Math.sin(t * 6 + x) > 0 ? '#ffe04a' : '#6cf'; ctx.fillRect(px + 10, py + 12, 6, 6); ctx.fillRect(px + 22, py + 12, 6, 6);
            break;
          case 'F': {
            ctx.fillStyle = '#5a4a3a'; roundRect(ctx, px + 8, py + 18, TS - 16, TS - 20, 4); ctx.fill();
            const fl = 1 + Math.sin(t * 12 + x * 3) * 0.15;
            ctx.fillStyle = '#ff8c00'; ctx.beginPath(); ctx.ellipse(px + TS / 2, py + 16, 9 * fl, 13 * fl, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.ellipse(px + TS / 2, py + 19, 4, 7 * fl, 0, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'W': water(ctx, px, py, t, x, y); break;
          case 'B':
            ctx.fillStyle = '#2f7a3a'; roundRect(ctx, px + 1, py + 1, TS - 2, TS - 2, 10); ctx.fill();
            ctx.fillStyle = '#3f9a4a'; ctx.beginPath(); ctx.arc(px + 13, py + 14, 9, 0, Math.PI * 2); ctx.arc(px + 27, py + 22, 10, 0, Math.PI * 2); ctx.fill();
            if ((x * 7 + y) % 3 === 0) { ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.arc(px + 20, py + 12, 3, 0, Math.PI * 2); ctx.fill(); }
            break;
          case 'I': {
            const k = x + ',' + y;
            if (this.revealed.has(k)) {
              const age = t - (this.bump.get(k) || 0);
              ctx.fillStyle = `rgba(110,60,150,${Math.max(0.35, 0.9 - age * 0.3)})`; roundRect(ctx, px + 2, py + 2, TS - 4, TS - 4, 6); ctx.fill();
            }
            break;
          }
          case 'D':
            if (!this.gateOpen('D')) {
              ctx.fillStyle = '#7d715e'; ctx.fillRect(px, py + 6, TS, TS - 12);
              ctx.fillStyle = '#9b8f78'; for (let i = 0; i < 3; i++) ctx.fillRect(px + 4 + i * 12, py + 8, 8, TS - 16);
            }
            break;
          case 'K': if (!this.gateOpen('K')) this.drawGate(ctx, px, py, x, y); break;
          case 'S': this.drawSwitch(ctx, px, py, this.switches.findIndex(s => s.x === x && s.y === y)); break;
          case 'Q': {
            const done = this.prog.quiz.includes(this.quizzes.findIndex(q => q.x === x && q.y === y));
            ctx.fillStyle = '#6b6b78'; roundRect(ctx, px + 8, py + 22, TS - 16, TS - 22, 3); ctx.fill();
            ctx.fillStyle = done ? '#7be07b' : '#b8b8c8'; ctx.beginPath(); ctx.arc(px + TS / 2, py + 16, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#222'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(done ? '✓' : '?', px + TS / 2, py + 21);
            break;
          }
          case 'N':
            ctx.fillStyle = '#7a5a35'; ctx.fillRect(px + TS / 2 - 2, py + 22, 4, 16);
            ctx.fillStyle = '#e8d6a8'; roundRect(ctx, px + 4, py + 4, TS - 8, 20, 3); ctx.fill();
            ctx.fillStyle = '#5a4a3a'; for (let i = 0; i < 3; i++) ctx.fillRect(px + 9, py + 9 + i * 5, TS - 18, 2);
            break;
          default:
            if (PADS.includes(c.toUpperCase()) && /[A-Za-z]/.test(c) && !SOLID.has(c)) {
              const col = PAD_COLORS[c.toUpperCase()], pulse = 0.5 + 0.5 * Math.sin(t * 4 + x);
              ctx.fillStyle = col; ctx.globalAlpha = 0.35 + pulse * 0.3;
              ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS / 2, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
              ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS / 2, 16, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
            }
        }
      }

      // people: guide, trainers, leader (sorted by y so they overlap nicely)
      const people = [];
      if (this.guide) people.push({ ...this.guide, kind: 'guide' });
      this.trainers.forEach((tr, i) => tr && people.push({ ...tr, kind: 'trainer', i }));
      people.push({ ...this.leader, kind: 'leader' });
      people.sort((a, b) => a.y - b.y);
      for (const pp of people) {
        const cx = (pp.x + 0.5) * TS, cy = (pp.y + 0.5) * TS;
        if (pp.kind === 'leader') {
          const ace = this.gym.team[this.gym.team.length - 1][0];
          PG.drawMon(ctx, ace, cx + 26, cy + 2, 44, false);
          person(ctx, cx, cy, type, '#3a2a1f', true);
          nameTag(ctx, cx, cy - 34, this.gym.leader, type);
        } else if (pp.kind === 'guide') {
          person(ctx, cx, cy, '#e9e9e9', '#555', false);
        } else {
          const beaten = this.prog.beaten.includes(pp.i);
          person(ctx, cx, cy, beaten ? '#8a8f9c' : '#4a6fd8', '#2a2a2a', false);
          if (!beaten) { ctx.fillStyle = '#e2524a'; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', cx, cy - 26 + Math.sin(t * 6) * 2); }
        }
      }

      // you
      const p = this.p;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1.25, 1.25); ctx.translate(-p.x, -p.y);
      game.world.drawPlayer.call(this.drawProxy, ctx, this.time);
      ctx.restore();

      if (this.near && !this.busy) {
        const s = this.near, bob = Math.sin(t * 5) * 3;
        ctx.fillStyle = '#ffcb05'; ctx.strokeStyle = '#5a4300'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo((s.x + 0.5) * TS, s.y * TS - 6 + bob); ctx.lineTo((s.x + 0.5) * TS - 8, s.y * TS - 16 + bob); ctx.lineTo((s.x + 0.5) * TS + 8, s.y * TS - 16 + bob); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
      // dark gyms: only a small circle around you is visible
      if (plan.puzzle === 'dark') {
        const g = ctx.createRadialGradient(p.x, p.y, 40, p.x, p.y, 120);
        g.addColorStop(0, 'rgba(6,4,14,0)'); g.addColorStop(1, 'rgba(6,4,14,0.97)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // candle near the leader so you know where to head
        const lx = (this.leader.x + 0.5) * TS, ly = (this.leader.y + 0.5) * TS;
        const cg = ctx.createRadialGradient(lx, ly, 4, lx, ly, 46 + Math.sin(t * 6) * 3);
        cg.addColorStop(0, 'rgba(180,140,255,0.55)'); cg.addColorStop(1, 'rgba(180,140,255,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(lx, ly, 50, 0, Math.PI * 2); ctx.fill();
      }
      // progress panel
      this.drawProgress(ctx);
      ctx.restore();
    }

    drawGate(ctx, px, py, x, y) {
      const t = this.time, pz = this.plan.puzzle;
      if (pz === 'valves') water(ctx, px, py, t, x, y);
      else if (pz === 'trash') {
        ctx.strokeStyle = '#ffe04a'; ctx.lineWidth = 2.5;
        ctx.beginPath(); let yy = py + 4; ctx.moveTo(px, py + TS / 2);
        for (let i = 0; i <= 4; i++) ctx.lineTo(px + i * 10, py + TS / 2 + (Math.random() - 0.5) * 18);
        ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255,224,74,0.18)'; ctx.fillRect(px, py + 6, TS, TS - 12);
      } else if (pz === 'quiz') {
        const fl = Math.sin(t * 10 + x * 2) * 4;
        ctx.fillStyle = '#ff5a1f'; ctx.beginPath(); ctx.moveTo(px, py + TS); ctx.quadraticCurveTo(px + TS / 2, py - 6 + fl, px + TS, py + TS); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(px + 8, py + TS); ctx.quadraticCurveTo(px + TS / 2, py + 12 - fl, px + TS - 8, py + TS); ctx.fill();
      } else {
        ctx.fillStyle = '#5a4a32'; ctx.fillRect(px, py + 4, TS, TS - 8);
        ctx.fillStyle = '#7d6a4a'; ctx.fillRect(px + 3, py + 8, TS - 6, 5); ctx.fillRect(px + 3, py + 22, TS - 6, 5);
      }
    }

    drawSwitch(ctx, px, py, i) {
      const pz = this.plan.puzzle, prog = this.prog;
      if (pz === 'trash') {
        const found = prog.found.includes(i);
        ctx.fillStyle = '#8c939e'; roundRect(ctx, px + 9, py + 10, TS - 18, TS - 12, 4); ctx.fill();
        ctx.fillStyle = '#a9b0bb'; roundRect(ctx, px + 7, py + 6, TS - 14, 7, 3); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let k = 0; k < 3; k++) ctx.fillRect(px + 13 + k * 6, py + 16, 2, 16);
        if (found) { ctx.fillStyle = '#ffe04a'; ctx.beginPath(); ctx.arc(px + TS / 2, py + 4, 5, 0, Math.PI * 2); ctx.fill(); }
      } else if (pz === 'valves') {
        const on = prog.on.includes(i);
        ctx.fillStyle = '#5c6b7a'; ctx.fillRect(px + TS / 2 - 3, py + 18, 6, 20);
        ctx.save(); ctx.translate(px + TS / 2, py + 16); ctx.rotate(on ? Math.PI / 4 : 0);
        ctx.strokeStyle = on ? '#4cd964' : '#e2524a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke();
        ctx.restore(); ctx.lineWidth = 1;
      } else {
        const pressed = prog.solved || prog.seq.includes(i);
        ctx.fillStyle = '#3a3f4f'; roundRect(ctx, px + 6, py + 8, TS - 12, TS - 12, 6); ctx.fill();
        ctx.fillStyle = pressed ? '#4cd964' : '#c9a227'; ctx.beginPath(); ctx.arc(px + TS / 2, py + TS / 2 + 2, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.plan.symbols[i], px + TS / 2, py + TS / 2 + 3); ctx.textBaseline = 'alphabetic';
      }
    }

    // little checklist in the corner: trainers beaten, challenge solved
    drawProgress(ctx) {
      const plan = this.plan, prog = this.prog;
      const items = [`Trainers ${prog.beaten.filter(i => i >= 0).length}/${plan.trainers.length}`];
      const goal = { valves: `Valves ${prog.on.length}/${this.switches.length}`, trash: `Switches ${prog.found.length}/2`, quiz: `Quiz ${prog.quiz.length}/${plan.quiz && plan.quiz.length}`,
        order: `Switch order ${prog.solved ? 'solved' : prog.seq.length + '/3'}` }[plan.puzzle];
      if (goal) items.push(goal);
      ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left';
      const w = Math.max(...items.map(s => ctx.measureText(s).width)) + 30;
      ctx.fillStyle = 'rgba(14,18,32,0.82)'; roundRect(ctx, W - w - 8, H - 16 - items.length * 16, w, items.length * 16 + 8, 8); ctx.fill();
      items.forEach((s, i) => {
        const done = i === 0 ? this.trainersDone() : prog.solved;
        ctx.fillStyle = done ? '#7be07b' : '#ffe27a';
        ctx.fillText(`${done ? '✓' : '•'} ${s}`, W - w + 2, H - 4 - (items.length - i) * 16 + 2);
      });
    }
  }

  // ---------- drawing helpers ----------
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function rock(ctx, px, py) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(px + 21, py + 32, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8f8270'; ctx.beginPath(); ctx.moveTo(px + 6, py + 32); ctx.lineTo(px + 10, py + 12); ctx.lineTo(px + 22, py + 6); ctx.lineTo(px + 34, py + 14); ctx.lineTo(px + 35, py + 32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(px + 12, py + 14); ctx.lineTo(px + 22, py + 9); ctx.lineTo(px + 20, py + 18); ctx.closePath(); ctx.fill();
  }
  function water(ctx, px, py, t, x, y) {
    ctx.fillStyle = '#4a8fd8'; ctx.fillRect(px, py, TS, TS);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
    const o = Math.sin(t * 2 + x + y) * 4;
    ctx.beginPath(); ctx.moveTo(px + 6 + o, py + 14); ctx.quadraticCurveTo(px + 12 + o, py + 10, px + 18 + o, py + 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 20 - o, py + 28); ctx.quadraticCurveTo(px + 26 - o, py + 24, px + 32 - o, py + 28); ctx.stroke();
    ctx.lineWidth = 1;
  }
  // a simple top-down person
  function person(ctx, x, y, coat, hair, leader) {
    const s = leader ? 1.2 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 14, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b3a67'; ctx.fillRect(-6, 4, 5, 10); ctx.fillRect(1, 4, 5, 10);
    ctx.fillStyle = coat; roundRect(ctx, -9, -8, 18, 14, 5); ctx.fill();
    ctx.fillStyle = '#f6d2ad'; ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -17, 7.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(-3, -14, 1.6, 2.4); ctx.fillRect(1.5, -14, 1.6, 2.4);
    ctx.restore();
  }
  function nameTag(ctx, x, y, text, col) {
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(14,18,32,0.85)'; roundRect(ctx, x - w / 2, y - 9, w, 16, 8); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = '#fff'; ctx.fillText(text, x, y + 3);
  }

  PG.GymInterior = GymInterior;
  PG.GYM_PLANS = PLANS;
  PG.Dialogue = { say, choose };
})();
