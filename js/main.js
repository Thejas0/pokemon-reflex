// Game controller: scenes, save/load, main loop.
(function () {
  const { CONFIG, GYMS, UI } = PG;
  const SPECIES_TYPE = (o) => PG.SPECIES[o.team[0][0]].types[0];
  const SAVE_KEY = 'pg-save-v1';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, dpr = 1;

  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    // big retina windows: cap the backing store (~4 MP) so every frame stays cheap to fill
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(4e6 / (vw * vh))));
    canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  const game = {
    scene: 'start',
    world: new PG.World(1),
    battle: null,
    state: { party: [], box: [], balls: { poke_ball: CONFIG.START_BALLS }, badges: [], money: CONFIG.START_MONEY, items: {}, seen: [], caught: [], fixes: { raichuReverted: true }, gymProgress: {}, region: 1, stash: {}, champions: {} },
    time: 0,
    saveTimer: 0,

    save() {
      if (!this.state.party.length) return;
      const p = this.world.player;
      const data = {
        party: this.state.party.map(m => m.toJSON()),
        box: this.state.box.map(m => m.toJSON()),
        balls: this.state.balls,
        badges: this.state.badges,
        money: this.state.money,
        items: this.state.items,
        seen: this.state.seen,
        caught: this.state.caught,
        tournament: this.state.tournament || null,
        fixes: this.state.fixes || {},
        gymProgress: this.state.gymProgress || {},
        region: PG.currentRegion,
        champions: this.state.champions || {},
        // the other region's team, box and tournament, kept while you are away
        stash: Object.fromEntries(Object.entries(this.state.stash || {}).map(([r, st]) => [r, {
          party: st.party.map(m => m.toJSON()), box: st.box.map(m => m.toJSON()), tournament: st.tournament || null, pos: st.pos || null,
        }])),
        pos: { x: p.x, y: p.y },
        mapW: this.world.W, mapH: this.world.H,
      };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
    },

    load() {
      let raw = null;
      try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
      if (!raw) return false;
      try {
        const d = JSON.parse(raw);
        // which region you were in (older saves: Kanto)
        PG.currentRegion = d.region === 2 ? 2 : 1;
        this.state.region = PG.currentRegion;
        if (PG.currentRegion !== 1) this.world = this.getWorld(PG.currentRegion);
        // Skip species that no longer exist in the game (e.g. removed in an update).
        const known = (o) => !!PG.SPECIES[o.species];
        this.state.party = d.party.filter(known).map(PG.Pokemon.fromJSON);
        this.state.box = (d.box || []).filter(known).map(PG.Pokemon.fromJSON);
        if (!this.state.party.length && this.state.box.length) this.state.party.push(this.state.box.shift());
        // Older saves stored a single Poké Ball count.
        this.state.balls = typeof d.balls === 'number' ? { poke_ball: d.balls } : (d.balls || { poke_ball: CONFIG.START_BALLS });
        this.state.badges = d.badges || [];
        this.state.money = d.money ?? CONFIG.START_MONEY;
        this.state.items = d.items || {};
        const owned = [...this.state.party, ...this.state.box].map(m => m.species);
        this.state.caught = (d.caught || [...new Set(owned)]).filter(id => PG.SPECIES[id]);
        this.state.seen = (d.seen || [...this.state.caught]).filter(id => PG.SPECIES[id]);
        this.state.tournament = d.tournament || null;
        this.state.fixes = d.fixes || {};
        this.state.gymProgress = d.gymProgress || {};
        this.state.champions = d.champions || {};
        this.state.stash = {};
        for (const [r, st] of Object.entries(d.stash || {})) {
          this.state.stash[r] = { party: (st.party || []).filter(known).map(PG.Pokemon.fromJSON), box: (st.box || []).filter(known).map(PG.Pokemon.fromJSON), tournament: st.tournament || null, pos: st.pos || null };
        }
        // older saves: a won Kanto tournament counts as being Kanto Champion
        const kantoT = PG.currentRegion === 1 ? this.state.tournament : this.state.stash[1] && this.state.stash[1].tournament;
        if (kantoT && kantoT.status === 'champion' && (kantoT.region || 1) === 1) this.state.champions[1] = true;
        // One-time fix: undo the accidental Pikachu -> Raichu evolution in this save (runs once, then never again).
        if (!this.state.fixes.raichuReverted) {
          const r = [...this.state.party, ...this.state.box].find(m => m.species === 'raichu');
          if (r) { r.devolve(); setTimeout(() => UI.toast('Your Raichu has been turned back into Pikachu.'), 1200); }
          this.state.fixes.raichuReverted = true;
        }
        // Positions from a save made on a different-sized map are meaningless: start at home instead.
        if (d.pos && d.mapW === this.world.W && d.mapH === this.world.H) { this.world.player.x = d.pos.x; this.world.player.y = d.pos.y; }
        // Saved spot may now be inside a building added in a later version.
        if (this.world.collides(this.world.player.x, this.world.player.y, 11, this.canSwim())) {
          this.world.player.x = (this.world.center.x + 0.5) * CONFIG.TILE;
          this.world.player.y = (this.world.center.y + 3.5) * CONFIG.TILE;
        }
        return this.state.party.length > 0;
      } catch (e) {
        return false;
      }
    },

    reset() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      location.reload();
    },

    begin() {
      if (this.load()) {
        this.enterWorld();
        UI.toast('Welcome back!');
      } else {
        UI.chooseStarter((id) => {
          this.state.party = [new PG.Pokemon(id, 5)];
          this.markCaught(id);
          this.save();
          this.enterWorld();
          UI.toast(`${this.state.party[0].name}, I choose you!`);
          UI.toast('Bump into wild Pokémon to battle. Gyms are marked on the minimap.');
          UI.toast('Buy Poké Balls at the Poké Mart (blue roof) before you try to catch anything.');
        });
      }
    },

    enterWorld() {
      this.scene = 'world';
      this.battle = null;
      this.interior = null;
      PG.Input.clear();
      UI.showWorldHud(this);
    },

    // Walk into a Poké Center or Poké Mart.
    enterBuilding(kind) {
      PG.Audio.sfx('door');
      this.scene = 'interior';
      this.interior = new PG.Interior(kind, this);
      PG.Input.clear();
      UI.showInteriorHud(this);
    },

    // Nurse counter: heals every Pokémon you own. Balls are not restocked (buy them at the Mart).
    healParty() {
      for (const m of [...this.state.party, ...this.state.box]) m.heal();
      this.save();
    },

    openPC() { UI.openCenter(this); },

    getWorld(region) {
      this.worlds = this.worlds || { 1: this.world };
      if (!this.worlds[region]) this.worlds[region] = new PG.World(region);
      return this.worlds[region];
    },

    // Pokémon you may use in this region's tournament (in Johto your Kanto team may join).
    leaguePool() {
      const s = this.state;
      return PG.currentRegion === 2 && s.stash && s.stash[1] ? [...s.party, ...s.stash[1].party] : s.party;
    },

    // Go to another region through a Poké Center portal. Each region keeps its own party, box and tournament.
    travel(to) {
      const s = this.state, from = PG.currentRegion;
      if (to === from) return;
      const p = this.world.player;
      s.stash = s.stash || {};
      s.stash[from] = { party: s.party, box: s.box, tournament: s.tournament || null, pos: { x: p.x, y: p.y } };
      const dest = s.stash[to] || { party: [], box: [], tournament: null, pos: null };
      delete s.stash[to];
      s.party = dest.party; s.box = dest.box; s.tournament = dest.tournament;
      PG.currentRegion = to; s.region = to;
      this.world = this.getWorld(to);
      // arrive outside the home town Poké Center
      const pc = this.world.buildings.find(b => b.kind === 'center');
      this.world.player.x = (pc.doorX + 0.5) * CONFIG.TILE;
      this.world.player.y = (pc.doorY + 1.6) * CONFIG.TILE;
      this.world.player.immune = 3;
      this.interior = null;
      UI.closeModal();
      PG.Audio.sfx('levelUp');
      const R = PG.region();
      if (!s.party.length) {
        UI.chooseStarter((id) => {
          s.party = [new PG.Pokemon(id, 5)];
          this.markCaught(id);
          this.enterWorld();
          this.save();
          UI.toast(`Welcome to ${R.name}! ${s.party[0].name}, I choose you!`);
          UI.toast(`Earn all ${R.gyms.length} ${R.name} badges to enter the ${R.leagueName}. Use the Poké Center portal to visit ${PG.REGIONS[from].name} any time.`);
        }, to);
      } else {
        this.enterWorld();
        this.save();
        UI.toast(`Welcome back to ${R.name}!`);
      }
    },

    // Get on / off the Bicycle in the overworld.
    toggleBike() {
      const p = this.world.player;
      if (!this.state.items.bicycle) { UI.toast("You don't have a Bicycle yet. Buy one at the Poké Mart."); return; }
      if (p.swimming) { UI.toast("You can't ride a Bicycle on the water!"); return; }
      p.biking = !p.biking;
      UI.toast(p.biking ? 'You got on the Bicycle! 🚲' : 'You got off the Bicycle.');
      UI.updateWorldHud(this);
    },
    openMart() { UI.openMart(this); },

    // A party Pokémon that knows Swim (or Surf) can carry you across water. Fainted ones still can,
    // so you never get stranded at sea.
    swimmer() {
      const m = this.state.party.find(m => m.moves.includes('swim') || m.moves.includes('surf'));
      return m ? m.species : null;
    },
    canSwim() { return !!this.swimmer(); },

    ballCount(id) { return this.state.balls[id] || 0; },
    totalBalls() { return PG.BALL_IDS.reduce((a, id) => a + this.ballCount(id), 0); },

    markSeen(id) { if (!this.state.seen.includes(id)) this.state.seen.push(id); },
    markCaught(id) { this.markSeen(id); if (!this.state.caught.includes(id)) this.state.caught.push(id); },

    openGym(i) { UI.openGym(this, i); },

    // Walk into a gym: story, gym trainers and a puzzle before the leader.
    enterGym(i) {
      PG.Audio.sfx('door');
      this.scene = 'interior';
      this.interior = new PG.GymInterior(i, this);
      PG.Input.clear();
      UI.showInteriorHud(this);
    },

    // A gym trainer's battle. trainerIndex -1 = a one-off challenger (e.g. after a wrong quiz answer).
    startGymTrainerBattle(gymInterior, t, trainerIndex) {
      if (!this.state.party.some(m => !m.fainted)) {
        gymInterior.p.y = Math.min(gymInterior.p.y + 48, (gymInterior.exit.y - 0.5) * 40);
        UI.toast('Your Pokémon are too tired to battle! Heal them at a Poké Center.');
        return false;
      }
      const gym = gymInterior.gym;
      const enemies = t.team.map(([id, lv]) => new PG.Pokemon(id, lv));
      this.beginBattle({ kind: 'gym', gymTrainer: true, trainerIndex, returnInterior: gymInterior, party: this.state.party, enemies,
        gym: { id: null, leader: `${t.title} ${t.name}`, type: gym.type, name: gym.name }, aiSkill: Math.max(0.4, gym.aiSkill - 0.15) });
      return true;
    },

    startWildBattle(mon, roamer) {
      if (!this.state.party.some(m => !m.fainted)) {
        UI.toast('Your Pokémon are too tired to fight! Head to a Poké Center.');
        this.world.player.immune = 2;
        if (roamer) this.world.roamers.push(roamer);
        return;
      }
      // Theme the arena after where the player is standing.
      const p = this.world.player, tx = Math.floor(p.x / CONFIG.TILE), ty = Math.floor(p.y / CONFIG.TILE);
      const arena = p.swimming ? 'ocean' : this.world.areaName(tx, ty).level === null ? 'town' : this.world.biome[this.world.idx(tx, ty)];
      // Legendaries fight like gym leaders.
      this.beginBattle({ kind: 'wild', party: this.state.party, enemies: [mon], aiSkill: mon.data.legendary ? CONFIG.LEGENDARY_AI_SKILL : 0.35, arena, tod: PG.timeOfDay(this.time) });
    },

    startGymBattle(gymIndex, team) {
      const g = PG.gyms()[gymIndex];
      const enemies = g.team.map(([id, lv]) => new PG.Pokemon(id, lv));
      // fought from inside the gym: come back to it afterwards
      const returnInterior = this.interior && this.interior.kind === 'gym' ? this.interior : null;
      this.beginBattle({ kind: 'gym', party: team, enemies, gym: g, aiSkill: g.aiSkill, returnInterior, trainerIndex: -1 });
    },

    beginBattle(opts) {
      PG.Input.clear();
      opts.enemies.forEach(m => this.markSeen(m.species));
      this.scene = 'battle';
      this.battle = new PG.Battle({
        ...opts,
        ui: UI,
        fullParty: this.state.party,
        getBalls: (id) => this.ballCount(id),
        useBall: (id) => { this.state.balls[id] = this.ballCount(id) - 1; },
        onEnd: (result, battle) => this.endBattle(result, battle),
      });
      UI.showBattleHud(this.battle);
    },

    // ---------- Pokémon League tournament ----------
    openLeague() { UI.openLeague(this); },

    startTournamentMatch(team) {
      const t = this.state.tournament, pm = PG.Tournament.playerMatch(t);
      if (!pm) return;
      const o = pm.opponent;
      const enemies = PG.Tournament.matchTeam(t, o).map(([id, lv]) => new PG.Pokemon(id, lv, { moves: PG.Tournament.bestMoves(id, lv) || undefined }));
      const gym = { id: null, leader: `${o.title} ${o.name}`, type: o.type || SPECIES_TYPE(o), name: 'Pokémon League' };
      this.beginBattle({ kind: 'gym', tournament: true, stage: PG.Tournament.stage(t), party: team, enemies, gym, aiSkill: PG.Tournament.matchSkill(t, o), enemyStages: PG.Tournament.matchStages(t) });
    },

    async endTournamentBattle(result, battle) {
      await new Promise(r => setTimeout(r, 900));
      const t = this.state.tournament, T = PG.Tournament;
      const round = t.round;
      const prize = T.recordPlayer(t, result === 'win');
      this.state.money += prize;
      // The League fully restores your team after every match, win or lose.
      for (const m of this.leaguePool()) m.heal();
      PG.Audio.sfx('heal');
      UI.toast('The League nurse restored your Pokémon to full health.');
      if (t.status === 'champion') {
        this.state.champions = this.state.champions || {};
        const firstTitle = !this.state.champions[PG.currentRegion];
        this.state.champions[PG.currentRegion] = true;
        this.state.balls.master_ball = this.ballCount('master_ball') + 1;
        await UI.message(`🏆 You won the Final! You are the ${PG.region().leagueName} Champion! (+1 Master Ball)`);
        if (PG.currentRegion === 1 && firstTitle) await UI.message('A shimmering portal has opened in every Poké Center. Step into it to travel to New Bark Town in the Johto region!');
      }
      const headline = result === 'win' ? `${T.roundName(round, t)} won!` : `Knocked out in the ${T.roundName(round, t)}`;
      await UI.processXp(this, headline, prize);
      this.world.player.immune = 2.5;
      this.enterWorld();
      this.save();
      UI.openLeague(this);
    },

    async endBattle(result, battle) {
      if (battle.opts.tournament) return this.endTournamentBattle(result, battle);
      const s = this.state;
      await new Promise(r => setTimeout(r, 900));
      if (result === 'caught') {
        const mon = battle.enemy.mon;
        this.markCaught(mon.species);
        if (s.party.length < CONFIG.PARTY_SIZE) { s.party.push(mon); UI.toast(`${mon.name} joined your party!`); }
        else { s.box.push(mon); UI.toast(`${mon.name} was sent to the Box.`); }
      }
      if (result === 'win' && battle.kind === 'gym' && !battle.opts.gymTrainer) {
        const g = battle.opts.gym;
        if (!s.badges.includes(g.id)) {
          battle.firstClear = true;
          s.badges.push(g.id);
          PG.Audio.sfx('badge');
          await UI.message(`You defeated ${g.leader} and earned the ${g.badge}!`);
          const R = PG.region();
          if (PG.gyms().every(gg => s.badges.includes(gg.id))) await UI.message(`You collected all ${PG.gyms().length} ${R.name} badges! The ${R.leagueName} at ${R.leagueTown} (the gold ★ on the map) is now open to you.`);
        } else {
          UI.toast(`You beat ${g.leader} again!`);
        }
        // The gym restores your team after a leader battle (a loss already heals you at the Poké Center).
        for (const m of s.party) m.heal();
        PG.Audio.sfx('heal');
        UI.toast('The gym restored your Pokémon to full health.');
      }
      if (result === 'lose') {
        // XP already earned from knocked-out opponents is kept, even though the battle was lost.
        await UI.message(battle.kind === 'gym' ? `${battle.opts.gym.leader} won this time. Train up and come back!` : 'You whited out...');
        // Back to the starting town, healed.
        const c = this.world.center;
        this.world.player.x = (c.x + 0.5) * CONFIG.TILE;
        this.world.player.y = (c.y + 3.5) * CONFIG.TILE;
        for (const m of s.party) m.heal();
        UI.toast('You rushed back to the Poké Center. Your Pokémon were healed.');
      }
      let money = 0;
      if (result === 'win') {
        const levels = battle.enemies.reduce((a, m) => a + m.level, 0);
        money = battle.opts.gymTrainer ? levels * 35 : battle.kind === 'gym' ? levels * (battle.firstClear ? 60 : 20) : levels * 30;
      } else if (result === 'caught') money = battle.enemy.mon.level * 10;
      s.money += money;
      const headline = {
        win: battle.kind === 'gym' ? `${battle.opts.gym.leader} defeated!` : `Defeated wild ${battle.enemy.mon.name}!`,
        caught: `Caught ${battle.enemy.mon.name}!`,
        lose: 'Experience earned before the loss',
      }[result];
      await UI.processXp(this, headline, money);
      // Gym battles drop you back inside the gym (a loss still sends you home).
      const gymRoom = result !== 'lose' && battle.opts.returnInterior;
      if (gymRoom) {
        if (result === 'win' && !battle.opts.gymTrainer) this.pendingGymLines = PG.GYM_PLANS[battle.opts.gym.id].leaderLose;
        this.scene = 'interior';
        this.battle = null;
        this.interior = gymRoom;
        PG.Input.clear();
        UI.showInteriorHud(this);
        gymRoom.onReturn(result, battle.opts.trainerIndex ?? -1);
      } else {
        this.world.player.immune = 2.5;
        this.enterWorld();
      }
      this.save();
    },

    update(dt) {
      this.time += dt;
      // background music follows the scene (and time of day outdoors)
      PG.Audio.music(this.scene === 'battle' && this.battle
        ? (this.battle.opts.tournament ? 'league' : this.battle.kind === 'gym' ? 'gym' : 'battle')
        : this.scene === 'interior' ? 'town'
        : this.scene === 'world' ? (PG.timeOfDay(this.time).dark > 0.25 ? 'night' : 'world') : 'town');
      if (UI.modalOpen) return;
      if (this.scene === 'world') {
        if (PG.Input.consume('menu')) { UI.openMenu(this); return; }
        PG.Input.consume('interact');
        if (PG.Input.consume('bike')) this.toggleBike();
        if (PG.Input.consume('map')) { PG.MapView.open(this); return; }
        if (PG.Input.consume('view')) {
          PG.VIEW.d25 = !PG.VIEW.d25;
          try { localStorage.setItem('pg-view2', PG.VIEW.d25 ? '2.5d' : 'flat'); } catch (e) { /* not remembered */ }
          UI.toast(PG.VIEW.d25 ? '2.5D view' : 'Classic top-down view');
        }
        for (let i = 0; i < CONFIG.PARTY_SIZE; i++) if (PG.Input.consume('slot' + i)) UI.setLead(this, i);
        this.world.update(dt, this);
        this.saveTimer += dt;
        if (this.saveTimer > 15) { this.saveTimer = 0; this.save(); }
        if (Math.floor(this.time * 4) !== Math.floor((this.time - dt) * 4)) UI.updateWorldHud(this);
      } else if (this.scene === 'interior' && this.interior) {
        if (PG.Input.consume('menu')) { UI.openMenu(this); return; }
        if (PG.Input.consume('map')) { PG.MapView.open(this); return; }
        this.interior.update(dt, this);
      } else if (this.scene === 'battle' && this.battle) {
        this.battle.update(dt);
        if (this.battle && this.battle.state !== 'over') UI.updateBattleHud(this.battle);
      }
    },

    draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.scene === 'battle' && this.battle) {
        this.battle.draw(ctx, vw, vh);
        return;
      }
      if (this.scene === 'interior' && this.interior) {
        this.interior.draw(ctx, vw, vh, this);
        return;
      }
      const zoom = Math.max(0.8, Math.min(1.4, Math.min(vw, vh) / 520));
      ctx.fillStyle = '#2f7a3a';
      ctx.fillRect(0, 0, vw, vh);
      ctx.save();
      ctx.scale(zoom, zoom);
      this.world.draw(ctx, vw / zoom, vh / zoom, this.time);
      ctx.restore();
      // soft vignette
      const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.45, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, vw, vh);
      if (this.scene === 'world') {
        // keep the minimap a sensible size whatever the map dimensions
        const scale = Math.min(vw < 600 ? 0.8 : 1.3, (vw < 600 ? 130 : 210) / this.world.W);
        this.world.drawMinimap(ctx, vw - this.world.W * scale - 12, 64, scale, this.state.badges);
      }
    },
  };

  PG.Input.setupJoystick(document.getElementById('joyzone'), document.getElementById('joy-base'), document.getElementById('joy-knob'));

  let last = performance.now();
  let lastFrameError = '';
  function reportFrameError(e) {
    const msg = String(e && e.stack || e);
    if (msg !== lastFrameError) { lastFrameError = msg; console.error('Frame error:', e); }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // One bad frame must never freeze the game: log it and keep the loop running.
    try { game.update(dt); } catch (e) { reportFrameError(e); }
    try { game.draw(); } catch (e) { reportFrameError(e); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('beforeunload', () => game.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });

  PG.game = game;
  game.begin();
})();
