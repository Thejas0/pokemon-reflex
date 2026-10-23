// Town Map: a full-screen, zoomable view of the whole world with towns, gyms, the League and you.
// Open with M (or N) or the 🗺️ HUD button. Drag to pan, wheel / + − to zoom.
(function () {
  const PX = 6; // pixels per tile in the pre-rendered map image

  // Pre-render the world once at PX px per tile, with a little texture per terrain.
  function renderDetail(world) {
    const TILE = PG.TILE, W = world.W, H = world.H;
    const cv = document.createElement('canvas');
    cv.width = W * PX; cv.height = H * PX;
    const c = cv.getContext('2d');
    const rnd = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = world.tile(x, y), px = x * PX, py = y * PX, r = rnd(x, y);
      switch (t) {
        case TILE.WATER: {
          const d = world.depth[world.idx(x, y)] || 1;
          c.fillStyle = ['#5aa0e8', '#4589d6', '#356fbe'][Math.min(2, d - 1)];
          c.fillRect(px, py, PX, PX);
          if (r < 0.08) { c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(px + 1, py + 2, 3, 1); }
          break;
        }
        case TILE.SAND: c.fillStyle = r < 0.5 ? '#ecdca4' : '#e6d498'; c.fillRect(px, py, PX, PX); break;
        case TILE.GRASS: c.fillStyle = r < 0.5 ? '#8ccd66' : '#86c760'; c.fillRect(px, py, PX, PX); break;
        case TILE.TALL:
          c.fillStyle = '#5fae4c'; c.fillRect(px, py, PX, PX);
          c.fillStyle = '#4a9a3c'; c.fillRect(px + 1, py + 1, 1, 3); c.fillRect(px + 4, py + 2, 1, 3);
          break;
        case TILE.TREE:
          c.fillStyle = '#6fb354'; c.fillRect(px, py, PX, PX);
          c.fillStyle = r < 0.5 ? '#2f7a3a' : '#2a6e34';
          c.beginPath(); c.arc(px + PX / 2, py + PX / 2, PX * 0.55, 0, Math.PI * 2); c.fill();
          break;
        case TILE.ROCK: c.fillStyle = r < 0.5 ? '#b3a68e' : '#ab9e86'; c.fillRect(px, py, PX, PX); break;
        case TILE.BOULDER:
          c.fillStyle = '#b3a68e'; c.fillRect(px, py, PX, PX);
          c.fillStyle = '#7d715e'; c.beginPath(); c.arc(px + PX / 2, py + PX / 2, PX * 0.45, 0, Math.PI * 2); c.fill();
          break;
        case TILE.PATH: c.fillStyle = '#dcc48f'; c.fillRect(px, py, PX, PX); break;
        case TILE.BRIDGE:
          c.fillStyle = '#a0703c'; c.fillRect(px, py, PX, PX);
          c.fillStyle = '#7d5428'; c.fillRect(px, py + 2, PX, 1);
          break;
        default: c.fillStyle = '#d4ccba'; c.fillRect(px, py, PX, PX); // town ground, buildings, doors
      }
    }
    // buildings in their roof colours
    for (const b of world.buildings) {
      const col = b.kind === 'center' ? '#e2524a' : b.kind === 'mart' ? '#3d7be0' : b.kind === 'league' ? '#d4a017' : PG.TYPES[world.gyms[b.gymIndex].type].color;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(b.x * PX + 2, b.y * PX + 2, b.w * PX, b.h * PX);
      c.fillStyle = col; c.fillRect(b.x * PX, b.y * PX, b.w * PX, b.h * PX);
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(b.x * PX, b.y * PX, b.w * PX, 2);
    }
    return cv;
  }

  const MapView = {
    open(game) {
      const UI = PG.UI, world = game.world, s = game.state;
      if (!world.detailMap) world.detailMap = renderDetail(world);
      const gymTowns = world.gyms.map((g, i) => ({ ...world.gymSpots[i], g, i, beaten: s.badges.includes(g.id) }));
      const places = [
        { name: world.region.home, x: world.center.x, y: world.center.y, icon: '🏠', sub: 'Start' },
        ...gymTowns.map(t => ({ name: t.g.city, x: t.x, y: t.y, icon: t.beaten ? '★' : String(t.i + 1),
          sub: `${t.g.leader} · ${t.g.type} gym${t.beaten ? ' · beaten' : ''}`, color: PG.TYPES[t.g.type].color, beaten: t.beaten })),
        { name: world.region.leagueTown, x: world.league.x, y: world.league.y, icon: '🏆', sub: world.region.leagueName, color: '#d4a017' },
      ];
      places.forEach(p => { p.lv = world.zoneLevel(p.x, p.y); });
      const box = UI.modal(`
        <div class="modal-head"><h2>🗺️ ${world.region.name} Map</h2><button class="btn" data-act="close">✕</button></div>
        <div class="map-wrap">
          <div class="map-stage"><canvas class="map-canvas"></canvas>
            <div class="map-tools">
              <button class="btn" data-act="zin" title="Zoom in">+</button>
              <button class="btn" data-act="zout" title="Zoom out">−</button>
              <button class="btn" data-act="me" title="Center on you">⌖</button>
            </div>
            <div class="map-hint">Drag to move · scroll or +/− to zoom</div>
          </div>
          <div class="map-side">
            <div class="map-legend">
              <span><i style="background:#e2524a"></i>Poké Center</span><span><i style="background:#3d7be0"></i>Poké Mart</span>
              <span><i style="background:#ffd700"></i>League</span><span><i style="background:#5fae4c"></i>Tall grass</span>
              <span><i style="background:#356fbe"></i>Deep water</span><span><i style="background:#ab9e86"></i>Mountains</span>
            </div>
            <div class="map-places">${places.map((p, i) => `
              <button class="map-place ${p.beaten ? 'done' : ''}" data-act="go" data-i="${i}" style="--c:${p.color || '#7cc860'}">
                <span class="mp-ico">${p.icon}</span><span><b>${p.name}</b><small>${p.sub} · wild Lv ~${p.lv}</small></span>
              </button>`).join('')}</div>
          </div>
        </div>`, { cls: 'map-modal' });

      const canvas = box.querySelector('.map-canvas'), stage = box.querySelector('.map-stage');
      const ctx = canvas.getContext('2d');
      const pl = world.player, T = PG.CONFIG.TILE;
      const view = { cx: pl.x / T, cy: pl.y / T, zoom: 1 }; // centre in tiles, zoom = screen px per map px
      let dpr = 1, vw = 0, vh = 0;
      const fit = () => {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        vw = stage.clientWidth; vh = stage.clientHeight;
        canvas.width = vw * dpr; canvas.height = vh * dpr;
        canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
      };
      fit();
      const minZoom = () => Math.min(vw / (world.W * PX), vh / (world.H * PX));
      view.zoom = Math.max(minZoom(), Math.min(1.2, minZoom() * 2.2));
      const clampZoom = (z) => Math.max(minZoom(), Math.min(4, z));
      const tilePx = () => PX * view.zoom; // screen px per tile

      let anim = 0;
      const draw = (t) => {
        if (!document.body.contains(canvas)) return; // modal closed
        if (stage.clientWidth !== vw || stage.clientHeight !== vh) fit();
        const tp = tilePx();
        // keep the view inside the map
        const halfW = vw / tp / 2, halfH = vh / tp / 2;
        view.cx = world.W > halfW * 2 ? Math.max(halfW, Math.min(world.W - halfW, view.cx)) : world.W / 2;
        view.cy = world.H > halfH * 2 ? Math.max(halfH, Math.min(world.H - halfH, view.cy)) : world.H / 2;
        const ox = vw / 2 - view.cx * tp, oy = vh / 2 - view.cy * tp;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#0d1220'; ctx.fillRect(0, 0, vw, vh);
        ctx.imageSmoothingEnabled = tp < PX;
        ctx.drawImage(world.detailMap, ox, oy, world.W * tp, world.H * tp);
        const sx = (x) => ox + x * tp, sy = (y) => oy + y * tp;

        // place markers and labels
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const p of places) {
          const x = sx(p.x), y = sy(p.y) - Math.max(10, tp * 6);
          const r = 11;
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + 1, y + 2, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = p.beaten ? '#ffd700' : p.color || '#ffffff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1a1a1a'; ctx.font = '800 11px system-ui, sans-serif';
          ctx.fillText(p.icon, x, y + 0.5);
          ctx.font = '700 12px system-ui, sans-serif';
          const w = ctx.measureText(p.name).width + 12;
          ctx.fillStyle = 'rgba(14,18,32,0.85)';
          ctx.beginPath(); ctx.roundRect(x - w / 2, y + r + 3, w, 17, 8); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.fillText(p.name, x, y + r + 12);
        }

        // you: pulsing ring + direction arrow
        const px = sx(pl.x / T), py = sy(pl.y / T);
        const pulse = (t / 1000) % 1;
        ctx.strokeStyle = `rgba(255,80,80,${1 - pulse})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py, 8 + pulse * 18, 0, Math.PI * 2); ctx.stroke();
        const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[pl.dir];
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e03a3a'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.font = '800 11px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
        ctx.strokeText('YOU', px, py + 18); ctx.fillText('YOU', px, py + 18);
        anim = requestAnimationFrame(draw);
      };
      anim = requestAnimationFrame(draw);

      // pan (mouse/touch drag) and pinch zoom
      const ptrs = new Map();
      let pinch = null;
      canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
      canvas.addEventListener('pointermove', (e) => {
        const prev = ptrs.get(e.pointerId);
        if (!prev) return;
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) view.zoom = clampZoom(view.zoom * d / pinch);
          pinch = d;
          return;
        }
        view.cx -= (e.clientX - prev.x) / tilePx();
        view.cy -= (e.clientY - prev.y) / tilePx();
      });
      const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        // zoom toward the cursor
        const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const before = { x: view.cx + (mx - vw / 2) / tilePx(), y: view.cy + (my - vh / 2) / tilePx() };
        view.zoom = clampZoom(view.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
        view.cx = before.x - (mx - vw / 2) / tilePx();
        view.cy = before.y - (my - vh / 2) / tilePx();
      }, { passive: false });

      const keys = (e) => {
        if (!document.body.contains(canvas)) { window.removeEventListener('keydown', keys); return; }
        const k = e.key.toLowerCase();
        if (k === 'm' || k === 'n' || k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
        if (k === '+' || k === '=') view.zoom = clampZoom(view.zoom * 1.25);
        if (k === '-') view.zoom = clampZoom(view.zoom / 1.25);
      };
      window.addEventListener('keydown', keys, true);
      const close = () => { cancelAnimationFrame(anim); window.removeEventListener('keydown', keys, true); UI.closeModal(); };

      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        switch (b.dataset.act) {
          case 'close': close(); break;
          case 'zin': view.zoom = clampZoom(view.zoom * 1.3); break;
          case 'zout': view.zoom = clampZoom(view.zoom / 1.3); break;
          case 'me': view.cx = pl.x / T; view.cy = pl.y / T; view.zoom = Math.max(view.zoom, minZoom() * 2.5); break;
          case 'go': {
            const p = places[+b.dataset.i];
            view.cx = p.x; view.cy = p.y; view.zoom = Math.max(view.zoom, minZoom() * 2.5);
            break;
          }
        }
      });
    },
  };

  PG.MapView = MapView;
})();
