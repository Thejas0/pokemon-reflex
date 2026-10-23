// Pokémon League tournament: a 32-trainer single-elimination bracket unlocked by all gym badges.
// The player is seed 1; other matches are simulated from team strength. State lives in
// game.state.tournament so it saves with the game.
(function () {
  const { CONFIG, SPECIES } = PG;

  // League settings of a region (bracket size, prize per round, stage per round, rival).
  const L = (r) => PG.REGIONS[r || 1].league;
  // 'Round of 64', 'Round of 32', ..., 'Quarter-finals', 'Semi-finals', 'Final'
  function roundNames(size) {
    const out = [];
    for (let n = size; n >= 2; n /= 2) out.push(n === 2 ? 'Final' : n === 4 ? 'Semi-finals' : n === 8 ? 'Quarter-finals' : `Round of ${n}`);
    return out;
  }

  // Trainer classes and the types they favour.
  const CLASSES = [
    ['Ace Trainer', null], ['Cooltrainer', null], ['Veteran', null], ['Black Belt', 'fighting'], ['Swimmer', 'water'],
    ['Bird Keeper', 'flying'], ['Psychic', 'psychic'], ['Hiker', 'rock'], ['Firebreather', 'fire'], ['Engineer', 'electric'],
    ['Bug Maniac', 'bug'], ['Dragon Tamer', 'dragon'], ['Channeler', 'ghost'], ['Beauty', 'grass'], ['Burglar', 'poison'],
    ['Ruin Maniac', 'ground'], ['Skier', 'ice'],
  ];
  const NAMES = ['Lena', 'Kai', 'Mira', 'Theo', 'Sana', 'Ravi', 'Ines', 'Jun', 'Priya', 'Owen', 'Yuki', 'Marco', 'Asha', 'Leo',
    'Noor', 'Felix', 'Tara', 'Dev', 'Hana', 'Rio', 'Zara', 'Ivo', 'Maya', 'Arjun', 'Elle', 'Nico'];

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Standard bracket order so seed 1 meets 32, then 16/17, 8/9, 4/5, and 2 in the final.
  function seedOrder(n) {
    let order = [1, 2];
    while (order.length < n) {
      const m = order.length * 2 + 1;
      order = order.flatMap(s => [s, m - s]);
    }
    return order;
  }

  // Fully evolved, non-legendary species, optionally of one type.
  function pool(type) {
    return Object.entries(SPECIES)
      .filter(([, s]) => !s.legendary && !s.evolves && (!type || s.types.includes(type)) && s.base.hp + s.base.atk + s.base.def + s.base.spd > 260)
      .map(([id]) => id);
  }

  function strength(e) {
    return e.team.reduce((a, [id, lv]) => { const b = SPECIES[id].base; return a + lv * (b.hp + b.atk + b.def + b.spd); }, 0) * (1 + e.skill * 0.3);
  }

  const T = {
    roundNames,
    rounds(t) { return roundNames(t.size || 32).length; },
    stage(t, r = t.round) { return L(t.region).stages[r]; },
    roundName(r, t) { return roundNames((t && t.size) || 32)[r]; },

    // Can the player walk in? Debug lets you in without all the badges.
    eligible(state) { return CONFIG.TOURNAMENT_DEBUG || PG.gyms().every(g => state.badges.includes(g.id)); },

    // One-time entry, unless debugging.
    canEnter(state) {
      const t = state.tournament;
      if (!T.eligible(state)) return false;
      if (!t) return true;
      // After a loss you can always start again from the Round of 32; after winning, only in debug mode.
      return t.status === 'eliminated' || (t.status !== 'active' && CONFIG.TOURNAMENT_DEBUG);
    },

    // Build a new bracket. Opponent levels scale from the player's strongest Pokémon.
    create(state) {
      const seed = (Date.now() ^ 0x5eed) >>> 0;
      const R = rng(seed);
      const pick = (arr) => arr[Math.floor(R() * arr.length)];
      const top = Math.max(45, Math.min(90, Math.max(...[...state.party, ...state.box].map(m => m.level)) + 5));
      const levelFor = (seedNo) => Math.round(top - (seedNo - 2) * 0.45);
      const entrants = [{ name: 'You', title: 'Trainer', isPlayer: true, team: [], type: null, skill: 0 }];

      const SIZE = CONFIG.TOURNAMENT_TEAM || 6;
      // Fill a team up to SIZE with distinct species from `choices` (falls back to any strong species).
      const fill = (ids, choices, lv) => {
        const team = ids.map(id => [id, lv]);
        const pool2 = choices.length >= SIZE ? choices : pool(null);
        let guard = 0;
        while (team.length < SIZE && guard++ < 200) { const id = pick(pool2); if (!team.some(([t]) => t === id)) team.push([id, lv]); }
        return team;
      };
      // Seed 2: the rival. Seeds 3-10: gym leaders, strongest first. Then themed trainers.
      const region = PG.currentRegion, lg = L(region), SIZE_T = lg.size;
      entrants.push({ name: lg.rival.name, title: 'Rival', type: null, skill: 0.97, team: fill(lg.rival.team, [], levelFor(2)) });
      // the region's gym leaders (in Johto, Kanto's leaders come to compete too)
      const leaders = [...PG.gyms()].reverse().concat(region === 2 ? [...PG.REGIONS[1].gyms].reverse() : []);
      leaders.forEach((g, i) => {
        entrants.push({ name: g.leader, title: 'Gym Leader', type: g.type, skill: Math.min(0.95, g.aiSkill + 0.05), team: fill(g.team.map(([id]) => id), pool(g.type), levelFor(3 + i)) });
      });
      const names = NAMES.slice();
      while (entrants.length < SIZE_T) {
        const seedNo = entrants.length + 1;
        const [title, type] = pick(CLASSES);
        const team = fill([], pool(type), levelFor(seedNo));
        const name = names.splice(Math.floor(R() * names.length), 1)[0] || `#${seedNo}`;
        entrants.push({ name, title, type: type || SPECIES[team[0][0]].types[0], skill: Math.max(0.5, 0.9 - (seedNo - 11) * 0.015), team });
      }
      // bracket slots hold entrant indices (seed - 1)
      const slots = seedOrder(SIZE_T).map(s => s - 1);
      const t = {
        seed, entrants, top, region, size: SIZE_T, round: 0, status: 'active', // active | eliminated | champion
        rounds: [slots], winners: [[]],             // winners[r][match] = entrant index
        entries: ((state.tournament && state.tournament.entries) || 0) + 1, prize: 0,
      };
      state.tournament = t;
      return t;
    },

    matchesOf(t, r) {
      const slots = t.rounds[r], out = [];
      for (let i = 0; i < slots.length; i += 2) out.push([slots[i], slots[i + 1]]);
      return out;
    },

    // The player's match this round: { index, opponent } or null.
    playerMatch(t) {
      if (t.status !== 'active') return null;
      const ms = T.matchesOf(t, t.round);
      const i = ms.findIndex(([a, b]) => a === 0 || b === 0);
      if (i < 0) return null;
      return { index: i, opponent: t.entrants[ms[i][0] === 0 ? ms[i][1] : ms[i][0]] };
    },

    // Record the player's match, simulate the rest of the round, and set up the next one.
    // Returns the prize money won (0 on a loss).
    recordPlayer(t, won) {
      const pm = T.playerMatch(t);
      if (!pm) return 0;
      const R = rng(t.seed + t.round * 7919);
      const ms = T.matchesOf(t, t.round);
      const w = t.winners[t.round];
      ms.forEach(([a, b], i) => {
        if (i === pm.index) { w[i] = won ? 0 : (a === 0 ? b : a); return; }
        const sa = Math.pow(strength(t.entrants[a]), 3), sb = Math.pow(strength(t.entrants[b]), 3);
        w[i] = R() < sa / (sa + sb) ? a : b;
      });
      if (!won) { t.status = 'eliminated'; return 0; }
      const prize = L(t.region).prizes[t.round];
      t.prize += prize;
      if (t.round === T.rounds(t) - 1) { t.status = 'champion'; return prize; }
      t.round++;
      t.rounds[t.round] = w.slice();
      t.winners[t.round] = [];
      return prize;
    },

    // Debug "Continue": undo the loss and replay the same match.
    retry(t) {
      if (t.status !== 'eliminated') return;
      t.winners[t.round] = [];
      t.status = 'active';
    },


    // Opponents get tougher every round: higher levels and sharper AI. The team's ace (last) is 3 levels up.
    matchTeam(t, opp) {
      // a rival with a fixed level (Blue: 75) fields the whole team at exactly that level, in any round
      const fixed = opp.title === 'Rival' && L(t.region).rival.level;
      if (fixed) return opp.team.map(([id]) => [id, fixed]);
      const n = T.rounds(t), frac = n > 1 ? t.round / (n - 1) : 1;
      const top = t.top || 60, boost = Math.round(1 + frac * 10 + (frac > 0.75 ? 1 : 0));
      const cap = L(t.region).levelCap || 100;
      return opp.team.map(([id], i, all) => [id, Math.min(cap, top + boost + (i === all.length - 1 ? 2 : 0))]);
    },
    matchSkill(t, opp) { const n = T.rounds(t); return Math.min(0.99, Math.max(opp.skill, 0.78 + (n > 1 ? t.round / (n - 1) : 1) * 0.21)); },

    // From the quarter-finals on, opponents start the battle with stat boosts (shown as chips in battle).
    matchStages(t) {
      const fromEnd = T.rounds(t) - 1 - t.round;
      return [{ atk: 1, def: 1, spd: 1 }, { atk: 1, spd: 1 }, { atk: 1 }][fromEnd] || {};
    },

    // Competitive moveset: the strongest attacks with varied types, plus a heal/boost move if it has one.
    bestMoves(species, level) {
      const MOVES = PG.MOVES, sp = SPECIES[species];
      const known = [...new Set(PG.fullLearnset(species).filter(([lv]) => lv <= level).map(([, m]) => m))];
      const score = (id) => { const m = MOVES[id]; return m.power * (sp.types.includes(m.type) ? 1.5 : 1) / Math.sqrt(m.recharge || 1) * (m.count ? 1.1 : 1); };
      const attacks = known.filter(id => MOVES[id].power > 0 && id !== 'struggle');
      const support = known.filter(id => ['heal', 'buff'].includes(MOVES[id].kind));
      const out = [], types = new Set();
      while (out.length < 3 && out.length < attacks.length) {
        const best = attacks.filter(id => !out.includes(id)).sort((a, b) => score(b) * (types.has(MOVES[b].type) ? 0.6 : 1) - score(a) * (types.has(MOVES[a].type) ? 0.6 : 1))[0];
        out.push(best); types.add(MOVES[best].type);
      }
      const sup = support.sort((a, b) => (MOVES[b].kind === 'heal') - (MOVES[a].kind === 'heal'))[0];
      if (sup) out.push(sup);
      else { const extra = attacks.filter(id => !out.includes(id)).sort((a, b) => score(b) - score(a))[0]; if (extra) out.push(extra); }
      return out.length ? out : null;
    },
  };

  PG.Tournament = T;
})();
