// Real-time arena battle. Both sides move freely; moves have hitboxes you can dodge.
// After each move a fighter is "tired" for MOVE_COOLDOWN_BASE * (1 + TIREDNESS_FACTOR * missingHp%).
(function () {
  const { CONFIG, MOVES } = PG;
  const ARENA_W = PG.ARENA.W, ARENA_H = PG.ARENA.H;
  const RADIUS = 30;
  const LUNGE_SPEED = 1100;
  // Arena-fighter mechanics
  const ROLL_TIME = 0.3, ROLL_SPEED = 620, ROLL_CD = 0.85;   // dodge roll: invulnerable while rolling
  const CHARGE_FULL = 0.8;                                     // hold a move this long for a full charge
  // Each type's ultimate (unlocked when the special meter is full). look: which strike visuals to borrow.
  const ULTS = {
    normal: ['Breakneck Blitz', 'generic'], fire: ['Inferno Overdrive', 'fire_blast'], water: ['Hydro Vortex', 'generic'],
    grass: ['Bloom Doom', 'generic'], electric: ['Gigavolt Havoc', 'thunder'], ice: ['Subzero Slammer', 'generic'],
    fighting: ['All-Out Pummeling', 'generic'], poison: ['Acid Downpour', 'sludge_bomb'], ground: ['Tectonic Rage', 'dig'],
    flying: ['Supersonic Skystrike', 'generic'], psychic: ['Shattered Psyche', 'psychic'], bug: ['Savage Spin-Out', 'generic'],
    rock: ['Continental Crush', 'rock_slide'], ghost: ['Never-Ending Nightmare', 'night_shade'], dragon: ['Devastating Drake', 'generic'],
    dark: ['Black Hole Eclipse', 'night_shade'], steel: ['Corkscrew Crash', 'generic'],
  };
  const INTRO_TIME = 1.5;

  function stageMult(s) { return s >= 0 ? (2 + s) / 2 : 2 / (2 - s); }

  function isContact(mv) { return mv.kind === 'melee' || mv.kind === 'dash'; }

  // Contact-focused Pokemon (most damaging moves are melee/dash) get a speed bonus to close the gap.
  function isBrawler(mon) {
    const dmg = mon.moves.map(id => MOVES[id]).filter(m => m.power > 0);
    return dmg.length > 0 && dmg.filter(isContact).length * 2 > dmg.length;
  }

  // mv is optional: contact moves are cheaper than the base cooldown, recharge moves dearer.
  function moveCooldown(mon, mv) {
    const missing = (mon.maxHp - Math.max(0, mon.hp)) / mon.maxHp;
    const base = CONFIG.MOVE_COOLDOWN_BASE * (1 + CONFIG.TIREDNESS_FACTOR * missing);
    if (!mv) return base;
    return base * (mv.recharge || 1) * (isContact(mv) ? CONFIG.CONTACT_COOLDOWN_MULT : 1);
  }

  // Which of two clashing attacks wins: 'a', 'b', or null (they cancel out).
  // Type matchup decides first (Water beats Fire); otherwise a clearly stronger attack (1.5x) wins.
  function clashWinner(ma, scaleA, mb, scaleB) {
    const ea = PG.effectiveness(ma.type, [mb.type]), eb = PG.effectiveness(mb.type, [ma.type]);
    if (ea > eb) return 'a';
    if (eb > ea) return 'b';
    const pa = ma.power * scaleA, pb = mb.power * scaleB;
    if (pa >= pb * 1.5) return 'a';
    if (pb >= pa * 1.5) return 'b';
    return null;
  }

  function seededRand(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Place terrain features for a tournament stage, keeping both start spots and the middle lane clear.
  function makeObstacles(kinds, count, existing = []) {
    const out = [];
    const clear = [[180, ARENA_H / 2], [ARENA_W - 180, ARENA_H / 2]];
    const counts = { rock: 6, pool: 4, grass: 5 };
    for (const kind of kinds) {
      let tries = 0, placed = 0;
      const n = count || (kinds.length > 1 ? Math.ceil(counts[kind] / 2) + 1 : counts[kind]);
      while (placed < n && tries++ < 200) {
        const r = kind === 'rock' ? 26 + Math.random() * 16 : 55 + Math.random() * 30;
        const x = 90 + Math.random() * (ARENA_W - 180), y = 80 + Math.random() * (ARENA_H - 150);
        if (clear.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < r + 90)) continue;
        if ([...existing, ...out].some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + (kind === 'rock' || o.kind === 'rock' ? 50 : 10))) continue;
        out.push({ kind, x, y, r, seed: Math.random() * 10 });
        placed++;
      }
    }
    return out;
  }

  // Projectile power by distance travelled.
  function falloff(dist) {
    if (dist <= CONFIG.FALLOFF_NEAR) return 1;
    const k = Math.min(1, (dist - CONFIG.FALLOFF_NEAR) / (CONFIG.FALLOFF_FAR - CONFIG.FALLOFF_NEAR));
    return 1 - k * (1 - CONFIG.FALLOFF_MIN);
  }

  class Fighter {
    constructor(mon, side, x, y) {
      this.mon = mon;
      this.side = side; // 'player' | 'enemy'
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.facing = side === 'player' ? 0 : Math.PI;
      this.cd = 0; this.cdMax = 1;
      this.stages = { atk: 0, def: 0, spd: 0 };
      this.dash = null;     // { vx, vy, t, move, hit, reach, lunge }
      this.flash = 0;       // hit flash
      this.stagger = 0;     // can't move or attack while > 0 (after taking a contact hit)
      this.hop = 0;         // little jump (Splash)
      this.faintT = 0;
      this.brawler = isBrawler(mon);
      // purely visual animation state
      this.spawnT = 0.45;                 // pop-out when sent into battle
      this.castT = 0; this.castAng = 0;   // lunge toward the target when using a move
      this.hitT = 0; this.hitAng = 0;     // recoil when hit
      this.flipK = side === 'player' ? -1 : 1; // eased facing: -1 faces right, 1 faces left
      this.phase = Math.random() * 10;    // idle breathing offset
      // arena-fighter state
      this.roll = null; this.rollCd = 0;          // dodge roll { t, vx, vy }
      this.charge = null;                         // holding a move to charge it { i, t }
      this.combo = 0; this.comboT = 0;            // consecutive hits landed
      this.meter = mon._meter || 0;               // special meter (0-100), kept when switching out
    }
    get speed() {
      return (150 + this.mon.spd * 1.1) * stageMult(this.stages.spd) * (this.brawler ? CONFIG.BRAWLER_SPEED : 1) * (this.terrain || 1)
        * (this.charge ? 0.6 : 1);
    }
    get atk() { return this.mon.atk * stageMult(this.stages.atk); }
    get def() { return this.mon.def * stageMult(this.stages.def); }
  }

  class Battle {
    // opts: { kind: 'wild'|'gym', party: Pokemon[], enemies: Pokemon[], gym, aiSkill, onEnd(result) , ui }
    constructor(opts) {
      this.opts = opts;
      this.kind = opts.kind;
      this.party = opts.party;
      this.enemies = opts.enemies;
      this.enemyIndex = 0;
      this.aiSkill = opts.aiSkill || 0.45;
      this.projectiles = [];
      this.strikes = [];
      this.hazards = [];        // lingering poison pools / burning ground
      this.texts = [];
      this.pp = new Map();      // mon uid -> { moveId: uses left }
      for (const m of [...opts.party, ...opts.enemies]) m._meter = 0;
      this.cinematic = null;    // ultimate cut-in { t, max, name, by, color }
      this.introT = INTRO_TIME; // 'VS' splash; nobody can act until it ends
      this.overT = 0;           // time since the battle ended, for the result banner
      this.ballCd = 0;
      this.ball = null;     // thrown pokeball in flight or shaking
      this.participants = new Set();
      this.state = 'fight'; // fight | choose | catching | over
      this.time = 0;
      this.ai = { think: 0, moveDelay: 0.6, strafe: 1, strafeT: 0 };
      this.result = null;

      const lead = this.party.find(m => !m.fainted);
      this.player = new Fighter(lead, 'player', 180, ARENA_H / 2);
      this.participants.add(lead);
      this.enemy = new Fighter(this.enemies[0], 'enemy', ARENA_W - 180, ARENA_H / 2);
      this.boostEnemy(this.enemy);
      this.player.cd = 0.5; this.player.cdMax = 0.5;
      this.enemy.cd = 1.0; this.enemy.cdMax = 1.0;
      this.stage = opts.stage || null; // tournament stage: { name, theme, terrain: ['rock'|'pool'|'grass'] }
      this.obstacles = this.stage ? makeObstacles(this.stage.terrain || []) : [];
      // gym and tournament battles are played in a stadium: stands, a match-up banner and a couple of boulders
      this.stadium = this.kind === 'gym';
      this.fx = new PG.BattleFx(this.stage ? this.stage.theme : this.kind === 'gym' ? 'gym:' + opts.gym.type : (opts.arena || 'grass'),
        Object.assign({}, opts.tod, { stadium: this.stadium && (opts.tournament ? '#c9a227' : true) }));
      if (this.stadium && !this.fx.arena.water && !this.obstacles.some(o => o.kind === 'rock')) this.obstacles.push(...makeObstacles(['rock'], 2, this.obstacles));
      this.fx.sendOut(this.player.x, this.player.y);
      this.fx.sendOut(this.enemy.x, this.enemy.y);
      this.legendary = this.kind === 'wild' && !!this.enemy.mon.data.legendary;
      this.ballType = PG.BALL_IDS.find(id => opts.getBalls && opts.getBalls(id) > 0) || 'poke_ball';
      this.log(this.legendary ? `A legendary ${this.enemy.mon.name} appeared!` : this.kind === 'wild' ? `A wild ${this.enemy.mon.name} appeared!` : `${opts.gym.leader} sent out ${this.enemy.mon.name}!`);
    }

    gainMeter(f, amount) {
      if (!f || f.mon.fainted) return;
      const was = f.meter;
      f.meter = Math.min(100, f.meter + amount);
      f.mon._meter = f.meter;
      if (was < 100 && f.meter >= 100) {
        this.floatText(f.x, f.y - 92, 'ULTIMATE READY!', '#ffcb05', 'big');
        PG.Audio.sfx('levelUp');
      }
    }


    // Dodge roll in a direction (or away from the opponent when standing still).
    startRoll(f, dx, dy) {
      if (f.roll || f.rollCd > 0 || f.dash || f.stagger > 0 || f.mon.fainted) return false;
      // a roll costs stamina (DODGE_TIREDNESS of the tiredness bar), so it needs that much left: too tired, no dodge
      const full = moveCooldown(f.mon), cost = full * CONFIG.DODGE_TIREDNESS;
      if (f.cd + cost > full + 1e-6) {
        if (f === this.player && !(f.tiredMsgT > this.time)) { this.floatText(f.x, f.y - 60, 'Too tired to dodge!', '#ff9a9a'); f.tiredMsgT = this.time + 0.8; }
        return false;
      }
      if (!dx && !dy) {
        // no direction held: sidestep (perpendicular to the opponent), toward the roomier side of the arena
        const o = f === this.player ? this.enemy : this.player, a = Math.atan2(o.y - f.y, o.x - f.x);
        const side = f.y + Math.cos(a) * 60 > ARENA_H / 2 ? -1 : 1;
        dx = -Math.sin(a) * side; dy = Math.cos(a) * side;
      }
      const l = Math.hypot(dx, dy) || 1;
      f.roll = { t: ROLL_TIME, vx: (dx / l) * ROLL_SPEED, vy: (dy / l) * ROLL_SPEED };
      f.rollCd = ROLL_CD; f.charge = null;
      // rolling is tiring: it eats into the move cooldown bar, so dodges can't be spammed for free
      f.cdMax = f.cd > 0 ? Math.max(f.cdMax, f.cd + cost) : full;
      f.cd = Math.max(0, f.cd) + cost;
      this.fx.burst(f.x, f.y + 22, 8, { speed: 120, life: 0.4, size: 8, color: '#d8ccb0', shape: 'smoke', grow: 12 });
      PG.Audio.sfx('throwBall');
      return true;
    }

    // Ultimate: a huge type-based strike with a cinematic cut-in. Needs a full meter.
    useUltimate(f) {
      const target = f === this.player ? this.enemy : this.player;
      if (f.meter < 100 || f.roll || f.dash || f.stagger > 0 || f.mon.fainted || target.mon.fainted) return false;
      const type = f.mon.types[0], [name, look] = ULTS[type] || ULTS.normal;
      const mv = { id: look, name, type, power: 150, kind: 'strike', radius: 155, delay: 0.6, ult: true,
        hazard: type === 'fire' || type === 'poison' ? { kind: type, dur: 3, r: 110, pct: 0.02 } : undefined };
      f.meter = 0; f.mon._meter = 0; f.charge = null;
      f.cd = f.cdMax = 1.2;
      const s = { owner: f, move: mv, x: target.x, y: target.y, r: mv.radius, t: mv.delay, max: mv.delay };
      this.fx.strikeSpawned(s);
      this.strikes.push(s);
      this.cinematic = { t: 1.3, max: 1.3, name, by: f, type, color: PG.TYPES[type].color };
      this.fx.screenFlash(PG.TYPES[type].color, 0.45);
      this.fx.shake(10);
      PG.Audio.sfx('badge');
      return true;
    }

    // Tournament opponents can start with stat stages already raised.
    boostEnemy(f) {
      for (const [k, v] of Object.entries(this.opts.enemyStages || {})) f.stages[k] = v;
    }

    log(msg) { this.opts.ui.toast(msg); }

    // style: undefined (labels), 'dmg' (damage numbers) or 'big' (heavy / super-effective hits)
    floatText(x, y, text, color, style) { this.texts.push({ x, y, text, color, style, t: 1.1 }); }

    // ---------- actions ----------
    // Remaining PP per move for a Pokémon, for this battle only (refilled every battle).
    ppOf(mon) {
      let pp = this.pp.get(mon.uid);
      if (!pp) { pp = {}; this.pp.set(mon.uid, pp); }
      for (const id of mon.moves) if (pp[id] === undefined) pp[id] = PG.movePP(MOVES[id]);
      return pp;
    }
    outOfPP(mon) { const pp = this.ppOf(mon); return mon.moves.every(id => pp[id] <= 0); }

    // charge: 0-1 from holding the move button (stronger, bigger, slower to recover).
    useMove(f, idx, charge = 0) {
      const target = f === this.player ? this.enemy : this.player;
      let id = f.mon.moves[idx];
      if (!id || f.cd > 0 || f.dash || f.roll || f.stagger > 0 || f.mon.fainted || target.mon.fainted) return false;
      const pp = this.ppOf(f.mon);
      if (this.outOfPP(f.mon)) id = 'struggle';
      else if (pp[id] <= 0) {
        if (f === this.player) this.floatText(f.x, f.y - 50, 'No PP left!', '#ff8080');
        return false;
      } else pp[id]--;
      let mv = MOVES[id];
      const ang = Math.atan2(target.y - f.y, target.x - f.x);
      f.facing = ang;
      f.castT = 0.22; f.castAng = ang;
      f.cdMax = f.cd = moveCooldown(f.mon, mv) * (1 + 0.35 * charge);
      if (charge > 0.15 && mv.power > 0) {
        // a charged move: up to +60% power, bigger hitboxes
        mv = Object.assign({}, mv, {
          power: Math.round(mv.power * (1 + 0.6 * charge)), charged: charge,
          size: mv.size ? mv.size * (1 + 0.5 * charge) : mv.size, radius: mv.radius ? mv.radius * (1 + 0.25 * charge) : mv.radius,
          range: (mv.range || 80) * (1 + 0.3 * charge), name: (charge >= 0.99 ? 'MAX ' : 'Charged ') + mv.name,
        });
        this.fx.burst(f.x, f.y, 14 + charge * 16, { speed: 260, life: 0.4, size: 5, color: [PG.TYPES[mv.type].color, '#ffffff'], add: true, shape: 'star' });
        this.fx.shake(3 + charge * 5);
      }
      this.floatText(f.x, f.y - 50, mv.name, PG.TYPES[mv.type].color);
      this.fx.cast(f, target, mv, ang);
      PG.Audio.sfx('move', mv);

      switch (mv.kind) {
        case 'melee': {
          const reach = (mv.range || 80) + RADIUS * 2;
          const d = Math.hypot(target.x - f.x, target.y - f.y);
          if (d <= reach) {
            this.fx.swing(f, mv, ang, target.x, target.y, true);
            this.hit(f, target, mv);
          } else if (d <= reach + CONFIG.MELEE_LUNGE) {
            // Leap in and strike once within reach.
            f.dash = { vx: Math.cos(ang) * LUNGE_SPEED, vy: Math.sin(ang) * LUNGE_SPEED, t: (d - reach) / LUNGE_SPEED + 0.08, move: mv, hit: false, reach, lunge: true };
          } else {
            this.fx.swing(f, mv, ang, f.x + Math.cos(ang) * reach * 0.7, f.y + Math.sin(ang) * reach * 0.7, false);
          }
          break;
        }
        case 'dash': {
          const sp = mv.dashSpeed || 800;
          f.dash = { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: 0.32, move: mv, hit: false, reach: RADIUS * 2.1 };
          break;
        }
        case 'projectile': {
          const n = mv.count || 1, spread = mv.spread || 0;
          for (let i = 0; i < n; i++) {
            const a = ang + (n > 1 ? (i - (n - 1) / 2) * spread : 0);
            const pr = {
              owner: f, move: mv, x: f.x + Math.cos(a) * RADIUS, y: f.y + Math.sin(a) * RADIUS,
              vx: Math.cos(a) * mv.speed, vy: Math.sin(a) * mv.speed, size: mv.size || 10, life: 2.5,
              homing: mv.homing, powerScale: 1 / Math.sqrt(n), dist: 0,
            };
            this.fx.projectileSpawned(pr);
            this.projectiles.push(pr);
          }
          break;
        }
        case 'area': {
          // the blast also knocks away incoming projectiles it beats or ties
          for (const pr of this.projectiles) {
            if (pr.owner === f || pr.life <= 0 || Math.hypot(pr.x - f.x, pr.y - f.y) > mv.radius) continue;
            if (clashWinner(mv, 1, pr.move, pr.powerScale) !== 'b') { pr.life = 0; this.fx.clash(pr.x, pr.y, mv, pr.move, false); }
          }
          if (Math.hypot(target.x - f.x, target.y - f.y) <= mv.radius + RADIUS) this.hit(f, target, mv);
          break;
        }
        case 'strike': {
          const s = { owner: f, move: mv, x: target.x, y: target.y, r: mv.radius, t: mv.delay, max: mv.delay };
          this.fx.strikeSpawned(s);
          this.strikes.push(s);
          break;
        }
        case 'buff': {
          f.stages[mv.stat] = Math.max(-4, Math.min(4, f.stages[mv.stat] + mv.stages));
          this.floatText(f.x, f.y - 30, `${mv.stat.toUpperCase()} ↑`, '#7fdc7f');
          break;
        }
        case 'debuff': {
          target.stages[mv.stat] = Math.max(-4, Math.min(4, target.stages[mv.stat] + mv.stages));
          this.floatText(target.x, target.y - 30, `${mv.stat.toUpperCase()} ↓`, '#ff8080');
          break;
        }
        case 'heal': {
          const amt = Math.round(f.mon.maxHp * mv.amount);
          f.mon.hp = Math.min(f.mon.maxHp, f.mon.hp + amt);
          this.floatText(f.x, f.y - 30, `+${amt}`, '#7fdc7f');
          break;
        }
        case 'none':
          this.floatText(f.x, f.y - 30, 'But nothing happened!', '#ccc');
          break;
      }
      return true;
    }

    hit(attacker, target, mv, scale = 1) {
      if (target.mon.fainted) return;
      // A Pokémon inside a shaking Poké Ball can't be hit (otherwise a late attack could knock it out mid-catch).
      if (this.ball && this.ball.phase === 'shake' && target === this.enemy) return;
      // dodge roll: invulnerable
      if (target.roll) { this.floatText(target.x, target.y - 60, 'Dodged!', '#bfe6ff'); return; }
      const contact = isContact(mv);
      // combos: hits landed in quick succession build a damage bonus (up to +40%)
      attacker.combo = attacker.comboT > 0 ? attacker.combo + 1 : 1;
      attacker.comboT = 1.6;
      target.combo = 0; target.comboT = 0;
      scale *= 1 + Math.min(0.4, 0.06 * (attacker.combo - 1));
      const eff = PG.effectiveness(mv.type, target.mon.types);
      const stab = attacker.mon.types.includes(mv.type) ? 1.5 : 1;
      const L = attacker.mon.level;
      const base = (((2 * L) / 5 + 2) * mv.power * (attacker.atk / target.def)) / 50 + 2;
      const dmg = eff === 0 ? 0 : Math.max(1, Math.round(base * stab * eff * scale * (0.85 + Math.random() * 0.15)));
      target.mon.hp = Math.max(0, target.mon.hp - dmg);
      target.flash = 0.2;
      // special meter: dealing and taking damage both charge it
      this.gainMeter(attacker, 2 + (dmg / target.mon.maxHp) * 55);
      this.gainMeter(target, (dmg / target.mon.maxHp) * 35);
      if (attacker.combo >= 2) this.floatText(attacker.x, attacker.y - 78, `${attacker.combo} HIT COMBO!`, '#ffcb05', attacker.combo >= 4 ? 'big' : undefined);
      target.hitT = 0.3; target.hitAng = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      // knockback; contact hits push less but stagger, so a brawler can follow up
      const ang = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      const kb = (contact ? 150 : 260) * (mv.ult ? 1.6 : 1);
      target.vx += Math.cos(ang) * kb; target.vy += Math.sin(ang) * kb;
      if (contact && dmg > 0) {
        target.stagger = Math.max(target.stagger, CONFIG.CONTACT_STAGGER);
        target.dash = null;
        this.fx.hitStop = 0.06;
      }
      this.fx.impact(target, mv, eff, contact, attacker);
      PG.Audio.sfx('hit', eff, contact);
      let col = '#ffe14a';
      if (eff > 1) { col = '#ff9d2e'; this.floatText(target.x, target.y - 70, 'Super effective!', col); }
      else if (eff === 0) { this.floatText(target.x, target.y - 70, 'No effect...', '#aaa'); }
      else if (eff < 1) { col = '#bbb'; this.floatText(target.x, target.y - 70, 'Not very effective', col); }
      const heavy = eff > 1 || dmg >= target.mon.maxHp * 0.3;
      if (heavy || mv.ult) this.fx.cheer(mv.ult ? 1 : 0.5);
      this.floatText(target.x + (Math.random() - 0.5) * 20, target.y - 35, '-' + dmg, col, heavy ? 'big' : 'dmg');
      if (mv.recoil && dmg > 0 && !attacker.mon.fainted) {
        const self = Math.max(1, Math.round(dmg * mv.recoil));
        attacker.mon.hp = Math.max(0, attacker.mon.hp - self);
        this.floatText(attacker.x, attacker.y - 35, '-' + self, '#ff9a9a', 'dmg');
        if (attacker.mon.fainted) this.onFaint(attacker);
      }
      if (mv.drain && dmg > 0) {
        const heal = Math.max(1, Math.round(dmg * mv.drain));
        attacker.mon.hp = Math.min(attacker.mon.maxHp, attacker.mon.hp + heal);
        this.floatText(attacker.x, attacker.y - 35, '+' + heal, '#7fdc7f');
      }
      if (target.mon.fainted) this.onFaint(target);
    }

    onFaint(f) {
      PG.Audio.sfx('faint');
      this.fx.cheer(1);
      f.faintT = 0.8;
      this.fx.burst(f.x, f.y + 20, 10, { speed: 90, life: 0.9, size: 14, color: '#d8ccb0', shape: 'smoke', grow: 20, vy: -20 });
      this.log(`${f.mon.name} fainted!`);
      if (f.side === 'enemy') {
        this.awardXp(f.mon);
        this.enemyIndex++;
        if (this.enemyIndex < this.enemies.length) this.queuePending(() => this.sendNextEnemy(), 1.0, 1);
        else this.queuePending(() => this.finish('win'), 1.2, 0);
      } else {
        const left = this.party.filter(m => !m.fainted);
        if (!left.length) this.queuePending(() => this.finish('lose'), 1.2, 0);
        else this.queuePending(() => this.promptSwitch(true), 0.9, 2);
      }
    }

    sendNextEnemy() {
      const next = this.enemies[this.enemyIndex];
      if (!next || !this.enemy.mon.fainted) return;
      this.enemy = new Fighter(next, 'enemy', ARENA_W - 180, ARENA_H / 2);
      this.ai.recent = [];   // a fresh Pokémon, a fresh move history
      this.boostEnemy(this.enemy);
      this.enemy.cd = this.enemy.cdMax = 1.2;
      this.resetArena();
      this.fx.sendOut(this.enemy.x, this.enemy.y);
      this.log(`${this.opts.gym.leader} sent out ${next.name}!`);
    }

    // Several things can faint at once (e.g. both Pokémon in the same instant), so follow-up actions
    // queue up instead of overwriting each other. Lower order runs first: battle end, enemy send-out, your switch.
    queuePending(fn, delay, order) {
      this.pendingList = this.pendingList || [];
      this.pendingList.push({ fn, order });
      this.pendingList.sort((a, b) => a.order - b.order);
      this.pendingT = Math.max(this.pending ? this.pendingT : 0, delay);
      this.pending = () => {
        const list = this.pendingList; this.pendingList = [];
        for (const item of list) { if (this.state === 'over') break; item.fn(); }
      };
    }

    // After a faint, send both fighters back to their starting spots and clear leftover
    // projectiles/strikes so the incoming Pokémon isn't hit the instant it appears.
    resetArena() {
      for (const [f, x] of [[this.player, 180], [this.enemy, ARENA_W - 180]]) {
        if (f.mon.fainted) continue;
        f.x = x; f.y = ARENA_H / 2;
        f.vx = 0; f.vy = 0;
        f.dash = null; f.stagger = 0;
        f.facing = f.side === 'player' ? 0 : Math.PI;
      }
      this.projectiles = [];
      this.strikes = [];
      this.hazards = [];
    }

    awardXp(defeated) {
      const total = defeated.xpYield(this.kind === 'gym');
      // Everyone who fought this battle shares the XP, including those who fainted along the way.
      const fought = [...this.participants];
      if (!fought.length) return;
      const each = Math.max(1, Math.floor(total / fought.length));
      for (const m of fought) this.opts.ui.queueXp(m, each);
      // Exp. Share holders anywhere in the party get the same share without fighting.
      for (const m of this.opts.fullParty || this.party) {
        if (m.item === 'exp_share' && !m.fainted && !fought.includes(m)) this.opts.ui.queueXp(m, each);
      }
      if (!this.player.mon.fainted) this.floatText(this.player.x, this.player.y - 80, `+${each} XP`, '#7cc4ff');
    }

    promptSwitch(forced) {
      if (this.state === 'over') return;
      const options = this.party.filter(m => !m.fainted && m !== this.player.mon);
      if (!options.length) { if (!forced) this.log('No other Pokémon can fight!'); return; }
      this.state = 'choose';
      this.opts.ui.chooseFighter(this.party, this.player.mon, forced, (mon) => {
        if (!mon) { this.state = 'fight'; return; }
        const old = this.player;
        this.player = new Fighter(mon, 'player', old.mon.fainted ? 180 : old.x, old.mon.fainted ? ARENA_H / 2 : old.y);
        this.player.cd = this.player.cdMax = CONFIG.SWITCH_COOLDOWN;
        if (old.mon.fainted) {
          this.resetArena();
          this.enemy.cd = Math.max(this.enemy.cd, 1.0);
          this.enemy.cdMax = Math.max(this.enemy.cdMax, this.enemy.cd);
        }
        this.participants.add(mon);
        this.fx.sendOut(this.player.x, this.player.y);
        this.log(`Go, ${mon.name}!`);
        this.state = 'fight';
      });
    }

    throwBall() {
      if (this.kind !== 'wild') { this.log("You can't catch a trainer's Pokémon!"); return; }
      if (this.ballCd > 0 || this.ball || this.enemy.mon.fainted) return;
      if (this.opts.getBalls(this.ballType) <= 0) this.cycleBall(true);
      if (this.opts.getBalls(this.ballType) <= 0) { this.log('Out of Poké Balls! Buy more at the Poké Mart.'); return; }
      this.opts.useBall(this.ballType);
      this.ballCd = CONFIG.BALL_COOLDOWN;
      PG.Audio.sfx('throwBall');
      const ang = Math.atan2(this.enemy.y - this.player.y, this.enemy.x - this.player.x);
      this.ball = { phase: 'fly', type: this.ballType, x: this.player.x, y: this.player.y, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, life: 1.2, z: 0 };
    }

    // Select the next ball type the player owns. quiet: no toast (used when the current type runs out).
    cycleBall(quiet) {
      const ids = PG.BALL_IDS, start = ids.indexOf(this.ballType);
      for (let k = 1; k <= ids.length; k++) {
        const id = ids[(start + k) % ids.length];
        if (this.opts.getBalls(id) > 0) {
          if (id !== this.ballType && !quiet) this.log(`${PG.ITEMS[id].name} ready (×${this.opts.getBalls(id)})`);
          this.ballType = id;
          return;
        }
      }
    }

    // Legendaries are much harder to catch; better balls multiply the odds and a Master Ball never fails.
    resolveCatch(ballType = 'poke_ball') {
      const mult = PG.ITEMS[ballType].ball;
      if (mult === Infinity) return true;
      const m = this.enemy.mon;
      const hpFactor = 1 - (2 / 3) * (m.hp / m.maxHp);
      const levelFactor = Math.max(0.35, 1 - m.level / 80);
      const rarity = m.data.legendary ? 0.15 : m.data.rare ? 0.5 : 1;
      const base = m.data.legendary ? 0.12 * rarity : 0.12;
      const chance = Math.min(0.95, (base + hpFactor * 0.85 * levelFactor * rarity) * mult);
      return Math.random() < chance;
    }

    run() {
      if (this.kind !== 'wild') { this.log("You can't run from a gym battle!"); return; }
      this.log('Got away safely!');
      this.finish('run');
    }

    finish(result) {
      if (this.state === 'over') return;
      this.state = 'over';
      this.result = result;
      if (result === 'win') PG.Audio.sfx('victory');
      else if (result === 'lose') PG.Audio.sfx('defeat');
      this.opts.onEnd(result, this);
    }

    // ---------- simulation ----------
    update(dt) {
      // brief freeze-frame on heavy contact hits
      if (this.fx.hitStop > 0) { this.fx.hitStop -= dt; dt *= 0.15; }
      // ultimate cut-in: the world slows right down
      if (this.cinematic) { this.cinematic.t -= dt; if (this.cinematic.t <= 0) this.cinematic = null; else dt *= 0.18; }
      this.time += dt;
      this.fx.update(dt);
      if (this.pending) {
        this.pendingT -= dt;
        if (this.pendingT <= 0) { const p = this.pending; this.pending = null; p(); }
      }
      if (this.state === 'over') { this.overT += dt; return; }
      if (!this.pending && this.state === 'fight') {
        if (this.enemy.mon.fainted && this.enemy.faintT <= 0) {
          if (this.enemies.some(m => !m.fainted)) { this.enemyIndex = this.enemies.findIndex(m => !m.fainted); this.sendNextEnemy(); }
          else this.finish('win');
        } else if (this.player.mon.fainted && this.player.faintT <= 0) {
          if (this.party.some(m => !m.fainted)) this.promptSwitch(true); else this.finish('lose');
        }
      }
      this.updateFx(dt);
      if (this.introT > 0) { this.introT -= dt; PG.Input.clear(); return; }
      if (this.state !== 'fight' && this.state !== 'catching') return;

      // Player controls
      const I = PG.Input;
      const p = this.player;
      if (this.state === 'fight' && !p.mon.fainted && !this.pending) {
        const a = p.stagger > 0 ? { x: 0, y: 0 } : I.axis();
        if (!p.dash) {
          p.vx += (a.x * p.speed - p.vx) * Math.min(1, dt * 12);
          p.vy += (a.y * p.speed - p.vy) * Math.min(1, dt * 12);
        }
        // moves: tap to use, hold to charge (release to fire)
        for (let i = 0; i < 4; i++) {
          const tapped = I.consume('move' + i);
          if (p.charge || !MOVES[p.mon.moves[i]]) continue;   // empty slot: nothing to use or charge
          if (I.held('move' + i)) { if (p.cd <= 0 && !p.roll && p.stagger <= 0 && !p.dash) p.charge = { i, t: 0, full: false }; }
          else if (tapped) this.useMove(p, i);
        }
        if (p.charge) {
          p.charge.t += dt;
          if (p.charge.t >= CHARGE_FULL + 0.15 && !p.charge.full) { p.charge.full = true; PG.Audio.sfx('shake'); }
          if (!I.held('move' + p.charge.i)) {
            const lvl = Math.max(0, Math.min(1, (p.charge.t - 0.15) / CHARGE_FULL));
            const i = p.charge.i; p.charge = null;
            this.useMove(p, i, lvl);
          }
        }
        // dodge roll, ultimate
        if (I.consume('dodge')) this.startRoll(p, a.x, a.y);
        if (I.consume('pixel')) { PG.setBattlePixel(!PG.battlePixel()); this.log(PG.battlePixel() ? 'Pixel-art battle view' : 'Smooth battle view'); }
        if (I.consume('ult')) { if (!this.useUltimate(p) && p.meter < 100) this.floatText(p.x, p.y - 60, `Meter ${Math.floor(p.meter)}%`, '#aaa'); }
        if (I.consume('ball')) this.throwBall();
        if (I.consume('ballnext')) this.cycleBall(false);
        if (I.consume('switch')) this.promptSwitch(false);
        if (I.consume('run')) { this.run(); return; }
      } else {
        I.clear();
      }

      if (this.state === 'fight' && !this.enemy.mon.fainted && !this.pending) this.updateAI(dt);

      for (const f of [this.player, this.enemy]) {
        f.cd = Math.max(0, f.cd - dt);
        f.flash = Math.max(0, f.flash - dt);
        f.stagger = Math.max(0, f.stagger - dt);
        f.hop = Math.max(0, f.hop - dt);
        f.spawnT = Math.max(0, f.spawnT - dt);
        f.castT = Math.max(0, f.castT - dt);
        f.hitT = Math.max(0, f.hitT - dt);
        f.rollCd = Math.max(0, f.rollCd - dt);
        f.comboT = Math.max(0, f.comboT - dt); if (f.comboT <= 0) f.combo = 0;
        if (f.roll && !f.mon.fainted) {
          f.x += f.roll.vx * dt; f.y += f.roll.vy * dt; f.roll.t -= dt;
          this.fx.ghosts.push({ species: f.mon.species, x: f.x, y: f.y, flip: f.flipK < 0, t: 0.18, max: 0.18 });
          if (f.roll.t <= 0) { f.vx = f.roll.vx * 0.2; f.vy = f.roll.vy * 0.2; f.roll = null; }
          f.x = Math.max(RADIUS, Math.min(ARENA_W - RADIUS, f.x)); f.y = Math.max(RADIUS + 20, Math.min(ARENA_H - RADIUS, f.y));
          continue;
        }
        // turn around smoothly instead of snapping
        const wantFlip = Math.cos(f.facing) > 0 ? -1 : 1;
        f.flipK += (wantFlip - f.flipK) * Math.min(1, dt * 14);
        if (f.mon.fainted) { f.faintT = Math.max(0, f.faintT - dt); f.vx *= 0.8; f.vy *= 0.8; continue; }
        if (f.dash) {
          const dash = f.dash, t = f === this.player ? this.enemy : this.player;
          // dashes curve slightly toward the target so a small sidestep doesn't fully dodge them
          if (!t.mon.fainted) {
            const cur = Math.atan2(dash.vy, dash.vx), sp = Math.hypot(dash.vx, dash.vy);
            let diff = Math.atan2(t.y - f.y, t.x - f.x) - cur;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turn = Math.max(-3 * dt, Math.min(3 * dt, diff));
            dash.vx = Math.cos(cur + turn) * sp; dash.vy = Math.sin(cur + turn) * sp;
          }
          f.x += dash.vx * dt; f.y += dash.vy * dt;
          f.facing = Math.atan2(dash.vy, dash.vx);
          dash.t -= dt;
          this.fx.dashTick(f, dash.move, dt);
          if (!dash.hit && !t.mon.fainted && Math.hypot(t.x - f.x, t.y - f.y) < dash.reach) {
            dash.hit = true;
            if (dash.lunge) this.fx.swing(f, dash.move, Math.atan2(t.y - f.y, t.x - f.x), t.x, t.y, true);
            else this.fx.dashHit(f, t, dash.move);
            this.hit(f, t, dash.move);
            dash.t = 0;
          }
          if (dash.t <= 0) {
            if (dash.lunge && !dash.hit) this.fx.swing(f, dash.move, f.facing, f.x + Math.cos(f.facing) * dash.reach * 0.7, f.y + Math.sin(f.facing) * dash.reach * 0.7, false);
            if (f.dash === dash) f.dash = null;
            f.vx = dash.vx * 0.15; f.vy = dash.vy * 0.15;
          }
        } else {
          f.x += f.vx * dt; f.y += f.vy * dt;
          if (f !== this.player || this.state !== 'fight') { f.vx *= 0.9; f.vy *= 0.9; }
        }
        if (Math.abs(f.vx) > 5) f.facing = Math.atan2(f.vy, f.vx);
        f.x = Math.max(RADIUS, Math.min(ARENA_W - RADIUS, f.x));
        f.y = Math.max(RADIUS + 20, Math.min(ARENA_H - RADIUS, f.y));
      }
      this.applyTerrain();
      // keep fighters from overlapping
      const dx = this.enemy.x - this.player.x, dy = this.enemy.y - this.player.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < RADIUS * 1.8 && !this.player.mon.fainted && !this.enemy.mon.fainted) {
        const push = (RADIUS * 1.8 - d) / 2;
        this.player.x -= (dx / d) * push; this.player.y -= (dy / d) * push;
        this.enemy.x += (dx / d) * push; this.enemy.y += (dy / d) * push;
      }

      this.updateProjectiles(dt);
      this.updateStrikes(dt);
      this.updateHazards(dt);
      this.updateBall(dt);
      this.ballCd = Math.max(0, this.ballCd - dt);
    }

    // Stage terrain: boulders block fighters; pools and tall grass change speed by type.
    applyTerrain() {
      for (const f of [this.player, this.enemy]) {
        let mult = 1;
        for (const o of this.obstacles) {
          const d = Math.hypot(f.x - o.x, f.y - o.y);
          if (o.kind === 'rock') {
            const min = o.r + RADIUS * 0.8;
            if (d < min) {
              const a = Math.atan2(f.y - o.y, f.x - o.x);
              f.x = o.x + Math.cos(a) * min; f.y = o.y + Math.sin(a) * min;
              if (f.dash) f.dash.t = 0; // a dash ends against a boulder
            }
          } else if (d < o.r) {
            const types = f.mon.types;
            if (o.kind === 'pool') mult = types.includes('water') ? 1.15 : types.includes('flying') ? 1 : 0.7;
            if (o.kind === 'grass') mult = types.includes('grass') || types.includes('bug') ? 1.15 : 0.85;
            // splashes and flying blades while moving through it
            if (Math.hypot(f.vx, f.vy) > 60 && Math.random() < 0.18) {
              if (o.kind === 'pool') this.fx.burst(f.x, f.y + 22, 3, { ang: -Math.PI / 2, spread: 1.2, speed: 150, life: 0.45, size: 3, color: ['#bfe6ff', '#ffffff', '#6aa8e8'], g: 500, drag: 1 });
              else this.fx.burst(f.x, f.y + 18, 2, { ang: -Math.PI / 2, spread: 1, speed: 110, life: 0.5, size: 4, color: ['#3f9a3c', '#7ccf5a'], shape: 'leaf', g: 200, drag: 1.5 });
            }
          }
        }
        f.terrain = mult;
      }
    }

    updateProjectiles(dt) {
      for (const pr of this.projectiles) {
        const target = pr.owner === this.player ? this.enemy : this.player;
        if (pr.homing && !target.mon.fainted) {
          const want = Math.atan2(target.y - pr.y, target.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
          const sp = Math.hypot(pr.vx, pr.vy);
          pr.vx = Math.cos(cur + turn) * sp; pr.vy = Math.sin(cur + turn) * sp;
        }
        pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        pr.dist += Math.hypot(pr.vx, pr.vy) * dt;
        pr.life -= dt;
        this.fx.projectileTick(pr, dt);
        // a dashing Pokémon slips through projectiles
        // boulders stop projectiles
        const rock = this.obstacles.find(o => o.kind === 'rock' && Math.hypot(o.x - pr.x, o.y - pr.y) < o.r + pr.size * 0.5);
        if (rock) {
          pr.life = 0;
          this.fx.burst(pr.x, pr.y, 8, { speed: 180, life: 0.4, size: 4, color: ['#9b8a5a', '#cfc3a5', PG.TYPES[pr.move.type].color], shape: 'rock', g: 500, drag: 1 });
          continue;
        }
        if (!target.mon.fainted && !target.dash && !target.roll && Math.hypot(target.x - pr.x, target.y - pr.y) < RADIUS + pr.size) {
          this.hit(pr.owner, target, pr.move, pr.powerScale * falloff(pr.dist));
          if (pr.move.hazard) this.addHazard(target.x, target.y + 12, pr.move, pr.owner);
          pr.life = 0;
        }
        if (pr.x < -50 || pr.y < -50 || pr.x > ARENA_W + 50 || pr.y > ARENA_H + 50) pr.life = 0;
      }
      this.resolveClashes();
      this.projectiles = this.projectiles.filter(p => p.life > 0);
    }

    // Opposing projectiles that meet in mid-air clash: the type that beats the other survives
    // (weakened) and keeps flying; an even match explodes and both are cancelled.
    resolveClashes() {
      const list = this.projectiles;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.life <= 0) continue;
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (b.life <= 0 || b.owner === a.owner) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) > a.size + b.size) continue;
          const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
          const w = clashWinner(a.move, a.powerScale, b.move, b.powerScale);
          if (w) {
            const [win, lose] = w === 'a' ? [a, b] : [b, a];
            lose.life = 0;
            win.powerScale *= 0.75;
            this.fx.clash(x, y, win.move, lose.move, false);
            PG.Audio.sfx('hit', 1, false);
            this.floatText(x, y - 24, `${win.move.name} wins!`, PG.TYPES[win.move.type].color);
            if (lose === a) break;
          } else {
            a.life = 0; b.life = 0;
            this.fx.clash(x, y, a.move, b.move, true);
            PG.Audio.sfx('clash');
            this.floatText(x, y - 24, 'BOOM!', '#ffd84a', 'big');
            break;
          }
        }
      }
    }

    // ---------- hazard zones ----------
    addHazard(x, y, mv, owner) {
      const h = mv.hazard;
      // overlapping zones of the same kind merge instead of stacking damage
      const near = this.hazards.find(z => z.kind === h.kind && z.side === owner.side && Math.hypot(z.x - x, z.y - y) < z.r);
      if (near) { near.t = Math.max(near.t, h.dur); return; }
      this.hazards.push({ x, y, r: h.r, kind: h.kind, pct: h.pct, t: h.dur, max: h.dur, tick: 0.5, side: owner.side, seed: Math.random() * 10 });
    }

    updateHazards(dt) {
      for (const z of this.hazards) {
        z.t -= dt; z.tick -= dt;
        if (z.tick > 0) continue;
        z.tick = 0.5;
        const victim = z.side === 'player' ? this.enemy : this.player;
        if (!victim || victim.mon.fainted || victim.dash) continue;
        if (this.ball && this.ball.phase === 'shake' && victim === this.enemy) continue;
        if (victim.mon.types.includes(z.kind)) continue; // Poison / Fire types shrug it off
        if (Math.hypot(victim.x - z.x, victim.y - z.y) > z.r + RADIUS * 0.4) continue;
        const dmg = Math.max(1, Math.round(victim.mon.maxHp * z.pct));
        victim.mon.hp = Math.max(0, victim.mon.hp - dmg);
        victim.flash = 0.08;
        const col = z.kind === 'poison' ? '#c86cd8' : '#ff8c3a';
        PG.Audio.sfx(z.kind === 'poison' ? 'poison' : 'burn');
        this.floatText(victim.x + (Math.random() - 0.5) * 16, victim.y - 30, `-${dmg} ${z.kind === 'poison' ? '☠' : '🔥'}`, col);
        this.fx.burst(victim.x, victim.y + 10, 4, z.kind === 'poison'
          ? { speed: 50, life: 0.6, size: 4, color: ['#a040a0', '#d070d0'], shape: 'bubble', vy: -40 }
          : { speed: 80, life: 0.4, size: 5, color: ['#ff4500', '#ffd23f'], add: true, vy: -60 });
        if (victim.mon.fainted) this.onFaint(victim);
      }
      this.hazards = this.hazards.filter(z => z.t > 0);
    }

    drawHazards(ctx) {
      for (const z of this.hazards) {
        const fade = Math.min(1, z.t / 0.5, (z.max - z.t) / 0.2 + 0.2);
        const t = this.time;
        ctx.save();
        ctx.globalAlpha = fade;
        if (z.kind === 'poison') {
          const g = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r);
          g.addColorStop(0, 'rgba(120,40,140,0.75)'); g.addColorStop(0.7, 'rgba(160,64,160,0.55)'); g.addColorStop(1, 'rgba(160,64,160,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(220,130,230,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 20;
          ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r * 0.92, z.r * 0.55, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          // popping bubbles
          for (let i = 0; i < 6; i++) {
            const k = (t * 0.9 + i / 6 + z.seed) % 1, a = i * 2.4 + z.seed;
            const bx = z.x + Math.cos(a) * z.r * 0.55, by = z.y + Math.sin(a) * z.r * 0.3;
            ctx.strokeStyle = `rgba(230,160,240,${1 - k})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(bx, by - k * 6, 2 + k * 5, 0, Math.PI * 2); ctx.stroke();
          }
        } else {
          const g = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r);
          g.addColorStop(0, 'rgba(60,20,10,0.55)'); g.addColorStop(1, 'rgba(60,20,10,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + z.seed, rr = z.r * (0.35 + ((i * 37) % 10) / 16);
            const fx2 = z.x + Math.cos(a) * rr * 0.8, fy = z.y + Math.sin(a) * rr * 0.5;
            const fl = 0.8 + Math.sin(t * 14 + i * 3) * 0.25;
            ctx.fillStyle = 'rgba(255,120,30,0.75)';
            ctx.beginPath(); ctx.moveTo(fx2 - 6, fy); ctx.quadraticCurveTo(fx2, fy - 22 * fl, fx2 + 6, fy); ctx.fill();
            ctx.fillStyle = 'rgba(255,220,90,0.8)';
            ctx.beginPath(); ctx.moveTo(fx2 - 3, fy); ctx.quadraticCurveTo(fx2, fy - 12 * fl, fx2 + 3, fy); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
      }
    }

    updateStrikes(dt) {
      for (const s of this.strikes) {
        s.t -= dt;
        if (s.t <= 0) {
          const target = s.owner === this.player ? this.enemy : this.player;
          this.fx.strikeLand(s);
          if (s.move.power >= 90) PG.Audio.sfx('boom');
          if (s.move.hazard) this.addHazard(s.x, s.y, s.move, s.owner);
          if (Math.hypot(target.x - s.x, target.y - s.y) < s.r + RADIUS * 0.5) this.hit(s.owner, target, s.move);
        }
      }
      this.strikes = this.strikes.filter(s => s.t > 0);
    }

    updateBall(dt) {
      const b = this.ball;
      if (!b) return;
      const e = this.enemy;
      if (b.phase === 'fly') {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        b.z = Math.sin((1.2 - b.life) / 1.2 * Math.PI) * 30;
        if (Math.hypot(e.x - b.x, e.y - b.y) < RADIUS + 8) {
          b.phase = 'shake'; b.t = 0; b.x = e.x; b.y = e.y + 10;
          b.success = this.resolveCatch(b.type);
          b.shakes = b.success ? 3 : 1 + Math.floor(Math.random() * 3);
          this.state = 'catching';
          this.enemy.vx = this.enemy.vy = 0;
          this.enemy.dash = null;
          // Clear every attack in flight, the player's too: a late hit used to knock the
          // Pokémon out inside the ball, turning the catch into a plain win.
          this.projectiles = [];
          this.strikes = [];
          this.hazards = [];
          this.player.dash = null;
        } else if (b.life <= 0) {
          this.log('The ball missed!');
          this.ball = null;
        }
      } else if (b.phase === 'shake') {
        const prevShake = Math.floor(b.t / 0.6);
        b.t += dt;
        if (Math.floor(b.t / 0.6) !== prevShake && b.t < b.shakes * 0.6) PG.Audio.sfx('shake');
        if (b.t >= b.shakes * 0.6 + 0.3) {
          if (b.success) {
            this.log(`Gotcha! ${e.mon.name} was caught!`);
            PG.Audio.sfx('caught');
            this.awardXp(e.mon);
            this.ball = null;
            this.finish('caught');
          } else {
            this.log(`Oh no! ${e.mon.name} broke free!`);
            PG.Audio.sfx('breakFree');
            this.ball = null;
            this.state = 'fight';
            this.enemy.cd = Math.max(this.enemy.cd, 0.4);
          }
        }
      }
    }

    updateFx(dt) {
      for (const t of this.texts) { t.t -= dt; t.y -= 30 * dt; }
      this.texts = this.texts.filter(t => t.t > 0);
    }

    // ---------- AI ----------
    updateAI(dt) {
      const e = this.enemy, p = this.player, ai = this.ai;
      if (e.dash || e.roll || e.stagger > 0) return;
      const skill = this.aiSkill;
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      const toP = Math.atan2(p.y - e.y, p.x - e.x);
      const smart = skill >= 0.5; // gym leaders, tournament trainers, legendaries

      // ---------- reflexes: dodge roll ----------
      ai.reactT = Math.max(0, (ai.reactT || 0) - dt);
      ai.rollHeat = Math.max(0, (ai.rollHeat || 0) - dt / 3);   // recent rolls, wearing off over ~3s
      if (smart && ai.reactT <= 0) {
        let threat = null;
        for (const pr of this.projectiles) {
          if (pr.owner === e) continue;
          const sp = Math.hypot(pr.vx, pr.vy) || 1, rx = e.x - pr.x, ry = e.y - pr.y;
          const along = (rx * pr.vx + ry * pr.vy) / sp, perp = (rx * pr.vy - ry * pr.vx) / sp;
          if (along > 0 && along < 170 && Math.abs(perp) < RADIUS + pr.size + 6) threat = { kind: 'shot', power: pr.move ? pr.move.power : 60, dx: -pr.vy / sp * Math.sign(perp || 1), dy: pr.vx / sp * Math.sign(perp || 1) };
        }
        for (const st of this.strikes) {
          if (st.owner === e) continue;
          if (Math.hypot(e.x - st.x, e.y - st.y) < st.r + RADIUS && st.t < 0.32) threat = { kind: 'strike', power: st.move.power, ult: st.move.ult, dx: e.x - st.x, dy: e.y - st.y };
        }
        if (p.dash && dist < 170) threat = { kind: 'dash', power: p.dash.move ? p.dash.move.power : 60, dx: -Math.sin(toP), dy: Math.cos(toP) };
        if (threat) {
          ai.reactT = 0.25;
          // Rolling costs tiredness, so good trainers only spend it on hits worth avoiding: big moves and
          // ultimates, rarely weak pokes, almost never twice in a row, and not when already exhausted.
          const worth = threat.ult ? 1 : Math.min(1, Math.max(0.15, ((threat.power || 60) - 30) / 70));
          const tooTired = e.cd > moveCooldown(e.mon) * (1 - CONFIG.DODGE_TIREDNESS);   // startRoll would refuse anyway
          const chance = skill * 0.9 * worth / (1 + ai.rollHeat * 3);
          if (!tooTired && e.rollCd <= 0 && Math.random() < chance && this.startRoll(e, threat.dx, threat.dy)) ai.rollHeat += 1;
        }
      }
      if (e.roll) return;

      // ---------- ultimate: fire it when you are tired, stunned or cornered ----------
      if (e.meter >= 100 && !p.roll && e.cd <= 0 && (p.cd > 0.4 || p.stagger > 0 || Math.random() < 0.01 + skill * 0.01)) {
        if (this.useUltimate(e)) return;
      }

      // ---------- charging a move ----------
      if (e.charge) {
        e.charge.t += dt;
        if (e.charge.t >= e.charge.hold || dist < 110) {
          const lvl = Math.max(0, Math.min(1, (e.charge.t - 0.15) / CHARGE_FULL)), i = e.charge.i;
          e.charge = null;
          this.useMove(e, i, lvl);
        }
      }

      const moves = e.mon.moves.map(id => MOVES[id]);
      const hasRanged = moves.some(m => ['projectile', 'strike'].includes(m.kind) && m.power > 0);
      const hasMelee = moves.some(m => ['melee', 'dash', 'area'].includes(m.kind) && m.power > 0);
      const punish = smart && (p.cd > 0.5 || p.stagger > 0);
      let preferred = hasRanged && (!hasMelee || e.mon.hp < e.mon.maxHp * 0.4) ? 260 : 90;
      if (punish) preferred = hasMelee ? 70 : 200;           // move in for the punish
      else if (smart && e.cd > 0.6 && !e.brawler) preferred = Math.max(preferred, 230); // back off while tired

      let mx = 0, my = 0;
      // approach / keep distance
      if (dist > preferred + 40) { mx += Math.cos(toP); my += Math.sin(toP); }
      else if (dist < preferred - 40) { mx -= Math.cos(toP); my -= Math.sin(toP); }
      // strafe around the player
      ai.strafeT -= dt;
      if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = 1 + Math.random() * 2; }
      mx += Math.cos(toP + Math.PI / 2) * ai.strafe * 0.6;
      my += Math.sin(toP + Math.PI / 2) * ai.strafe * 0.6;

      // dodge incoming projectiles and telegraphed strikes (better AI dodges more reliably)
      for (const pr of this.projectiles) {
        if (pr.owner === e) continue;
        const rx = e.x - pr.x, ry = e.y - pr.y;
        const sp = Math.hypot(pr.vx, pr.vy) || 1;
        const along = (rx * pr.vx + ry * pr.vy) / sp;
        if (along <= 0 || along > 260) continue;
        const perp = (rx * pr.vy - ry * pr.vx) / sp;
        if (Math.abs(perp) < RADIUS + pr.size + 15 && Math.random() < skill + 0.2) {
          const side = perp >= 0 ? 1 : -1;
          mx += (pr.vy / sp) * side * 2.5; my += (-pr.vx / sp) * side * 2.5;
        }
      }
      for (const s of this.strikes) {
        if (s.owner === e) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < s.r + RADIUS && s.t < s.max * (0.4 + skill * 0.6)) {
          const a = Math.atan2(e.y - s.y, e.x - s.x);
          mx += Math.cos(a) * 3; my += Math.sin(a) * 3;
        }
      }
      // step out of the player's poison pools / burning ground
      for (const z of this.hazards) {
        if (z.side === e.side) continue;
        const d = Math.hypot(e.x - z.x, e.y - z.y);
        if (d < z.r + RADIUS * 0.6) { const a = Math.atan2(e.y - z.y, e.x - z.x); mx += Math.cos(a) * 2.5; my += Math.sin(a) * 2.5; }
      }
      // avoid walls
      if (e.x < 80) mx += 1; if (e.x > ARENA_W - 80) mx -= 1;
      if (e.y < 100) my += 1; if (e.y > ARENA_H - 80) my -= 1;

      const ml = Math.hypot(mx, my);
      const spd = e.speed * (0.75 + skill * 0.25);
      if (ml > 0.1) {
        e.vx += ((mx / ml) * spd - e.vx) * Math.min(1, dt * 8);
        e.vy += ((my / ml) * spd - e.vy) * Math.min(1, dt * 8);
      }

      // attack decisions
      if (e.charge) return;
      if (e.cd > 0) { ai.think = (punish ? 0.02 : 0.15) + (1 - skill) * 0.6 * Math.random(); return; }
      ai.think -= dt;
      if (ai.think > 0) return;
      const [best, bestScore] = this.chooseMove(e, p, dist, skill);
      if (this.outOfPP(e.mon)) { if (dist < 200) this.useMove(e, 0); else ai.think = 0.25; return; } // Struggle
      if (best >= 0 && bestScore > 4) {
        const m = MOVES[e.mon.moves[best]];
        // smart trainers charge strong attacks when you are far away or too tired to punish them
        if (smart && !e.charge && m.power >= 60 && (dist > 260 || p.cd > 0.8) && Math.random() < skill * 0.7) {
          e.charge = { i: best, t: 0, hold: 0.35 + skill * 0.7 };
          this.rememberMove(e.mon.moves[best]);
          return;
        }
        if (!e.charge && this.useMove(e, best)) this.rememberMove(e.mon.moves[best]);
        if (punish) ai.think = 0.05;
      } else ai.think = 0.25;
    }

    // Pick the enemy's next move: [index, score] (-1 when nothing is worth using).
    // Moves are scored by power, type match-up, STAB and range, then the pick is a weighted draw among the
    // good options, so even top trainers mix it up instead of spamming their single strongest move.
    // Repeating the last move (and the same style: contact vs. ranged) is discouraged.
    chooseMove(e, p, dist, skill) {
      const ai = this.ai, recent = ai.recent || [], pp = this.ppOf(e.mon);
      const lastKind = recent.length ? MOVES[recent[recent.length - 1]].kind : null;
      const contact = (k) => k === 'melee' || k === 'dash';
      const opts = [];
      e.mon.moves.forEach((id, i) => {
        if (pp[id] <= 0) return;
        const m = MOVES[id];
        let score;
        if (m.kind === 'heal') score = e.mon.hp < e.mon.maxHp * 0.45 ? 120 : 0;
        else if (m.kind === 'buff') score = e.stages[m.stat] < 2 && dist > 200 ? 35 : 5;
        else if (m.kind === 'debuff') score = p.stages[m.stat] > -2 ? 25 : 3;
        else if (m.kind === 'none') score = 1;
        else {
          const eff = PG.effectiveness(m.type, p.mon.types);
          const stab = e.mon.types.includes(m.type) ? 1.5 : 1;
          score = m.power * eff * stab * (m.count ? 1.2 : 1) / Math.sqrt(m.recharge || 1);
          const inRange =
            m.kind === 'melee' ? dist < (m.range || 80) + RADIUS * 2 + CONFIG.MELEE_LUNGE :
            m.kind === 'area' ? dist < m.radius + RADIUS :
            m.kind === 'dash' ? dist < 320 : dist < 520;
          if (!inRange) score *= 0.05;
          if (lastKind && m.power > 0 && contact(m.kind) !== contact(lastKind)) score *= 1.15;   // switch styles
        }
        // don't repeat yourself: the last move is less attractive, a third time in a row much less
        const n = recent.length;
        if (n && recent[n - 1] === id) score *= n >= 2 && recent[n - 2] === id ? 0.25 : 0.55;
        else if (n >= 2 && recent[n - 2] === id) score *= 0.8;
        score *= 0.85 + Math.random() * 0.3;
        opts.push({ i, score });
      });
      if (!opts.length) return [-1, 0];
      const top = Math.max(...opts.map(o => o.score));
      // weighted draw among moves close to the best (sharper trainers keep the cut-off tighter)
      const pool = opts.filter(o => o.score >= top * (0.35 + skill * 0.25) && o.score > 4);
      if (!pool.length) return [-1, top];
      let r = Math.random() * pool.reduce((a, o) => a + o.score, 0);
      for (const o of pool) { r -= o.score; if (r <= 0) return [o.i, o.score]; }
      return [pool[0].i, pool[0].score];
    }

    rememberMove(id) {
      const ai = this.ai;
      (ai.recent = ai.recent || []).push(id);
      if (ai.recent.length > 3) ai.recent.shift();
    }

    // ---------- rendering ----------
    drawWorld(ctx, vw, vh, L) {
      const fx = this.fx;
      ctx.fillStyle = fx.arena.out;
      ctx.fillRect(0, 0, vw, vh);
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.scale(L.scale, L.scale);
      if (fx.stadium) PG.Stadium.draw(ctx, fx.stadium, ARENA_W, ARENA_H, this.time, fx.cheerT);

      // ground layer: arena, marks, telegraphs
      fx.drawArena(ctx);
      fx.drawDecals(ctx);
      this.drawTerrain(ctx, false);
      for (const s of this.strikes) fx.drawStrikeGround(ctx, s);
      this.drawHazards(ctx);
      fx.drawGhosts(ctx);

      this.drawTerrain(ctx, true);
      fx.drawLighting(ctx, [this.player, this.enemy]); // night / dusk for outdoor battles
      for (const f of [this.player, this.enemy].sort((a, b) => a.y - b.y)) this.drawFighter(ctx, f);

      // air layer: attacks, particles, ambient
      for (const pr of this.projectiles) fx.drawProjectile(ctx, pr);
      for (const s of this.strikes) fx.drawStrikeAir(ctx, s);
      fx.drawAnims(ctx);
      fx.drawParticles(ctx);
      fx.drawAmbient(ctx);

      if (this.ball) this.drawBall(ctx, this.ball);

      fx.drawFlash(ctx);
      ctx.restore();
    }

    // Floating labels and damage numbers (big, chunky and outlined, like an arcade fighter).
    drawTexts(ctx) {
      for (const t of this.texts) {
        const age = 1.1 - t.t;
        const pop = t.style && age < 0.14 ? 1.9 - (age / 0.14) * 0.9 : 1;
        const px = t.style === 'big' ? 34 : t.style === 'dmg' ? 26 : 17;
        ctx.save();
        ctx.translate(t.x, t.y); ctx.scale(pop, pop);
        ctx.font = t.style ? `900 ${px}px "Arial Black", Impact, system-ui, sans-serif` : `bold ${px}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = t.style ? 6 : 4;
        ctx.strokeStyle = t.style ? '#2a1640' : 'rgba(0,0,0,0.75)';
        ctx.globalAlpha = Math.min(1, t.t * 2);
        if (t.style) { ctx.fillStyle = '#2a1640'; ctx.fillText(t.text, 2, 3); }   // hard drop shadow
        ctx.strokeText(t.text, 0, 0);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
      }
    }

    // Where the field sits on screen. Stadiums leave room for the stands (they may run off the edges).
    layout(vw, vh) {
      const st = this.fx.stadium, top = st ? PG.Stadium.TOP : 0, bot = st ? PG.Stadium.BOT : 0;
      const scale = Math.min(vw / ARENA_W, (vh - 10) / (ARENA_H + (st ? 110 : 0)));
      const ox = (vw - ARENA_W * scale) / 2;
      const oy = (vh - (ARENA_H + top + bot) * scale) / 2 + top * scale;
      const [sx, sy] = this.fx.shakeOffset();
      return { scale, x: ox + sx * scale, y: oy + sy * scale };
    }

    // Battles are drawn in two passes: the world (arena, crowd, Pokémon, effects) at a low resolution and
    // scaled up with hard pixel edges for a pixel-art look, then text (name tags, damage numbers, banner,
    // cut-ins) sharp on top. P toggles the pixel look.
    draw(ctx, vw, vh) {
      const L = this.layout(vw, vh), P = PG.battlePixel();
      this.tagQueue = [];
      if (P > 1) {
        const W = Math.ceil(vw / P), H = Math.ceil(vh / P);
        const c = this.pixCanvas || (this.pixCanvas = document.createElement('canvas'));
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        const g = c.getContext('2d');
        g.setTransform(1 / P, 0, 0, 1 / P, 0, 0);
        this.drawWorld(g, vw, vh, L);
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, W * P, H * P); ctx.restore();
      } else this.drawWorld(ctx, vw, vh, L);
      ctx.save();
      ctx.translate(L.x, L.y); ctx.scale(L.scale, L.scale);
      if (this.fx.stadium) {
        const title = this.opts.tournament ? PG.region().leagueName : this.opts.gym.name;
        PG.Stadium.drawTitle(ctx, ARENA_W, `${title}  ·  ${this.player.mon.name} vs ${this.enemy.mon.name}`.toUpperCase());
      }
      for (const [f, hop, col] of this.tagQueue) this.drawTag(ctx, f, hop, col);
      this.drawTexts(ctx);
      ctx.restore();

      if (this.cinematic) this.drawCinematic(ctx, vw, vh);
      if (this.introT > 0) this.drawIntro(ctx, vw, vh);
      if (this.state === 'over') this.drawResult(ctx, vw, vh);
    }

    // Ultimate cut-in: a type-themed backdrop (flames, storm, black hole...), the Pokémon close up and the move name.
    drawCinematic(ctx, vw, vh) {
      const c = this.cinematic, k = 1 - c.t / c.max;
      const ease = Math.min(1, k / 0.18), out = Math.min(1, c.t / 0.2);
      const a = Math.min(ease, out), P = PG.ULT.pal(c.type), left = c.by.side === 'player';
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.45 * a})`; ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = a;
      PG.ULT.backdrop(ctx, c.type, vw, vh, this.time, k);
      // letterbox bars with a type-coloured edge
      const bar = vh * 0.13 * a;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, bar); ctx.fillRect(0, vh - bar, vw, bar);
      ctx.fillStyle = P[0]; ctx.fillRect(0, bar - 4, vw, 4); ctx.fillRect(0, vh - bar, vw, 4);
      // the Pokémon slides in, haloed and outlined in the type colour
      const size = Math.min(vh * 0.5, 340);
      const slide = (1 - Math.min(1, k / 0.22)) * vw * 0.45 * (left ? -1 : 1);
      const cx = (left ? vw * 0.28 : vw * 0.72) + slide, cy = vh * 0.46;
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.75);
      g.addColorStop(0, hexA(P[1], 0.85)); g.addColorStop(0.5, hexA(P[0], 0.5)); g.addColorStop(1, hexA(P[0], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, size * 0.75, 0, Math.PI * 2); ctx.fill();
      PG.drawMon(ctx, c.by.mon.species, cx, cy, size * (1 + 0.06 * Math.sin(k * 30)), left);
      // slanted banner with the move name, sweeping in from the opposite side
      const title = c.name.toUpperCase(), ty = Math.max(vh * 0.3, Math.min(vh * 0.64, vh - 240));
      let fs = Math.min(66, vw / 12);
      ctx.font = `900 italic ${Math.round(fs)}px system-ui, sans-serif`;
      while (ctx.measureText(title).width > vw * 0.86 && fs > 18) { fs -= 2; ctx.font = `900 italic ${Math.round(fs)}px system-ui, sans-serif`; }
      const tw = ctx.measureText(title).width, sweep = (1 - Math.min(1, Math.max(0, k - 0.08) / 0.2)) * vw * (left ? 1 : -1);
      const tx = vw / 2 + sweep;
      ctx.save(); ctx.translate(tx, ty - fs * 0.35); ctx.transform(1, 0, -0.25, 1, 0, 0);
      ctx.fillStyle = hexA(P[2], 0.85); ctx.fillRect(-tw / 2 - 40, -fs * 0.75, tw + 80, fs * 1.3);
      ctx.fillStyle = P[0]; ctx.fillRect(-tw / 2 - 40, -fs * 0.75, 10, fs * 1.3); ctx.fillRect(tw / 2 + 30, -fs * 0.75, 10, fs * 1.3);
      ctx.restore();
      const tg = ctx.createLinearGradient(0, ty - fs, 0, ty);
      tg.addColorStop(0, P[1]); tg.addColorStop(1, P[0]);
      ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
      ctx.strokeText(title, tx, ty); ctx.fillStyle = tg; ctx.fillText(title, tx, ty);
      // shine sweeping across the letters
      const u = Math.min(0.92, (k * 1.6) % 1.2);
      const sh = ctx.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0);
      sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(u, 'rgba(255,255,255,0)');
      sh.addColorStop(u + 0.04, 'rgba(255,255,255,0.75)'); sh.addColorStop(u + 0.08, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh; ctx.fillText(title, tx, ty);
      ctx.font = `800 ${Math.round(Math.min(22, vw / 36))}px system-ui, sans-serif`;
      const sub = `${c.by.mon.name.toUpperCase()}'S ${c.type.toUpperCase()} ULTIMATE`;
      ctx.lineWidth = 5; ctx.strokeText(sub, tx, ty - fs * 1.05); ctx.fillStyle = P[1]; ctx.fillText(sub, tx, ty - fs * 1.05);
      ctx.restore();
    }

    // 'VS' splash: two team bands slide in from the sides.
    drawIntro(ctx, vw, vh) {
      const t = INTRO_TIME - this.introT;
      const slide = Math.min(1, t / 0.35), ease = 1 - Math.pow(1 - slide, 3);
      const fade = Math.min(1, this.introT / 0.3);
      const bandH = Math.min(120, vh * 0.2);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, vw, vh);
      const sides = [
        { y: vh / 2 - bandH - 6, dir: -1, col: '#2b7de0', mon: this.player.mon, title: 'You' },
        { y: vh / 2 + 6, dir: 1, col: '#d93c3c', mon: this.enemy.mon, title: this.opts.tournament ? this.opts.gym.leader : this.kind === 'gym' ? `Leader ${this.opts.gym.leader}` : this.legendary ? '★ Legendary Pokémon ★' : 'Wild Pokémon' },
      ];
      for (const sd of sides) {
        const off = (1 - ease) * vw * sd.dir;
        ctx.save();
        ctx.translate(off, 0);
        const g = ctx.createLinearGradient(0, 0, vw, 0);
        g.addColorStop(sd.dir < 0 ? 0 : 1, sd.col); g.addColorStop(sd.dir < 0 ? 1 : 0, hexA(sd.col, 0.15));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-40, sd.y + bandH); ctx.lineTo(vw + 40, sd.y + bandH - 30); ctx.lineTo(vw + 40, sd.y - 30); ctx.lineTo(-40, sd.y); ctx.closePath();
        ctx.fill();
        const sx = sd.dir < 0 ? vw * 0.22 : vw * 0.78;
        PG.drawMon(ctx, sd.mon.species, sx, sd.y + bandH / 2 - 14, bandH * 1.05, sd.dir < 0);
        ctx.textAlign = sd.dir < 0 ? 'left' : 'right';
        const tx = sd.dir < 0 ? sx + bandH * 0.6 : sx - bandH * 0.6;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = `600 ${Math.round(bandH * 0.14)}px system-ui, sans-serif`;
        ctx.fillText(sd.title, tx, sd.y + bandH * 0.36);
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${Math.round(bandH * 0.3)}px system-ui, sans-serif`;
        ctx.fillText(`${sd.mon.name}  Lv${sd.mon.level}`, tx, sd.y + bandH * 0.7);
        ctx.restore();
      }
      if (this.stage) {
        ctx.save();
        ctx.globalAlpha = fade * Math.min(1, t / 0.5);
        ctx.font = `800 ${Math.round(bandH * 0.18)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round';
        const label = `Stage: ${this.stage.name}`;
        ctx.strokeText(label, vw / 2, vh / 2 + bandH * 1.45);
        ctx.fillStyle = '#ffe680'; ctx.fillText(label, vw / 2, vh / 2 + bandH * 1.45);
        ctx.restore();
      }
      const vsK = Math.max(0, Math.min(1, (t - 0.25) / 0.2));
      const vsScale = vsK < 1 ? 2.5 - vsK * 1.5 : 1 + Math.sin(t * 10) * 0.03;
      ctx.globalAlpha = fade * vsK;
      ctx.translate(vw / 2, vh / 2); ctx.scale(vsScale, vsScale); ctx.rotate(-0.08);
      ctx.font = `900 italic ${Math.round(bandH * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1a1a';
      ctx.strokeText('VS', 0, 0);
      ctx.fillStyle = '#ffcb05'; ctx.fillText('VS', 0, 0);
      ctx.restore();
    }

    // Result banner shown in the moment between the battle ending and the results screen.
    drawResult(ctx, vw, vh) {
      const spec = {
        win: [this.opts.tournament ? 'MATCH WON!' : this.opts.gymTrainer ? 'VICTORY!' : this.kind === 'gym' ? 'GYM CLEARED!' : 'VICTORY!', '#ffcb05'],
        caught: ['GOTCHA!', '#7be07b'],
        lose: ['DEFEATED', '#ff5a5a'],
        run: ['GOT AWAY!', '#9ec5ff'],
      }[this.result];
      if (!spec) return;
      const k = Math.min(1, this.overT / 0.3);
      const scale = k < 1 ? 0.6 + k * 0.5 : 1.1 - Math.min(0.1, (this.overT - 0.3) * 0.3);
      const bandH = Math.min(110, vh * 0.18);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, vh / 2 - bandH / 2, vw, bandH);
      ctx.fillStyle = spec[1];
      ctx.fillRect(0, vh / 2 - bandH / 2, vw, 3); ctx.fillRect(0, vh / 2 + bandH / 2 - 3, vw, 3);
      ctx.translate(vw / 2, vh / 2); ctx.scale(scale, scale);
      ctx.font = `900 italic ${Math.round(bandH * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
      ctx.strokeText(spec[0], 0, 0);
      ctx.fillStyle = spec[1]; ctx.fillText(spec[0], 0, 0);
      ctx.restore();
    }

    // rocks: true draws boulders, false draws flat ground features (pools, tall grass).
    drawTerrain(ctx, rocks) {
      const t = this.time;
      for (const o of this.obstacles) {
        if ((o.kind === 'rock') !== rocks) continue;
        const R = seededRand(o.seed * 1000 + 7);
        if (o.kind === 'pool') {
          const rx = o.r, ry = o.r * 0.75;
          // wet sand rim and stones
          ctx.fillStyle = '#b9a47a'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 3, rx + 10, ry + 9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#8f7d58'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 4, rx + 4, ry + 4, 0, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 + R() * 0.3, sx = o.x + Math.cos(a) * (rx + 7), sy = o.y + Math.sin(a) * (ry + 6) + 2;
            ctx.fillStyle = R() < 0.5 ? '#9a958c' : '#b8b2a6';
            ctx.beginPath(); ctx.ellipse(sx, sy, 4 + R() * 3, 3 + R() * 2, R() * 3, 0, Math.PI * 2); ctx.fill();
          }
          // water: deep in the middle, shallow at the edge
          const g = ctx.createRadialGradient(o.x - rx * 0.25, o.y - ry * 0.3, 4, o.x, o.y, rx);
          g.addColorStop(0, '#1f5fa8'); g.addColorStop(0.65, '#3a86d0'); g.addColorStop(1, '#7cc4f0');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(o.x, o.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          ctx.save(); ctx.beginPath(); ctx.ellipse(o.x, o.y, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
          // drifting caustic ripples
          ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const yy = o.y - ry + (((t * 12 + i * ry * 0.5) % (ry * 2)));
            ctx.beginPath();
            for (let x = o.x - rx; x <= o.x + rx; x += 8) ctx.lineTo(x, yy + Math.sin(x / 14 + t * 2 + i) * 3);
            ctx.stroke();
          }
          // expanding ripple rings
          for (let i = 0; i < 2; i++) {
            const k = (t * 0.5 + i * 0.5 + o.seed) % 1;
            ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(o.x + (i ? rx * 0.3 : -rx * 0.25), o.y + (i ? -ry * 0.2 : ry * 0.2), 6 + k * 26, (6 + k * 26) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
          // shine
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.ellipse(o.x, o.y, rx - 6, ry - 6, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
          ctx.lineCap = 'butt';
          // lily pads
          for (let i = 0; i < 2; i++) {
            const lx = o.x + (R() - 0.5) * rx * 1.1, ly = o.y + (R() - 0.5) * ry * 1.0 + Math.sin(t + i) * 1.5;
            ctx.fillStyle = '#3f9a4a'; ctx.beginPath(); ctx.arc(lx, ly, 8, 0.35, Math.PI * 2 - 0.35); ctx.lineTo(lx, ly); ctx.fill();
            ctx.fillStyle = '#5fbf5e'; ctx.beginPath(); ctx.arc(lx - 2, ly - 2, 3, 0, Math.PI * 2); ctx.fill();
            if (i === 0) { ctx.fillStyle = '#ff9ec7'; ctx.beginPath(); ctx.arc(lx + 2, ly - 3, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(lx + 2, ly - 3, 1.2, 0, Math.PI * 2); ctx.fill(); }
          }
        } else if (o.kind === 'grass') {
          const rx = o.r, ry = o.r * 0.8;
          const g = ctx.createRadialGradient(o.x, o.y, 4, o.x, o.y, rx);
          g.addColorStop(0, 'rgba(34,92,34,0.75)'); g.addColorStop(0.8, 'rgba(46,112,40,0.45)'); g.addColorStop(1, 'rgba(46,112,40,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(o.x, o.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
          // blades, back to front so nearer ones overlap
          const blades = [];
          for (let i = 0; i < 55; i++) {
            const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 0.9;
            blades.push({ x: o.x + Math.cos(a) * rx * d, y: o.y + Math.sin(a) * ry * d, h: 12 + R() * 14, c: ['#2f7d32', '#3f9a3c', '#5cb84a', '#7ccf5a'][Math.floor(R() * 4)], ph: R() * 6 });
          }
          blades.sort((a, b) => a.y - b.y);
          for (const bl of blades) {
            const sw = Math.sin(t * 2.2 + bl.ph + bl.x * 0.05) * 3;
            ctx.fillStyle = bl.c;
            ctx.beginPath(); ctx.moveTo(bl.x - 3, bl.y); ctx.quadraticCurveTo(bl.x - 1 + sw * 0.5, bl.y - bl.h * 0.6, bl.x + sw, bl.y - bl.h); ctx.quadraticCurveTo(bl.x + 1 + sw * 0.5, bl.y - bl.h * 0.5, bl.x + 3, bl.y); ctx.fill();
          }
          for (let i = 0; i < 4; i++) {
            const fx2 = o.x + (R() - 0.5) * rx * 1.3, fy = o.y + (R() - 0.5) * ry * 1.2 - 10;
            ctx.fillStyle = ['#ffe066', '#ff9ec7', '#ffffff'][i % 3];
            for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { ctx.beginPath(); ctx.arc(fx2 + ox, fy + oy, 1.8, 0, Math.PI * 2); ctx.fill(); }
          }
        } else {
          const r = o.r;
          // soft shadow and pebbles
          ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(o.x + 6, o.y + r * 0.55, r * 1.12, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 4; i++) {
            const a = R() * Math.PI * 2;
            ctx.fillStyle = '#8b8172'; ctx.beginPath(); ctx.ellipse(o.x + Math.cos(a) * (r + 10), o.y + r * 0.45 + Math.sin(a) * 8, 3 + R() * 2, 2 + R() * 1.5, 0, 0, Math.PI * 2); ctx.fill();
          }
          // body with light from the top-left
          const pts = [];
          for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = r * (0.82 + R() * 0.22); pts.push([o.x + Math.cos(a) * rr, o.y - r * 0.25 + Math.sin(a) * rr * 0.82]); }
          const g = ctx.createLinearGradient(o.x - r, o.y - r, o.x + r, o.y + r * 0.6);
          g.addColorStop(0, '#e6dfcc'); g.addColorStop(0.55, '#bdb39b'); g.addColorStop(1, '#7f7563');
          ctx.fillStyle = g; ctx.beginPath(); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#4a4236'; ctx.lineWidth = 2.5; ctx.stroke();
          // top facet highlight
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.beginPath(); ctx.moveTo(pts[5][0], pts[5][1]); ctx.lineTo(pts[6][0], pts[6][1]); ctx.lineTo(o.x, o.y - r * 0.35); ctx.closePath(); ctx.fill();
          // moss and cracks
          ctx.fillStyle = 'rgba(110,158,78,0.8)';
          ctx.beginPath(); ctx.ellipse(o.x - r * 0.15, o.y - r * 0.85, r * 0.45, r * 0.16, -0.2, 0, Math.PI * 2); ctx.fill();
          for (let i = 0; i < 3; i++) {   // patches of moss
            ctx.fillStyle = i % 2 ? 'rgba(150,190,100,0.7)' : 'rgba(96,140,70,0.65)';
            ctx.beginPath(); ctx.ellipse(o.x + (R() - 0.5) * r * 1.1, o.y - r * 0.25 + (R() - 0.5) * r * 0.9, r * (0.12 + R() * 0.16), r * (0.08 + R() * 0.08), R() * 3, 0, Math.PI * 2); ctx.fill();
          }
          ctx.strokeStyle = 'rgba(40,34,26,0.6)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(o.x + r * 0.2, o.y - r * 0.5); ctx.lineTo(o.x + r * 0.05, o.y - r * 0.15); ctx.lineTo(o.x + r * 0.28, o.y + r * 0.1); ctx.stroke();
        }
      }
      ctx.lineWidth = 1;
    }

    drawFighter(ctx, f) {
      const caught = this.ball && this.ball.phase === 'shake' && f === this.enemy;
      if (caught) return;
      if (f.mon.fainted && f.faintT <= 0) return;
      ctx.save();
      const fk = f.mon.fainted ? 1 - f.faintT / 0.8 : 0;
      if (f.mon.fainted) ctx.globalAlpha = Math.min(1, (f.faintT / 0.8) * 1.6);
      const sideCol = f.side === 'player' ? '#50aaff' : '#ff5a5a';
      const baseY = f.y + RADIUS * 0.8;
      const hop = f.hop > 0 ? Math.abs(Math.sin(f.hop * Math.PI * 3)) * 26 : 0;

      // shadow, team ring, and a ring segment that fills as the move cooldown recovers
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(f.x, baseY, RADIUS * (1 - hop / 80), RADIUS * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hexA(sideCol, 0.35); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(f.x, baseY, RADIUS + 6, RADIUS * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      const ready = f.cd <= 0 && !f.mon.fainted;
      const prog = ready || f.mon.fainted ? 1 : 1 - f.cd / f.cdMax;
      ctx.strokeStyle = ready ? '#ffffff' : sideCol; ctx.lineWidth = ready ? 3.5 : 3;
      if (ready) { ctx.shadowColor = sideCol; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.ellipse(f.x, baseY, RADIUS + 6, RADIUS * 0.42, 0, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;

      const size = 104;
      if (f.mon.data.legendary && !f.mon.fainted) {
        // pulsing golden aura behind legendaries
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
        const g = ctx.createRadialGradient(f.x, f.y - 8, 10, f.x, f.y - 8, 70 + pulse * 10);
        g.addColorStop(0, `rgba(255,220,120,${0.35 + pulse * 0.2})`); g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y - 8, 80, 0, Math.PI * 2); ctx.fill();
      }
      // ultimate ready: a shimmering rainbow aura
      if (f.meter >= 100 && !f.mon.fainted) {
        const t = this.time;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `hsla(${(t * 220 + i * 120) % 360},90%,65%,0.55)`; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(f.x, f.y - 6, 46 + Math.sin(t * 5 + i) * 4, 52 + Math.cos(t * 4 + i) * 4, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
      this.drawBody(ctx, f, size, baseY, hop, fk);
      // charging a move: a ring that fills, flashing white when fully charged
      if (f.charge && !fk && MOVES[f.mon.moves[f.charge.i]]) {
        const k = Math.min(1, Math.max(0, (f.charge.t - 0.15) / CHARGE_FULL));
        const col = PG.TYPES[MOVES[f.mon.moves[f.charge.i]].type].color, full = k >= 1;
        ctx.strokeStyle = full ? (Math.floor(this.time * 12) % 2 ? '#ffffff' : col) : hexA(col, 0.9); ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(f.x, f.y - 8, 50, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
        if (Math.random() < 0.5) this.fx.emit({ x: f.x + (Math.random() - 0.5) * 90, y: f.y + 20, vx: 0, vy: -120 - k * 120, life: 0.4, size: 3 + k * 3, color: col, shape: 'spark', add: true, drag: 1 });
        ctx.lineWidth = 1;
      }
      if (fk > 0) { ctx.restore(); return; }

      // dizzy stars while staggered
      if (f.stagger > 0) {
        for (let i = 0; i < 3; i++) {
          const a = this.time * 7 + (i / 3) * Math.PI * 2;
          const x = f.x + Math.cos(a) * 24, y = f.y - 48 + Math.sin(a) * 7;
          ctx.fillStyle = '#ffe066';
          ctx.beginPath();
          for (let k = 0; k < 10; k++) { const r = k % 2 ? 2.5 : 6, ang = a + (k / 10) * Math.PI * 2; ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r); }
          ctx.fill();
        }
      }

      this.tagQueue.push([f, hop, sideCol]);   // drawn sharp, after the pixel pass
      ctx.restore();
    }

    drawTag(ctx, f, hop, sideCol) {
      ctx.save();
      // overhead HP bar with name tag
      const bw = 84, bx = f.x - bw / 2, by = f.y - 66 - hop;
      ctx.fillStyle = 'rgba(10,12,18,0.72)';
      ctx.beginPath(); ctx.roundRect(bx - 3, by - 3, bw + 6, 12, 6); ctx.fill();
      const hpPct = Math.max(0, f.mon.hp / f.mon.maxHp);
      ctx.fillStyle = hpPct > 0.5 ? '#4cd964' : hpPct > 0.2 ? '#ffcc00' : '#ff3b30';
      if (hpPct > 0) { ctx.beginPath(); ctx.roundRect(bx, by, Math.max(6, bw * hpPct), 6, 3); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      if (hpPct > 0) ctx.fillRect(bx + 2, by + 1, Math.max(0, bw * hpPct - 4), 1.5);
      // name plate: type dots, name, level badge
      ctx.font = 'bold 11px system-ui, sans-serif';
      const name = f.mon.name, lv = `${f.mon.level}`;
      const nw = ctx.measureText(name).width;
      ctx.font = 'bold 9px system-ui, sans-serif';
      const lw = ctx.measureText(lv).width + 8;
      const dots = f.mon.types.length * 8;
      const pw = dots + nw + lw + 16, px = f.x - pw / 2, py = by - 19;
      ctx.fillStyle = 'rgba(10,12,18,0.78)';
      ctx.beginPath(); ctx.roundRect(px, py, pw, 14, 7); ctx.fill();
      ctx.strokeStyle = hexA(sideCol, 0.8); ctx.lineWidth = 1.5; ctx.stroke();
      f.mon.types.forEach((t, i) => {
        ctx.fillStyle = PG.TYPES[t].color;
        ctx.beginPath(); ctx.arc(px + 8 + i * 8, py + 7, 3, 0, Math.PI * 2); ctx.fill();
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillStyle = '#fff';
      ctx.fillText(name, px + 5 + dots, py + 7.5);
      ctx.fillStyle = sideCol; ctx.beginPath(); ctx.roundRect(px + pw - lw - 3, py + 2.5, lw, 9, 4.5); ctx.fill();
      ctx.font = 'bold 9px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(lv, px + pw - lw / 2 - 3, py + 7.5);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    // The Pokémon itself: pop-out entry, breathing, walk bounce and lean, smooth turning,
    // attack lunge, hit recoil, a soft type-coloured glow, and the faint topple.
    drawBody(ctx, f, size, baseY, hop, fk) {
      const t = this.time + f.phase;
      const speed = Math.hypot(f.vx, f.vy);
      const moving = speed > 30 && !f.mon.fainted;
      const low = f.mon.hp / f.mon.maxHp <= 0.25;
      // breathing (faster panting when low on HP)
      const breathe = Math.sin(t * (low ? 7 : 2.6)) * (low ? 0.045 : 0.03);
      let sx = 1 - breathe * 0.5, sy = 1 + breathe;
      let ox = 0, oy = -hop, rot = 0;
      if (moving) {
        const k = Math.min(1, speed / 220);
        oy -= Math.abs(Math.sin(t * 13)) * 6 * k;
        rot += Math.max(-0.14, Math.min(0.14, f.vx / 1500));
        sy *= 1 + Math.abs(Math.cos(t * 13)) * 0.04 * k;
      }
      if (f.dash) { sx *= 1.12; sy *= 0.9; rot += Math.cos(f.facing) * 0.18; }
      if (f.roll) { rot += (1 - f.roll.t / ROLL_TIME) * Math.PI * 2 * (f.roll.vx >= 0 ? 1 : -1); sx *= 0.82; sy *= 0.82; oy += 6; }
      if (f.castT > 0) {
        // anticipation then lunge toward the target
        const k = f.castT / 0.22, push = Math.sin((1 - k) * Math.PI) * 12;
        ox += Math.cos(f.castAng) * push; oy += Math.sin(f.castAng) * push * 0.5;
        sx *= 1 + Math.sin((1 - k) * Math.PI) * 0.1; sy *= 1 - Math.sin((1 - k) * Math.PI) * 0.06;
      }
      if (f.hitT > 0) {
        const k = f.hitT / 0.3;
        ox += Math.cos(f.hitAng) * 10 * k; oy += Math.sin(f.hitAng) * 4 * k;
        rot += Math.cos(f.hitAng) * 0.25 * k;
        sx *= 1 + 0.15 * k; sy *= 1 - 0.15 * k;
      }
      if (f.stagger > 0) ox += Math.sin(this.time * 40) * 3;
      let pop = 1;
      if (f.spawnT > 0) {
        // grow out of the ball with a little overshoot
        const k = 1 - f.spawnT / 0.45;
        pop = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      }
      if (fk > 0) { sx = 1 + fk * 0.25; sy = 1 - fk * 0.7; ox = 0; oy = 0; rot = 0; }

      ctx.save();
      ctx.translate(f.x + ox, baseY + oy);
      ctx.rotate(rot);
      ctx.scale(sx * pop * f.flipK, sy * pop);
      if (f.flash > 0) ctx.filter = 'brightness(2.5)';
      else if (f.spawnT > 0.15) ctx.filter = `brightness(${1 + (f.spawnT - 0.15) * 6})`;
      else if (fk > 0) ctx.filter = `grayscale(${fk}) brightness(${1 - fk * 0.4})`;
      if (!fk) {
        // soft type-coloured rim light
        ctx.shadowColor = hexA(PG.TYPES[f.mon.types[0]].color, 0.85);
        ctx.shadowBlur = 14;
      }
      PG.drawMon(ctx, f.mon.species, 0, -(baseY - (f.y - 8)), size, false);
      ctx.restore();

      // sweat drop when panting
      if (low && !fk && f.mon.hp > 0) {
        const k = (t * 1.2) % 1;
        ctx.fillStyle = `rgba(150,200,255,${1 - k})`;
        const dx = f.x + 26 * -f.flipK, dy = f.y - 40 + k * 14 - hop;
        ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, Math.PI * 2); ctx.lineTo(dx, dy - 8); ctx.fill();
      }
    }

    drawBall(ctx, b) {
      let x = b.x, y = b.y - (b.z || 0), rot = 0;
      if (b.phase === 'shake') {
        const k = b.t % 0.6;
        rot = k < 0.3 ? Math.sin(k / 0.3 * Math.PI * 2) * 0.5 : 0;
      }
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = PG.ITEMS[b.type || 'poke_ball'].color; ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI, 0); ctx.fill();
      if (b.type === 'great_ball') { ctx.fillStyle = '#e33'; ctx.fillRect(-8, -9, 4, 6); ctx.fillRect(4, -9, 4, 6); }
      if (b.type === 'ultra_ball') { ctx.fillStyle = '#f5c518'; ctx.fillRect(-10, -6, 6, 5); ctx.fillRect(4, -6, 6, 5); }
      if (b.type === 'master_ball') { ctx.fillStyle = '#ff7fc8'; ctx.beginPath(); ctx.arc(-6, -6, 2.5, 0, Math.PI * 2); ctx.arc(6, -6, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center'; ctx.fillText('M', 0, -3); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  function hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
  }

  PG.Battle = Battle;
  PG.moveCooldown = moveCooldown;
})();
