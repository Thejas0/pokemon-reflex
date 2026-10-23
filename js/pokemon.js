// Pokemon instances: stats, experience, levelling, move learning, evolution.
(function () {
  const { CONFIG, SPECIES, MOVES } = PG;

  // species -> the species it evolved from (for inheriting learnsets)
  const PREVO = {};
  for (const [id, s] of Object.entries(SPECIES)) {
    if (s.evolves) PREVO[s.evolves.into] = id;
  }

  // Learnset including every pre-evolution's moves, so an evolved Pokemon keeps learning its line's moves.
  function fullLearnset(speciesId) {
    const chain = [];
    for (let id = speciesId; id; id = PREVO[id]) chain.unshift(id);
    const out = [];
    for (const id of chain) out.push(...SPECIES[id].learnset);
    return out;
  }

  function xpForLevel(level) {
    return Math.floor(0.8 * level * level * level);
  }

  function calcStat(base, level) {
    return Math.floor((2 * base * level) / 100) + 5;
  }

  function calcHp(base, level) {
    return Math.floor((2 * base * level) / 100) + level + 10;
  }

  let uidCounter = Date.now();

  class Pokemon {
    constructor(speciesId, level, opts = {}) {
      this.uid = opts.uid || 'p' + (uidCounter++).toString(36);
      this.species = speciesId;
      this.level = level;
      this.xp = opts.xp !== undefined ? opts.xp : xpForLevel(level);
      this.nickname = opts.nickname || null;
      this.item = opts.item || null;
      this.noEvolve = !!opts.noEvolve; // evolution switched off by the player (like holding an Everstone)
      if (opts.moves) {
        this.moves = opts.moves.slice(0, CONFIG.MAX_MOVES);
      } else {
        const known = [];
        for (const [lv, m] of fullLearnset(speciesId)) {
          if (lv <= level && !known.includes(m)) known.push(m);
        }
        this.moves = known.slice(-CONFIG.MAX_MOVES);
      }
      this.recalc();
      this.hp = opts.hp !== undefined ? Math.min(opts.hp, this.maxHp) : this.maxHp;
    }

    get data() { return SPECIES[this.species]; }
    get name() { return this.nickname || this.data.name; }
    get types() { return this.data.types; }
    get fainted() { return this.hp <= 0; }

    recalc() {
      const b = this.data.base;
      const mult = this.data.legendary ? CONFIG.LEGENDARY_STAT_MULT : 1;
      this.maxHp = Math.floor(calcHp(b.hp, this.level) * mult);
      this.atk = Math.floor(calcStat(b.atk, this.level) * mult);
      this.def = Math.floor(calcStat(b.def, this.level) * mult);
      this.spd = Math.floor(calcStat(b.spd, this.level) * mult);
    }

    heal() { this.hp = this.maxHp; }

    xpToNext() { return xpForLevel(this.level + 1) - this.xp; }
    xpProgress() {
      const lo = xpForLevel(this.level), hi = xpForLevel(this.level + 1);
      return Math.max(0, Math.min(1, (this.xp - lo) / (hi - lo)));
    }

    // Adds XP and returns a list of events: {type:'level', level}, {type:'learn', move}, {type:'evolve', into}.
    // 'learn' events for a full moveset must be resolved by the player (replace or discard).
    gainXp(amount) {
      const events = [];
      if (this.level >= 100) return events;
      this.xp += amount;
      while (this.level < 100 && this.xp >= xpForLevel(this.level + 1)) {
        const oldMax = this.maxHp;
        const wasFainted = this.fainted;
        this.level++;
        this.recalc();
        // Levelling up doesn't revive a fainted Pokémon.
        if (!wasFainted) this.hp = Math.min(this.maxHp, this.hp + (this.maxHp - oldMax));
        events.push({ type: 'level', level: this.level });
        for (const [lv, m] of fullLearnset(this.species)) {
          if (lv === this.level && !this.moves.includes(m)) events.push({ type: 'learn', move: m });
        }
        const evo = this.data.evolves;
        if (evo && !this.noEvolve && this.level >= evo.level && !events.some(e => e.type === 'evolve')) {
          events.push({ type: 'evolve', into: evo.into });
        }
      }
      return events;
    }

    // Returns true if learned directly; false if the moveset is full (caller must ask the player).
    tryLearn(moveId) {
      if (this.moves.includes(moveId)) return true;
      if (this.moves.length < CONFIG.MAX_MOVES) {
        this.moves.push(moveId);
        return true;
      }
      return false;
    }

    // Moves this Pokemon has unlocked by level but doesn't currently know.
    learnableMoves() {
      const out = [];
      for (const [lv, m] of fullLearnset(this.species)) {
        if (lv <= this.level && !this.moves.includes(m) && !out.includes(m)) out.push(m);
      }
      return out;
    }

    // Moves still to come: [{ level, move }] sorted by level.
    upcomingMoves() {
      const out = [];
      for (const [lv, m] of fullLearnset(this.species)) {
        if (lv > this.level && !this.moves.includes(m) && !out.some(o => o.move === m)) out.push({ level: lv, move: m });
      }
      return out.sort((a, b) => a.level - b.level);
    }

    replaceMove(index, moveId) {
      this.moves[index] = moveId;
    }

    // Evolves and returns moves the new form offers right away (anything in its learnset up to the current level).
    evolve() {
      const into = this.data.evolves.into;
      const hpLost = this.maxHp - this.hp;
      this.species = into;
      this.recalc();
      this.hp = Math.max(1, this.maxHp - hpLost);
      const offers = [];
      // Offer every move the new form knows by now, including ones missed by postponing evolution.
      for (const [lv, m] of SPECIES[into].learnset) {
        if (lv <= this.level && !this.moves.includes(m) && !offers.includes(m)) offers.push(m);
      }
      return offers;
    }

    // XP this Pokemon yields when defeated or caught.
    xpYield(trainerBattle) {
      return Math.floor((this.data.exp * this.level) / 7 * (trainerBattle ? 1.5 : 1));
    }

    // The species this one evolved from, if any.
    get prevo() { return PREVO[this.species] || null; }

    // Undo an evolution (e.g. an accidental Raichu back to Pikachu). Keeps level, XP and moves,
    // and switches evolution off so it isn't offered again on the next level-up.
    devolve() {
      const from = this.prevo;
      if (!from) return false;
      const ratio = this.hp / this.maxHp;
      this.species = from;
      this.recalc();
      this.hp = this.hp <= 0 ? 0 : Math.max(1, Math.round(this.maxHp * ratio));
      this.noEvolve = true;
      return true;
    }

    toJSON() {
      return { uid: this.uid, species: this.species, level: this.level, xp: this.xp, hp: this.hp, moves: this.moves, nickname: this.nickname, item: this.item, noEvolve: this.noEvolve };
    }

    static fromJSON(o) {
      return new Pokemon(o.species, o.level, o);
    }
  }

  function moveInfo(id) { return MOVES[id]; }

  // Sprites ship with the game in sprites/<dex>.png (front sprites), so they work offline.
  // If a local file is missing, fall back to the same PokeAPI sprite on the jsDelivr CDN.
  const CDN = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/';
  function cdnUrl(speciesId, back) { return `${CDN}${back ? 'back/' : ''}${SPECIES[speciesId].dex}.png`; }
  function spriteUrl(speciesId, back) {
    return back ? cdnUrl(speciesId, true) : `sprites/${SPECIES[speciesId].dex}.png`;
  }

  // Any <img> pointing at a local sprite that fails to load retries once from the CDN.
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.cdnTried) return;
    const m = /sprites\/(\d+)\.png$/.exec(img.getAttribute('src') || '');
    if (!m) return;
    img.dataset.cdnTried = '1';
    img.addEventListener('load', () => { img.style.visibility = ''; }, { once: true }); // undo the inline onerror hide
    img.src = CDN + m[1] + '.png';
  }, true);

  // Sprite cache with a drawn fallback when a sprite can't be loaded at all.
  const spriteCache = {};
  function getSprite(speciesId, back) {
    const key = speciesId + (back ? ':b' : '');
    if (!spriteCache[key]) {
      const img = new Image();
      const entry = { img, ok: false, failed: false };
      img.onload = () => { entry.ok = true; };
      img.onerror = () => {
        if (!entry.retried && !back) { entry.retried = true; img.crossOrigin = 'anonymous'; img.src = cdnUrl(speciesId); return; }
        entry.failed = true;
      };
      img.src = spriteUrl(speciesId, back);
      spriteCache[key] = entry;
    }
    return spriteCache[key];
  }

  PG.Pokemon = Pokemon;
  PG.fullLearnset = fullLearnset;
  PG.xpForLevel = xpForLevel;
  PG.moveInfo = moveInfo;
  PG.spriteUrl = spriteUrl;
  PG.getSprite = getSprite;
})();
