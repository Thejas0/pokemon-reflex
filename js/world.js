// Open world: procedural tile map, towns, gyms, roaming wild Pokemon, player movement.
(function () {
  const { CONFIG, SPECIES } = PG;
  const T = CONFIG.TILE;

  const TILE = {
    WATER: 0, SAND: 1, GRASS: 2, TALL: 3, TREE: 4, ROCK: 5, BOULDER: 6,
    PATH: 7, TOWN: 8, BUILDING: 9, DOOR_CENTER: 10, DOOR_GYM: 11, BRIDGE: 12, DOOR_MART: 13, DOOR_LEAGUE: 14,
  };
  // Overworld camera: the classic flat top-down view, or an optional 2.5D view (tilted ground, things stand up). V toggles it.
  PG.VIEW = { d25: false };
  try { PG.VIEW.d25 = localStorage.getItem('pg-view2') === '2.5d'; } catch (e) { /* storage blocked: default view */ }
  const CHUNK = 12;           // 2.5D view: the flat ground is cached in CHUNK x CHUNK tile canvases
  const DOORS = new Set([TILE.DOOR_CENTER, TILE.DOOR_GYM, TILE.DOOR_MART, TILE.DOOR_LEAGUE]);
  const BLOCKED = new Set([TILE.WATER, TILE.TREE, TILE.BOULDER, TILE.BUILDING]);
  const TILE_COLOR = {
    [TILE.WATER]: '#3a7bd5', [TILE.SAND]: '#e8d8a0', [TILE.GRASS]: '#7cc860', [TILE.TALL]: '#4fa04a',
    [TILE.TREE]: '#2f7a3a', [TILE.ROCK]: '#a89a84', [TILE.BOULDER]: '#a89a84', [TILE.PATH]: '#d9c08c',
    [TILE.TOWN]: '#cfc6b4', [TILE.BUILDING]: '#cfc6b4', [TILE.DOOR_CENTER]: '#cfc6b4', [TILE.DOOR_GYM]: '#cfc6b4', [TILE.DOOR_MART]: '#cfc6b4', [TILE.DOOR_LEAGUE]: '#cfc6b4',
    [TILE.BRIDGE]: '#a0703c',
  };

  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function valueNoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function fbm(x, y, seed) {
    let v = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < 4; o++) {
      v += amp * valueNoise(x * f, y * f, seed + o * 101);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return v / norm;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shadeHex(hex, amt) {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const out = c.map(v => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  }

  class World {
    // regionId: 1 = Kanto, 2 = Johto (see PG.REGIONS).
    constructor(regionId = 1) {
      this.region = PG.REGIONS[regionId];
      this.gyms = this.region.gyms;
      this.seed = this.region.seed;
      const seed = this.seed;
      this.W = this.region.mapW;
      this.H = this.region.mapH;
      this.tiles = new Uint8Array(this.W * this.H);
      this.biome = new Array(this.W * this.H);
      this.buildings = [];
      this.gymSpots = [];
      this.center = { x: Math.floor(this.W / 2), y: Math.floor(this.H / 2) };
      this.roamers = [];
      this.player = { x: 0, y: 0, dir: 'down', walk: 0, immune: 0, lastTile: -1, onDoor: false };
      this.rng = mulberry32(seed ^ 0x9e3779b9);
      this.spawnRng = Math.random;
      this.generate();
      this.minimap = this.renderMinimap();
      // street lamps beside every building door (purely decorative)
      this.lamps = [];
      for (const b of this.buildings) for (const dx of [-1.4, 1.4]) {
        const lx = (b.doorX + 0.5 + dx) * T, ly = (b.doorY + 1.15) * T;
        if (this.tile(Math.floor(lx / T), Math.floor(ly / T)) === TILE.TOWN) this.lamps.push({ x: lx, y: ly });
      }
      this.puffs = [];   // footstep dust / grass rustle
      this.stepT = 0;
    }

    idx(x, y) { return y * this.W + x; }
    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
    tile(x, y) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : TILE.TREE; }
    setTile(x, y, t) { if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = t; }

    generate() {
      const s = this.seed;
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          const e = fbm(x / 22, y / 22, s);
          const m = fbm(x / 18, y / 18, s + 500);
          const d = fbm(x / 4, y / 4, s + 900);
          let t, b;
          if (e < 0.33) { t = TILE.WATER; b = 'water'; }
          else if (e < 0.38) { t = TILE.SAND; b = 'sand'; }
          else if (e > 0.66) { t = d > 0.68 ? TILE.BOULDER : TILE.ROCK; b = 'rock'; }
          else if (m > 0.54) { t = d > 0.52 ? TILE.TREE : TILE.TALL; b = 'forest'; }
          else { t = d > 0.64 ? TILE.TALL : TILE.GRASS; b = 'grass'; }
          // Border of trees so the player can't leave the map.
          if (x < 2 || y < 2 || x >= this.W - 2 || y >= this.H - 2) t = TILE.TREE;
          this.tiles[this.idx(x, y)] = t;
          this.biome[this.idx(x, y)] = b;
        }
      }

      const c = this.center;
      this.makeTown(c.x, c.y, 16, 11, null);
      this.player.x = (c.x + 0.5) * T;
      this.player.y = (c.y + 3.5) * T;

      // Gym towns spiral outward from home: each one is farther away (tougher wild Pokémon) than the last.
      // Positions are fractions of the map so they scale with the map size.
      const gymPositions = (this.region.id === 1
        ? [[0.62, 0.44], [0.40, 0.31], [0.29, 0.62], [0.68, 0.74], [0.56, 0.10], [0.84, 0.46], [0.14, 0.80], [0.89, 0.875]]
        : this.spiralPositions(this.gyms.length))
        .map(([fx, fy]) => ({ x: Math.round(fx * this.W), y: Math.round(fy * this.H) }));
      let prev = c;
      this.gyms.forEach((g, i) => {
        const p = gymPositions[i];
        this.carvePath(c.x, c.y, p.x, p.y);
        if (i > 0) this.carvePath(prev.x, prev.y, p.x, p.y); // a route on from the previous gym
        this.makeTown(p.x, p.y, 14, 11, i);
        prev = p;
      });
      // The League town (Indigo Plateau / Silver Town), far to the north-west.
      this.league = this.region.id === 1 ? { x: Math.round(0.13 * this.W), y: Math.round(0.15 * this.H) } : { x: Math.round(0.09 * this.W), y: Math.round(0.08 * this.H) };
      this.carvePath(c.x, c.y, this.league.x, this.league.y);
      this.carvePath(prev.x, prev.y, this.league.x, this.league.y);
      this.makeTown(this.league.x, this.league.y, 16, 11, null, 'league');
      // A few extra trails into the wilderness so every biome is reachable.
      const trailTargets = [[0.5, 0.94], [0.09, 0.5], [0.5, 0.05], [0.95, 0.19], [0.91, 0.62], [0.27, 0.94]];
      for (const [fx, fy] of trailTargets) this.carvePath(c.x, c.y, Math.round(fx * this.W), Math.round(fy * this.H), true);
      this.computeWaterDepth();
    }

    // Town spots for many gyms: a widening spiral around the centre, pushed apart so towns never overlap
    // and kept clear of the League corner. Deterministic for a given map.
    spiralPositions(n) {
      const out = [], rng = mulberry32(this.seed ^ 0x51ed);
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / n;
        let a = i * 2.39996 + 0.6, r = 0.14 + k * 0.33, p, tries = 0;
        do {
          p = [0.5 + Math.cos(a) * r * 1.0, 0.5 + Math.sin(a) * r * 0.95];
          p[0] = Math.min(0.93, Math.max(0.07, p[0])); p[1] = Math.min(0.92, Math.max(0.08, p[1]));
          a += 0.35; r = Math.min(0.46, r + 0.01 * rng());
        } while (tries++ < 60 && (out.some(q => Math.abs(q[0] - p[0]) * this.W < 22 && Math.abs(q[1] - p[1]) * this.H < 17) ||
          (Math.abs(p[0] - 0.5) * this.W < 22 && Math.abs(p[1] - 0.5) * this.H < 17) || (p[0] < 0.22 && p[1] < 0.2)));
        out.push(p);
      }
      return out;
    }

    // Distance (in tiles, capped at 3) from each water tile to the nearest land; used for shallow/deep shading.
    computeWaterDepth() {
      this.depth = new Uint8Array(this.W * this.H);
      for (let y = 0; y < this.H; y++) {
        for (let x = 0; x < this.W; x++) {
          if (this.tile(x, y) !== TILE.WATER) continue;
          let d = 3;
          for (let r = 1; r < 3 && d === 3; r++) {
            for (let oy = -r; oy <= r && d === 3; oy++) {
              for (let ox = -r; ox <= r; ox++) {
                const t = this.tile(x + ox, y + oy);
                if (t !== TILE.WATER && t !== TILE.BRIDGE) { d = r; break; }
              }
            }
          }
          this.depth[this.idx(x, y)] = d;
        }
      }
    }

    // Name of the area the player is standing in, for the HUD.
    areaName(tx, ty) {
      const town = this.towns.find(t => Math.abs(tx - t.x) <= t.w / 2 + 1 && Math.abs(ty - t.y) <= t.h / 2 + 1);
      if (town) return { name: town.name, level: null };
      const biome = this.biome[this.idx(tx, ty)];
      const label = { grass: 'Meadow', forest: 'Forest', sand: 'Beach', rock: 'Mountains', water: 'Lakeside' }[biome] || 'Route';
      return { name: label, level: this.zoneLevel(tx, ty) };
    }

    // special: 'league' builds Indigo Plateau (Poké Center, Mart and the League hall).
    makeTown(cx, cy, w, h, gymIndex, special) {
      this.towns = this.towns || [];
      this.towns.push({ x: cx, y: cy, w, h, name: special === 'league' ? this.region.leagueTown : gymIndex === null ? this.region.home : this.gyms[gymIndex].city });
      const x0 = cx - Math.floor(w / 2), y0 = cy - Math.floor(h / 2);
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          if (x < 2 || y < 2 || x >= this.W - 2 || y >= this.H - 2) continue;
          this.setTile(x, y, TILE.TOWN);
          this.biome[this.idx(x, y)] = 'town';
        }
      }
      // Poke Center (left of center), gym (right of center) if this is a gym town.
      if (special === 'league') {
        this.placeBuilding(cx - 7, cy - 4, 4, 3, 'center', null);
        this.placeBuilding(cx - 7, cy + 1, 4, 3, 'mart', null);
        this.placeBuilding(cx, cy - 4, 6, 4, 'league', null);
        return;
      }
      const pcX = gymIndex === null ? cx - 2 : cx - 6;
      this.placeBuilding(pcX, cy - 4, 4, 3, 'center', null);
      if (gymIndex === null) this.placeBuilding(cx + 3, cy - 4, 4, 3, 'mart', null);
      else this.placeBuilding(cx - 6, cy + 1, 4, 3, 'mart', null);
      if (gymIndex !== null) {
        this.placeBuilding(cx + 1, cy - 4, 5, 4, 'gym', gymIndex);
        this.gymSpots[gymIndex] = { x: cx + 3, y: cy };
      }
    }

    placeBuilding(x, y, w, h, kind, gymIndex) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.setTile(xx, yy, TILE.BUILDING);
      const doorX = x + Math.floor(w / 2), doorY = y + h - 1;
      this.setTile(doorX, doorY, { gym: TILE.DOOR_GYM, center: TILE.DOOR_CENTER, mart: TILE.DOOR_MART, league: TILE.DOOR_LEAGUE }[kind]);
      this.buildings.push({ x, y, w, h, kind, gymIndex, doorX, doorY });
    }

    // Wobbly 2-wide path; water becomes bridge.
    carvePath(x0, y0, x1, y1, trail) {
      let x = x0, y = y0;
      const rng = this.rng;
      let guard = 0;
      while ((x !== x1 || y !== y1) && guard++ < 2000) {
        const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
        if (dx && (!dy || rng() < Math.abs(x1 - x) / (Math.abs(x1 - x) + Math.abs(y1 - y)))) x += dx;
        else y += dy;
        if (rng() < 0.15) { x += rng() < 0.5 ? -1 : 1; x = Math.max(3, Math.min(this.W - 4, x)); }
        for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const tx = x + ox, ty = y + oy;
          if (!this.inBounds(tx, ty) || tx < 2 || ty < 2 || tx >= this.W - 2 || ty >= this.H - 2) continue;
          const cur = this.tile(tx, ty);
          if (cur === TILE.TOWN || cur === TILE.BUILDING || DOORS.has(cur)) continue;
          if (cur === TILE.WATER) this.setTile(tx, ty, TILE.BRIDGE);
          else if (trail && (cur === TILE.GRASS || cur === TILE.TALL || cur === TILE.SAND || cur === TILE.ROCK)) continue;
          else this.setTile(tx, ty, TILE.PATH);
        }
      }
    }

    // Wild level grows with distance from the starting town.
    zoneLevel(tx, ty) {
      const d = Math.hypot(tx - this.center.x, ty - this.center.y);
      if (this.region.id === 1) return Math.max(2, Math.min(this.region.maxZone, Math.round(2 + d * 0.5)));
      // Johto: wild levels follow the nearest gym, so the area around each gym suits that gym's challenge.
      let best = null, bd = Infinity;
      this.gymSpots.forEach((g, i) => { const dd = Math.hypot(tx - g.x, ty - g.y); if (dd < bd) { bd = dd; best = i; } });
      if (best === null) return Math.max(2, Math.round(2 + d * 0.3));
      const team = this.gyms[best].team, gymLv = team.reduce((a, [, l]) => a + l, 0) / team.length - 3;
      return Math.max(2, Math.min(this.region.maxZone, Math.round(3 + (gymLv - 3) * (d / (d + bd + 0.001)))));
    }

    // swim: a party Pokémon knows Swim, so open water can be crossed.
    walkable(tx, ty, swim) {
      const t = this.tile(tx, ty);
      return (swim && t === TILE.WATER) || !BLOCKED.has(t);
    }

    collides(px, py, r, swim) {
      const x0 = Math.floor((px - r) / T), x1 = Math.floor((px + r) / T);
      const y0 = Math.floor((py - r) / T), y1 = Math.floor((py + r) / T);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.walkable(x, y, swim)) return true;
      return false;
    }

    pickWildSpecies(biome, level) {
      let b = biome;
      if (b === 'sand' && this.spawnRng() < 0.5) b = 'water';
      if (b === 'town') return null;
      const pool = [];
      for (const [id, s] of Object.entries(SPECIES)) {
        if ((s.region || 1) !== this.region.id || !s.habitat.includes(b) || (s.minLv || 1) > level) continue;
        pool.push({ id, w: s.legendary ? 0.004 : s.rare ? 0.12 : 1 }); // legendaries: roughly 1 in a few hundred spawns
      }
      if (!pool.length) return null;
      let total = pool.reduce((a, p) => a + p.w, 0);
      let r = this.spawnRng() * total;
      let id = pool[pool.length - 1].id;
      for (const p of pool) { r -= p.w; if (r <= 0) { id = p.id; break; } }
      // Evolve if the wild level is past the evolution level.
      // (only into species of this region: a wild Pichu in Johto stays a Pichu)
      while (SPECIES[id].evolves && level >= SPECIES[id].evolves.level && (SPECIES[SPECIES[id].evolves.into].region || 1) === this.region.id) id = SPECIES[id].evolves.into;
      return id;
    }

    // biome: override the tile's biome (e.g. 'ocean' while swimming).
    makeWild(tx, ty, biome) {
      biome = biome || this.biome[this.idx(tx, ty)];
      const level = Math.max(2, this.zoneLevel(tx, ty) + Math.floor(this.spawnRng() * 5) - 2);
      const id = this.pickWildSpecies(biome, level);
      if (!id) return null;
      // legendaries are always formidable, wherever they turn up: Lv 95-100
      const [lo, hi] = CONFIG.LEGENDARY_LEVEL;
      return new PG.Pokemon(id, SPECIES[id].legendary ? lo + Math.floor(this.spawnRng() * (hi - lo + 1)) : level);
    }

    spawnRoamers() {
      const p = this.player;
      const ptx = p.x / T, pty = p.y / T;
      this.roamers = this.roamers.filter(r => Math.hypot(r.x / T - ptx, r.y / T - pty) < 26);
      let attempts = 0;
      while (this.roamers.length < 14 && attempts++ < 40) {
        const ang = this.spawnRng() * Math.PI * 2;
        const dist = 9 + this.spawnRng() * 10;
        const tx = Math.floor(ptx + Math.cos(ang) * dist), ty = Math.floor(pty + Math.sin(ang) * dist);
        if (!this.inBounds(tx, ty) || !this.walkable(tx, ty)) continue;
        const t = this.tile(tx, ty);
        if (t === TILE.TOWN || t === TILE.PATH || t === TILE.BRIDGE || DOORS.has(t)) continue;
        const mon = this.makeWild(tx, ty);
        if (!mon) continue;
        this.roamers.push({ mon, x: (tx + 0.5) * T, y: (ty + 0.5) * T, vx: 0, vy: 0, timer: 0, bob: this.spawnRng() * 6 });
      }
    }

    update(dt, game) {
      const p = this.player;
      p.immune = Math.max(0, p.immune - dt);
      const a = PG.Input.axis();
      const swim = game.canSwim();
      if (p.swimming) p.biking = false;
      const speed = p.swimming ? 140 : p.biking ? 300 : 165;
      p.moving = !!(a.x || a.y);
      if (a.x || a.y) {
        const nx = p.x + a.x * speed * dt;
        if (!this.collides(nx, p.y, 11, swim)) p.x = nx;
        // bumping into water without a swimmer: say how to get across
        else if (!swim && this.tile(Math.floor((nx + a.x * 12) / T), Math.floor(p.y / T)) === TILE.WATER) this.waterHint(game);
        const ny = p.y + a.y * speed * dt;
        if (!this.collides(p.x, ny, 11, swim)) p.y = ny;
        else if (!swim && this.tile(Math.floor(p.x / T), Math.floor((ny + a.y * 12) / T)) === TILE.WATER) this.waterHint(game);
        p.walk += dt * (p.biking ? 14 : 10);
        this.stepT -= dt;
        if (this.stepT <= 0) {
          this.stepT = p.biking ? 0.07 : 0.14;
          const gt = this.tile(Math.floor(p.x / T), Math.floor((p.y + 10) / T));
          if (gt === TILE.PATH || gt === TILE.SAND || gt === TILE.ROCK) this.puffs.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y + 11, vx: -a.x * 20, vy: -6, t: 0.5, max: 0.5, kind: 'dust', col: gt === TILE.SAND ? '#e8d6a0' : '#d8c49a' });
          if (gt === TILE.TALL) for (let i = 0; i < 2; i++) this.puffs.push({ x: p.x + (Math.random() - 0.5) * 14, y: p.y + 4, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 30, t: 0.6, max: 0.6, kind: 'leaf', col: Math.random() < 0.5 ? '#4c9f45' : '#79c55e' });
        }
        if (Math.abs(a.x) > Math.abs(a.y)) p.dir = a.x > 0 ? 'right' : 'left';
        else p.dir = a.y > 0 ? 'down' : 'up';
      }

      const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
      const tIdx = this.idx(tx, ty);
      const t = this.tile(tx, ty);
      p.swimming = t === TILE.WATER;
      this.hintT = Math.max(0, (this.hintT || 0) - dt);
      if (p.swimming) this.swimmer = game.swimmer();

      // Buildings: step onto the door to use it.
      if (DOORS.has(t)) {
        if (!p.onDoor) {
          p.onDoor = true;
          p.y = (ty + 1.5) * T; // step back out so it doesn't retrigger
          if (t === TILE.DOOR_CENTER) game.enterBuilding('center');
          else if (t === TILE.DOOR_MART) game.enterBuilding('mart');
          else if (t === TILE.DOOR_LEAGUE) game.openLeague();
          else {
            const b = this.buildings.find(b => b.doorX === tx && b.doorY === ty);
            game.enterGym(b.gymIndex);
          }
          return;
        }
      } else p.onDoor = false;

      // Tall grass hidden encounters.
      if (tIdx !== p.lastTile) {
        p.lastTile = tIdx;
        // out on open water: ocean Pokémon
        if (t === TILE.WATER && p.immune <= 0 && Math.random() < 0.06) {
          const mon = this.makeWild(tx, ty, 'ocean');
          if (mon) { game.startWildBattle(mon, null); return; }
        }
        if (t === TILE.TALL && p.immune <= 0 && Math.random() < 0.05) {
          const mon = this.makeWild(tx, ty);
          if (mon) { game.startWildBattle(mon, null); return; }
        }
      }

      this.spawnRoamers();
      for (const r of this.roamers) {
        r.timer -= dt;
        r.bob += dt * 4;
        if (r.timer <= 0) {
          r.timer = 1 + Math.random() * 2.5;
          if (Math.random() < 0.35) { r.vx = 0; r.vy = 0; }
          else {
            const ang = Math.random() * Math.PI * 2;
            r.vx = Math.cos(ang) * 50; r.vy = Math.sin(ang) * 50;
          }
        }
        const nx = r.x + r.vx * dt, ny = r.y + r.vy * dt;
        const ntx = Math.floor(nx / T), nty = Math.floor(ny / T);
        const nt = this.tile(ntx, nty);
        if (this.walkable(ntx, nty) && nt !== TILE.TOWN && nt !== TILE.PATH) { r.x = nx; r.y = ny; }
        else r.timer = 0;
        if (p.immune <= 0 && Math.hypot(r.x - p.x, r.y - p.y) < 26) {
          this.roamers = this.roamers.filter(o => o !== r);
          game.startWildBattle(r.mon, r);
          return;
        }
      }
    }

    // ---------- rendering ----------
    draw(ctx, vw, vh, time) {
      this.view25 = PG.VIEW.d25;
      if (this.view25) return this.draw25(ctx, vw, vh, time);
      const p = this.player;
      const camX = Math.round(Math.max(0, Math.min(this.W * T - vw, p.x - vw / 2)));
      const camY = Math.round(Math.max(0, Math.min(this.H * T - vh, p.y - vh / 2)));
      this.cam = { x: camX, y: camY };
      const x0 = Math.max(0, Math.floor(camX / T) - 1), y0 = Math.max(0, Math.floor(camY / T) - 1);
      const x1 = Math.min(this.W - 1, Math.ceil((camX + vw) / T)), y1 = Math.min(this.H - 1, Math.ceil((camY + vh) / T) + 1);

      ctx.save();
      ctx.translate(-camX, -camY);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) this.drawGround(ctx, x, y, time);
      }

      // Everything with height is depth-sorted by its base y.
      const ents = [];
      for (let y = y0; y <= y1 + 1 && y < this.H; y++) {
        for (let x = x0; x <= x1; x++) {
          if (this.tile(x, y) === TILE.TREE) ents.push({ y: (y + 1) * T, draw: () => this.drawTree(ctx, x, y, time) });
        }
      }
      for (const b of this.buildings) {
        if ((b.x + b.w) * T < camX - 40 || b.x * T > camX + vw + 40 || (b.y + b.h) * T < camY - 40 || b.y * T > camY + vh + 80) continue;
        ents.push({ y: (b.y + b.h) * T, draw: () => this.drawBuilding(ctx, b) });
      }
      const tod = PG.timeOfDay(time);
      for (const l of this.lamps) {
        if (l.x < camX - 40 || l.x > camX + vw + 40 || l.y < camY - 80 || l.y > camY + vh + 40) continue;
        ents.push({ y: l.y + 4, draw: () => this.drawLamp(ctx, l.x, l.y, tod.dark) });
      }
      for (const r of this.roamers) ents.push({ y: r.y + 12, draw: () => this.drawRoamer(ctx, r, time) });
      ents.push({ y: p.y + 12, draw: () => (p.swimming ? this.drawSwimmer(ctx, time) : this.drawPlayer(ctx, time)) });
      ents.sort((a, b) => a.y - b.y);
      for (const e of ents) e.draw();

      this.drawPuffs(ctx, time);
      this.drawCritters(ctx, camX, camY, vw, vh, time, tod);
      this.drawClouds(ctx, camX, camY, vw, vh, time);
      ctx.restore();
      this.drawLighting(ctx, camX, camY, vw, vh, time, tod);
    }

    // ---------- 2.5D view ----------
    // The ground is a tilted plane: rows further away shrink toward a horizon above the screen and are
    // foreshortened. Trees, buildings, lamps and characters stand upright on it, scaled by distance.
    // Gameplay is unchanged: everything still lives on the same flat tile map.
    setupView(vw, vh) {
      const Ys = vh * 0.6, Yh = -1.63 * Ys, Hgt = Ys - Yh, D = Hgt / 0.72;   // 0.72 = ground squash at the player
      const sTop = -Yh / Hgt, sBot = (vh - Yh) / Hgt;
      const ahead = D * (1 / sTop - 1), behind = D * (1 - 1 / sBot);
      const p = this.player, half = vw / 2;
      const fx = Math.max(half, Math.min(this.W * T - half, p.x));
      const fz = Math.max(ahead * 0.55, Math.min(this.H * T - behind, p.y));
      this.view = { vw, vh, Yh, Hgt, D, fx, fz, sTop, ahead, behind };
    }

    // World point on the ground -> screen position and scale.
    project(wx, wy) {
      const v = this.view, s = v.D / (v.D + v.fz - wy);
      return { x: v.vw / 2 + (wx - v.fx) * s, y: v.Yh + v.Hgt * s, s };
    }

    // Screen position (and scale) of a world point, in whichever view is active. hgt lifts it off the ground.
    toScreen(wx, wy, hgt = 0) {
      if (!this.view25) return { x: wx - this.cam.x, y: wy - hgt - this.cam.y, s: 1 };
      const p = this.project(wx, wy); p.y -= hgt * p.s; return p;
    }

    // Run draw() so that world point (x, y) lands on its projected spot, standing upright and scaled.
    standAt(ctx, x, y, draw) {
      if (!this.view25) return draw();
      const pr = this.project(x, y);
      if (pr.s <= 0) return;
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.scale(pr.s, pr.s); ctx.translate(-x, -y); draw(); ctx.restore();
    }

    // One cached canvas of flat ground. Chunks with water or tall grass are refreshed a few times a second.
    groundChunk(cx, cy, time) {
      const chunks = this.chunks || (this.chunks = new Map());
      const key = cx + ',' + cy;
      let c = chunks.get(key);
      if (c) { chunks.delete(key); chunks.set(key, c); }   // keep the map in least-recently-used order
      else {
        c = { cv: document.createElement('canvas'), t: -1, anim: false };
        c.cv.width = c.cv.height = CHUNK * T;
        chunks.set(key, c);
        if (chunks.size > 72) chunks.delete(chunks.keys().next().value);
      }
      if (c.t < 0 || (c.anim && time - c.t > 0.25 && this.chunkBudget-- > 0)) {
        const g = c.cv.getContext('2d'), C = CHUNK * T;
        g.save(); g.translate(-cx * C, -cy * C);
        this.noBoulders = true;   // boulders stand up as their own objects
        let anim = false;
        for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++) for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
          this.drawGround(g, x, y, time);
          const t = this.tile(x, y);
          if (t === TILE.WATER || t === TILE.BRIDGE || t === TILE.TALL) anim = true;
        }
        this.noBoulders = false;
        g.restore();
        c.anim = anim; c.t = time;
      }
      return c.cv;
    }

    draw25(ctx, vw, vh, time) {
      this.setupView(vw, vh);
      const v = this.view, p = this.player;
      const halfTop = vw / 2 / v.sTop + T;
      const gx0 = Math.floor((v.fx - halfTop) / T) * T, gx1 = Math.ceil((v.fx + halfTop) / T) * T;
      const gy0 = Math.floor((v.fz - v.ahead) / T - 1) * T, gy1 = Math.ceil((v.fz + v.behind) / T + 1) * T;
      this.cam = { x: gx0, y: gy0 };

      // flat ground, composed from cached chunks...
      const G = this.groundCanvas || (this.groundCanvas = document.createElement('canvas'));
      if (G.width < gx1 - gx0 || G.height < gy1 - gy0) { G.width = Math.max(G.width, gx1 - gx0); G.height = Math.max(G.height, gy1 - gy0); }
      const g = G.getContext('2d'), C = CHUNK * T;
      this.chunkBudget = 3;
      for (let cy = Math.floor(gy0 / C); cy <= Math.floor((gy1 - 1) / C); cy++)
        for (let cx = Math.floor(gx0 / C); cx <= Math.floor((gx1 - 1) / C); cx++)
          g.drawImage(this.groundChunk(cx, cy, time), cx * C - gx0, cy * C - gy0);
      // ...painted onto the screen as a tilted plane, a thin band of rows at a time
      const band = 2;
      for (let sy = 0; sy < vh; sy += band) {
        const s0 = (sy - v.Yh) / v.Hgt, s1 = (sy + band - v.Yh) / v.Hgt;
        const w0 = v.fz + v.D - v.D / s0, w1 = v.fz + v.D - v.D / s1, half = vw / (s0 + s1);
        ctx.drawImage(G, v.fx - half - gx0, w0 - gy0, half * 2, w1 - w0, 0, sy, vw, band + 0.6);
      }

      // everything with height stands up, sorted far to near
      const ents = [];
      const onScreen = (ax, ay, w, h) => { const pr = this.project(ax, ay); return pr.s > 0 && pr.x > -w * pr.s && pr.x < vw + w * pr.s && pr.y > -8 && pr.y - h * pr.s < vh; };
      for (let y = gy0 / T; y < gy1 / T + 2; y++) {
        for (let x = gx0 / T; x < gx1 / T; x++) {
          const t = this.tile(x, y);
          if (t !== TILE.TREE && t !== TILE.BOULDER) continue;
          const ax = (x + 0.5) * T, ay = (y + 1) * T;
          if (!onScreen(ax, ay, 40, 70)) continue;
          ents.push({ ax, ay, draw: t === TILE.TREE ? () => this.drawTree(ctx, x, y, time) : () => this.drawBoulder(ctx, x * T, y * T, this.variant(x, y)) });
        }
      }
      for (const b of this.buildings) {
        const ax = (b.x + b.w / 2) * T, ay = (b.y + b.h) * T;
        if (onScreen(ax, ay, b.w * T, b.h * T + 20)) ents.push({ ax, ay, draw: () => this.drawBuilding(ctx, b) });
      }
      const tod = PG.timeOfDay(time);
      for (const l of this.lamps) if (onScreen(l.x, l.y, 20, 45)) ents.push({ ax: l.x, ay: l.y + 3, draw: () => this.drawLamp(ctx, l.x, l.y, tod.dark) });
      for (const r of this.roamers) if (onScreen(r.x, r.y, 60, 80)) ents.push({ ax: r.x, ay: r.y + 8, draw: () => this.drawRoamer(ctx, r, time) });
      ents.push({ ax: p.x, ay: p.y + 12, draw: () => (p.swimming ? this.drawSwimmer(ctx, time) : this.drawPlayer(ctx, time)) });
      ents.sort((a, b) => a.ay - b.ay);
      for (const e of ents) this.standAt(ctx, e.ax, e.ay, e.draw);

      this.drawPuffs(ctx, time);
      this.drawCritters(ctx, gx0, gy0, gx1 - gx0, gy1 - gy0, time, tod);
      this.drawClouds(ctx, gx0, gy0, gx1 - gx0, gy1 - gy0, time);
      // distance haze: the far rows fade into the sky
      const hz = ctx.createLinearGradient(0, 0, 0, vh * 0.32);
      hz.addColorStop(0, `rgba(205,228,250,${0.42 * (1 - tod.dark)})`); hz.addColorStop(1, 'rgba(205,228,250,0)');
      ctx.fillStyle = hz; ctx.fillRect(0, 0, vw, vh * 0.32);
      this.drawLighting(ctx, gx0, gy0, vw, vh, time, tod);
    }

    // ---------- atmosphere ----------
    drawLamp(ctx, x, y, dark) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b3f4a'; ctx.fillRect(x - 1.5, y - 30, 3, 33);
      ctx.fillRect(x - 4, y + 1, 8, 3);
      ctx.fillStyle = '#2b2e36'; roundRect(ctx, x - 5, y - 38, 10, 9, 2); ctx.fill();
      ctx.fillStyle = dark > 0.12 ? '#ffe9a0' : '#d9e3ee'; ctx.fillRect(x - 3.5, y - 36.5, 7, 6);
    }

    drawPuffs(ctx, time) {
      const dt = Math.min(0.05, time - (this.lastFxTime ?? time)); this.lastFxTime = time;
      for (const f of this.puffs) {
        f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.kind === 'leaf') f.vy += 160 * dt;
        const k = Math.max(0, f.t / f.max);
        this.standAt(ctx, f.x, f.y, () => {
          ctx.globalAlpha = k * 0.8;
          ctx.fillStyle = f.col;
          if (f.kind === 'dust') { ctx.beginPath(); ctx.arc(f.x, f.y, 3 + (1 - k) * 5, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(time * 8 + f.x); ctx.fillRect(-2.5, -1, 5, 2); ctx.restore(); }
        });
      }
      ctx.globalAlpha = 1;
      this.puffs = this.puffs.filter(f => f.t > 0);
    }

    // Butterflies over meadows, falling leaves in forests, fireflies at night. Stateless: each
    // ~6x6-tile cell may own one critter whose path is a function of time, so nothing needs updating.
    drawCritters(ctx, camX, camY, vw, vh, time, tod) {
      const C = 6 * T;
      const cx0 = Math.floor(camX / C) - 1, cy0 = Math.floor(camY / C) - 1;
      const cx1 = Math.floor((camX + vw) / C) + 1, cy1 = Math.floor((camY + vh) / C) + 1;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const h = hash2(cx, cy, 31);
        if (h < 0.35) continue;
        const bx = (cx + 0.2 + hash2(cx, cy, 5) * 0.6) * C, by = (cy + 0.2 + hash2(cx, cy, 9) * 0.6) * C;
        const tx = Math.floor(bx / T), ty = Math.floor(by / T);
        if (!this.inBounds(tx, ty)) continue;
        const biome = this.biome[this.idx(tx, ty)], tile = this.tile(tx, ty);
        if (tile === TILE.WATER || biome === 'town') continue;
        const ph = h * 100;
        if (tod.dark > 0.2) {
          // fireflies
          for (let i = 0; i < 3; i++) {
            const x = bx + Math.sin(time * 0.7 + ph + i * 2) * 40 + Math.sin(time * 1.9 + i) * 10, y = by + Math.cos(time * 0.6 + ph + i) * 30;
            const a = (0.5 + 0.5 * Math.sin(time * 3 + ph + i * 1.7)) * Math.min(1, tod.dark * 2);
            this.standAt(ctx, x, y + 20, () => {
              const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
              g.addColorStop(0, `rgba(230,255,140,${a})`); g.addColorStop(1, 'rgba(230,255,140,0)');
              ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
            });
          }
        } else if (biome === 'forest' && h > 0.55) {
          // a falling leaf drifting down through the cell
          const k = ((time * 0.12 + h) % 1);
          const x = bx + Math.sin(time * 1.5 + ph) * 18, y = by - 60 + k * 140;
          this.standAt(ctx, x, by + 80, () => {
            ctx.globalAlpha = Math.min(1, (1 - k) * 3) * 0.9;
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 2 + ph));
            ctx.fillStyle = h > 0.8 ? '#d9822b' : '#c9a227'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); ctx.globalAlpha = 1;
          });
        } else if (biome === 'grass' || biome === 'water') {
          // butterfly: lazy figure-of-eight with flapping wings
          const x = bx + Math.sin(time * 0.5 + ph) * 50, y = by + Math.sin(time * 1.0 + ph) * 22 - 14;
          const flap = Math.abs(Math.sin(time * 14 + ph)) * 4 + 1;
          const col = ['#ffd23f', '#ff9ec7', '#ffffff', '#9fd0ff'][Math.floor(h * 40) % 4];
          this.standAt(ctx, x, y + 18, () => {
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(x, y + 18, 3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.ellipse(x - flap / 2 - 1, y, flap / 2 + 0.5, 3, -0.3, 0, Math.PI * 2); ctx.ellipse(x + flap / 2 + 1, y, flap / 2 + 0.5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#333'; ctx.fillRect(x - 0.5, y - 2.5, 1, 5);
          });
        }
      }
    }

    // Time-of-day overlay: tinted darkness with holes cut out for lights (you, doors, lamps).
    drawLighting(ctx, camX, camY, vw, vh, time, tod) {
      if (tod.warm > 0.01) {
        ctx.fillStyle = `rgba(255,140,60,${tod.warm})`;
        ctx.globalCompositeOperation = 'soft-light'; ctx.fillRect(0, 0, vw, vh);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (tod.dark < 0.02) return;
      const lc = this.lightCanvas || (this.lightCanvas = document.createElement('canvas'));
      const W = Math.ceil(vw / 2), H = Math.ceil(vh / 2); // half resolution is plenty for soft light
      if (lc.width !== W || lc.height !== H) { lc.width = W; lc.height = H; }
      const g = lc.getContext('2d');
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);
      g.fillStyle = `rgba(12,20,52,${tod.dark})`; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      const light = (wx, wy, r, a, hgt = 0) => {
        const sp = this.toScreen(wx, wy, hgt), x = sp.x / 2, y = sp.y / 2, rr = r * sp.s / 2;
        if (x < -rr || y < -rr || x > W + rr || y > H + rr) return;
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
      };
      const p = this.player;
      light(p.x, p.y + 12, 150, 0.85, 18);
      for (const l of this.lamps) light(l.x, l.y, 130, 0.9, 34);
      for (const b of this.buildings) light((b.doorX + 0.5) * T, (b.doorY + 0.6) * T, 90, 0.7);
      for (const r of this.roamers) if (r.mon.data.legendary) light(r.x, r.y + 8, 110, 0.8, 14);
      ctx.drawImage(lc, 0, 0, vw, vh);
      // warm glow around lamp heads
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lamps) {
        const sp = this.toScreen(l.x, l.y, 34), x = sp.x, y = sp.y, R = 40 * sp.s;
        if (sp.s <= 0 || x < -60 || y < -60 || x > vw + 60 || y > vh + 60) continue;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, `rgba(255,200,110,${0.5 * tod.dark})`); gr.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    variant(x, y) { return hash2(x, y, 7); }

    isGreen(t) { return t === TILE.GRASS || t === TILE.TALL || t === TILE.TREE; }

    drawGround(ctx, x, y, time) {
      const t = this.tile(x, y);
      const px = x * T, py = y * T;
      const h = this.variant(x, y);
      const biome = this.biome[this.idx(x, y)];
      switch (t) {
        case TILE.GRASS:
        case TILE.TREE: {
          const forest = biome === 'forest' || t === TILE.TREE;
          ctx.fillStyle = forest ? ['#74bb58', '#70b654', '#77be5b'][Math.floor(hash2(x >> 1, y >> 1, 3) * 3)] : ['#92d36b', '#8ccd66', '#95d66e'][Math.floor(hash2(x >> 1, y >> 1, 3) * 3)];
          ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
          if (h > 0.55) this.drawTuft(ctx, px + 4 + h * 18, py + 8 + (h * 97 % 1) * 16, forest ? '#5fa148' : '#73b955');
          if (h < 0.08 && !forest) this.drawFlower(ctx, px + 8 + h * 150, py + 10 + h * 120, ['#ff7aa2', '#ffd23f', '#ffffff', '#b89cff'][Math.floor(h * 50) % 4]);
          break;
        }
        case TILE.TALL:
          ctx.fillStyle = '#62ad4f';
          ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
          this.drawTallGrass(ctx, px, py, x, y, time, false);
          break;
        case TILE.SAND:
          ctx.fillStyle = ['#f2e2ab', '#efdea6', '#f4e5b0'][Math.floor(hash2(x >> 1, y >> 1, 4) * 3)];
          ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
          if (h > 0.6) { ctx.fillStyle = '#ddc88c'; ctx.fillRect(px + h * 24, py + (h * 31 % 1) * 24, 2, 2); ctx.fillRect(px + (h * 13 % 1) * 24, py + h * 20, 2, 2); }
          if (h < 0.04) this.drawShell(ctx, px + 16, py + 18);
          break;
        case TILE.ROCK:
        case TILE.BOULDER:
          ctx.fillStyle = ['#bcae94', '#b6a88e', '#b9ab91'][Math.floor(hash2(x >> 1, y >> 1, 6) * 3)];
          ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
          if (h > 0.7) {
            ctx.strokeStyle = '#9d8f76'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(px + 6, py + 10 + h * 8); ctx.lineTo(px + 14, py + 14 + h * 6); ctx.lineTo(px + 20, py + 12 + h * 10); ctx.stroke();
          }
          if (h < 0.25) { ctx.fillStyle = '#a2947b'; ctx.beginPath(); ctx.ellipse(px + 8 + h * 60, py + 22, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
          if (t === TILE.BOULDER && !this.noBoulders) this.drawBoulder(ctx, px, py, h);
          break;
        case TILE.PATH:
          this.drawPath(ctx, x, y, px, py, h);
          break;
        case TILE.TOWN:
        case TILE.BUILDING:
        case TILE.DOOR_CENTER:
        case TILE.DOOR_MART:
        case TILE.DOOR_GYM:
        case TILE.DOOR_LEAGUE:
          this.drawCobble(ctx, x, y, px, py, h);
          break;
        case TILE.WATER:
          this.drawWater(ctx, x, y, px, py, time);
          break;
        case TILE.BRIDGE:
          this.drawWater(ctx, x, y, px, py, time);
          this.drawBridge(ctx, x, y, px, py);
          break;
      }

      // Cliff face where high rock ground drops to lower terrain.
      if ((t === TILE.ROCK || t === TILE.BOULDER)) {
        const s = this.tile(x, y + 1);
        if (s !== TILE.ROCK && s !== TILE.BOULDER) {
          ctx.fillStyle = '#8d7d64'; ctx.fillRect(px, py + T - 9, T, 9);
          ctx.fillStyle = '#7a6b54'; ctx.fillRect(px, py + T - 3, T, 3);
          ctx.fillStyle = '#a3937a'; ctx.fillRect(px + 5 + h * 10, py + T - 8, 2, 4);
        }
      }
      // Earth bank where land meets water to the south.
      if (t !== TILE.WATER && t !== TILE.BRIDGE && this.tile(x, y + 1) === TILE.WATER) {
        ctx.fillStyle = t === TILE.SAND ? '#d9c487' : '#8f7148';
        ctx.fillRect(px, py + T - 5, T, 5);
      }
    }

    drawTuft(ctx, x, y, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y + 5); ctx.lineTo(x - 2, y);
      ctx.moveTo(x + 2, y + 5); ctx.lineTo(x + 2, y - 1);
      ctx.moveTo(x + 4, y + 5); ctx.lineTo(x + 6, y + 1);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    drawFlower(ctx, x, y, color) {
      x = Math.min(x, x - (x % T) + T - 6); y = Math.min(y, y - (y % T) + T - 6);
      ctx.fillStyle = color;
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, 1.8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f5b400';
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    }

    drawShell(ctx, x, y) {
      ctx.fillStyle = '#f7c6c0';
      ctx.beginPath(); ctx.arc(x, y, 4, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#d99a92'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 4); ctx.moveTo(x, y); ctx.lineTo(x - 3, y - 2); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 2); ctx.stroke();
    }

    drawBoulder(ctx, px, py, h) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(px + 17, py + 25, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8b7d68';
      ctx.beginPath(); ctx.ellipse(px + 16, py + 17, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a29380';
      ctx.beginPath(); ctx.ellipse(px + 14, py + 14, 9, 7, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c2b4a0';
      ctx.beginPath(); ctx.ellipse(px + 11, py + 11, 3.5, 2.2, -0.4, 0, Math.PI * 2); ctx.fill();
    }

    drawPath(ctx, x, y, px, py, h) {
      ctx.fillStyle = ['#e4cd98', '#e0c891', '#e2ca94'][Math.floor(hash2(x >> 1, y >> 1, 8) * 3)];
      ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
      if (h > 0.6) { ctx.fillStyle = '#c9b07c'; ctx.beginPath(); ctx.ellipse(px + h * 26, py + (h * 37 % 1) * 26, 2.5, 1.8, 0, 0, Math.PI * 2); ctx.fill(); }
      const soft = (tt) => tt !== TILE.PATH && tt !== TILE.BRIDGE && tt !== TILE.TOWN && !DOORS.has(tt) && tt !== TILE.BUILDING;
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (const [dx, dy] of dirs) {
        const nt = this.tile(x + dx, y + dy);
        if (!soft(nt)) continue;
        ctx.fillStyle = '#ccb17a';
        if (dy === -1) ctx.fillRect(px, py, T, 3);
        if (dy === 1) ctx.fillRect(px, py + T - 3, T, 3);
        if (dx === -1) ctx.fillRect(px, py, 3, T);
        if (dx === 1) ctx.fillRect(px + T - 3, py, 3, T);
        if (this.isGreen(nt)) {
          // grass creeping over the path edge
          ctx.fillStyle = '#86c962';
          for (let i = 0; i < 4; i++) {
            const k = 4 + i * 8 + ((h * 10 + i) % 3);
            ctx.beginPath();
            if (dy === -1) { ctx.moveTo(px + k - 3, py); ctx.lineTo(px + k, py + 5); ctx.lineTo(px + k + 3, py); }
            if (dy === 1) { ctx.moveTo(px + k - 3, py + T); ctx.lineTo(px + k, py + T - 5); ctx.lineTo(px + k + 3, py + T); }
            if (dx === -1) { ctx.moveTo(px, py + k - 3); ctx.lineTo(px + 5, py + k); ctx.lineTo(px, py + k + 3); }
            if (dx === 1) { ctx.moveTo(px + T, py + k - 3); ctx.lineTo(px + T - 5, py + k); ctx.lineTo(px + T, py + k + 3); }
            ctx.fill();
          }
        }
      }
    }

    drawCobble(ctx, x, y, px, py, h) {
      ctx.fillStyle = '#ddd6c6';
      ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
      ctx.strokeStyle = '#c9c0ac'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py + 16.5); ctx.lineTo(px + T, py + 16.5);
      ctx.moveTo(px, py + 0.5); ctx.lineTo(px + T, py + 0.5);
      const off = (y & 1) ? 8 : 0;
      ctx.moveTo(px + 8 + off + 0.5, py); ctx.lineTo(px + 8 + off + 0.5, py + 16);
      ctx.moveTo(px + 24 - off + 0.5, py + 16); ctx.lineTo(px + 24 - off + 0.5, py + T);
      ctx.stroke();
      if (h > 0.85) { ctx.fillStyle = '#e8e2d5'; ctx.fillRect(px + 2, py + 2, 10, 4); }
      // decorations on open town tiles
      if (this.tile(x, y) === TILE.TOWN && h < 0.035) this.drawFlowerPot(ctx, px + 16, py + 20);
    }

    drawFlowerPot(ctx, x, y) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b5653b'; ctx.fillRect(x - 6, y - 2, 12, 8);
      ctx.fillStyle = '#5aa84a'; ctx.beginPath(); ctx.arc(x, y - 4, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.arc(x - 2, y - 6, 2, 0, Math.PI * 2); ctx.arc(x + 3, y - 4, 2, 0, Math.PI * 2); ctx.fill();
    }

    drawWater(ctx, x, y, px, py, time) {
      const d = this.depth[this.idx(x, y)] || 1;
      ctx.fillStyle = d === 1 ? '#56aae8' : d === 2 ? '#4592d8' : '#3a7fc8';
      ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
      const w = Math.sin(time * 1.8 + x * 0.9 + y * 0.6);
      if (this.variant(x, y) > 0.5) {
        ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + 6 + w * 3, py + 14); ctx.quadraticCurveTo(px + 11 + w * 3, py + 11, px + 16 + w * 3, py + 14);
        ctx.stroke();
      }
      // little sun glints that twinkle on and off
      const gv = hash2(x, y, 13);
      if (gv > 0.78) {
        const tw = Math.pow(Math.max(0, Math.sin(time * 2.6 + gv * 40)), 6);
        if (tw > 0.05) {
          const gx = px + 6 + gv * 20, gy = py + 8 + (gv * 53 % 1) * 16;
          ctx.fillStyle = `rgba(255,255,255,${tw * 0.9})`;
          ctx.beginPath(); ctx.moveTo(gx, gy - 3); ctx.lineTo(gx + 1, gy); ctx.lineTo(gx, gy + 3); ctx.lineTo(gx - 1, gy); ctx.closePath(); ctx.fill();
          ctx.fillRect(gx - 3, gy - 0.5, 6, 1);
        }
      }
      // foam where water touches land
      const isLand = (tt) => tt !== TILE.WATER && tt !== TILE.BRIDGE;
      ctx.fillStyle = 'rgba(235,248,255,0.75)';
      const f = 3 + Math.sin(time * 2.4 + x + y) * 1.2;
      if (isLand(this.tile(x, y - 1))) ctx.fillRect(px, py, T, f);
      if (isLand(this.tile(x, y + 1))) ctx.fillRect(px, py + T - f, T, f);
      if (isLand(this.tile(x - 1, y))) ctx.fillRect(px, py, f, T);
      if (isLand(this.tile(x + 1, y))) ctx.fillRect(px + T - f, py, f, T);
    }

    drawBridge(ctx, x, y, px, py) {
      const vertical = this.tile(x, y - 1) === TILE.BRIDGE || this.tile(x, y + 1) === TILE.BRIDGE || this.tile(x, y - 1) === TILE.PATH;
      ctx.fillStyle = '#b07a43';
      ctx.fillRect(px, py, T + 1, T + 1); // +1 overlap hides seams when zoomed
      ctx.fillStyle = '#8c5a2c';
      for (let i = 0; i < 4; i++) {
        if (vertical) ctx.fillRect(px, py + i * 8 + 7, T, 1.5);
        else ctx.fillRect(px + i * 8 + 7, py, 1.5, T);
      }
      ctx.fillStyle = '#6d4420';
      if (vertical) {
        if (this.tile(x - 1, y) === TILE.WATER) ctx.fillRect(px, py, 3, T);
        if (this.tile(x + 1, y) === TILE.WATER) ctx.fillRect(px + T - 3, py, 3, T);
      } else {
        if (this.tile(x, y - 1) === TILE.WATER) ctx.fillRect(px, py, T, 3);
        if (this.tile(x, y + 1) === TILE.WATER) ctx.fillRect(px, py + T - 3, T, 3);
      }
    }

    // Blades of tall grass. front=true draws only the lower half (used over entities standing in it).
    drawTallGrass(ctx, px, py, x, y, time, front) {
      const cols = ['#3f8f3d', '#4c9f45', '#79c55e'];
      for (let row = front ? 1 : 0; row < 2; row++) {
        for (let i = 0; i < 4; i++) {
          const ox = 2 + i * 8 + (row ? 4 : 0);
          const base = py + (row ? T : T - 10);
          const sway = Math.sin(time * 2.2 + x * 0.8 + i + row) * 1.6;
          ctx.fillStyle = cols[(i + row + x) % 3];
          ctx.beginPath();
          ctx.moveTo(px + ox - 4, base);
          ctx.lineTo(px + ox + sway, base - 14);
          ctx.lineTo(px + ox + 4, base);
          ctx.fill();
        }
      }
    }

    drawTree(ctx, x, y, time = 0) {
      const py = y * T;
      const h = this.variant(x, y);
      const pine = this.biome[this.idx(x, y)] === 'rock' || h > 0.82;
      const sway = Math.sin(time * 1.1 + x * 0.7 + y * 0.4) * 1.3;
      const px = x * T;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(px + 17, py + T - 4, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b4526';
      ctx.fillRect(px + 13, py + 14, 6, T - 16);
      ctx.fillStyle = '#5a3a1f';
      ctx.fillRect(px + 16, py + 14, 3, T - 16);
      if (pine) {
        const layers = [[py - 18, 10], [py - 8, 14], [py + 4, 17]];
        layers.forEach(([ty, w], i) => {
          const tip = px + 16 + sway * (1.2 - i * 0.4);
          ctx.fillStyle = '#2d6b3c';
          ctx.beginPath(); ctx.moveTo(tip, ty - 4); ctx.lineTo(px + 16 - w, ty + 16); ctx.lineTo(px + 16 + w, ty + 16); ctx.fill();
          ctx.fillStyle = '#3d8550';
          ctx.beginPath(); ctx.moveTo(tip, ty - 4); ctx.lineTo(px + 16 - w, ty + 16); ctx.lineTo(px + 15, ty + 16); ctx.fill();
        });
      } else {
        const s = 0.9 + h * 0.25;
        // a few forest trees turn autumn colours
        const autumn = this.biome[this.idx(x, y)] === 'forest' && h > 0.7;
        const [c0, c1, c2] = autumn ? (h > 0.76 ? ['#b5532a', '#d9732f', '#f0a04b'] : ['#a8862a', '#c9a227', '#e8c75a']) : ['#2f7a3a', '#3b9046', '#58b05c'];
        const qx = px + sway;
        ctx.fillStyle = c0;
        ctx.beginPath(); ctx.arc(qx + 16, py + 2, 17 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(qx + 10, py - 3, 10 * s, 0, Math.PI * 2);
        ctx.arc(qx + 22, py - 1, 9 * s, 0, Math.PI * 2);
        ctx.arc(qx + 16, py - 9, 9 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(qx + 11, py - 9, 4.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath(); ctx.arc(qx + 21, py + 8, 9 * s, 0, Math.PI * 2); ctx.fill();
        if (h < 0.12) {
          ctx.fillStyle = '#e8463c';
          ctx.beginPath(); ctx.arc(px + 22, py + 4, 2.5, 0, Math.PI * 2); ctx.arc(px + 9, py + 6, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    drawBuilding(ctx, b) {
      const px = b.x * T, py = b.y * T, w = b.w * T, h = b.h * T;
      const gym = b.kind === 'gym' || b.kind === 'league';
      const league = b.kind === 'league';
      const mart = b.kind === 'mart';
      const roof = league ? '#c9a227' : gym ? PG.TYPES[this.gyms[b.gymIndex].type].color : mart ? '#3d7be0' : '#e2524a';
      const wallTop = py + h * 0.42;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      roundRect(ctx, px + 6, py + 10, w, h, 6); ctx.fill();
      // walls
      ctx.fillStyle = gym ? '#e9e4da' : '#fbf6ec';
      ctx.fillRect(px, wallTop, w, h - (wallTop - py));
      ctx.fillStyle = gym ? '#cfc8ba' : '#e8dfcf';
      ctx.fillRect(px, py + h - 6, w, 6);
      // roof with shingle rows
      ctx.fillStyle = shadeHex(roof, -0.25);
      roundRect(ctx, px - 6, py - 4, w + 12, h * 0.46 + 4, 6); ctx.fill();
      ctx.fillStyle = roof;
      roundRect(ctx, px - 6, py - 8, w + 12, h * 0.46, 6); ctx.fill();
      ctx.strokeStyle = shadeHex(roof, -0.15); ctx.lineWidth = 1.5;
      for (let ry = py + 2; ry < py + h * 0.46 - 10; ry += 8) {
        ctx.beginPath(); ctx.moveTo(px - 2, ry); ctx.lineTo(px + w + 2, ry); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(px - 4, py - 6, w + 8, 3);
      // windows
      const winY = wallTop + 8;
      ctx.fillStyle = '#7fc3ef';
      ctx.strokeStyle = '#5b6b78'; ctx.lineWidth = 2;
      for (const wx of [px + 8, px + w - 26]) {
        ctx.fillRect(wx, winY, 18, 14); ctx.strokeRect(wx, winY, 18, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(wx + 2, winY + 2, 5, 4); ctx.fillStyle = '#7fc3ef';
      }
      // door
      const dx = b.doorX * T, dy = b.doorY * T;
      ctx.fillStyle = gym ? '#5a4a6a' : '#9fd3f5';
      roundRect(ctx, dx + 5, dy + 2, T - 10, T - 2, 4); ctx.fill();
      ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 2;
      roundRect(ctx, dx + 5, dy + 2, T - 10, T - 2, 4); ctx.stroke();
      if (!gym) { ctx.beginPath(); ctx.moveTo(dx + 16, dy + 3); ctx.lineTo(dx + 16, dy + T); ctx.stroke(); }
      ctx.fillStyle = '#bdb6a8'; ctx.fillRect(dx + 2, dy + T - 2, T - 4, 4);
      // emblem on roof
      const ex = px + w / 2, ey = py + h * 0.2;
      if (gym || mart) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = roof; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(mart ? 'M' : league ? '★' : this.gyms[b.gymIndex].type[0].toUpperCase(), ex, ey + 0.5);
      } else {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e2524a'; ctx.beginPath(); ctx.arc(ex, ey, 10, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ex, ey, 10, 0, Math.PI * 2); ctx.moveTo(ex - 10, ey); ctx.lineTo(ex + 10, ey); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.textBaseline = 'alphabetic';
      // name plate
      const label = league ? 'POKéMON LEAGUE' : gym ? this.gyms[b.gymIndex].name.toUpperCase() : mart ? 'POKé MART' : 'POKé CENTER';
      ctx.font = 'bold 11px system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(30,34,48,0.85)';
      roundRect(ctx, px + w / 2 - tw / 2, wallTop - 9, tw, 16, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(label, px + w / 2, wallTop + 3);
    }

    waterHint(game) {
      if (this.hintT > 0) return;
      this.hintT = 8;
      PG.UI.toast(game.state.party.some(m => m.types.includes('water'))
        ? 'The water is deep. Teach a water Pokémon Swim (Menu → Moves) and it can carry you.'
        : 'The water is deep. A water-type Pokémon that knows Swim could carry you across.');
    }

    // Riding a Pokémon across the water: ripples, the swimmer, and the trainer on its back.
    drawSwimmer(ctx, time) {
      const p = this.player, x = Math.round(p.x), y = Math.round(p.y);
      const bob = Math.sin(time * 4) * 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const k = ((time * 0.8 + i * 0.5) % 1);
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.ellipse(x, y + 10, 14 + k * 18, 5 + k * 6, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
      if (this.swimmer) PG.drawMon(ctx, this.swimmer, x, y + 4 + bob, 46, p.dir === 'right');
      ctx.save();
      ctx.translate(0, -12 + bob);
      ctx.beginPath(); ctx.rect(x - 20, y - 40, 40, 46); ctx.clip(); // hide the legs
      this.drawPlayer(ctx, time);
      ctx.restore();
    }

    // Bicycle under the trainer, with pedalling legs. crank: pedal angle.
    drawBike(ctx, x, y, dir, crank) {
      const side = dir === 'left' || dir === 'right';
      const s = dir === 'left' ? -1 : 1;
      ctx.lineCap = 'round';
      if (side) {
        // wheels
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2.2;
        for (const wx of [x - 10, x + 10]) { ctx.beginPath(); ctx.arc(wx, y + 8, 5.5, 0, Math.PI * 2); ctx.stroke(); }
        ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 0.8;
        for (const wx of [x - 10, x + 10]) for (let k = 0; k < 3; k++) {
          const a = crank * 1.5 + k * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(wx - Math.cos(a) * 5, y + 8 - Math.sin(a) * 5); ctx.lineTo(wx + Math.cos(a) * 5, y + 8 + Math.sin(a) * 5); ctx.stroke();
        }
        // frame, seat, handlebar
        ctx.strokeStyle = '#e03a3a'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(x - 10 * s, y + 8); ctx.lineTo(x - 2 * s, y + 1); ctx.lineTo(x + 7 * s, y + 1); ctx.lineTo(x + 10 * s, y + 8);
        ctx.moveTo(x - 2 * s, y + 1); ctx.lineTo(x, y + 8); ctx.lineTo(x - 10 * s, y + 8); ctx.moveTo(x, y + 8); ctx.lineTo(x + 7 * s, y + 1); ctx.stroke();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 7 * s, y + 1); ctx.lineTo(x + 8 * s, y - 4); ctx.lineTo(x + 5 * s, y - 5); ctx.stroke();
        ctx.fillStyle = '#222'; ctx.fillRect(x - 5 * s - 2.5, y - 1, 5, 2);
        // pedalling legs
        ctx.strokeStyle = '#2b3a67'; ctx.lineWidth = 3.5;
        for (const ph of [0, Math.PI]) {
          const px = x + Math.cos(crank + ph) * 3, py = y + 8 + Math.sin(crank + ph) * 3;
          ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 1); ctx.lineTo(x + 2 * s, y + 4); ctx.lineTo(px, py); ctx.stroke();
        }
      } else {
        // seen from the front/back: one wheel, handlebar across
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.ellipse(x, y + 9, 2.5, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#e03a3a'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 1); ctx.stroke();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 8, dir === 'down' ? y - 3 : y - 1); ctx.lineTo(x + 8, dir === 'down' ? y - 3 : y - 1); ctx.stroke();
        ctx.fillStyle = '#2b3a67';
        const lift = Math.sin(crank) * 2.5;
        ctx.fillRect(x - 6, y + 1 + lift, 3.5, 7);
        ctx.fillRect(x + 2.5, y + 1 - lift, 3.5, 7);
      }
      ctx.lineCap = 'butt'; ctx.lineWidth = 1;
    }

    drawPlayer(ctx, time) {
      const p = this.player;
      const x = Math.round(p.x), y = Math.round(p.y);
      const biking = !!p.biking;
      const step = p.moving && !biking ? Math.sin(p.walk) : 0;
      const bob = biking ? -4 : p.moving ? Math.abs(Math.cos(p.walk)) * -1.5 : 0;
      const dir = p.dir;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, y + 12, biking && (dir === 'left' || dir === 'right') ? 15 : 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      if (biking) this.drawBike(ctx, x, y, dir, p.moving ? p.walk : 0);
      else {
        // legs
        ctx.fillStyle = '#2b3a67';
        ctx.fillRect(x - 5, y + 3 + bob, 4, 7 + step * 1.5);
        ctx.fillRect(x + 1, y + 3 + bob, 4, 7 - step * 1.5);
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x - 5, y + 9 + bob + step * 1.5, 4, 3);
        ctx.fillRect(x + 1, y + 9 + bob - step * 1.5, 4, 3);
      }
      // backpack visible from behind / side
      if (dir === 'up') { ctx.fillStyle = '#e3a72f'; roundRect(ctx, x - 6, y - 6 + bob, 12, 10, 3); ctx.fill(); }
      // body
      ctx.fillStyle = '#3b6fd8';
      roundRect(ctx, x - 7, y - 6 + bob, 14, 11, 4); ctx.fill();
      if (dir === 'down') { ctx.fillStyle = '#fff'; ctx.fillRect(x - 0.5, y - 5 + bob, 1, 9); }
      if (dir === 'left' || dir === 'right') {
        const s = dir === 'left' ? 1 : -1;
        ctx.fillStyle = '#e3a72f'; roundRect(ctx, x + s * 5 - 3, y - 5 + bob, 6, 9, 2); ctx.fill();
      }
      // arms
      ctx.fillStyle = '#f6d2ad';
      ctx.fillRect(x - 9, y - 4 + bob - step * 1.5, 3, 7);
      ctx.fillRect(x + 6, y - 4 + bob + step * 1.5, 3, 7);
      // head
      ctx.fillStyle = '#3a2a1f';
      ctx.beginPath(); ctx.arc(x, y - 12 + bob, 7.5, 0, Math.PI * 2); ctx.fill();
      if (dir !== 'up') {
        ctx.fillStyle = '#f6d2ad';
        const fx = dir === 'left' ? -1.5 : dir === 'right' ? 1.5 : 0;
        ctx.beginPath(); ctx.arc(x + fx, y - 11 + bob, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        if (dir === 'down') { ctx.fillRect(x - 3, y - 11 + bob, 1.6, 2.4); ctx.fillRect(x + 1.5, y - 11 + bob, 1.6, 2.4); }
        else ctx.fillRect(x + fx * 2.3 - 0.8, y - 11 + bob, 1.6, 2.4);
      }
      // cap
      ctx.fillStyle = '#e03a3a';
      ctx.beginPath(); ctx.arc(x, y - 14 + bob, 7.8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 3, y - 20 + bob, 6, 3);
      ctx.fillStyle = '#c42d2d';
      if (dir === 'down') ctx.fillRect(x - 7, y - 15 + bob, 14, 3);
      else if (dir === 'left') ctx.fillRect(x - 11, y - 15 + bob, 9, 3);
      else if (dir === 'right') ctx.fillRect(x + 2, y - 15 + bob, 9, 3);
      // legs hidden by tall grass
      const tx = Math.floor(p.x / T), ty = Math.floor((p.y + 8) / T);
      if (this.tile(tx, ty) === TILE.TALL) this.drawTallGrass(ctx, tx * T, ty * T, tx, ty, time, true);
      if (p.immune > 0 && Math.floor(p.immune * 8) % 2 === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - 2, 19, 0, Math.PI * 2); ctx.stroke();
      }
    }

    drawRoamer(ctx, r, time) {
      const moving = Math.abs(r.vx) + Math.abs(r.vy) > 1;
      const hop = moving ? -Math.abs(Math.sin(r.bob * 1.6)) * 5 : Math.sin(r.bob) * 1.2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(r.x, r.y + 8, 13 + hop * 0.4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      if (r.mon.data.legendary) {
        // a legendary sighting glows and sparkles so it stands out
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        const g = ctx.createRadialGradient(r.x, r.y - 6, 4, r.x, r.y - 6, 40);
        g.addColorStop(0, `rgba(255,220,120,${0.45 + pulse * 0.25})`); g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(r.x, r.y - 6, 40, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff6c2';
        for (let i = 0; i < 3; i++) {
          const a = time * 2 + i * 2.1, sx = r.x + Math.cos(a) * 24, sy = r.y - 10 + Math.sin(a * 1.3) * 18;
          ctx.fillRect(sx - 1, sy - 4, 2, 8); ctx.fillRect(sx - 4, sy - 1, 8, 2);
        }
      }
      PG.drawMon(ctx, r.mon.species, r.x, r.y - 6 + hop, 56, r.vx > 0);
      const tx = Math.floor(r.x / T), ty = Math.floor((r.y + 8) / T);
      if (this.tile(tx, ty) === TILE.TALL) this.drawTallGrass(ctx, tx * T, ty * T, tx, ty, time, true);
      // level pill
      const label = 'Lv' + r.mon.level;
      ctx.font = 'bold 10px system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(20,24,32,0.7)';
      roundRect(ctx, r.x - tw / 2, r.y + 16, tw, 13, 6.5); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(label, r.x, r.y + 26);
      // "!" when the player is close
      if (Math.hypot(r.x - this.player.x, r.y - this.player.y) < 110) {
        const by = r.y - 46 + Math.sin(time * 6) * 2;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
        roundRect(ctx, r.x - 7, by - 9, 14, 16, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e03a3a'; ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText('!', r.x, by + 4);
      }
    }

    // Soft cloud shadows drifting across the map.
    drawClouds(ctx, camX, camY, vw, vh, time) {
      const span = this.W * T + 800;
      ctx.fillStyle = 'rgba(20,40,60,0.07)';
      for (let i = 0; i < 9; i++) {
        const cx = ((i * 977 + time * (10 + i)) % span) - 400;
        const cy = (i * 1361) % (this.H * T);
        if (cx < camX - 300 || cx > camX + vw + 300 || cy < camY - 200 || cy > camY + vh + 200) continue;
        ctx.beginPath();
        if (this.view25) {
          const pr = this.project(cx, cy), k = pr.s, q = k * 0.72;
          if (pr.s <= 0) continue;
          ctx.ellipse(pr.x, pr.y, 170 * k, 70 * q, 0, 0, Math.PI * 2);
          ctx.ellipse(pr.x + 90 * k, pr.y + 25 * q, 110 * k, 55 * q, 0, 0, Math.PI * 2);
          ctx.ellipse(pr.x - 80 * k, pr.y + 20 * q, 100 * k, 50 * q, 0, 0, Math.PI * 2);
        } else {
          ctx.ellipse(cx, cy, 170, 70, 0, 0, Math.PI * 2);
          ctx.ellipse(cx + 90, cy + 25, 110, 55, 0, 0, Math.PI * 2);
          ctx.ellipse(cx - 80, cy + 20, 100, 50, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    renderMinimap() {
      const c = document.createElement('canvas');
      c.width = this.W; c.height = this.H;
      const g = c.getContext('2d');
      const img = g.createImageData(this.W, this.H);
      const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
      for (let i = 0; i < this.tiles.length; i++) {
        let col = TILE_COLOR[this.tiles[i]];
        if (this.tiles[i] === TILE.BUILDING) col = '#e05050';
        if (this.tiles[i] === TILE.DOOR_MART) col = '#3d7be0';
        if (this.tiles[i] === TILE.DOOR_LEAGUE) col = '#ffd700';
        const [r, gg, b] = hex(col);
        img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return c;
    }

    drawMinimap(ctx, x, y, scale, badges) {
      const mw = this.W * scale, mh = this.H * scale;
      ctx.save();
      ctx.fillStyle = 'rgba(20,24,32,0.85)';
      roundRect(ctx, x - 4, y - 4, mw + 8, mh + 8, 10); ctx.fill();
      roundRect(ctx, x, y, mw, mh, 7); ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.minimap, x, y, mw, mh);
      ctx.restore();
      ctx.save();
      this.gymSpots.forEach((g, i) => {
        ctx.fillStyle = badges.includes(this.gyms[i].id) ? '#ffd700' : PG.TYPES[this.gyms[i].type].color;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x + g.x * scale, y + g.y * scale, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      // League: a gold star, dimmed until every badge is earned
      const all = this.gyms.every(g => badges.includes(g.id));
      ctx.fillStyle = all ? '#ffd700' : '#9a8a55'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 2.5 : 6, a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
        ctx.lineTo(x + this.league.x * scale + Math.cos(a) * r, y + this.league.y * scale + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      const px = x + (this.player.x / T) * scale, py = y + (this.player.y / T) * scale;
      const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[this.player.dir];
      ctx.translate(px, py); ctx.rotate(ang);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e03a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-2, 0); ctx.lineTo(-4, 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // Draws a Pokemon sprite centred at (x, y), or a typed blob if the sprite isn't available.
  PG.drawMon = function (ctx, speciesId, x, y, size, flip, back) {
    const s = PG.getSprite(speciesId, back);
    if (s.ok) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (flip) { ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(s.img, -size / 2, -size / 2, size, size); }
      else ctx.drawImage(s.img, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    } else {
      const sp = SPECIES[speciesId];
      ctx.fillStyle = PG.TYPES[sp.types[0]].color;
      ctx.beginPath(); ctx.arc(x, y, size * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = sp.types[1] ? PG.TYPES[sp.types[1]].color : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(size * 0.22)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sp.name.slice(0, 2), x, y);
      ctx.textBaseline = 'alphabetic';
    }
  };

  // Day/night: one full day every CONFIG.DAY_LENGTH seconds of play, starting mid-morning.
  // dark = night overlay strength, warm = sunrise/sunset tint.
  PG.timeOfDay = function (time) {
    const phase = ((time / (CONFIG.DAY_LENGTH || 720)) + 0.3) % 1; // 0 = midnight, 0.5 = noon
    const sun = Math.cos((phase - 0.5) * Math.PI * 2);
    const dark = Math.max(0, Math.min(0.5, (0.12 - sun) * 0.42));
    const warm = Math.max(0, 1 - Math.abs(sun) * 3.2) * 0.22;
    const label = sun > 0.25 ? 'Day' : sun > -0.25 ? (phase < 0.5 ? 'Dawn' : 'Dusk') : 'Night';
    return { phase, dark, warm, label, icon: { Day: '☀️', Dawn: '🌅', Dusk: '🌇', Night: '🌙' }[label] };
  };

  PG.World = World;
  PG.TILE = TILE;
})();
