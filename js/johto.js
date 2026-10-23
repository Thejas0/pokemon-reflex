// Gen 2 / Johto: Dark and Steel types, new moves, Pokémon #152-251, the 16 Johto gyms and the
// region definitions (Kanto = region 1, Johto = region 2). Loaded after species-extra.js.
(function () {
  const { TYPES, TYPE_CHART, MOVES, SPECIES } = PG;

  // ---------- new types ----------
  TYPES.dark = { color: '#705848' };
  TYPES.steel = { color: '#b8b8d0' };
  TYPE_CHART.dark = { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 };
  TYPE_CHART.steel = { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5 };
  const vs = (atk, def, m) => { TYPE_CHART[atk][def] = m; };
  vs('normal', 'steel', 0.5); vs('fire', 'steel', 2); vs('grass', 'steel', 0.5); vs('ice', 'steel', 0.5);
  vs('fighting', 'dark', 2); vs('fighting', 'steel', 2); vs('poison', 'steel', 0); vs('flying', 'steel', 0.5);
  vs('psychic', 'dark', 0); vs('psychic', 'steel', 0.5); vs('bug', 'dark', 2); vs('bug', 'steel', 0.5);
  vs('rock', 'steel', 0.5); vs('ghost', 'dark', 0.5); vs('ghost', 'steel', 0.5); vs('dragon', 'steel', 0.5);
  vs('ground', 'steel', 2);

  // ---------- new moves ----------
  Object.assign(MOVES, {
    pursuit:       { name: 'Pursuit',       type: 'dark',     power: 40,  kind: 'melee' },
    faint_attack:  { name: 'Faint Attack',  type: 'dark',     power: 60,  kind: 'dash', dashSpeed: 950 },
    crunch:        { name: 'Crunch',        type: 'dark',     power: 80,  kind: 'melee' },
    dark_pulse:    { name: 'Dark Pulse',    type: 'dark',     power: 80,  kind: 'projectile', speed: 520, size: 14 },
    metal_claw:    { name: 'Metal Claw',    type: 'steel',    power: 50,  kind: 'melee' },
    steel_wing:    { name: 'Steel Wing',    type: 'steel',    power: 70,  kind: 'dash', dashSpeed: 850 },
    iron_tail:     { name: 'Iron Tail',     type: 'steel',    power: 100, kind: 'melee', range: 100, recharge: 1.2 },
    headbutt:      { name: 'Headbutt',      type: 'normal',   power: 70,  kind: 'dash', dashSpeed: 800 },
    extremespeed:  { name: 'ExtremeSpeed',  type: 'normal',   power: 80,  kind: 'dash', dashSpeed: 1400 },
    rollout:       { name: 'Rollout',       type: 'rock',     power: 50,  kind: 'dash', dashSpeed: 900 },
    ancient_power: { name: 'AncientPower',  type: 'rock',     power: 60,  kind: 'projectile', speed: 440, size: 13 },
    giga_drain:    { name: 'Giga Drain',    type: 'grass',    power: 75,  kind: 'projectile', speed: 440, size: 12, drain: 0.5 },
    petal_dance:   { name: 'Petal Dance',   type: 'grass',    power: 95,  kind: 'area', radius: 140, recharge: 1.3 },
    octazooka:     { name: 'Octazooka',     type: 'water',    power: 65,  kind: 'projectile', speed: 480, size: 14 },
    icy_wind:      { name: 'Icy Wind',      type: 'ice',      power: 55,  kind: 'projectile', speed: 480, size: 9, count: 3, spread: 0.25 },
    powder_snow:   { name: 'Powder Snow',   type: 'ice',      power: 40,  kind: 'area', radius: 110 },
    zap_cannon:    { name: 'Zap Cannon',    type: 'electric', power: 120, kind: 'strike', radius: 70, delay: 1.1 },
    twister:       { name: 'Twister',       type: 'dragon',   power: 45,  kind: 'area', radius: 130 },
    outrage:       { name: 'Outrage',       type: 'dragon',   power: 110, kind: 'dash', dashSpeed: 900, recharge: 1.4 },
    megahorn:      { name: 'Megahorn',      type: 'bug',      power: 110, kind: 'dash', dashSpeed: 850, recharge: 1.3 },
    dynamic_punch: { name: 'DynamicPunch',  type: 'fighting', power: 100, kind: 'melee', recharge: 1.3 },
    sacred_fire:   { name: 'Sacred Fire',   type: 'fire',     power: 100, kind: 'strike', radius: 90, delay: 0.7, hazard: { kind: 'fire', dur: 2.5, r: 70, pct: 0.02 } },
    aeroblast:     { name: 'Aeroblast',     type: 'flying',   power: 100, kind: 'projectile', speed: 700, size: 16 },
    synthesis:     { name: 'Synthesis',     type: 'grass',    power: 0,   kind: 'heal', amount: 0.3, recharge: 2, pp: 5 },
    moonlight:     { name: 'Moonlight',     type: 'normal',   power: 0,   kind: 'heal', amount: 0.3, recharge: 2, pp: 5 },
    morning_sun:   { name: 'Morning Sun',   type: 'normal',   power: 0,   kind: 'heal', amount: 0.3, recharge: 2, pp: 5 },
    milk_drink:    { name: 'Milk Drink',    type: 'normal',   power: 0,   kind: 'heal', amount: 0.3, recharge: 2, pp: 5 },
    agility:       { name: 'Agility',       type: 'psychic',  power: 0,   kind: 'buff', stat: 'spd', stages: 2 },
    swords_dance:  { name: 'Swords Dance',  type: 'normal',   power: 0,   kind: 'buff', stat: 'atk', stages: 2 },
    charm:         { name: 'Charm',         type: 'normal',   power: 0,   kind: 'debuff', stat: 'atk', stages: -2 },
    cotton_spore:  { name: 'Cotton Spore',  type: 'grass',    power: 0,   kind: 'debuff', stat: 'spd', stages: -2 },
  });
  for (const [id, m] of Object.entries(MOVES)) m.id = id;

  // ---------- Johto Pokémon (#152-251) ----------
  // S(dex, name, types, hp, atk, def, spd, exp, learnset, extra). region: 2 keeps them out of Kanto's wild.
  const S = (dex, name, types, hp, atk, def, spd, exp, learnset, extra = {}) =>
    Object.assign({ dex, name, types, base: { hp, atk, def, spd }, exp, learnset, habitat: [], region: 2 }, extra);
  const E = (into, level) => ({ evolves: { into, level } });

  Object.assign(SPECIES, {
    chikorita:  S(152, 'Chikorita', ['grass'], 45, 49, 65, 45, 64, [[1, 'tackle'], [1, 'growl'], [6, 'razor_leaf'], [12, 'vine_whip'], [18, 'mega_drain'], [26, 'body_slam'], [32, 'synthesis'], [40, 'giga_drain'], [50, 'solar_beam']], E('bayleef', 16)),
    bayleef:    S(153, 'Bayleef', ['grass'], 60, 62, 80, 60, 142, [[1, 'razor_leaf'], [1, 'tackle']], E('meganium', 32)),
    meganium:   S(154, 'Meganium', ['grass'], 80, 83, 100, 80, 236, [[1, 'razor_leaf'], [32, 'petal_dance'], [45, 'earthquake']]),
    cyndaquil:  S(155, 'Cyndaquil', ['fire'], 39, 60, 50, 65, 62, [[1, 'tackle'], [1, 'growl'], [6, 'ember'], [12, 'quick_attack'], [20, 'fire_fang'], [27, 'swift'], [34, 'flamethrower'], [42, 'fire_spin'], [48, 'fire_blast']], E('quilava', 14)),
    quilava:    S(156, 'Quilava', ['fire'], 58, 80, 65, 80, 142, [[1, 'ember'], [1, 'tackle']], E('typhlosion', 36)),
    typhlosion: S(157, 'Typhlosion', ['fire'], 78, 109, 82, 100, 240, [[1, 'ember'], [40, 'earthquake']]),
    totodile:   S(158, 'Totodile', ['water'], 50, 65, 64, 43, 63, [[1, 'scratch'], [1, 'growl'], [6, 'water_gun'], [13, 'bite'], [20, 'bubble_beam'], [27, 'crunch'], [35, 'surf'], [43, 'hydro_pump']], E('croconaw', 18)),
    croconaw:   S(159, 'Croconaw', ['water'], 65, 80, 81, 58, 142, [[1, 'water_gun'], [1, 'scratch']], E('feraligatr', 30)),
    feraligatr: S(160, 'Feraligatr', ['water'], 85, 105, 92, 78, 239, [[1, 'water_gun'], [30, 'crunch'], [45, 'outrage']]),
    sentret:    S(161, 'Sentret', ['normal'], 35, 46, 40, 20, 43, [[1, 'scratch'], [1, 'growl'], [5, 'quick_attack'], [11, 'bite'], [17, 'headbutt'], [25, 'body_slam']], { ...E('furret', 15), habitat: ['grass'], minLv: 2 }),
    furret:     S(162, 'Furret', ['normal'], 85, 76, 60, 90, 145, [[1, 'scratch'], [1, 'quick_attack']], { habitat: ['grass'], minLv: 15 }),
    hoothoot:   S(163, 'Hoothoot', ['normal', 'flying'], 60, 36, 56, 50, 52, [[1, 'tackle'], [1, 'growl'], [6, 'gust'], [11, 'confusion'], [17, 'wing_attack'], [24, 'psybeam'], [34, 'aerial_ace']], { ...E('noctowl', 20), habitat: ['forest', 'grass'], minLv: 2 }),
    noctowl:    S(164, 'Noctowl', ['normal', 'flying'], 100, 76, 86, 70, 155, [[1, 'gust'], [1, 'confusion']], { habitat: ['forest'], minLv: 20 }),
    ledyba:     S(165, 'Ledyba', ['bug', 'flying'], 40, 40, 80, 55, 53, [[1, 'tackle'], [8, 'bug_bite'], [15, 'swift'], [22, 'signal_beam'], [29, 'agility']], { ...E('ledian', 18), habitat: ['forest', 'grass'], minLv: 2 }),
    ledian:     S(166, 'Ledian', ['bug', 'flying'], 55, 55, 110, 85, 137, [[1, 'tackle'], [1, 'bug_bite']], { habitat: ['forest'], minLv: 18 }),
    spinarak:   S(167, 'Spinarak', ['bug', 'poison'], 40, 60, 40, 30, 50, [[1, 'poison_sting'], [1, 'string_shot'], [6, 'bug_bite'], [12, 'night_shade'], [19, 'leech_life'], [26, 'signal_beam'], [33, 'sludge_bomb']], { ...E('ariados', 22), habitat: ['forest'], minLv: 2 }),
    ariados:    S(168, 'Ariados', ['bug', 'poison'], 70, 90, 70, 40, 140, [[1, 'poison_sting'], [1, 'bug_bite']], { habitat: ['forest'], minLv: 22 }),
    crobat:     S(169, 'Crobat', ['poison', 'flying'], 85, 90, 80, 130, 241, [[1, 'leech_life'], [1, 'wing_attack'], [40, 'aerial_ace'], [48, 'sludge_bomb']]),
    chinchou:   S(170, 'Chinchou', ['water', 'electric'], 75, 56, 60, 67, 66, [[1, 'water_gun'], [1, 'thunder_shock'], [13, 'bubble_beam'], [20, 'spark'], [29, 'thunderbolt'], [37, 'hydro_pump']], { ...E('lanturn', 27), habitat: ['ocean', 'water'], minLv: 6 }),
    lanturn:    S(171, 'Lanturn', ['water', 'electric'], 125, 76, 76, 67, 161, [[1, 'water_gun'], [1, 'spark']], { habitat: ['ocean'], minLv: 27 }),
    pichu:      S(172, 'Pichu', ['electric'], 20, 40, 30, 60, 41, [[1, 'thunder_shock'], [1, 'charm'], [6, 'quick_attack']], { ...E('pikachu', 10), habitat: ['forest', 'grass'], minLv: 2, rare: true }),
    cleffa:     S(173, 'Cleffa', ['normal'], 50, 45, 40, 15, 44, [[1, 'tackle'], [1, 'charm'], [8, 'swift']], { ...E('clefairy', 10), habitat: ['rock'], minLv: 2, rare: true }),
    igglybuff:  S(174, 'Igglybuff', ['normal'], 90, 40, 25, 15, 42, [[1, 'tackle'], [1, 'charm'], [8, 'swift']], { ...E('jigglypuff', 10), habitat: ['grass'], minLv: 2, rare: true }),
    togepi:     S(175, 'Togepi', ['normal'], 35, 40, 85, 20, 49, [[1, 'growl'], [1, 'charm'], [7, 'tackle'], [15, 'ancient_power'], [25, 'swift']], { ...E('togetic', 20), habitat: ['grass'], minLv: 5, rare: true }),
    togetic:    S(176, 'Togetic', ['normal', 'flying'], 55, 80, 95, 40, 142, [[1, 'charm'], [20, 'aerial_ace'], [30, 'ancient_power'], [40, 'morning_sun']]),
    natu:       S(177, 'Natu', ['psychic', 'flying'], 40, 70, 45, 70, 64, [[1, 'gust'], [1, 'growl'], [10, 'night_shade'], [20, 'psybeam'], [30, 'psychic']], { ...E('xatu', 25), habitat: ['rock', 'grass'], minLv: 5 }),
    xatu:       S(178, 'Xatu', ['psychic', 'flying'], 65, 95, 70, 95, 165, [[1, 'confusion'], [25, 'aerial_ace'], [35, 'psychic']], { habitat: ['rock'], minLv: 25 }),
    mareep:     S(179, 'Mareep', ['electric'], 55, 65, 50, 35, 56, [[1, 'tackle'], [1, 'growl'], [9, 'thunder_shock'], [16, 'spark'], [23, 'cotton_spore'], [30, 'thunderbolt'], [37, 'thunder']], { ...E('flaaffy', 15), habitat: ['grass'], minLv: 3 }),
    flaaffy:    S(180, 'Flaaffy', ['electric'], 70, 80, 60, 45, 128, [[1, 'thunder_shock'], [1, 'tackle']], { ...E('ampharos', 30), habitat: ['grass'], minLv: 15 }),
    ampharos:   S(181, 'Ampharos', ['electric'], 90, 115, 90, 55, 230, [[1, 'thunderbolt'], [30, 'zap_cannon'], [42, 'dragon_pulse']]),
    bellossom:  S(182, 'Bellossom', ['grass'], 75, 90, 97, 50, 221, [[1, 'mega_drain'], [1, 'petal_dance'], [30, 'giga_drain'], [40, 'moonlight']], { habitat: ['forest'], minLv: 30, rare: true }),
    marill:     S(183, 'Marill', ['water'], 70, 20, 50, 40, 88, [[1, 'tackle'], [3, 'water_gun'], [10, 'bubble_beam'], [17, 'body_slam'], [25, 'surf']], { ...E('azumarill', 18), habitat: ['water'], minLv: 3 }),
    azumarill:  S(184, 'Azumarill', ['water'], 100, 60, 80, 50, 153, [[1, 'water_gun'], [25, 'surf'], [35, 'hydro_pump']], { habitat: ['water'], minLv: 18 }),
    sudowoodo:  S(185, 'Sudowoodo', ['rock'], 70, 100, 95, 30, 135, [[1, 'rock_throw'], [1, 'low_kick'], [18, 'rock_slide'], [26, 'body_slam'], [35, 'stone_edge']], { habitat: ['rock', 'forest'], minLv: 18, rare: true }),
    politoed:   S(186, 'Politoed', ['water'], 90, 85, 100, 70, 225, [[1, 'bubble_beam'], [1, 'body_slam'], [30, 'surf'], [40, 'hydro_pump']], { habitat: ['water'], minLv: 30, rare: true }),
    hoppip:     S(187, 'Hoppip', ['grass', 'flying'], 35, 35, 50, 50, 50, [[1, 'tackle'], [5, 'synthesis'], [10, 'cotton_spore'], [13, 'razor_leaf'], [20, 'mega_drain']], { ...E('skiploom', 18), habitat: ['grass'], minLv: 3 }),
    skiploom:   S(188, 'Skiploom', ['grass', 'flying'], 55, 45, 65, 80, 119, [[1, 'tackle'], [1, 'razor_leaf']], { ...E('jumpluff', 27), habitat: ['grass'], minLv: 18 }),
    jumpluff:   S(189, 'Jumpluff', ['grass', 'flying'], 75, 55, 90, 110, 207, [[1, 'mega_drain'], [27, 'giga_drain'], [35, 'aerial_ace']]),
    aipom:      S(190, 'Aipom', ['normal'], 55, 70, 55, 85, 72, [[1, 'scratch'], [1, 'growl'], [6, 'sand_attack'], [12, 'quick_attack'], [19, 'swift'], [27, 'agility'], [36, 'body_slam']], { habitat: ['forest'], minLv: 5 }),
    sunkern:    S(191, 'Sunkern', ['grass'], 30, 30, 30, 30, 36, [[1, 'mega_drain'], [1, 'growl'], [10, 'razor_leaf'], [19, 'synthesis']], { ...E('sunflora', 15), habitat: ['grass'], minLv: 2 }),
    sunflora:   S(192, 'Sunflora', ['grass'], 75, 105, 80, 30, 149, [[1, 'razor_leaf'], [15, 'petal_dance'], [30, 'giga_drain'], [40, 'solar_beam']], { habitat: ['grass'], minLv: 15 }),
    yanma:      S(193, 'Yanma', ['bug', 'flying'], 65, 75, 45, 95, 78, [[1, 'tackle'], [1, 'quick_attack'], [17, 'wing_attack'], [25, 'signal_beam'], [33, 'agility']], { habitat: ['forest', 'water'], minLv: 10 }),
    wooper:     S(194, 'Wooper', ['water', 'ground'], 55, 45, 45, 15, 42, [[1, 'water_gun'], [1, 'growl'], [5, 'mud_slap'], [11, 'bubble_beam'], [16, 'dig']], { ...E('quagsire', 20), habitat: ['water'], minLv: 3 }),
    quagsire:   S(195, 'Quagsire', ['water', 'ground'], 95, 85, 70, 35, 151, [[1, 'water_gun'], [1, 'mud_slap'], [25, 'earthquake'], [35, 'surf']], { habitat: ['water'], minLv: 20 }),
    espeon:     S(196, 'Espeon', ['psychic'], 65, 130, 102, 110, 184, [[1, 'confusion'], [1, 'quick_attack'], [30, 'psybeam'], [38, 'psychic'], [45, 'morning_sun']], { habitat: ['grass'], minLv: 30, rare: true }),
    umbreon:    S(197, 'Umbreon', ['dark'], 95, 65, 130, 65, 184, [[1, 'pursuit'], [1, 'quick_attack'], [30, 'faint_attack'], [38, 'crunch'], [45, 'moonlight']], { habitat: ['forest'], minLv: 30, rare: true }),
    murkrow:    S(198, 'Murkrow', ['dark', 'flying'], 60, 85, 42, 91, 81, [[1, 'gust'], [1, 'pursuit'], [11, 'night_shade'], [16, 'faint_attack'], [26, 'wing_attack'], [35, 'aerial_ace'], [41, 'dark_pulse']], { habitat: ['forest'], minLv: 8 }),
    slowking:   S(199, 'Slowking', ['water', 'psychic'], 95, 100, 100, 30, 172, [[1, 'water_gun'], [1, 'confusion'], [30, 'psychic'], [40, 'surf']], { habitat: ['water'], minLv: 30, rare: true }),
    misdreavus: S(200, 'Misdreavus', ['ghost'], 60, 85, 60, 85, 87, [[1, 'growl'], [1, 'lick'], [6, 'night_shade'], [12, 'confusion'], [20, 'psybeam'], [30, 'shadow_ball']], { habitat: ['forest'], minLv: 15, rare: true }),
    unown:      S(201, 'Unown', ['psychic'], 48, 72, 48, 48, 118, [[1, 'confusion'], [15, 'psybeam'], [30, 'ancient_power']], { habitat: ['rock'], minLv: 10 }),
    wobbuffet:  S(202, 'Wobbuffet', ['psychic'], 190, 33, 58, 33, 142, [[1, 'confusion'], [1, 'recover'], [20, 'psybeam']], { habitat: ['rock'], minLv: 15, rare: true }),
    girafarig:  S(203, 'Girafarig', ['normal', 'psychic'], 70, 90, 65, 85, 159, [[1, 'tackle'], [1, 'growl'], [7, 'confusion'], [13, 'headbutt'], [20, 'agility'], [30, 'psybeam'], [41, 'crunch'], [50, 'psychic']], { habitat: ['grass', 'sand'], minLv: 20 }),
    pineco:     S(204, 'Pineco', ['bug'], 50, 65, 90, 15, 58, [[1, 'tackle'], [1, 'harden'], [8, 'bug_bite'], [15, 'rock_throw'], [22, 'body_slam']], { ...E('forretress', 31), habitat: ['forest'], minLv: 3 }),
    forretress: S(205, 'Forretress', ['bug', 'steel'], 75, 90, 140, 40, 163, [[1, 'tackle'], [31, 'iron_tail'], [40, 'rock_slide']], { habitat: ['forest'], minLv: 31 }),
    dunsparce:  S(206, 'Dunsparce', ['normal'], 100, 70, 70, 45, 145, [[1, 'tackle'], [4, 'bite'], [10, 'dig'], [20, 'body_slam'], [30, 'ancient_power'], [40, 'headbutt']], { habitat: ['rock'], minLv: 10, rare: true }),
    gligar:     S(207, 'Gligar', ['ground', 'flying'], 65, 75, 85, 85, 86, [[1, 'poison_sting'], [6, 'sand_attack'], [13, 'metal_claw'], [20, 'quick_attack'], [28, 'faint_attack'], [36, 'dig'], [44, 'earthquake']], { habitat: ['rock', 'sand'], minLv: 15 }),
    steelix:    S(208, 'Steelix', ['steel', 'ground'], 75, 85, 200, 30, 179, [[1, 'rock_throw'], [1, 'iron_tail'], [40, 'crunch'], [45, 'earthquake']]),
    snubbull:   S(209, 'Snubbull', ['normal'], 60, 80, 50, 30, 60, [[1, 'tackle'], [1, 'charm'], [8, 'bite'], [19, 'lick'], [26, 'crunch']], { ...E('granbull', 23), habitat: ['grass'], minLv: 5 }),
    granbull:   S(210, 'Granbull', ['normal'], 90, 120, 60, 45, 158, [[1, 'bite'], [23, 'crunch'], [35, 'body_slam']], { habitat: ['grass'], minLv: 23 }),
    qwilfish:   S(211, 'Qwilfish', ['water', 'poison'], 65, 95, 65, 85, 88, [[1, 'poison_sting'], [1, 'water_gun'], [10, 'harden'], [19, 'rollout'], [28, 'sludge_bomb'], [37, 'hydro_pump']], { habitat: ['ocean', 'water'], minLv: 15 }),
    scizor:     S(212, 'Scizor', ['bug', 'steel'], 70, 130, 90, 65, 175, [[1, 'metal_claw'], [1, 'quick_attack'], [40, 'steel_wing'], [48, 'swords_dance']]),
    shuckle:    S(213, 'Shuckle', ['bug', 'rock'], 20, 10, 230, 5, 177, [[1, 'harden'], [1, 'string_shot'], [9, 'rock_throw'], [14, 'rollout']], { habitat: ['rock'], minLv: 10, rare: true }),
    heracross:  S(214, 'Heracross', ['bug', 'fighting'], 80, 125, 95, 85, 175, [[1, 'tackle'], [6, 'bug_bite'], [12, 'karate_chop'], [19, 'quick_attack'], [27, 'megahorn'], [35, 'cross_chop']], { habitat: ['forest'], minLv: 18, rare: true }),
    sneasel:    S(215, 'Sneasel', ['dark', 'ice'], 55, 95, 65, 115, 86, [[1, 'scratch'], [1, 'growl'], [9, 'quick_attack'], [17, 'metal_claw'], [25, 'faint_attack'], [33, 'icy_wind'], [41, 'crunch']], { habitat: ['rock'], minLv: 20 }),
    teddiursa:  S(216, 'Teddiursa', ['normal'], 60, 80, 50, 40, 66, [[1, 'scratch'], [1, 'growl'], [8, 'lick'], [15, 'faint_attack'], [22, 'headbutt'], [29, 'swords_dance'], [36, 'crunch']], { ...E('ursaring', 30), habitat: ['forest'], minLv: 5 }),
    ursaring:   S(217, 'Ursaring', ['normal'], 90, 130, 75, 55, 175, [[1, 'scratch'], [30, 'body_slam'], [40, 'crunch'], [50, 'hyper_beam']], { habitat: ['forest'], minLv: 30 }),
    slugma:     S(218, 'Slugma', ['fire'], 40, 70, 40, 20, 50, [[1, 'ember'], [8, 'harden'], [15, 'rock_throw'], [22, 'fire_fang'], [29, 'flamethrower'], [36, 'fire_spin']], { ...E('magcargo', 38), habitat: ['rock'], minLv: 8 }),
    magcargo:   S(219, 'Magcargo', ['fire', 'rock'], 50, 80, 100, 30, 151, [[1, 'ember'], [38, 'rock_slide'], [45, 'flamethrower']], { habitat: ['rock'], minLv: 38 }),
    swinub:     S(220, 'Swinub', ['ice', 'ground'], 50, 50, 35, 50, 50, [[1, 'tackle'], [10, 'powder_snow'], [19, 'mud_slap'], [28, 'icy_wind']], { ...E('piloswine', 33), habitat: ['rock'], minLv: 6 }),
    piloswine:  S(221, 'Piloswine', ['ice', 'ground'], 100, 100, 60, 50, 158, [[1, 'powder_snow'], [33, 'earthquake'], [42, 'ice_beam']], { habitat: ['rock'], minLv: 33 }),
    corsola:    S(222, 'Corsola', ['water', 'rock'], 55, 65, 95, 35, 144, [[1, 'tackle'], [7, 'harden'], [13, 'bubble_beam'], [19, 'recover'], [25, 'rock_throw'], [31, 'ancient_power'], [37, 'rock_slide']], { habitat: ['ocean', 'sand'], minLv: 15 }),
    remoraid:   S(223, 'Remoraid', ['water'], 35, 65, 35, 65, 60, [[1, 'water_gun'], [11, 'psybeam'], [22, 'aurora_beam'], [33, 'bubble_beam']], { ...E('octillery', 25), habitat: ['ocean', 'water'], minLv: 6 }),
    octillery:  S(224, 'Octillery', ['water'], 75, 105, 75, 45, 168, [[1, 'water_gun'], [25, 'octazooka'], [38, 'hydro_pump']], { habitat: ['ocean'], minLv: 25 }),
    delibird:   S(225, 'Delibird', ['ice', 'flying'], 45, 65, 45, 75, 116, [[1, 'powder_snow'], [10, 'icy_wind'], [20, 'aerial_ace']], { habitat: ['rock'], minLv: 15, rare: true }),
    mantine:    S(226, 'Mantine', ['water', 'flying'], 65, 80, 140, 70, 168, [[1, 'tackle'], [1, 'bubble_beam'], [10, 'wing_attack'], [19, 'aurora_beam'], [28, 'surf']], { habitat: ['ocean'], minLv: 20 }),
    skarmory:   S(227, 'Skarmory', ['steel', 'flying'], 65, 80, 110, 70, 168, [[1, 'gust'], [1, 'metal_claw'], [13, 'sand_attack'], [19, 'swift'], [25, 'agility'], [31, 'steel_wing'], [37, 'aerial_ace']], { habitat: ['rock'], minLv: 20, rare: true }),
    houndour:   S(228, 'Houndour', ['dark', 'fire'], 45, 80, 40, 65, 66, [[1, 'ember'], [1, 'growl'], [7, 'bite'], [19, 'pursuit'], [25, 'faint_attack'], [31, 'flamethrower'], [37, 'crunch']], { ...E('houndoom', 24), habitat: ['rock', 'forest'], minLv: 10 }),
    houndoom:   S(229, 'Houndoom', ['dark', 'fire'], 75, 110, 70, 95, 175, [[1, 'ember'], [24, 'faint_attack'], [35, 'crunch'], [43, 'fire_blast']], { habitat: ['rock'], minLv: 24 }),
    kingdra:    S(230, 'Kingdra', ['water', 'dragon'], 75, 95, 95, 85, 243, [[1, 'bubble_beam'], [1, 'twister'], [45, 'dragon_pulse'], [50, 'hydro_pump']]),
    phanpy:     S(231, 'Phanpy', ['ground'], 90, 60, 60, 40, 66, [[1, 'tackle'], [1, 'growl'], [9, 'rollout'], [17, 'headbutt'], [25, 'dig']], { ...E('donphan', 25), habitat: ['sand', 'rock'], minLv: 5 }),
    donphan:    S(232, 'Donphan', ['ground'], 90, 120, 120, 50, 175, [[1, 'rollout'], [25, 'earthquake'], [35, 'stone_edge']], { habitat: ['sand'], minLv: 25 }),
    porygon2:   S(233, 'Porygon2', ['normal'], 85, 105, 92, 60, 180, [[1, 'tackle'], [1, 'psybeam'], [35, 'zap_cannon'], [45, 'ice_beam']]),
    stantler:   S(234, 'Stantler', ['normal'], 73, 95, 65, 85, 163, [[1, 'tackle'], [8, 'sand_attack'], [15, 'confusion'], [23, 'headbutt'], [31, 'psybeam'], [40, 'body_slam']], { habitat: ['forest', 'grass'], minLv: 15 }),
    smeargle:   S(235, 'Smeargle', ['normal'], 55, 20, 40, 75, 88, [[1, 'tackle'], [11, 'swift'], [21, 'agility']], { habitat: ['grass'], minLv: 10, rare: true }),
    tyrogue:    S(236, 'Tyrogue', ['fighting'], 35, 35, 35, 35, 42, [[1, 'tackle'], [1, 'low_kick']], { ...E('hitmontop', 20), habitat: ['rock'], minLv: 8, rare: true }),
    hitmontop:  S(237, 'Hitmontop', ['fighting'], 50, 95, 110, 70, 159, [[1, 'low_kick'], [20, 'quick_attack'], [26, 'dynamic_punch'], [34, 'agility']]),
    smoochum:   S(238, 'Smoochum', ['ice', 'psychic'], 45, 85, 55, 65, 61, [[1, 'tackle'], [1, 'lick'], [9, 'powder_snow'], [13, 'confusion'], [21, 'icy_wind'], [25, 'psybeam'], [33, 'ice_beam']], { ...E('jynx', 30), habitat: ['rock', 'water'], minLv: 5, rare: true }),
    elekid:     S(239, 'Elekid', ['electric'], 45, 75, 50, 95, 72, [[1, 'quick_attack'], [1, 'growl'], [9, 'thunder_shock'], [17, 'spark'], [25, 'thunderbolt'], [33, 'thunder']], { ...E('electabuzz', 30), habitat: ['grass', 'rock'], minLv: 5, rare: true }),
    magby:      S(240, 'Magby', ['fire'], 45, 75, 50, 83, 73, [[1, 'ember'], [7, 'growl'], [13, 'fire_spin'], [19, 'fire_fang'], [25, 'flamethrower']], { ...E('magmar', 30), habitat: ['rock'], minLv: 5, rare: true }),
    miltank:    S(241, 'Miltank', ['normal'], 95, 80, 90, 100, 172, [[1, 'tackle'], [4, 'growl'], [13, 'rollout'], [19, 'milk_drink'], [26, 'headbutt'], [34, 'body_slam']], { habitat: ['grass'], minLv: 15, rare: true }),
    blissey:    S(242, 'Blissey', ['normal'], 255, 75, 76, 55, 608, [[1, 'body_slam'], [1, 'milk_drink']]),
    raikou:     S(243, 'Raikou', ['electric'], 90, 115, 85, 115, 261, [[1, 'thunder_shock'], [1, 'bite'], [30, 'spark'], [40, 'thunderbolt'], [50, 'thunder'], [55, 'crunch']], { habitat: ['grass'], minLv: 40, legendary: true }),
    entei:      S(244, 'Entei', ['fire'], 115, 115, 80, 100, 261, [[1, 'ember'], [1, 'bite'], [30, 'fire_fang'], [40, 'flamethrower'], [50, 'fire_blast'], [55, 'crunch']], { habitat: ['sand'], minLv: 40, legendary: true }),
    suicune:    S(245, 'Suicune', ['water'], 100, 90, 115, 85, 261, [[1, 'water_gun'], [1, 'bubble_beam'], [30, 'aurora_beam'], [40, 'surf'], [50, 'hydro_pump'], [55, 'ice_beam']], { habitat: ['water'], minLv: 40, legendary: true }),
    larvitar:   S(246, 'Larvitar', ['rock', 'ground'], 50, 64, 50, 41, 60, [[1, 'bite'], [1, 'growl'], [8, 'sand_attack'], [15, 'rock_throw'], [22, 'rock_slide'], [29, 'crunch'], [36, 'earthquake']], { ...E('pupitar', 30), habitat: ['rock'], minLv: 15, rare: true }),
    pupitar:    S(247, 'Pupitar', ['rock', 'ground'], 70, 84, 70, 51, 144, [[1, 'bite'], [1, 'rock_slide']], E('tyranitar', 55)),
    tyranitar:  S(248, 'Tyranitar', ['rock', 'dark'], 100, 134, 105, 61, 270, [[1, 'crunch'], [55, 'stone_edge'], [60, 'earthquake']]),
    lugia:      S(249, 'Lugia', ['psychic', 'flying'], 106, 90, 140, 110, 306, [[1, 'gust'], [1, 'confusion'], [40, 'aeroblast'], [50, 'psychic'], [60, 'hurricane']], { habitat: ['ocean'], minLv: 45, legendary: true }),
    ho_oh:      S(250, 'Ho-Oh', ['fire', 'flying'], 106, 130, 120, 90, 306, [[1, 'ember'], [1, 'gust'], [40, 'sacred_fire'], [50, 'fire_blast'], [60, 'hurricane']], { habitat: ['rock'], minLv: 45, legendary: true }),
    celebi:     S(251, 'Celebi', ['psychic', 'grass'], 100, 100, 100, 100, 270, [[1, 'confusion'], [1, 'recover'], [30, 'giga_drain'], [40, 'psychic'], [50, 'ancient_power'], [60, 'solar_beam']], { habitat: ['forest'], minLv: 40, legendary: true }),
  });

  // Gen 2 evolutions of Kanto Pokémon.
  const evo = { golbat: ['crobat', 40], onix: ['steelix', 40], scyther: ['scizor', 40], seadra: ['kingdra', 45], porygon: ['porygon2', 35], chansey: ['blissey', 40] };
  for (const [from, [into, level]] of Object.entries(evo)) if (SPECIES[from] && !SPECIES[from].evolves) SPECIES[from].evolves = { level, into };

  // Starters can also turn up in the wild, rarely (each in its own region).
  const STARTER_HABITAT = {
    bulbasaur: ['grass', 'forest'], charmander: ['rock', 'grass'], squirtle: ['water'],
    chikorita: ['grass', 'forest'], cyndaquil: ['rock', 'grass'], totodile: ['water'],
  };
  for (const [id, habitat] of Object.entries(STARTER_HABITAT)) {
    const sp = SPECIES[id];
    if (sp && !sp.habitat.length) Object.assign(sp, { habitat, rare: true, minLv: 5 });
  }
  // Johto evolutions of Kanto Pokémon can't be reached by wild evolution (Kanto's wild Pokémon only evolve
  // into Kanto species), so they turn up in Johto's wild themselves, rarely.
  const RARE_EVOLVED = {
    crobat: [['rock', 'forest'], 30], steelix: [['rock'], 35], scizor: [['forest', 'grass'], 30],
    kingdra: [['water', 'ocean'], 35], porygon2: [['grass'], 30], blissey: [['grass'], 30],
  };
  for (const [id, [habitat, minLv]] of Object.entries(RARE_EVOLVED)) {
    const sp = SPECIES[id];
    if (sp && !sp.habitat.length) Object.assign(sp, { habitat, rare: true, minLv });
  }

  // Water lines learn Swim at Lv 10, as in Kanto.
  const prevo = {};
  for (const [id, sp] of Object.entries(SPECIES)) if (sp.evolves) prevo[sp.evolves.into] = id;
  for (const [id, sp] of Object.entries(SPECIES)) {
    if (sp.region !== 2 || !sp.types.includes('water')) continue;
    const from = prevo[id];
    if (from && SPECIES[from].types.includes('water')) continue;
    if (!sp.learnset.some(([, m]) => m === 'swim')) { sp.learnset.push([10, 'swim']); sp.learnset.sort((a, b) => a[0] - b[0]); }
  }

  // ---------- the 16 Johto gyms (anime-style circuit), in order of difficulty ----------
  PG.GYMS_JOHTO = [
    { id: 'cherrygrove', city: 'Cherrygrove City', name: 'Tide Gym', leader: 'Marina', type: 'water', badge: 'Tide Badge', aiSkill: 0.5,
      team: [['marill', 10], ['wooper', 11], ['chinchou', 12]] },
    { id: 'violet', city: 'Violet City', name: 'Zephyr Gym', leader: 'Falkner', type: 'flying', badge: 'Zephyr Badge', aiSkill: 0.53,
      team: [['hoothoot', 13], ['natu', 14], ['pidgeotto', 15]] },
    { id: 'azalea', city: 'Azalea Town', name: 'Hive Gym', leader: 'Bugsy', type: 'bug', badge: 'Hive Badge', aiSkill: 0.56,
      team: [['ledyba', 17], ['spinarak', 18], ['scyther', 19]] },
    { id: 'ilex', city: 'Ilex Village', name: 'Grove Gym', leader: 'Willow', type: 'grass', badge: 'Grove Badge', aiSkill: 0.59,
      team: [['skiploom', 21], ['sunflora', 22], ['bellossom', 23]] },
    { id: 'goldenrod', city: 'Goldenrod City', name: 'Plain Gym', leader: 'Whitney', type: 'normal', badge: 'Plain Badge', aiSkill: 0.62,
      team: [['clefairy', 24], ['aipom', 25], ['miltank', 27]] },
    { id: 'ecruteak', city: 'Ecruteak City', name: 'Fog Gym', leader: 'Morty', type: 'ghost', badge: 'Fog Badge', aiSkill: 0.65,
      team: [['misdreavus', 28], ['haunter', 30], ['gengar', 32]] },
    { id: 'cinder', city: 'Cinder Town', name: 'Ember Gym', leader: 'Blaze', type: 'fire', badge: 'Ember Badge', aiSkill: 0.68,
      team: [['slugma', 33], ['houndour', 34], ['magcargo', 36]] },
    { id: 'cianwood', city: 'Cianwood City', name: 'Storm Gym', leader: 'Chuck', type: 'fighting', badge: 'Storm Badge', aiSkill: 0.71,
      team: [['primeape', 37], ['hitmontop', 38], ['poliwrath', 40]] },
    { id: 'olivine', city: 'Olivine City', name: 'Mineral Gym', leader: 'Jasmine', type: 'steel', badge: 'Mineral Badge', aiSkill: 0.74,
      team: [['magneton', 41], ['forretress', 42], ['steelix', 44]] },
    { id: 'rockvale', city: 'Rockvale Town', name: 'Crag Gym', leader: 'Ross', type: 'rock', badge: 'Crag Badge', aiSkill: 0.77,
      team: [['sudowoodo', 45], ['corsola', 46], ['golem', 48]] },
    { id: 'mahogany', city: 'Mahogany Town', name: 'Glacier Gym', leader: 'Pryce', type: 'ice', badge: 'Glacier Badge', aiSkill: 0.8,
      team: [['swinub', 49], ['dewgong', 50], ['piloswine', 52]] },
    { id: 'ragewater', city: 'Ragewater Town', name: 'Volt Gym', leader: 'Raye', type: 'electric', badge: 'Volt Badge', aiSkill: 0.83,
      team: [['flaaffy', 53], ['lanturn', 54], ['ampharos', 56]] },
    { id: 'alph', city: 'Alph Ruins Town', name: 'Rune Gym', leader: 'Eusine', type: 'psychic', badge: 'Rune Badge', aiSkill: 0.86,
      team: [['xatu', 57], ['girafarig', 58], ['espeon', 60]] },
    { id: 'venom', city: 'Venom Hollow', name: 'Toxin Gym', leader: 'Janine', type: 'poison', badge: 'Toxin Badge', aiSkill: 0.89,
      team: [['ariados', 61], ['qwilfish', 62], ['crobat', 64]] },
    { id: 'shadowmere', city: 'Shadowmere', name: 'Eclipse Gym', leader: 'Karen', type: 'dark', badge: 'Eclipse Badge', aiSkill: 0.92,
      team: [['murkrow', 65], ['houndoom', 66], ['umbreon', 68]] },
    { id: 'blackthorn', city: 'Blackthorn City', name: 'Rising Gym', leader: 'Clair', type: 'dragon', badge: 'Rising Badge', aiSkill: 0.95,
      team: [['dragonair', 70], ['kingdra', 71], ['dragonite', 73]] },
  ];

  // ---------- regions ----------
  const STAGES = [
    { name: 'Grass Field', icon: '🌿', theme: 'grass', terrain: ['grass'] },
    { name: 'Lakeside Pools', icon: '🌊', theme: 'water', terrain: ['pool'] },
    { name: 'Rocky Ground', icon: '🪨', theme: 'rock', terrain: ['rock'] },
    { name: 'Forest Clearing', icon: '🌲', theme: 'forest', terrain: ['grass', 'rock'] },
    { name: 'Champion Stadium', icon: '🏆', theme: 'league', terrain: [] },
  ];
  PG.REGIONS = {
    1: {
      id: 1, name: 'Kanto', seed: 1337, mapW: 220, mapH: 160, home: 'Home Town', maxZone: 60,
      gyms: PG.GYMS, starters: PG.STARTERS, leagueTown: 'Indigo Plateau', leagueName: 'Pokémon League',
      league: { size: 32, prizes: [2000, 4000, 8000, 15000, 30000], stages: STAGES,
        levelCap: 78,   // no other entrant goes above this, so Blue is always the strongest
        rival: { name: 'Blue', level: 80, team: ['pidgeot', 'alakazam', 'gyarados', 'arcanine', 'exeggutor', 'rhydon'] } },   // level: fixed level for the rival's team
    },
    2: {
      id: 2, name: 'Johto', seed: 2002, mapW: 260, mapH: 200, home: 'New Bark Town', maxZone: 75,
      gyms: PG.GYMS_JOHTO, starters: ['chikorita', 'cyndaquil', 'totodile'], leagueTown: 'Silver Town', leagueName: 'Silver Conference',
      league: { size: 64, prizes: [3000, 6000, 10000, 16000, 25000, 40000],
        stages: [
          { name: 'Grass Field', icon: '🌿', theme: 'grass', terrain: ['grass'] },
          { name: 'Lakeside Pools', icon: '🌊', theme: 'water', terrain: ['pool'] },
          { name: 'Rocky Ground', icon: '🪨', theme: 'rock', terrain: ['rock'] },
          { name: 'Forest Clearing', icon: '🌲', theme: 'forest', terrain: ['grass', 'rock'] },
          { name: 'Beach Arena', icon: '🏖️', theme: 'sand', terrain: ['pool', 'rock'] },
          { name: 'Silver Stadium', icon: '🏆', theme: 'league', terrain: [] },
        ],
        rival: { name: 'Silver', team: ['feraligatr', 'crobat', 'alakazam', 'gengar', 'magneton', 'tyranitar'] } },
    },
  };
  PG.currentRegion = 1;
  PG.region = () => PG.REGIONS[PG.currentRegion];
  PG.gyms = () => PG.REGIONS[PG.currentRegion].gyms;
  // Which region's league / gyms a badge id belongs to.
  PG.regionOfGym = (id) => (PG.GYMS_JOHTO.some(g => g.id === id) ? 2 : 1);
})();
