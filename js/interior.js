// Walk-in building interiors (Poké Center, Poké Mart). The player walks around and uses
// stations: the nurse counter heals, the PC manages storage, the Pokédex board shows progress.
(function () {
  const TS = 40;                 // tile size inside buildings
  const COLS = 15, ROWS = 10;
  const W = COLS * TS, H = ROWS * TS;
  const R = 11;                  // player collision radius
  const REACH = 58;              // how close you must be to use a station

  // solid: rects the player can't walk through. stations: things to use. door: exit mat.
  const LAYOUTS = {
    center: {
      title: 'Poké Center',
      floor: ['#f4ead8', '#efe3cc'], wall: '#f6c9c9', trim: '#e2524a',
      solid: [
        [0, 0, COLS, 2.2],                // back wall
        [4, 2, 7, 1.4],                   // nurse counter
        [11.6, 2, 2.4, 1.3],              // PC desk
        [0.6, 2, 2.6, 1.2],               // Pokédex board base
        [0.5, 7.3, 2.4, 1], [12.1, 7.3, 2.4, 1], // benches
      ],
      stations: [
        { id: 'heal', x: 7.5, y: 4.1, label: 'Heal your Pokémon', icon: '✚' },
        { id: 'pc', x: 12.8, y: 4.0, label: 'Use the PC (storage)', icon: '🖥' },
        { id: 'dex', x: 1.9, y: 3.9, label: 'Check the Pokédex', icon: '📖' },
      ],
    },
    mart: {
      title: 'Poké Mart',
      floor: ['#e3ecf5', '#d8e4ef'], wall: '#cfe0f5', trim: '#3d7be0',
      solid: [
        [0, 0, COLS, 2.2],
        [1, 2, 4.5, 1.4],                 // shop counter
        [7, 3.4, 6.5, 0.9], [7, 5.8, 6.5, 0.9], // shelves
      ],
      stations: [
        { id: 'shop', x: 3.2, y: 4.1, label: 'Shop (Poké Balls & items)', icon: '🛒' },
      ],
    },
  };

  class Interior {
    constructor(kind, game) {
      this.kind = kind;
      this.L = LAYOUTS[kind];
      this.stations = this.L.stations.slice();
      // Region portal at the Poké Center: Kanto → Johto once you are Kanto Champion, Johto → Kanto always.
      if (kind === 'center' && game && (PG.currentRegion === 2 || (game.state.champions && game.state.champions[1]))) {
        const to = PG.currentRegion === 1 ? 2 : 1;
        this.stations.push({ id: 'portal', to, x: 10.4, y: 6.3, icon: '🌀', label: `Portal to ${PG.REGIONS[to].name} (${PG.REGIONS[to].home})` });
      }
      this.p = { x: 7.5 * TS, y: 8.6 * TS, dir: 'up', walk: 0, moving: false };
      this.time = 0;
      this.near = null;
      this.healT = 0;          // healing machine animation
      this.cooldown = 0.3;     // ignore input for a moment after entering
      this.drawProxy = { player: this.p, tile: () => -1, drawTallGrass() {} };
    }

    solidAt(x, y) {
      if (x < TS * 0.5 + R || x > W - TS * 0.5 - R || y > H - TS * 0.5 - R) {
        // side/bottom walls, except the doorway in the bottom wall
        const inDoor = x > 6.5 * TS && x < 8.5 * TS && y > H - TS;
        if (!inDoor) return true;
      }
      for (const [rx, ry, rw, rh] of this.L.solid) {
        if (x + R > rx * TS && x - R < (rx + rw) * TS && y + R * 0.6 > ry * TS && y - R * 0.6 < (ry + rh) * TS) return true;
      }
      return false;
    }

    update(dt, game) {
      this.time += dt;
      this.healT = Math.max(0, this.healT - dt);
      this.cooldown = Math.max(0, this.cooldown - dt);
      const I = PG.Input, p = this.p;
      const a = I.axis();
      p.moving = !!(a.x || a.y);
      if (p.moving) {
        const sp = 170;
        const nx = p.x + a.x * sp * dt, ny = p.y + a.y * sp * dt;
        if (!this.solidAt(nx, p.y)) p.x = nx;
        if (!this.solidAt(p.x, ny)) p.y = ny;
        p.walk += dt * 12;
        if (Math.abs(a.x) > Math.abs(a.y)) p.dir = a.x > 0 ? 'right' : 'left';
        else p.dir = a.y > 0 ? 'down' : 'up';
      }
      // leaving through the door
      if (p.y > H - TS * 0.35) { game.enterWorld(); return; }

      this.near = null;
      for (const s of this.stations) {
        if (Math.hypot(s.x * TS - p.x, s.y * TS - p.y) < REACH) { this.near = s; break; }
      }
      PG.UI.setInteriorPrompt(this.near && this.healT <= 0 ? this.near : null);
      if (I.consume('interact') && this.near && this.cooldown <= 0) this.use(this.near, game);
    }

    use(st, game) {
      const UI = PG.UI;
      switch (st.id) {
        case 'heal':
          if (this.healT > 0) return;
          this.healT = 1.6;
          game.healParty();
          PG.Audio.sfx('heal');
          setTimeout(() => UI.toast('Your Pokémon are fully healed! We hope to see you again!'), 1500);
          break;
        case 'pc': game.openPC(); break;
        case 'dex': UI.openDex(game); break;
        case 'shop': game.openMart(); break;
        case 'portal': {
          const R = PG.REGIONS[st.to], here = PG.region();
          const first = st.to === 2 && !(game.state.stash && game.state.stash[2]);
          PG.Dialogue.choose(
            `A shimmering portal hums behind the counter. Travel to ${R.home} in the ${R.name} region? ` +
            (first ? `Your ${here.name} Pokémon will stay behind here, and you'll pick a new partner in ${R.name}.` : `Your ${here.name} Pokémon will stay in ${here.name}; your ${R.name} team is waiting for you.`),
            [`Yes, go to ${R.name}!`, 'Not now'], 'Nurse Joy',
          ).then(pick => { if (pick === 0) game.travel(st.to); });
          break;
        }
      }
    }

    // ---------- drawing ----------
    draw(ctx, vw, vh, game) {
      const scale = Math.min(vw / W, (vh - 10) / H);
      const ox = (vw - W * scale) / 2, oy = (vh - H * scale) / 2;
      ctx.fillStyle = '#15171f';
      ctx.fillRect(0, 0, vw, vh);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      const L = this.L;

      // floor
      for (let y = 2; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = L.floor[(x + y) & 1];
        ctx.fillRect(x * TS, y * TS, TS, TS);
      }
      // back wall with trim and windows
      ctx.fillStyle = L.wall; ctx.fillRect(0, 0, W, 2.2 * TS);
      ctx.fillStyle = L.trim; ctx.fillRect(0, 2.05 * TS, W, 0.15 * TS);
      ctx.fillStyle = shade(L.wall, -0.08);
      for (let x = 0; x < COLS; x += 2) ctx.fillRect(x * TS, 0, 2, 2.05 * TS);
      // side and bottom walls
      ctx.fillStyle = '#3a3f4f';
      ctx.fillRect(0, 2.2 * TS, TS * 0.5, H); ctx.fillRect(W - TS * 0.5, 2.2 * TS, TS * 0.5, H);
      ctx.fillRect(0, H - TS * 0.5, 6.5 * TS, TS * 0.5); ctx.fillRect(8.5 * TS, H - TS * 0.5, W - 8.5 * TS, TS * 0.5);
      // exit mat
      ctx.fillStyle = L.trim; ctx.fillRect(6.6 * TS, H - TS * 0.9, 1.8 * TS, TS * 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('EXIT', 7.5 * TS, H - TS * 0.3);

      if (this.kind === 'center') this.drawCenter(ctx, game); else this.drawMart(ctx);
      const portal = this.stations.find(s => s.id === 'portal');
      if (portal) this.drawPortal(ctx, portal.x * TS, portal.y * TS);

      // player
      const p = this.p;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.scale(1.25, 1.25); ctx.translate(-p.x, -p.y);
      game.world.drawPlayer.call(this.drawProxy, ctx, this.time);
      ctx.restore();

      // station highlight
      if (this.near) {
        const s = this.near, bob = Math.sin(this.time * 5) * 3;
        ctx.fillStyle = '#ffcb05'; ctx.strokeStyle = '#5a4300'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x * TS, (s.y - 1.15) * TS + bob); ctx.lineTo(s.x * TS - 8, (s.y - 1.45) * TS + bob); ctx.lineTo(s.x * TS + 8, (s.y - 1.45) * TS + bob); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }

      // soft lighting
      const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.2, W / 2, H * 0.45, W * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // A swirling region portal.
    drawPortal(ctx, x, y) {
      const t = this.time;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y + 26, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(x, y, 2, x, y, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(150,120,255,0.85)'); g.addColorStop(1, 'rgba(60,40,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 24, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = ['#b9a8ff', '#7fd3ff', '#ffffff'][i];
        ctx.beginPath(); ctx.ellipse(x, y, 20 - i * 5, 26 - i * 6, 0, t * (2 + i) + i, t * (2 + i) + i + 4); ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        const a = t * 1.5 + i * 1.26, r = 24 + Math.sin(t * 3 + i) * 4;
        ctx.fillStyle = 'rgba(220,210,255,0.8)'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 1.2, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawCenter(ctx, game) {
      const t = this.time;
      // big Poké Center logo on the back wall
      ctx.save(); ctx.translate(7.5 * TS, 0.85 * TS);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e2524a'; ctx.beginPath(); ctx.arc(0, 0, 24, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();

      // nurse (Chansey helps out) behind the counter, and the healing machine
      PG.drawMon(ctx, 'chansey', 6.2 * TS, 1.9 * TS, 54, false);
      this.drawNurse(ctx, 7.5 * TS, 2.05 * TS);
      ctx.fillStyle = '#9aa3b5'; roundRect(ctx, 8.6 * TS, 1.25 * TS, 1.6 * TS, 0.9 * TS, 6); ctx.fill();
      for (let i = 0; i < 6; i++) {
        const bx = 8.85 * TS + (i % 3) * 0.55 * TS, by = 1.5 * TS + Math.floor(i / 3) * 0.38 * TS;
        const lit = this.healT > 0 && Math.floor((1.6 - this.healT) / 0.18) % 6 >= i && i < game.state.party.length;
        ctx.fillStyle = lit ? '#fff9c4' : i < game.state.party.length ? '#e33' : '#5d6475';
        if (lit) { ctx.shadowColor = '#fff59d'; ctx.shadowBlur = 12; }
        ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      // counter
      ctx.fillStyle = '#e2524a'; roundRect(ctx, 4 * TS, 2.3 * TS, 7 * TS, 1.1 * TS, 8); ctx.fill();
      ctx.fillStyle = '#fff'; roundRect(ctx, 4 * TS, 2.15 * TS, 7 * TS, 0.35 * TS, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(4.3 * TS, 2.95 * TS, 6.4 * TS, 3);

      // PC desk
      ctx.fillStyle = '#8b6b4a'; roundRect(ctx, 11.6 * TS, 2.5 * TS, 2.4 * TS, 0.8 * TS, 5); ctx.fill();
      ctx.fillStyle = '#2d3445'; roundRect(ctx, 12.1 * TS, 1.45 * TS, 1.4 * TS, 1.05 * TS, 5); ctx.fill();
      ctx.fillStyle = `rgba(110,200,255,${0.75 + Math.sin(t * 3) * 0.15})`; ctx.fillRect(12.22 * TS, 1.57 * TS, 1.16 * TS, 0.72 * TS);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('PC', 12.8 * TS, 2.05 * TS);

      // Pokédex progress board
      const st = PG.dexStats(game.state);
      ctx.fillStyle = '#26324a'; roundRect(ctx, 0.6 * TS, 0.45 * TS, 2.9 * TS, 2.5 * TS, 8); ctx.fill();
      ctx.strokeStyle = '#ffcb05'; ctx.lineWidth = 3; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffcb05'; ctx.font = 'bold 12px system-ui';
      ctx.fillText('POKéDEX', 2.05 * TS, 0.95 * TS);
      ctx.fillStyle = '#fff'; ctx.font = '900 22px system-ui';
      ctx.fillText(`${st.caught}/${st.total}`, 2.05 * TS, 1.6 * TS);
      ctx.font = '11px system-ui'; ctx.fillStyle = '#c9d4ea';
      ctx.fillText(`caught · ${st.seen} seen`, 2.05 * TS, 1.95 * TS);
      ctx.fillText(`★ ${st.legendCaught}/${st.legendTotal} legendary`, 2.05 * TS, 2.3 * TS);
      ctx.fillStyle = '#3c4864'; ctx.fillRect(0.85 * TS, 2.5 * TS, 2.4 * TS, 6);
      ctx.fillStyle = '#7be07b'; ctx.fillRect(0.85 * TS, 2.5 * TS, 2.4 * TS * (st.caught / st.total), 6);

      // benches and plants
      for (const bx of [0.5, 12.1]) { ctx.fillStyle = '#b5835a'; roundRect(ctx, bx * TS, 7.3 * TS, 2.4 * TS, 0.7 * TS, 6); ctx.fill(); }
      this.drawPlant(ctx, 0.95 * TS, 6.6 * TS); this.drawPlant(ctx, 14.05 * TS, 6.6 * TS);
    }

    drawMart(ctx) {
      // clerk and counter
      this.drawNurse(ctx, 3.2 * TS, 2.05 * TS, '#3d7be0');
      ctx.fillStyle = '#3d7be0'; roundRect(ctx, 1 * TS, 2.3 * TS, 4.5 * TS, 1.1 * TS, 8); ctx.fill();
      ctx.fillStyle = '#fff'; roundRect(ctx, 1 * TS, 2.15 * TS, 4.5 * TS, 0.35 * TS, 6); ctx.fill();
      // sign
      ctx.fillStyle = '#3d7be0'; roundRect(ctx, 6.2 * TS, 0.4 * TS, 6 * TS, 1.1 * TS, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('POKé MART', 9.2 * TS, 1.15 * TS);
      // shelves stocked with balls and items
      const colors = PG.BALL_IDS.map(id => PG.ITEMS[id].color);
      for (const sy of [3.4, 5.8]) {
        ctx.fillStyle = '#9c7650'; roundRect(ctx, 7 * TS, sy * TS, 6.5 * TS, 0.9 * TS, 5); ctx.fill();
        for (let i = 0; i < 12; i++) {
          const x = 7.35 * TS + i * 0.52 * TS, y = sy * TS + 0.25 * TS;
          ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(x, y, 7, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI); ctx.fill();
        }
      }
      this.drawPlant(ctx, 14.05 * TS, 7.6 * TS);
    }

    drawNurse(ctx, x, y, coat = '#ff8fb0') {
      ctx.fillStyle = coat; roundRect(ctx, x - 13, y - 14, 26, 22, 8); ctx.fill();
      ctx.fillStyle = '#ffe0c7'; ctx.beginPath(); ctx.arc(x, y - 24, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = coat === '#ff8fb0' ? '#f06292' : '#5b3a1e';
      ctx.beginPath(); ctx.arc(x, y - 28, 11, Math.PI, 0); ctx.fill();
      if (coat === '#ff8fb0') { ctx.fillStyle = '#fff'; roundRect(ctx, x - 8, y - 41, 16, 7, 3); ctx.fill(); ctx.fillStyle = '#e2524a'; ctx.fillRect(x - 1.5, y - 40, 3, 5); ctx.fillRect(x - 3.5, y - 38, 7, 1.5); }
      ctx.fillStyle = '#333'; ctx.fillRect(x - 5, y - 25, 2, 3); ctx.fillRect(x + 3, y - 25, 2, 3);
    }

    drawPlant(ctx, x, y) {
      ctx.fillStyle = '#b5835a'; roundRect(ctx, x - 12, y, 24, 18, 4); ctx.fill();
      ctx.fillStyle = '#4caf50';
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.45; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 10, 5, a, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }
  function shade(hex, amt) {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const out = c.map(v => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }

  PG.Interior = Interior;
})();
