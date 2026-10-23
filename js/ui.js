// DOM overlays: HUDs, menus, prompts, toasts.
(function () {
  const { MOVES, SPECIES, TYPES, CONFIG, ITEMS } = PG;
  const regionBadges = (s) => PG.gyms().filter(g => s.badges.includes(g.id)).length;
  const $ = (sel) => document.querySelector(sel);

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function typeBadge(t) {
    return `<span class="type" style="background:${TYPES[t].color}">${t}</span>`;
  }

  const KIND_LABEL = {
    melee: '✊ Melee', dash: '➶ Dash', projectile: '➹ Ranged', area: '◎ Area', strike: '⊙ Strike',
    buff: '▲ Buff', debuff: '▼ Debuff', heal: '✚ Heal', none: '· None',
  };

  function moveLine(id) {
    const m = MOVES[id];
    const power = m.power ? `${m.power} pow` : m.kind;
    return `<span class="move-chip" style="border-color:${TYPES[m.type].color}">
      <b>${m.name}</b><small>${m.type} · ${power} · ${KIND_LABEL[m.kind] || m.kind}${m.recharge ? ` · ⏳ ${m.recharge}× cooldown` : ''}</small></span>`;
  }

  // Effectiveness of a damaging move against the current opponent, as a small badge.
  function effBadge(m, foe) {
    if (!m.power) return '';
    const e = PG.effectiveness(m.type, foe.types);
    if (e === 1) return '';
    const label = e === 0 ? '0×' : e >= 4 ? '4×' : e > 1 ? '2×' : e <= 0.25 ? '¼×' : '½×';
    return `<span class="mv-eff ${e > 1 ? 'good' : e === 0 ? 'none' : 'bad'}">${label}</span>`;
  }

  // Stat stages and conditions on a fighter, as chips under its HP bar.
  function statusChips(f) {
    const out = [];
    for (const [k, label] of [['atk', 'ATK'], ['def', 'DEF'], ['spd', 'SPD']]) {
      const v = f.stages[k];
      if (v) out.push(`<span class="chip ${v > 0 ? 'up' : 'down'}">${label} ${v > 0 ? '▲' : '▼'}${Math.abs(v)}</span>`);
    }
    if (f.stagger > 0) out.push('<span class="chip warn">Dizzy</span>');
    if (f.brawler) out.push('<span class="chip brawler" title="Mostly contact moves: 15% faster">Brawler</span>');
    return out.join('');
  }

  // Pokédex completion numbers (also shown on the board inside Poké Centers).
  PG.dexStats = function (state) {
    const all = Object.entries(SPECIES);
    const legends = all.filter(([, sp]) => sp.legendary).map(([id]) => id);
    return {
      total: all.length, caught: state.caught.length, seen: state.seen.length,
      legendTotal: legends.length, legendCaught: legends.filter(id => state.caught.includes(id)).length,
    };
  };

  function hpColor(p) { return p > 0.5 ? '#4cd964' : p > 0.2 ? '#ffcc00' : '#ff3b30'; }

  function monCard(mon, extra = '') {
    const hp = mon.hp / mon.maxHp;
    return `<div class="mon-card ${mon.fainted ? 'fainted' : ''}">
      <img src="${PG.spriteUrl(mon.species)}" alt="" onerror="this.style.visibility='hidden'">
      <div class="mon-info">
        <div class="mon-title"><b>${mon.name}</b> <span>Lv ${mon.level}</span> ${mon.types.map(typeBadge).join('')}</div>
        <div class="bar"><div style="width:${hp * 100}%;background:${hpColor(hp)}"></div></div>
        <div class="mon-sub">HP ${mon.hp}/${mon.maxHp} · ATK ${mon.atk} · DEF ${mon.def} · SPD ${mon.spd}</div>
        <div class="bar xp"><div style="width:${mon.xpProgress() * 100}%"></div></div>
        <div class="mon-sub">XP ${mon.xp.toLocaleString()} · ${mon.xpToNext().toLocaleString()} to Lv ${mon.level + 1}</div>
        ${mon.item ? `<div class="mon-sub held">Holding <b>${ITEMS[mon.item].icon} ${ITEMS[mon.item].name}</b></div>` : ''}
        ${extra}
      </div>
    </div>`;
  }

  const UI = {
    modalOpen: false,
    xpQueue: [],

    toast(msg) {
      const box = $('#toasts');
      const t = el('div', 'toast', msg);
      box.appendChild(t);
      while (box.children.length > 4) box.removeChild(box.firstChild);
      setTimeout(() => t.classList.add('out'), 2200);
      setTimeout(() => t.remove(), 2700);
    },

    // ---------- modal plumbing ----------
    modal(html, opts = {}) {
      const root = $('#modal-root');
      root.innerHTML = '';
      const box = el('div', 'modal ' + (opts.cls || ''), html);
      root.appendChild(box);
      root.classList.add('open');
      this.modalOpen = true;
      PG.Input.clear();
      return box;
    },
    closeModal() {
      const root = $('#modal-root');
      root.classList.remove('open');
      root.innerHTML = '';
      this.modalOpen = false;
      PG.Input.clear();
    },

    // ---------- starter ----------
    // region: which region's starters to offer (2 = Johto, when first arriving there)
    chooseStarter(onPick, region = 1) {
      const R = PG.REGIONS[region];
      const box = this.modal(`
        <div class="title-hero">
          <div class="logo-ball"></div>
          <div>
            <h1 class="logo">Pokémon <span>${region === 1 ? 'Open World' : 'Johto Journey'}</span></h1>
            <p>${region === 1 ? 'Pick your first partner. Explore a huge world, battle in real time, earn every badge and win the Pokémon League.' : `Welcome to ${R.home}! Your Kanto Pokémon stayed behind, so Professor Elm offers you a new partner. Earn all ${R.gyms.length} Johto badges and win the ${R.leagueName}.`}</p>
          </div>
        </div>
        <div class="starter-grid">${R.starters.map((id, i) => `
          <button class="starter" data-id="${id}" style="--c:${TYPES[SPECIES[id].types[0]].color}; --d:${i * 0.15}s">
            <small>#${String(SPECIES[id].dex).padStart(3, '0')}</small>
            <img src="${PG.spriteUrl(id)}" alt="" onerror="this.style.visibility='hidden'">
            <b>${SPECIES[id].name}</b>
            <div>${SPECIES[id].types.map(typeBadge).join('')}</div>
            <span class="choose">Choose</span>
          </button>`).join('')}
        </div>
        <div class="help">${this.controlsHelp()}</div>`, { cls: 'wide' });
      box.querySelectorAll('.starter').forEach(b => b.onclick = () => { this.closeModal(); onPick(b.dataset.id); });
    },

    controlsHelp() {
      const k = (...keys) => keys.map(x => `<kbd>${x}</kbd>`).join('');
      return `<div class="controls"><h4>Controls</h4>
        <div class="ctl-grid">
          <span>${k('W', 'A', 'S', 'D')} move</span><span>${k('1', '2', '3', '4')} moves</span><span>${k('Q')} throw ball</span><span>${k('B')} ball type</span>
          <span>${k('E')} switch</span><span>${k('R')} run</span><span>${k('C')} bicycle</span><span>${k('M')} map</span><span>${k('V')} 2.5D view</span><span>hold ${k('1')} charge</span><span>${k('Tab')} dodge</span><span>${k('U')} ultimate</span><span>${k('P')} pixel look</span><span>${k('Esc')} menu</span><span>${k('Enter')} use / talk</span>
        </div>
        <p>📱 On a phone: drag on the left half of the screen to move and tap the buttons. After every move a Pokémon is tired for a moment, longer the more HP it has lost.</p></div>`;
    },

    // ---------- world HUD ----------
    showWorldHud(game) {
      $('#battle-hud').classList.add('hidden');
      document.body.classList.remove('stadium-battle');
      const hud = $('#hud');
      hud.classList.remove('hidden');
      hud.innerHTML = `
        <div class="hud-top">
          <div class="area-pill" id="hud-area"></div>
          <div class="hud-right">
            <div class="hud-status">
              <span id="hud-money"></span>
              <span id="hud-balls"></span>
              <span id="hud-badges"></span>
            </div>
            ${game.state.items.bicycle ? '<button class="btn hud-icon" id="hud-bike" title="Bicycle (C)">🚲</button>' : ''}
            <button class="btn hud-icon" id="hud-map" title="Town Map (M)">🗺️</button>
            <button class="btn menu-btn" id="hud-menu"><i class="pb"></i>Menu</button>
          </div>
        </div>
        <div class="party-bar" id="party-bar"></div>`;
      $('#hud-menu').onclick = () => this.openMenu(game);
      if ($('#hud-bike')) $('#hud-bike').onclick = () => PG.Input.trigger('bike');
      $('#hud-map').onclick = () => PG.MapView.open(game);
      $('#party-bar').addEventListener('pointerdown', (ev) => {
        const slot = ev.target.closest('.slot');
        if (!slot) return;
        ev.preventDefault(); ev.stopPropagation();
        this.openSummary(game, game.state.party[+slot.dataset.i]);
      });
      this.partyKey = null;
      this.updateWorldHud(game);
    },

    // HUD while inside a Poké Center / Mart: where you are, wallet, and an action button for the nearby station.
    showInteriorHud(game) {
      $('#battle-hud').classList.add('hidden');
      document.body.classList.remove('stadium-battle');
      const hud = $('#hud');
      hud.classList.remove('hidden');
      hud.innerHTML = `
        <div class="hud-top">
          <div class="area-pill"><b>${game.interior.L.title}</b><small>Walk to the mat to leave</small></div>
          <div class="hud-right">
            <span class="pill" id="hud-money"></span>
            <span class="pill" id="hud-balls"></span>
            <button class="btn hud-icon" id="hud-leave" title="Leave the building">🚪 Leave</button>
            <button class="btn" id="hud-menu">Menu</button>
          </div>
        </div>
        <button class="btn primary interact-btn hidden" id="interact-btn"></button>`;
      $('#hud-menu').onclick = () => this.openMenu(game);
      $('#hud-leave').onclick = () => { if (!this.modalOpen && !(game.interior && game.interior.busy)) game.enterWorld(); };
      $('#interact-btn').addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); PG.Input.trigger('interact'); });
      this.interiorGame = game;
      this.promptId = undefined;
      this.setInteriorPrompt(null);
    },

    setInteriorPrompt(st) {
      const btn = $('#interact-btn');
      if (!btn) return;
      const game = this.interiorGame;
      $('#hud-money').textContent = `₽ ${game.state.money.toLocaleString()}`;
      $('#hud-balls').textContent = `◓ ${game.totalBalls()}`;
      const id = st ? st.id : null;
      if (id === this.promptId) return;
      this.promptId = id;
      btn.classList.toggle('hidden', !st);
      if (st) btn.innerHTML = `<span>${st.icon}</span> ${st.label} <kbd>Enter</kbd>`;
    },

    // Make party[i] the lead by swapping it with slot 0, so the rest of the order stays put.
    setLead(game, i) {
      const party = game.state.party;
      if (!party[i] || i === 0) return;
      [party[0], party[i]] = [party[i], party[0]];
      this.toast(`${party[0].name} is now leading!`);
      game.save();
      this.updateWorldHud(game);
    },

    updateWorldHud(game) {
      const bar = $('#party-bar');
      if (!bar) return;
      const party = game.state.party;
      // Include the held item so giving/taking one re-renders the slot badge.
      const key = party.map(m => `${m.uid}:${m.species}:${m.level}:${m.item || ''}`).join('|');
      if (key !== this.partyKey) {
        this.partyKey = key;
        bar.innerHTML = party.map((m, i) => `
          <button class="slot ${i === 0 ? 'lead' : ''}" style="--c:${TYPES[m.types[0]].color}" data-i="${i}" title="${m.name} — view summary (press ${i + 1} to make lead)">
            ${i === 0 ? '<span class="lead-tag">LEAD</span>' : ''}
            ${m.item ? `<span class="slot-item" title="${ITEMS[m.item].name}">${ITEMS[m.item].icon}</span>` : ''}
            <kbd>${i + 1}</kbd>
            <img src="${PG.spriteUrl(m.species)}" alt="" onerror="this.style.visibility='hidden'">
            <span class="slot-lv">Lv${m.level}</span>
            <span class="bar hp"><i></i></span>
            <span class="bar xp"><i></i></span>
          </button>`).join('');
      }
      bar.querySelectorAll('.slot').forEach((el, i) => {
        const m = party[i];
        const hp = m.hp / m.maxHp;
        const hpBar = el.querySelector('.hp i');
        hpBar.style.width = hp * 100 + '%';
        hpBar.style.background = hpColor(hp);
        el.querySelector('.xp i').style.width = m.xpProgress() * 100 + '%';
        el.classList.toggle('fainted', m.fainted);
      });
      const p = game.world.player;
      const area = game.world.areaName(Math.floor(p.x / CONFIG.TILE), Math.floor(p.y / CONFIG.TILE));
      const icon = p.swimming ? '🌊' : { Meadow: '🌾', Forest: '🌲', Beach: '🏖️', Mountains: '⛰️', Lakeside: '💧', 'Indigo Plateau': '🏆', 'Silver Town': '🏆' }[area.name] || '🏘️';
      const tod = PG.timeOfDay(game.time);
      const areaHtml = `<span class="area-ico">${icon}</span><span><b>${p.swimming ? 'Open Water' : area.name}</b>${area.level ? `<small>Wild Lv ~${area.level} · ${tod.icon} ${tod.label}</small>` : `<small>Safe town · ${tod.icon} ${tod.label}</small>`}</span>`;
      if ($('#hud-area').dataset.k !== areaHtml) { $('#hud-area').dataset.k = areaHtml; $('#hud-area').innerHTML = areaHtml; }
      const balls = game.state.balls;
      $('#hud-balls').textContent = `◓ ${game.totalBalls()}`;
      $('#hud-balls').title = PG.BALL_IDS.map(id => `${ITEMS[id].name}: ${balls[id] || 0}`).join('\n');
      $('#hud-money').textContent = `₽ ${game.state.money.toLocaleString()}`;
      $('#hud-badges').textContent = `🏅 ${regionBadges(game.state)}/${PG.gyms().length}`;
      $('#hud-badges').title = 'Gym badges';
      if ($('#hud-bike')) $('#hud-bike').classList.toggle('on', !!game.world.player.biking);
    },

    // ---------- menu: party, bag, badges ----------
    openMenu(game) {
      const s = game.state;
      const candies = s.items.rare_candy || 0, shares = s.items.exp_share || 0;
      const partyHtml = s.party.map((m, i) => `<div class="card-link" data-act="info" data-i="${i}" title="View summary">${monCard(m, `
        <div class="moves">${m.moves.map(moveLine).join('')}</div>
        <div class="row">
          ${i > 0 ? `<button class="btn sm" data-act="lead" data-i="${i}">Make lead</button>` : '<span class="pill gold">Lead</span>'}
          <button class="btn sm" data-act="moves" data-i="${i}">Moves${m.learnableMoves().length ? ` <span class="dot-new">${m.learnableMoves().length}</span>` : ''}</button>
          ${m.item ? `<button class="btn sm" data-act="take" data-i="${i}">Take ${ITEMS[m.item].icon} ${ITEMS[m.item].name}</button>`
            : shares ? `<button class="btn sm" data-act="give" data-i="${i}">Give ✦ Exp. Share</button>` : ''}
          ${candies && m.level < 100 ? `<button class="btn sm" data-act="candy" data-i="${i}">Use ❖ Rare Candy (${candies})</button>` : ''}
        </div>`)}</div>`).join('');
      const bag = Object.entries(ITEMS).map(([id, it]) => {
        const n = it.ball ? (s.balls[id] || 0) : (s.items[id] || 0);
        return `<div class="bag-item ${n ? '' : 'none'}"><span class="icon" ${it.ball ? `style="color:${it.color}"` : ''}>${it.icon}</span><span><b>${it.name}</b><small>${it.desc}</small></span><span class="qty">${it.key ? (n ? 'Owned' : '—') : '×' + n}</span></div>`;
      }).join('');
      const tab = this.menuTab || 'party';
      const tabs = [['party', '🎒', 'Party'], ['bag', '👜', 'Bag'], ['badges', '🏅', 'Badges'], ['options', '⚙️', 'Options']];
      const badgesHtml = PG.gyms().map((g, i) => {
        const got = s.badges.includes(g.id);
        return `<div class="badge-card ${got ? 'got' : ''}" style="--c:${TYPES[g.type].color}">
          <div class="badge-gem">${got ? '★' : i + 1}</div>
          <b>${g.badge}</b><small>${g.leader} · ${g.city}</small></div>`;
      }).join('');
      const box = this.modal(`
        <div class="modal-head"><h2>Trainer</h2><button class="btn" data-act="close">✕</button></div>
        <div class="trainer-card">
          <div class="tc-ava"><i class="pb"></i></div>
          <div class="tc-stats">
            <span><b>₽ ${s.money.toLocaleString()}</b><small>Money</small></span>
            <span><b>${regionBadges(s)}/${PG.gyms().length}</b><small>${PG.region().name} badges</small></span>
            <span><b>${s.caught.length}/${Object.keys(SPECIES).length}</b><small>Caught</small></span>
            <span><b>${s.party.length + s.box.length}</b><small>Owned</small></span>
          </div>
          <button class="btn sm" data-act="dex">📖 Pokédex</button>
        </div>
        <div class="tabs">${tabs.map(([k, ic, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="tab" data-tab="${k}">${ic} ${l}</button>`).join('')}</div>
        <section class="tab-panel" ${tab === 'party' ? '' : 'hidden'}>
          <p class="muted small">Party ${s.party.length}/${CONFIG.PARTY_SIZE} · tap a Pokémon for its summary · swap with your Box at any Poké Center's PC</p>
          <div class="list">${partyHtml}</div>
        </section>
        <section class="tab-panel" ${tab === 'bag' ? '' : 'hidden'}><div class="bag">${bag}</div></section>
        <section class="tab-panel" ${tab === 'badges' ? '' : 'hidden'}><div class="badge-grid">${badgesHtml}</div>
          <p class="muted small">${PG.gyms().every(g => s.badges.includes(g.id)) ? `🏆 All badges earned: the ${PG.region().leagueName} at ${PG.region().leagueTown} is open!` : `Earn all ${PG.gyms().length} badges to enter the ${PG.region().leagueName} at ${PG.region().leagueTown} (gold ★ on the map).`}</p></section>
        <section class="tab-panel" ${tab === 'options' ? '' : 'hidden'}>
          <div class="sound-panel">
            <h4>🔊 Sound</h4>
            <label>Music <input type="range" min="0" max="1" step="0.05" data-vol="music" value="${PG.Audio.settings.music}"></label>
            <label>Effects <input type="range" min="0" max="1" step="0.05" data-vol="sfx" value="${PG.Audio.settings.sfx}"></label>
            <button class="btn sm" data-act="mute">${PG.Audio.settings.muted ? '🔇 Sound off: turn on' : '🔊 Sound on: mute'}</button>
          </div>
          <div class="help">${this.controlsHelp()}</div>
          <div class="row"><button class="btn" data-act="save">💾 Save</button><button class="btn danger" data-act="reset">Reset game</button></div>
        </section>`, { cls: 'wide' });
      box.querySelectorAll('[data-vol]').forEach(r => r.addEventListener('input', () => { PG.Audio.set(r.dataset.vol, +r.value); if (r.dataset.vol === 'sfx') PG.Audio.sfx('click'); }));
      box.onclick = async (ev) => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        const i = +b.dataset.i;
        const m = s.party[i];
        switch (b.dataset.act) {
          case 'close': this.closeModal(); return;
          case 'tab': this.menuTab = b.dataset.tab; this.openMenu(game); return;
          case 'mute': PG.Audio.toggleMute(); this.openMenu(game); return;
          case 'dex': this.openDex(game, () => this.openMenu(game)); return;
          case 'info': this.openSummary(game, m, () => this.openMenu(game)); return;
          case 'moves': this.openMoves(game, m, () => this.openMenu(game)); return;
          case 'lead': [s.party[0], s.party[i]] = [s.party[i], s.party[0]]; break;
          case 'give': this.giveItem(game, m, 'exp_share'); break;
          case 'take': this.takeItem(game, m); break;
          case 'candy':
            s.items.rare_candy--;
            this.closeModal();
            this.queueXp(m, m.xpToNext());
            await this.processXp(game, `${m.name} ate a Rare Candy!`);
            break;
          case 'save': game.save(); this.toast('Game saved.'); return;
          case 'reset':
            if (!confirm('Delete your save and start over?')) return;
            game.reset(); return;
        }
        game.save();
        this.updateWorldHud(game);
        this.openMenu(game);
      };
    },

    // ---------- Pokémon summary: stats, moves, held item ----------
    openSummary(game, mon, back) {
      if (!mon) return;
      const s = game.state;
      const partyIdx = s.party.indexOf(mon);
      const shares = s.items.exp_share || 0;
      const hp = mon.hp / mon.maxHp;
      const item = mon.item && ITEMS[mon.item];
      const stats = [['HP', mon.maxHp, mon.data.base.hp], ['Attack', mon.atk, mon.data.base.atk],
        ['Defense', mon.def, mon.data.base.def], ['Speed', mon.spd, mon.data.base.spd]];
      const box = this.modal(`
        <div class="modal-head"><h2>${mon.name}</h2><button class="btn" data-act="close">✕</button></div>
        <div class="sum-top">
          <img src="${PG.spriteUrl(mon.species)}" alt="" onerror="this.style.visibility='hidden'">
          <div class="mon-info">
            <div class="mon-title"><span>#${String(mon.data.dex).padStart(3, '0')}</span> <b>Lv ${mon.level}</b> ${mon.types.map(typeBadge).join('')}</div>
            <div class="mon-sub">${partyIdx === 0 ? 'Lead of your party' : partyIdx > 0 ? `Party slot ${partyIdx + 1}` : 'In storage'}${mon.fainted ? ' · <b>Fainted</b>' : ''}</div>
            <div class="bar"><div style="width:${hp * 100}%;background:${hpColor(hp)}"></div></div>
            <div class="mon-sub">HP ${mon.hp}/${mon.maxHp}</div>
            <div class="bar xp"><div style="width:${mon.xpProgress() * 100}%"></div></div>
            <div class="mon-sub">XP ${mon.xp.toLocaleString()} · ${mon.level < 100 ? `${mon.xpToNext().toLocaleString()} to Lv ${mon.level + 1}` : 'Max level'}</div>
            ${mon.data.evolves && mon.level < mon.data.evolves.level ? `<div class="mon-sub">Evolves into ${SPECIES[mon.data.evolves.into].name} at Lv ${mon.data.evolves.level}</div>` : ''}
          </div>
        </div>
        <h3>Stats</h3>
        <div class="sum-stats">${stats.map(([label, val, base]) => `
          <span>${label}</span><b>${val}</b>
          <span class="bar"><div style="width:${Math.min(100, base / 1.6)}%;background:#7cc4ff"></div></span>`).join('')}
        </div>
        <h3>Moves (${mon.moves.length}/${CONFIG.MAX_MOVES})</h3>
        <div class="moves">${mon.moves.map(moveLine).join('')}</div>
        <h3>Held item</h3>
        <div class="sum-item">${item
          ? `<span class="shop-icon">${item.icon}</span><div class="shop-info"><b>${item.name}</b><p>${item.desc}</p></div>
             <button class="btn sm" data-act="take">Take</button>`
          : `<div class="shop-info"><p>Not holding anything.</p></div>
             ${shares ? `<button class="btn sm" data-act="give">Give ✦ Exp. Share (${shares})</button>` : ''}`}
        </div>
        <div class="row">
          ${partyIdx > 0 ? `<button class="btn sm" data-act="lead">Make lead</button>` : ''}
          <button class="btn sm" data-act="moves">Manage moves${mon.learnableMoves().length ? ` <span class="dot-new">${mon.learnableMoves().length}</span>` : ''}</button>
          ${mon.data.evolves ? `<button class="btn sm ${mon.noEvolve ? '' : 'primary'}" data-act="evotoggle" title="Like holding an Everstone">Evolution: ${mon.noEvolve ? 'Off' : 'On'}</button>` : ''}
        </div>`, { cls: 'wide' });
      const reopen = () => this.openSummary(game, mon, back);
      box.onclick = (ev) => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        switch (b.dataset.act) {
          case 'close': this.closeModal(); this.updateWorldHud(game); if (back) back(); return;
          case 'moves': this.openMoves(game, mon, reopen); return;
          case 'lead': this.setLead(game, s.party.indexOf(mon)); break;
          case 'give': this.giveItem(game, mon, 'exp_share'); break;
          case 'take': this.takeItem(game, mon); break;
          case 'evotoggle':
            mon.noEvolve = !mon.noEvolve;
            this.toast(mon.noEvolve ? `${mon.name} won't evolve.` : `${mon.name} can evolve again.`);
            break;
        }
        game.save();
        this.updateWorldHud(game);
        reopen();
      };
    },

    giveItem(game, mon, id) {
      const s = game.state;
      if (!s.items[id] || mon.item) return;
      s.items[id]--;
      mon.item = id;
      this.toast(`${mon.name} is now holding the ${ITEMS[id].name}.`);
    },

    takeItem(game, mon) {
      if (!mon.item) return;
      const s = game.state;
      s.items[mon.item] = (s.items[mon.item] || 0) + 1;
      this.toast(`Took the ${ITEMS[mon.item].name} from ${mon.name}.`);
      mon.item = null;
    },

    // ---------- Poke Center: heal + storage grid ----------
    openCenter(game, sort) {
      const s = game.state;
      sort = sort || this.centerSort || 'party';
      this.centerSort = sort;
      const all = [...s.party, ...s.box];
      const order = {
        party: (a, b) => (s.party.includes(b) - s.party.includes(a)) || (b.level - a.level),
        level: (a, b) => b.level - a.level,
        name: (a, b) => a.name.localeCompare(b.name),
        dex: (a, b) => a.data.dex - b.data.dex,
      }[sort];
      const sorted = all.slice().sort(order);
      const shares = s.items.exp_share || 0;
      const slots = [];
      for (let i = 0; i < CONFIG.PARTY_SIZE; i++) {
        const m = s.party[i];
        slots.push(m
          ? `<button class="pc-slot filled" data-act="remove" data-uid="${m.uid}" title="Remove from party">
               <img src="${PG.spriteUrl(m.species)}" alt="" onerror="this.style.visibility='hidden'"><small>Lv${m.level}</small>${i === 0 ? '<span class="lead-tag">LEAD</span>' : ''}</button>`
          : `<div class="pc-slot empty">+</div>`);
      }
      const card = (m) => {
        const inParty = s.party.indexOf(m);
        const hp = m.hp / m.maxHp;
        return `<div class="pc-card ${inParty >= 0 ? 'in' : ''}" data-act="toggle" data-uid="${m.uid}">
          ${inParty >= 0 ? `<span class="pc-badge">${inParty + 1}</span>` : ''}
          ${m.item ? `<span class="pc-item" title="${ITEMS[m.item].name}">${ITEMS[m.item].icon}</span>` : ''}
          <img src="${PG.spriteUrl(m.species)}" alt="" onerror="this.style.visibility='hidden'">
          <b>${m.name}</b>
          <small>Lv ${m.level} ${m.types.map(t => `<i class="tdot" style="background:${TYPES[t].color}" title="${t}"></i>`).join('')}</small>
          <span class="bar"><span style="width:${hp * 100}%;background:${hpColor(hp)}"></span></span>
          <span class="pc-actions">
            <button class="btn xs" data-act="info" data-uid="${m.uid}">Info</button>
            <button class="btn xs" data-act="moves" data-uid="${m.uid}">Moves${m.learnableMoves().length ? ` <span class="dot-new">${m.learnableMoves().length}</span>` : ''}</button>
            ${m.item ? `<button class="btn xs" data-act="take" data-uid="${m.uid}">Take ${ITEMS[m.item].icon}</button>`
              : shares ? `<button class="btn xs" data-act="give" data-uid="${m.uid}">Give ✦</button>` : ''}
          </span>
        </div>`;
      };
      const box = this.modal(`
        <div class="modal-head"><h2>PC Storage</h2><button class="btn" data-act="close">✕</button></div>
        <p class="muted small">Store Pokémon here and choose who travels with you. Heal at the nurse's counter.</p>
        <h3>Party (${s.party.length}/${CONFIG.PARTY_SIZE}) <small class="muted">— tap a slot to send it to storage</small></h3>
        <div class="pc-party">${slots.join('')}</div>
        <div class="pc-toolbar">
          <h3>All Pokémon (${all.length}) <small class="muted">— tap to add or remove from your party</small></h3>
          <div class="seg">${['party', 'level', 'dex', 'name'].map(k => `<button class="${k === sort ? 'on' : ''}" data-act="sort" data-sort="${k}">${{ party: 'Party first', level: 'Level', dex: 'Dex #', name: 'Name' }[k]}</button>`).join('')}</div>
        </div>
        ${shares ? `<p class="muted small">You have ${shares} ✦ Exp. Share to give.</p>` : ''}
        <div class="pc-grid">${sorted.map(card).join('')}</div>`, { cls: 'wide' });
      box.onclick = (ev) => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        const mon = all.find(m => m.uid === b.dataset.uid);
        switch (b.dataset.act) {
          case 'close': this.closeModal(); this.updateWorldHud(game); return;
          case 'sort': this.openCenter(game, b.dataset.sort); return;
          case 'info': this.openSummary(game, mon, () => this.openCenter(game, sort)); return;
          case 'moves': this.openMoves(game, mon, () => this.openCenter(game, sort)); return;
          case 'give': this.giveItem(game, mon, 'exp_share'); break;
          case 'take': this.takeItem(game, mon); break;
          case 'remove':
          case 'toggle': {
            const i = s.party.indexOf(mon);
            if (i >= 0) {
              if (s.party.length === 1) { this.toast('You need at least one Pokémon with you.'); return; }
              s.party.splice(i, 1);
              s.box.push(mon);
            } else {
              if (s.party.length >= CONFIG.PARTY_SIZE) { this.toast('Party is full — tap a party slot to make room.'); return; }
              s.box.splice(s.box.indexOf(mon), 1);
              s.party.push(mon);
            }
            break;
          }
        }
        game.save();
        this.openCenter(game, sort);
      };
    },

    // ---------- Poke Mart ----------
    openMart(game) {
      const s = game.state;
      const box = this.modal(`
        <div class="modal-head"><h2>Poké Mart</h2><button class="btn" data-act="close">✕</button></div>
        <p>Wallet: <span class="pill gold">₽ ${s.money.toLocaleString()}</span> <small class="muted">Earn money by winning battles and catching Pokémon.</small></p>
        <div class="shop">${Object.entries(ITEMS).map(([id, it]) => {
          const owned = it.ball ? (s.balls[id] || 0) : (s.items[id] || 0);
          const qtys = it.ball && id !== 'master_ball' ? [1, 5, 10] : [1];
          if (it.key && owned) return `<div class="shop-item"><span class="shop-icon">${it.icon}</span>
            <div class="shop-info"><b>${it.name}</b> <span class="pill gold">Owned</span><p>${it.desc}</p></div></div>`;
          return `<div class="shop-item">
            <span class="shop-icon" ${it.ball ? `style="color:${it.color}"` : ''}>${it.icon}</span>
            <div class="shop-info"><b>${it.name}</b> <small class="muted">owned ×${owned}</small><p>${it.desc}</p></div>
            <div class="shop-buy">${qtys.map(q => `<button class="btn sm ${q === 1 ? 'primary' : ''}" data-act="buy" data-id="${id}" data-q="${q}" ${s.money < it.price * q ? 'disabled' : ''}>
              ${q > 1 ? `×${q} ` : ''}₽${(it.price * q).toLocaleString()}</button>`).join('')}</div>
          </div>`;
        }).join('')}</div>
        <p class="muted small">Give an Exp. Share from the Menu or at a Poké Center. Rare Candy is used from the Menu.</p>`, { cls: 'wide' });
      box.onclick = (ev) => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'close') { this.closeModal(); this.updateWorldHud(game); return; }
        if (b.dataset.act === 'buy') {
          const id = b.dataset.id, q = +b.dataset.q, cost = ITEMS[id].price * q;
          if (s.money < cost) return;
          s.money -= cost;
          PG.Audio.sfx('coin');
          if (ITEMS[id].ball) s.balls[id] = (s.balls[id] || 0) + q;
          else s.items[id] = (s.items[id] || 0) + q;
          this.toast(`Bought ${q > 1 ? q + '× ' : ''}${ITEMS[id].name}!`);
          if (ITEMS[id].key && id === 'bicycle') this.toast('Press C (or tap 🚲 at the top) outside to ride it.');
          game.save();
          this.openMart(game);
        }
      };
    },

    // ---------- Move Relearner ----------
    // Shows current moves, every unlocked move that can be (re)learned, and what's coming at later levels.
    openMoves(game, mon, back) {
      const learnable = mon.learnableMoves();
      const upcoming = mon.upcomingMoves();
      const box = this.modal(`
        <div class="modal-head"><h2>${mon.name}'s moves</h2><button class="btn" data-act="close">✕</button></div>
        ${monCard(mon)}
        <h3>Current moves (${mon.moves.length}/${CONFIG.MAX_MOVES}) <small class="muted">— the order is the battle key: move 1 is on key 1, and so on</small></h3>
        <div class="move-list">${mon.moves.map((id, i) => `<div class="move-row"><span class="move-key">${i + 1}</span>${moveLine(id)}
          <span class="move-order">
            <button class="btn xs" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Move up">▲</button>
            <button class="btn xs" data-act="down" data-i="${i}" ${i === mon.moves.length - 1 ? 'disabled' : ''} title="Move down">▼</button>
          </span>
          ${mon.moves.length > 1 ? `<button class="btn xs" data-act="forget" data-i="${i}">Forget</button>` : ''}</div>`).join('')}</div>
        <h3>Ready to learn (${learnable.length}) <small class="muted">— tap to teach</small></h3>
        <div class="move-list">${learnable.length ? learnable.map(id => `<button class="move-row pick-move" data-act="learn" data-move="${id}">${moveLine(id)}<span class="btn xs primary">Learn</span></button>`).join('')
          : '<p class="muted small">Nothing new right now. Level up to unlock more moves.</p>'}</div>
        <h3>Coming up</h3>
        <div class="move-list">${upcoming.length ? upcoming.map(u => `<div class="move-row locked">${moveLine(u.move)}<span class="pill">Lv ${u.level}</span></div>`).join('')
          : '<p class="muted small">No more level-up moves.</p>'}</div>`, { cls: 'wide' });
      box.onclick = async (ev) => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'close') { this.closeModal(); if (back) back(); return; }
        if (b.dataset.act === 'up' || b.dataset.act === 'down') {
          // swap with the neighbour: this decides which battle key (1-4) uses the move
          const i = +b.dataset.i, j = b.dataset.act === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= mon.moves.length) return;
          [mon.moves[i], mon.moves[j]] = [mon.moves[j], mon.moves[i]];
        }
        if (b.dataset.act === 'forget') {
          const old = mon.moves.splice(+b.dataset.i, 1)[0];
          this.toast(`${mon.name} forgot ${MOVES[old].name}.`);
        }
        if (b.dataset.act === 'learn') {
          this.closeModal();
          await this.offerMove(mon, b.dataset.move);
        }
        game.save();
        this.openMoves(game, mon, back);
      };
    },

    // ---------- Pokedex ----------
    // Pokédex: completion stats plus a filterable grid of every species.
    openDex(game, back, filter) {
      const s = game.state;
      filter = filter || this.dexFilter || 'all';
      this.dexFilter = filter;
      const list = Object.entries(SPECIES).sort((a, b) => a[1].dex - b[1].dex);
      const st = PG.dexStats(s);
      const keep = {
        all: () => true,
        caught: (id) => s.caught.includes(id),
        seen: (id) => s.seen.includes(id) && !s.caught.includes(id),
        missing: (id) => !s.seen.includes(id),
        legendary: (id, sp) => sp.legendary,
        kanto: (id, sp) => sp.dex <= 151,
        johto: (id, sp) => sp.dex > 151,
      }[filter];
      const shown = list.filter(([id, sp]) => keep(id, sp));
      const box = this.modal(`
        <div class="modal-head"><h2>Pokédex</h2><button class="btn" data-act="close">✕</button></div>
        <div class="dex-stats">
          <div class="dex-stat big"><b>${st.caught}</b><span>/ ${st.total} caught</span></div>
          <div class="dex-stat"><b>${st.seen}</b><span>seen</span></div>
          <div class="dex-stat"><b>${st.total - st.seen}</b><span>never seen</span></div>
          <div class="dex-stat gold"><b>${st.legendCaught}/${st.legendTotal}</b><span>legendaries</span></div>
        </div>
        <div class="dex-progress"><i style="width:${(st.caught / st.total) * 100}%"></i><i class="seen" style="width:${((st.seen - st.caught) / st.total) * 100}%"></i>
          <span>${Math.round((st.caught / st.total) * 100)}% complete</span></div>
        <div class="seg dex-filter">${[['all', 'All'], ['caught', 'Caught'], ['seen', 'Seen'], ['missing', 'Missing'], ['kanto', 'Kanto'], ['johto', 'Johto'], ['legendary', '★ Legendary']]
          .map(([k, l]) => `<button class="${k === filter ? 'on' : ''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div>
        <div class="dex-grid">${shown.map(([id, sp]) => {
          const caught = s.caught.includes(id), seen = s.seen.includes(id);
          return `<div class="dex-card ${caught ? 'caught' : seen ? 'seen' : 'unknown'} ${sp.legendary ? 'legend' : ''}">
            <small>#${String(sp.dex).padStart(3, '0')}${sp.legendary ? ' ★' : ''}</small>
            <img src="${PG.spriteUrl(id)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
            <b>${seen ? sp.name : '???'}</b>
            ${seen ? `<span>${sp.types.map(t => `<i class="tdot" style="background:${TYPES[t].color}"></i>`).join('')}</span>` : ''}
            ${caught ? '<span class="dex-ball">◓</span>' : ''}
          </div>`;
        }).join('') || '<p class="muted">Nothing here yet.</p>'}</div>`, { cls: 'wide' });
      box.onclick = (ev) => {
        const b = ev.target.closest('[data-act]');
        if (!b) return;
        if (b.dataset.act === 'close') { this.closeModal(); if (back) back(); }
        if (b.dataset.act === 'filter') this.openDex(game, back, b.dataset.f);
      };
    },

    // ---------- gym ----------
    openGym(game, gymIndex) {
      const g = PG.gyms()[gymIndex];
      const s = game.state;
      const beaten = s.badges.includes(g.id);
      const healthy = s.party.filter(m => !m.fainted);
      const picked = healthy.slice(0, CONFIG.GYM_TEAM_SIZE).map(m => m.uid);
      const render = () => {
        const box = this.modal(`
          <div class="modal-head"><h2>${g.name}</h2><button class="btn" data-act="close">✕</button></div>
          <p>Leader <b>${g.leader}</b> · ${typeBadge(g.type)} specialist ${beaten ? '· <span class="pill gold">Badge earned — rematch?</span>' : ''}</p>
          <div class="gym-team">${g.team.map(([id, lv]) => `<div class="mini"><img src="${PG.spriteUrl(id)}" alt="" onerror="this.style.visibility='hidden'"><small>${SPECIES[id].name} Lv${lv}</small></div>`).join('')}</div>
          <h3>Pick up to ${CONFIG.GYM_TEAM_SIZE} Pokémon (in order)</h3>
          <div class="list">${s.party.map(m => {
            const idx = picked.indexOf(m.uid);
            return `<button class="pick ${idx >= 0 ? 'on' : ''}" data-uid="${m.uid}" ${m.fainted ? 'disabled' : ''}>
              ${idx >= 0 ? `<span class="order">${idx + 1}</span>` : ''}${monCard(m)}</button>`;
          }).join('')}</div>
          <div class="row"><button class="btn primary" data-act="fight" ${picked.length ? '' : 'disabled'}>Battle ${g.leader}!</button></div>`, { cls: 'wide' });
        box.onclick = (ev) => {
          const p = ev.target.closest('.pick');
          if (p && !p.disabled) {
            const uid = p.dataset.uid;
            const i = picked.indexOf(uid);
            if (i >= 0) picked.splice(i, 1);
            else if (picked.length < CONFIG.GYM_TEAM_SIZE) picked.push(uid);
            render();
            return;
          }
          const b = ev.target.closest('[data-act]');
          if (!b) return;
          if (b.dataset.act === 'close') this.closeModal();
          if (b.dataset.act === 'fight' && picked.length) {
            this.closeModal();
            game.startGymBattle(gymIndex, picked.map(uid => s.party.find(m => m.uid === uid)));
          }
        };
      };
      if (!healthy.length) { this.toast('Your Pokémon need rest — visit a Poké Center first.'); return; }
      render();
    },

    // ---------- battle HUD ----------
    showBattleHud(battle) {
      $('#hud').classList.add('hidden');
      const hud = $('#battle-hud');
      hud.classList.remove('hidden');
      document.body.classList.toggle('stadium-battle', !!battle.stadium);   // toasts drop below the match-up banner
      hud.innerHTML = `
        <div class="bh-top">
          <div class="bh-card" id="bh-player"></div>
          <div class="bh-card enemy" id="bh-enemy"></div>
        </div>
        <div class="bh-controls">
          <div class="bh-fight">
            <button class="btn act ult-btn" data-a="ult" title="Ultimate (U), needs a full meter"><i class="ultfill"></i><span>★ Ultimate</span> <kbd>U</kbd></button>
            <button class="btn act" data-a="dodge" title="Dodge roll (Tab): you can't be hit while rolling">⤴ Dodge <kbd>Tab</kbd></button>
          </div>
          <div class="bh-moves" id="bh-moves"></div>
          <div class="bh-actions">
            ${battle.kind === 'wild' ? `<div class="ball-row"><button class="btn act ball-btn" data-a="ball"><span class="bicon">◓</span> <span class="bcount"></span> <kbd>Q</kbd><i class="cdfill"></i></button>
              <button class="btn act ball-next" data-a="ballnext" title="Switch ball type (B)">⇅</button></div>` : ''}
            <button class="btn act" data-a="switch">⇄ Switch <kbd>E</kbd></button>
            ${battle.kind === 'wild' ? '<button class="btn act" data-a="run">Run <kbd>R</kbd></button>' : ''}
          </div>
        </div>`;
      hud.querySelectorAll('[data-a]').forEach(b => {
        b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); PG.Input.trigger(b.dataset.a); });
      });
      hud.querySelectorAll('[data-hold]').forEach(b => this.holdButton(b, b.dataset.hold));
      this.battleRefs = { monUid: null, enemyUid: null };
      this.updateBattleHud(battle);
    },

    renderMoveButtons(battle) {
      const wrap = $('#bh-moves');
      const mon = battle.player.mon;
      const keys = ['1', '2', '3', '4'];
      const foe = battle.enemy.mon;
      wrap.innerHTML = mon.moves.map((id, i) => {
        const m = MOVES[id];
        const kind = KIND_LABEL[m.kind] || m.kind;
        return `<button class="move-btn" data-i="${i}" style="--c:${TYPES[m.type].color}">
          <i class="cdfill"></i><b>${m.name}</b><small>${m.power ? m.power + ' · ' : ''}${m.type}${m.recharge ? ` · ⏳×${m.recharge}` : ''}${m.hazard ? (m.hazard.kind === 'poison' ? ' · ☠ pool' : ' · 🔥 ground') : ''}</small>
          <span class="mv-kind ${m.kind === 'melee' || m.kind === 'dash' ? 'contact' : ''}">${kind}</span>${effBadge(m, foe)}<span class="mv-pp"></span><kbd>${keys[i]}</kbd></button>`;
      }).join('');
      // tap to attack, hold to charge
      wrap.querySelectorAll('.move-btn').forEach(b => this.holdButton(b, 'move' + b.dataset.i));
    },

    // A button that acts like a held key (press on pointerdown, release on pointerup / leave).
    holdButton(b, action) {
      b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); try { b.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } PG.Input.press(action); });
      for (const evName of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(evName, () => PG.Input.release(action));
    },

    fighterCard(f, label) {
      const m = f.mon;
      return `<img class="bh-portrait" src="${PG.spriteUrl(m.species)}" alt="" onerror="this.style.visibility='hidden'">
        <div class="bh-body">
        <div class="bh-name"><b>${m.name}</b> <span class="bh-lv">Lv${m.level}</span> ${m.types.map(typeBadge).join('')}</div>
        <div class="bar hp"><div class="hptrail"></div><div class="hpfill"></div></div>
        <div class="bh-sub"><span class="hptext"></span><span class="tired"></span></div>
        <div class="bar cd"><div class="cdbar"></div></div>
        <div class="bar meter" title="Special meter: fills as you deal and take damage"><div class="meterfill"></div></div>
        ${f.side === 'player' ? '<div class="bar xp"><div class="xpfill"></div></div>' : ''}
        <div class="bh-chips"></div>
        ${label ? `<div class="bh-label">${label}</div>` : ''}
        </div>`;
    },

    updateBattleHud(battle) {
      const r = this.battleRefs;
      if (!r) return;
      const p = battle.player, e = battle.enemy;
      if (r.monUid !== p.mon.uid || r.monLevel !== p.mon.level) {
        r.monUid = p.mon.uid; r.monLevel = p.mon.level;
        $('#bh-player').innerHTML = this.fighterCard(p, 'You');
        r.lastHp = null;
        this.renderMoveButtons(battle);
      }
      if (r.enemyUid !== e.mon.uid) {
        r.enemyUid = e.mon.uid;
        const label = battle.kind === 'gym'
          ? `${battle.opts.gym.leader} ${battle.enemies.map((m, i) => `<span class="dot ${i < battle.enemyIndex || m.fainted ? 'out' : ''}"></span>`).join('')}`
          : 'Wild';
        $('#bh-enemy').innerHTML = this.fighterCard(e, label);
        r.lastHp = null;
        this.renderMoveButtons(battle);
      }
      if (battle.kind === 'gym') {
        $('#bh-enemy').querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('out', battle.enemies[i].fainted));
      }
      for (const [f, id] of [[p, '#bh-player'], [e, '#bh-enemy']]) {
        const card = $(id);
        const hp = Math.max(0, f.mon.hp / f.mon.maxHp);
        const fill = card.querySelector('.hpfill');
        fill.style.width = hp * 100 + '%';
        fill.style.background = hpColor(hp);
        // the trail lags behind (CSS transition delay) so the chunk just lost stays visible for a moment
        card.querySelector('.hptrail').style.width = hp * 100 + '%';
        const key = f.side;
        r.lastHp = r.lastHp || {};
        if (r.lastHp[key] !== undefined && f.mon.hp < r.lastHp[key]) {
          card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
        }
        r.lastHp[key] = f.mon.hp;
        card.classList.toggle('low', hp > 0 && hp <= 0.25);
        const chips = statusChips(f);
        const chipEl = card.querySelector('.bh-chips');
        if (chipEl.dataset.k !== chips) { chipEl.dataset.k = chips; chipEl.innerHTML = chips; }
        card.querySelector('.hptext').textContent = `${f.mon.hp}/${f.mon.maxHp}`;
        const nextCd = PG.moveCooldown(f.mon);
        card.querySelector('.tired').textContent = `tired ${nextCd.toFixed(1)}s`;
        card.querySelector('.cdbar').style.width = (f.cd > 0 ? (1 - f.cd / f.cdMax) : 1) * 100 + '%';
        card.querySelector('.cdbar').classList.toggle('ready', f.cd <= 0);
      }
      $('#battle-hud').classList.toggle('danger', !p.mon.fainted && p.mon.hp / p.mon.maxHp <= 0.25);
      for (const [f, id] of [[p, '#bh-player'], [e, '#bh-enemy']]) {
        const mf = document.querySelector(id + ' .meterfill');
        if (mf) { mf.style.width = f.meter + '%'; mf.classList.toggle('full', f.meter >= 100); }
      }
      const ub = document.querySelector('#battle-hud .ult-btn');
      if (ub) { ub.querySelector('.ultfill').style.width = p.meter + '%'; ub.classList.toggle('ready', p.meter >= 100); }
      const xf = document.querySelector('#bh-player .xpfill');
      if (xf) xf.style.width = p.mon.xpProgress() * 100 + '%';
      const cdPct = p.cd > 0 ? p.cd / p.cdMax : 0;
      document.querySelectorAll('#bh-moves .move-btn').forEach(b => {
        b.querySelector('.cdfill').style.height = cdPct * 100 + '%';
        b.classList.toggle('cooling', cdPct > 0);
      });
      const ballBtn = document.querySelector('#battle-hud [data-a="ball"]');
      if (ballBtn) {
        ballBtn.querySelector('.cdfill').style.height = (battle.ballCd / CONFIG.BALL_COOLDOWN) * 100 + '%';
        const it = ITEMS[battle.ballType];
        ballBtn.querySelector('.bicon').style.color = it.color;
        ballBtn.querySelector('.bcount').textContent = `${it.name.replace(' Ball', '')} ×${battle.opts.getBalls(battle.ballType)}`;
      }
      // PP left on each move button
      const pp = battle.ppOf(p.mon), struggling = battle.outOfPP(p.mon);
      document.querySelectorAll('#bh-moves .move-btn').forEach(b => {
        const id = p.mon.moves[+b.dataset.i];
        if (!id) return;
        const left = pp[id], max = PG.movePP(MOVES[id]);
        const el = b.querySelector('.mv-pp');
        const txt = struggling ? 'Struggle!' : `PP ${left}/${max}`;
        if (el.textContent !== txt) el.textContent = txt;
        b.classList.toggle('empty', !struggling && left <= 0);
        el.classList.toggle('low', struggling || left <= Math.ceil(max / 4));
      });
    },

    // ---------- Pokémon League tournament ----------
    openLeague(game) {
      const s = game.state, T = PG.Tournament, t = s.tournament;
      const debug = CONFIG.TOURNAMENT_DEBUG;
      const TEAM = CONFIG.TOURNAMENT_TEAM || 6;
      const badges = regionBadges(s);
      const close = () => { this.closeModal(); };
      const R = PG.region(), size = R.league.size, nRounds = T.roundNames(size).length;
      const head = `<div class="modal-head"><h2>🏆 ${R.leagueName}</h2><button class="btn" data-act="close">✕</button></div>
        ${debug ? '<p class="debug-note">Debug mode: repeat entries, retry after a loss and entry without badges are on (TOURNAMENT_DEBUG in js/data.js).</p>' : ''}`;
      const badgeRow = `<p>${PG.gyms().map(g => `<span class="pill ${s.badges.includes(g.id) ? 'gold' : ''}">${g.badge}</span>`).join(' ')}</p>`;

      // Not eligible yet
      if (!T.eligible(s)) {
        const box = this.modal(`${head}<p>Only trainers holding all <b>${PG.gyms().length} ${R.name} gym badges</b> may enter. You have <b>${badges}/${PG.gyms().length}</b>.</p>${badgeRow}`, { cls: 'wide' });
        box.querySelector('[data-act="close"]').onclick = close;
        return;
      }

      // No tournament yet, or a finished one: intro / results
      if (!t || t.status !== 'active') {
        let body = '';
        if (t && t.status === 'champion') body = `<div class="league-result champ">🏆 You are the ${R.leagueName} Champion!<small>Prize money won: ₽${t.prize.toLocaleString()}</small></div>`;
        else if (t && t.status === 'eliminated') {
          const ms = T.matchesOf(t, t.round), pm = ms.find(([a, b]) => a === 0 || b === 0);
          const by = t.entrants[pm[0] === 0 ? pm[1] : pm[0]];
          body = `<div class="league-result out">Knocked out in the ${T.roundName(t.round, t)} by ${by.title} ${by.name}.<small>Prize money won: ₽${t.prize.toLocaleString()}</small></div>`;
        }
        const canEnter = T.canEnter(s);
        const box = this.modal(`${head}${body}
          <p>${size} trainers, single elimination: win <b>${nRounds} matches</b> in a row to become Champion.${R.id === 2 ? ' <b>Your Kanto Pokémon may fight here too.</b>' : ''} Pick up to ${TEAM} Pokémon for each match. Opponents' teams are hidden, they level up and fight smarter every round, and from the quarter-finals they start with stat boosts. <b>Your team is fully healed after every match.</b>
          Prize money for every round you win, and a Master Ball for the Champion.</p>
          ${!debug ? `<p class="muted small">Lose and you start again from the Round of ${size} with a new bracket. Win it once and you are Champion for good.</p>` : ''}
          ${t ? this.bracketHtml(t) : ''}
          <div class="row">
            ${t && t.status === 'eliminated' && debug ? '<button class="btn" data-act="retry">↺ Continue (retry match)</button>' : ''}
            ${canEnter ? `<button class="btn primary" data-act="enter">${!t ? 'Enter the tournament' : t.status === 'eliminated' ? '↻ Try again from the start' : 'New tournament'}</button>` : (t ? '<span class="muted">You are the Champion! The League has no one left to challenge you.</span>' : '')}
          </div>`, { cls: 'wide' });
        box.onclick = (ev) => {
          const b = ev.target.closest('[data-act]');
          if (!b) return;
          if (b.dataset.act === 'close') close();
          if (b.dataset.act === 'enter') { T.create(s); game.save(); this.openLeague(game); }
          if (b.dataset.act === 'retry') { T.retry(t); for (const m of game.leaguePool()) m.heal(); game.save(); this.openLeague(game); }
        };
        return;
      }

      // Active: bracket + next match + team picker
      const pm = T.playerMatch(t), o = pm.opponent;
      const pool = game.leaguePool();
      const healthy = pool.filter(m => !m.fainted);
      const picked = this.leaguePicked && this.leaguePicked.every(uid => healthy.some(m => m.uid === uid))
        ? this.leaguePicked : healthy.slice(0, TEAM).map(m => m.uid);
      this.leaguePicked = picked;
      const render = () => {
        const box = this.modal(`${head}
          <div class="league-next">
            <div><small class="muted">${T.roundName(t.round, t)} · match ${pm.index + 1} · Stage: ${T.stage(t).icon} ${T.stage(t).name}</small>
              <h3>vs ${o.title} ${o.name} ${o.type ? typeBadge(o.type) : ''}</h3></div>
            <div class="gym-team hidden-team">${o.team.map(() => `<div class="mini secret"><span>?</span><small>Hidden</small></div>`).join('')}</div>
            <p class="muted small league-warn">Their ${o.team.length} Pokémon stay secret until the battle. Expect around Lv ${PG.Tournament.matchTeam(t, o)[0][1]}+ this round, and every round gets tougher.</p>
          </div>
          <h3>Pick up to ${TEAM} Pokémon (in order)</h3>
          <div class="list">${pool.map(m => {
            const idx = picked.indexOf(m.uid);
            const kanto = PG.currentRegion === 2 && !s.party.includes(m);
            return `<button class="pick ${idx >= 0 ? 'on' : ''}" data-uid="${m.uid}" ${m.fainted ? 'disabled' : ''}>
              ${idx >= 0 ? `<span class="order">${idx + 1}</span>` : ''}${kanto ? '<span class="region-tag">Kanto</span>' : ''}${monCard(m)}</button>`;
          }).join('')}</div>
          <div class="row"><button class="btn primary" data-act="fight" ${picked.length ? '' : 'disabled'}>Battle ${o.name}!</button>
            <button class="btn" data-act="close">Leave (progress is saved)</button></div>
          ${this.bracketHtml(t)}`, { cls: 'wide' });
        box.onclick = (ev) => {
          const p = ev.target.closest('.pick');
          if (p && !p.disabled) {
            const i = picked.indexOf(p.dataset.uid);
            if (i >= 0) picked.splice(i, 1);
            else if (picked.length < TEAM) picked.push(p.dataset.uid);
            render();
            return;
          }
          const b = ev.target.closest('[data-act]');
          if (!b) return;
          if (b.dataset.act === 'close') close();
          if (b.dataset.act === 'fight') {
            this.closeModal();
            game.startTournamentMatch(picked.map(uid => pool.find(m => m.uid === uid)));
          }
        };
      };
      render();
    },

    // The whole bracket: one column per round, the player's path in gold.
    bracketHtml(t) {
      const T = PG.Tournament;
      const name = (i) => i === undefined ? '' : i === 0 ? '<b>You</b>' : `${t.entrants[i].name}`;
      const cols = [];
      const size = t.size || 32, nR = T.rounds(t);
      for (let r = 0; r < nR; r++) {
        const slots = t.rounds[r];
        const matches = [];
        const n = (size >> r) / 2;
        for (let i = 0; i < n; i++) {
          const a = slots ? slots[i * 2] : undefined, b = slots ? slots[i * 2 + 1] : undefined;
          const w = t.winners[r] ? t.winners[r][i] : undefined;
          const you = a === 0 || b === 0;
          const cell = (x) => `<div class="bk-slot ${w !== undefined && w === x ? 'win' : w !== undefined ? 'lose' : ''} ${x === 0 ? 'me' : ''}">${x === undefined ? '—' : name(x)}</div>`;
          matches.push(`<div class="bk-match ${you ? 'mine' : ''}">${cell(a)}${cell(b)}</div>`);
        }
        cols.push(`<div class="bk-col ${r === t.round && t.status === 'active' ? 'now' : ''}"><div class="bk-title">${T.roundName(r, t)}<small>${T.stage(t, r).icon} ${T.stage(t, r).name}</small></div><div class="bk-list">${matches.join('')}</div></div>`);
      }
      const champ = t.status === 'champion' ? '<b>You</b>' : t.winners[nR - 1] && t.winners[nR - 1][0] !== undefined ? name(t.winners[nR - 1][0]) : '?';
      cols.push(`<div class="bk-col"><div class="bk-title">Champion</div><div class="bk-list"><div class="bk-match champ">🏆 ${champ}</div></div></div>`);
      return `<div class="bracket">${cols.join('')}</div>`;
    },

    // Pick a Pokemon to send out. forced = current one fainted (can't cancel).
    chooseFighter(party, current, forced, cb) {
      const box = this.modal(`
        <div class="modal-head"><h2>${forced ? 'Choose your next Pokémon' : 'Switch Pokémon'}</h2>
        ${forced ? '' : '<button class="btn" data-act="close">✕</button>'}</div>
        <div class="list">${party.map(m => `<button class="pick" data-uid="${m.uid}" ${m.fainted || m === current ? 'disabled' : ''}>${monCard(m)}</button>`).join('')}</div>`);
      box.onclick = (ev) => {
        const p = ev.target.closest('.pick');
        if (p && !p.disabled) { this.closeModal(); cb(party.find(m => m.uid === p.dataset.uid)); return; }
        if (ev.target.closest('[data-act="close"]')) { this.closeModal(); cb(null); }
      };
    },

    // ---------- XP, learning, evolution ----------
    queueXp(mon, amount) { this.xpQueue.push({ mon, amount }); },

    // Applies queued XP, shows the results screen, then walks through move-learning and evolution prompts.
    async processXp(game, headline, money) {
      const merged = new Map();
      for (const { mon, amount } of this.xpQueue) merged.set(mon, (merged.get(mon) || 0) + amount);
      this.xpQueue = [];
      if (!merged.size) { if (money) this.toast(`You got ₽${money}!`); game.save(); return; }
      const results = [];
      for (const [mon, amount] of merged) {
        const from = mon.level + mon.xpProgress();
        const events = mon.gainXp(amount);
        results.push({ mon, amount, from, to: mon.level + mon.xpProgress(), events });
      }
      await this.showXpResults(results, headline || 'Battle results', money);
      for (const { mon, events } of results) {
        for (const ev of events) {
          if (ev.type === 'level') PG.Audio.sfx('levelUp');
          else if (ev.type === 'learn') await this.offerMove(mon, ev.move);
          else if (ev.type === 'evolve') {
            const ok = await this.confirmEvolve(mon, ev.into);
            if (ok) {
              const before = mon.name;
              const offers = mon.evolve();
              await this.message(`Congratulations! ${before} evolved into ${SPECIES[mon.species].name}!`, mon.species);
              for (const m of offers) await this.offerMove(mon, m);
            }
          }
        }
      }
      game.save();
    },

    // Post-battle screen: XP gained per Pokemon with bars that fill (and roll over on level-ups).
    showXpResults(results, headline, money) {
      return new Promise(res => {
        const box = this.modal(`
          <h2 class="center">${headline}</h2>
          ${money ? `<p class="center"><span class="pill gold">+ ₽${money.toLocaleString()}</span></p>` : ''}
          <div class="list">${results.map((r, i) => `
            <div class="xp-row" data-i="${i}">
              <img src="${PG.spriteUrl(r.mon.species)}" alt="" onerror="this.style.visibility='hidden'">
              <div class="xp-info">
                <div class="xp-head"><b>${r.mon.name}</b>${r.mon.item === 'exp_share' ? '<span class="share-tag">✦ Exp. Share</span>' : ''}<span class="lv">Lv ${Math.floor(r.from)}</span><span class="gain">+${r.amount.toLocaleString()} XP</span></div>
                <div class="bar xp big"><div></div></div>
                <div class="xp-foot"><span class="lvup"></span><small>${r.mon.xpToNext().toLocaleString()} XP to Lv ${r.mon.level + 1}</small></div>
                <div class="xp-moves">${r.events.filter(e => e.type === 'learn').map(e => `<span class="new-move">★ New move: ${MOVES[e.move].name}</span>`).join('')}
                  ${(() => { const n = r.mon.upcomingMoves()[0]; return n ? `<small class="muted">Next move: <b>${MOVES[n.move].name}</b> at Lv ${n.level}</small>` : ''; })()}</div>
              </div>
            </div>`).join('')}
          </div>
          <div class="row center"><button class="btn primary" data-enter>Continue <kbd>Enter</kbd></button></div>`);
        const rows = [...box.querySelectorAll('.xp-row')];
        const start = performance.now();
        let raf;
        const tick = (now) => {
          let done = true;
          results.forEach((r, i) => {
            const span = r.to - r.from;
            const dur = Math.min(2.2, Math.max(0.7, span * 0.9)) * 1000;
            const k = Math.min(1, (now - start) / dur);
            if (k < 1) done = false;
            const v = r.from + span * (1 - Math.pow(1 - k, 3));
            const lv = Math.floor(v + 1e-9);
            const row = rows[i];
            row.querySelector('.bar div').style.width = (k >= 1 ? r.to - Math.floor(r.to) : v - lv) * 100 + '%';
            row.querySelector('.lv').textContent = 'Lv ' + (k >= 1 ? r.mon.level : lv);
            const gained = (k >= 1 ? r.mon.level : lv) - Math.floor(r.from);
            if (gained > 0) {
              row.classList.add('leveled');
              row.querySelector('.lvup').textContent = `▲ Level up${gained > 1 ? ' ×' + gained : ''}!`;
            }
          });
          if (!done) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        box.querySelector('button').onclick = () => { cancelAnimationFrame(raf); this.closeModal(); res(); };
      });
    },

    message(text, speciesId) {
      return new Promise(res => {
        const box = this.modal(`
          ${speciesId ? `<img class="big" src="${PG.spriteUrl(speciesId)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
          <p class="center">${text}</p>
          <div class="row center"><button class="btn primary" data-enter>OK <kbd>Enter</kbd></button></div>`);
        box.querySelector('button').onclick = () => { this.closeModal(); res(); };
      });
    },

    confirmEvolve(mon, into) {
      return new Promise(res => {
        const box = this.modal(`
          <h2 class="center">What? ${mon.name} is evolving!</h2>
          <div class="evo"><img src="${PG.spriteUrl(mon.species)}" alt=""><span>➜</span><img class="glow" src="${PG.spriteUrl(into)}" alt=""></div>
          <p class="center">${SPECIES[mon.species].name} → <b>${SPECIES[into].name}</b></p>
          <div class="row center"><button class="btn primary" data-v="1">Evolve</button><button class="btn" data-v="0">Not now</button></div>`);
        box.querySelectorAll('button').forEach(b => b.onclick = () => { this.closeModal(); res(b.dataset.v === '1'); });
      });
    },

    // Learn a move: auto-add if there's room, otherwise the player replaces one or discards the new move.
    offerMove(mon, moveId) {
      if (mon.moves.includes(moveId)) return Promise.resolve();
      if (mon.tryLearn(moveId)) return this.message(`<b>${mon.name}</b> learned <b>${MOVES[moveId].name}</b>!<br>${moveLine(moveId)}`, mon.species);
      return new Promise(res => {
        const box = this.modal(`
          <h2>${mon.name} wants to learn ${MOVES[moveId].name}</h2>
          <p>New: ${moveLine(moveId)}</p>
          <p>${mon.name} already knows ${CONFIG.MAX_MOVES} moves. Pick one to forget, or discard the new move.</p>
          <div class="list">${mon.moves.map((id, i) => `<button class="pick" data-i="${i}">Forget ${moveLine(id)}</button>`).join('')}</div>
          <div class="row"><button class="btn danger" data-skip="1">Discard ${MOVES[moveId].name}</button></div>`);
        box.onclick = (ev) => {
          const p = ev.target.closest('.pick');
          if (p) {
            const old = mon.moves[+p.dataset.i];
            mon.replaceMove(+p.dataset.i, moveId);
            this.closeModal();
            this.toast(`${mon.name} forgot ${MOVES[old].name} and learned ${MOVES[moveId].name}!`);
            res();
          } else if (ev.target.closest('[data-skip]')) {
            this.closeModal();
            this.toast(`${mon.name} did not learn ${MOVES[moveId].name}.`);
            res();
          }
        };
      });
    },
  };

  // Keyboard: Enter / Space presses the pop-up's main button (marked data-enter), e.g. Continue after XP.
  // Runs before the game's own key handling so the same press doesn't also trigger something behind it.
  window.addEventListener('keydown', (e) => {
    if (!UI.modalOpen || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const btn = [...document.querySelectorAll('#modal-root [data-enter]')].pop();
    if (!btn || btn.disabled) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    btn.click();
  }, true);

  // a small blip for every button press
  document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('button')) PG.Audio.sfx('click'); }, true);

  PG.UI = UI;
})();
