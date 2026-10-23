// Static game data: tuning constants, types, moves, species, gyms.
window.PG = window.PG || {};

PG.CONFIG = {
  // Cooldown after every move: BASE * (1 + TIREDNESS * missingHpFraction).
  // Full HP -> 1.5s, 50% HP -> 2.6s, near 0 HP -> 3.75s.
  MOVE_COOLDOWN_BASE: 1.5,
  TIREDNESS_FACTOR: 1.5,
  DODGE_TIREDNESS: 0.4,        // a dodge roll costs this share of the full move cooldown (stacks if you spam it)
  LEGENDARY_STAT_MULT: 1.6,    // legendaries' HP, Attack, Defense and Speed are multiplied by this (wild and caught)
  LEGENDARY_LEVEL: [95, 100],  // wild legendaries always appear in this level range
  LEGENDARY_AI_SKILL: 0.97,    // wild legendaries fight better than gym leaders
  // Contact (melee/dash) balance, so close-range fighters aren't simply kited by ranged attackers.
  CONTACT_COOLDOWN_MULT: 0.65, // contact moves tire the user less than ranged ones
  MELEE_LUNGE: 170,            // melee moves leap up to this far to reach a target just out of range
  CONTACT_STAGGER: 0.4,        // seconds a contact hit stops the target from moving or attacking
  BRAWLER_SPEED: 1.15,         // speed bonus when most of a Pokemon's damaging moves are contact moves
  // Projectiles lose power over long distances: full power up to NEAR px travelled, down to MIN at FAR px.
  FALLOFF_NEAR: 280,
  FALLOFF_FAR: 650,
  FALLOFF_MIN: 0.7,
  BALL_COOLDOWN: 2.0,
  SWITCH_COOLDOWN: 1.0,
  MAX_MOVES: 4,
  PARTY_SIZE: 6,
  GYM_TEAM_SIZE: 3,
  TILE: 32,
  MAP_W: 220,
  MAP_H: 160,
  WORLD_SEED: 1337,
  START_BALLS: 0,     // Poké Balls are bought at the Poké Mart, never handed out for free
  START_MONEY: 1500,
  DAY_LENGTH: 720,   // seconds of play for one full day/night cycle in the overworld
  // Pokémon League tournament (unlocked by all gym badges): 32-trainer single elimination.
  TOURNAMENT_SIZE: 32,
  TOURNAMENT_TEAM: 6,   // full 6-on-6 teams in the League
  // Testing: allow entering again after it ends, a "Continue" (retry) option after a loss,
  // and entering without all the badges. Set all three to false for the real one-time tournament.
  TOURNAMENT_DEBUG: true,
};

// Sold at the Poke Mart. hold: given to a Pokemon (stays on it); use: consumed from the bag.
// key: owned once, never used up (e.g. the Bicycle).
// ball: catch-rate multiplier (Infinity = always catches). Balls live in state.balls, keyed by id.
PG.ITEMS = {
  poke_ball:   { name: 'Poké Ball',   price: 200,   icon: '◓', ball: 1,   color: '#e33',    desc: 'Throw at a weakened wild Pokémon to catch it.' },
  great_ball:  { name: 'Great Ball',  price: 600,   icon: '◓', ball: 1.6, color: '#2f6fe0', desc: 'Better catch rate than a Poké Ball.' },
  ultra_ball:  { name: 'Ultra Ball',  price: 1200,  icon: '◓', ball: 2.4, color: '#222',    desc: 'High catch rate. Your best shot at a rare Pokémon.' },
  master_ball: { name: 'Master Ball', price: 50000, icon: '◓', ball: Infinity, color: '#7a3fc4', desc: 'Never fails. Save it for a legendary Pokémon.' },
  exp_share:  { name: 'Exp. Share', price: 1500, icon: '✦', hold: true,
    desc: 'Give it to a Pokémon. It earns full XP from every battle you win, even if it never fought.' },
  bicycle:    { name: 'Bicycle',    price: 5000, icon: '🚲', key: true, desc: 'Ride across the world much faster. Press C or tap 🚲 to get on and off.' },
  rare_candy: { name: 'Rare Candy', price: 1200, icon: '❖', use: true, desc: 'Instantly raises a Pokémon by one level.' },
};


PG.TYPES = {
  normal:   { color: '#a8a878' },
  fire:     { color: '#f08030' },
  water:    { color: '#6890f0' },
  grass:    { color: '#78c850' },
  electric: { color: '#f8d030' },
  ice:      { color: '#98d8d8' },
  fighting: { color: '#c03028' },
  poison:   { color: '#a040a0' },
  ground:   { color: '#e0c068' },
  flying:   { color: '#a890f0' },
  psychic:  { color: '#f85888' },
  bug:      { color: '#a8b820' },
  rock:     { color: '#b8a038' },
  ghost:    { color: '#705898' },
  dragon:   { color: '#7038f8' },
};

// attacker -> defender -> multiplier (missing = 1)
PG.TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  ice:      { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, fire: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, bug: 2, rock: 0.5, ghost: 0.5 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, poison: 2, flying: 0.5, psychic: 2, ghost: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2 },
  ghost:    { normal: 0, psychic: 0, ghost: 2 },
  dragon:   { dragon: 2 },
};

PG.BALL_IDS = ['poke_ball', 'great_ball', 'ultra_ball', 'master_ball'];

// Uses per battle (PP). A move can set pp itself; otherwise stronger moves get fewer uses.
PG.movePP = function (mv) {
  if (mv.pp) return mv.pp;
  if (mv.kind === 'heal') return 5;      // healing stays scarce
  if (!mv.power) return 12;
  return mv.power <= 50 ? 32 : mv.power <= 80 ? 23 : mv.power <= 100 ? 15 : 12;
};

PG.effectiveness = function (moveType, defTypes) {
  let m = 1;
  for (const t of defTypes) {
    const row = PG.TYPE_CHART[moveType] || {};
    if (row[t] !== undefined) m *= row[t];
  }
  return m;
};

// Move kinds:
//  melee      - short-range hit in front of the user; leaps in (MELEE_LUNGE) if the target is slightly too far
//  dash       - lunge toward the target, hits on contact; projectiles pass through a dashing Pokemon
// melee and dash are "contact" moves: cheaper cooldown and a short stagger on hit (see CONFIG).
//  projectile - fired at the target's current position (dodgeable); count/spread for multi-shot
//  area       - burst around the user
//  strike     - telegraphed circle at the target's position, lands after a delay (dodgeable)
//  buff/debuff- stat stage change on self / target
//  heal       - restore a fraction of max HP
//  none       - does nothing (Splash)
// drain: fraction of damage dealt returned as HP.
// hazard: leaves a zone after landing ({ kind: 'poison'|'fire', dur s, r px, pct of max HP per 0.5s tick });
//   only hurts the other side, and Poison / Fire types are immune to their own kind.
// pp: uses per battle (default from PG.movePP). recoil: fraction of damage dealt taken by the user.
// recharge: cooldown multiplier for heavy moves (Hyper Beam must recharge, big instant areas and heals are slow).
PG.MOVES = {
  tackle:        { name: 'Tackle',        type: 'normal',   power: 40,  kind: 'melee' },
  scratch:       { name: 'Scratch',       type: 'normal',   power: 40,  kind: 'melee' },
  quick_attack:  { name: 'Quick Attack',  type: 'normal',   power: 40,  kind: 'dash', dashSpeed: 900 },
  bite:          { name: 'Bite',          type: 'normal',   power: 60,  kind: 'melee' },
  hyper_fang:    { name: 'Hyper Fang',    type: 'normal',   power: 80,  kind: 'melee' },
  body_slam:     { name: 'Body Slam',     type: 'normal',   power: 80,  kind: 'dash', dashSpeed: 650 },
  swift:         { name: 'Swift',         type: 'normal',   power: 60,  kind: 'projectile', speed: 420, homing: true, size: 9 },
  hyper_beam:    { name: 'Hyper Beam',    type: 'normal',   power: 120, kind: 'projectile', speed: 620, size: 16, recharge: 1.6 },
  growl:         { name: 'Growl',         type: 'normal',   power: 0,   kind: 'debuff', stat: 'atk', stages: -1 },
  harden:        { name: 'Harden',        type: 'normal',   power: 0,   kind: 'buff', stat: 'def', stages: 1 },
  recover:       { name: 'Recover',       type: 'normal',   power: 0,   kind: 'heal', amount: 0.3, recharge: 2, pp: 5 },
  splash:        { name: 'Splash',        type: 'normal',   power: 0,   kind: 'none' },
  // Used automatically once every move is out of PP. Hurts the user too.
  struggle:      { name: 'Struggle',      type: 'normal',   power: 50,  kind: 'melee', recoil: 0.25, pp: Infinity },

  ember:         { name: 'Ember',         type: 'fire',     power: 40,  kind: 'projectile', speed: 480, size: 9 },
  fire_fang:     { name: 'Fire Fang',     type: 'fire',     power: 65,  kind: 'melee' },
  flamethrower:  { name: 'Flamethrower',  type: 'fire',     power: 90,  kind: 'projectile', speed: 560, size: 13, count: 3, spread: 0.12 },
  fire_spin:     { name: 'Fire Spin',     type: 'fire',     power: 55,  kind: 'area', radius: 130 },
  // Fire Blast: the classic five-armed "大" flame, shot from the user; it only hits if it touches the target.
  fire_blast:    { name: 'Fire Blast',    type: 'fire',     power: 110, kind: 'projectile', speed: 400, size: 20, hazard: { kind: 'fire', dur: 2.5, r: 65, pct: 0.02 } },

  water_gun:     { name: 'Water Gun',     type: 'water',    power: 40,  kind: 'projectile', speed: 480, size: 9 },
  bubble_beam:   { name: 'Bubble Beam',   type: 'water',    power: 65,  kind: 'projectile', speed: 400, size: 8, count: 3, spread: 0.25 },
  surf:          { name: 'Surf',          type: 'water',    power: 85,  kind: 'area', radius: 145, recharge: 1.3 },
  // Swim also lets you cross water in the overworld (any party Pokémon that knows it carries you).
  swim:          { name: 'Swim',          type: 'water',    power: 55,  kind: 'dash', dashSpeed: 850 },
  hydro_pump:    { name: 'Hydro Pump',    type: 'water',    power: 110, kind: 'projectile', speed: 380, size: 20 },

  vine_whip:     { name: 'Vine Whip',     type: 'grass',    power: 45,  kind: 'melee', range: 120 },
  razor_leaf:    { name: 'Razor Leaf',    type: 'grass',    power: 55,  kind: 'projectile', speed: 520, size: 7, count: 3, spread: 0.3 },
  mega_drain:    { name: 'Mega Drain',    type: 'grass',    power: 45,  kind: 'projectile', speed: 420, size: 10, drain: 0.5 },
  solar_beam:    { name: 'Solar Beam',    type: 'grass',    power: 120, kind: 'projectile', speed: 330, size: 22 },

  thunder_shock: { name: 'Thunder Shock', type: 'electric', power: 40,  kind: 'projectile', speed: 560, size: 8 },
  spark:         { name: 'Spark',         type: 'electric', power: 65,  kind: 'dash', dashSpeed: 800 },
  thunderbolt:   { name: 'Thunderbolt',   type: 'electric', power: 90,  kind: 'projectile', speed: 650, size: 12 },
  thunder:       { name: 'Thunder',       type: 'electric', power: 110, kind: 'strike', radius: 75, delay: 0.7 },

  ice_beam:      { name: 'Ice Beam',      type: 'ice',      power: 90,  kind: 'projectile', speed: 560, size: 12 },
  aurora_beam:   { name: 'Aurora Beam',   type: 'ice',      power: 65,  kind: 'projectile', speed: 500, size: 10 },

  karate_chop:   { name: 'Karate Chop',   type: 'fighting', power: 50,  kind: 'melee' },
  low_kick:      { name: 'Low Kick',      type: 'fighting', power: 65,  kind: 'melee' },
  cross_chop:    { name: 'Cross Chop',    type: 'fighting', power: 100, kind: 'dash', dashSpeed: 700 },
  bulk_up:       { name: 'Bulk Up',       type: 'fighting', power: 0,   kind: 'buff', stat: 'atk', stages: 1 },

  poison_sting:  { name: 'Poison Sting',  type: 'poison',   power: 30,  kind: 'projectile', speed: 520, size: 6 },
  acid:          { name: 'Acid',          type: 'poison',   power: 45,  kind: 'projectile', speed: 420, size: 10, count: 2, spread: 0.2, hazard: { kind: 'poison', dur: 2, r: 40, pct: 0.02 } },
  sludge_bomb:   { name: 'Sludge Bomb',   type: 'poison',   power: 90,  kind: 'strike', radius: 80, delay: 0.8, hazard: { kind: 'poison', dur: 2.5, r: 75, pct: 0.02 } },

  sand_attack:   { name: 'Sand Attack',   type: 'ground',   power: 0,   kind: 'debuff', stat: 'spd', stages: -1 },
  mud_slap:      { name: 'Mud-Slap',      type: 'ground',   power: 40,  kind: 'projectile', speed: 460, size: 10 },
  dig:           { name: 'Dig',           type: 'ground',   power: 80,  kind: 'strike', radius: 65, delay: 1.0 },
  earthquake:    { name: 'Earthquake',    type: 'ground',   power: 90,  kind: 'area', radius: 150, recharge: 1.5 },

  gust:          { name: 'Gust',          type: 'flying',   power: 40,  kind: 'projectile', speed: 460, size: 12 },
  wing_attack:   { name: 'Wing Attack',   type: 'flying',   power: 60,  kind: 'melee', range: 95 },
  aerial_ace:    { name: 'Aerial Ace',    type: 'flying',   power: 65,  kind: 'dash', dashSpeed: 950 },
  hurricane:     { name: 'Hurricane',     type: 'flying',   power: 95,  kind: 'area', radius: 150, recharge: 1.5 },

  confusion:     { name: 'Confusion',     type: 'psychic',  power: 50,  kind: 'projectile', speed: 440, size: 11, homing: true },
  psybeam:       { name: 'Psybeam',       type: 'psychic',  power: 65,  kind: 'projectile', speed: 560, size: 11 },
  psychic:       { name: 'Psychic',       type: 'psychic',  power: 90,  kind: 'strike', radius: 80, delay: 0.7 },

  string_shot:   { name: 'String Shot',   type: 'bug',      power: 0,   kind: 'debuff', stat: 'spd', stages: -2 },
  bug_bite:      { name: 'Bug Bite',      type: 'bug',      power: 60,  kind: 'melee' },
  leech_life:    { name: 'Leech Life',    type: 'bug',      power: 60,  kind: 'melee', drain: 0.5 },
  signal_beam:   { name: 'Signal Beam',   type: 'bug',      power: 75,  kind: 'projectile', speed: 500, size: 11 },

  rock_throw:    { name: 'Rock Throw',    type: 'rock',     power: 50,  kind: 'projectile', speed: 400, size: 13 },
  rock_slide:    { name: 'Rock Slide',    type: 'rock',     power: 75,  kind: 'strike', radius: 90, delay: 0.85 },
  stone_edge:    { name: 'Stone Edge',    type: 'rock',     power: 100, kind: 'projectile', speed: 520, size: 15, count: 2, spread: 0.15 },

  lick:          { name: 'Lick',          type: 'ghost',    power: 30,  kind: 'melee' },
  night_shade:   { name: 'Night Shade',   type: 'ghost',    power: 60,  kind: 'strike', radius: 70, delay: 0.6 },
  shadow_ball:   { name: 'Shadow Ball',   type: 'ghost',    power: 80,  kind: 'projectile', speed: 430, size: 15, homing: true },

  dragon_rage:   { name: 'Dragon Rage',   type: 'dragon',   power: 60,  kind: 'projectile', speed: 480, size: 13 },
  dragon_pulse:  { name: 'Dragon Pulse',  type: 'dragon',   power: 90,  kind: 'projectile', speed: 520, size: 15 },
};

// Base stats are close to the originals. learnset: [level, moveId]. evolves: { level, into }.
// habitat: biomes where the species spawns wild; minLv: earliest wild level.
PG.SPECIES = {
  bulbasaur:  { dex: 1,   name: 'Bulbasaur',  types: ['grass', 'poison'], base: { hp: 45, atk: 49, def: 49, spd: 45 }, exp: 64,
    learnset: [[1, 'tackle'], [1, 'growl'], [7, 'vine_whip'], [13, 'poison_sting'], [20, 'razor_leaf'], [27, 'mega_drain'], [36, 'sludge_bomb'], [44, 'solar_beam']],
    evolves: { level: 16, into: 'ivysaur' }, habitat: [] },
  ivysaur:    { dex: 2,   name: 'Ivysaur',    types: ['grass', 'poison'], base: { hp: 60, atk: 62, def: 63, spd: 60 }, exp: 142,
    learnset: [[1, 'tackle'], [1, 'vine_whip']], evolves: { level: 32, into: 'venusaur' }, habitat: [] },
  venusaur:   { dex: 3,   name: 'Venusaur',   types: ['grass', 'poison'], base: { hp: 80, atk: 82, def: 83, spd: 80 }, exp: 236,
    learnset: [[1, 'razor_leaf'], [32, 'earthquake']], habitat: [] },

  charmander: { dex: 4,   name: 'Charmander', types: ['fire'], base: { hp: 39, atk: 52, def: 43, spd: 65 }, exp: 62,
    learnset: [[1, 'scratch'], [1, 'growl'], [7, 'ember'], [13, 'bite'], [19, 'fire_fang'], [28, 'fire_spin'], [36, 'flamethrower'], [46, 'fire_blast']],
    evolves: { level: 16, into: 'charmeleon' }, habitat: [] },
  charmeleon: { dex: 5,   name: 'Charmeleon', types: ['fire'], base: { hp: 58, atk: 64, def: 58, spd: 80 }, exp: 142,
    learnset: [[1, 'scratch'], [1, 'ember']], evolves: { level: 36, into: 'charizard' }, habitat: [] },
  charizard:  { dex: 6,   name: 'Charizard',  types: ['fire', 'flying'], base: { hp: 78, atk: 84, def: 78, spd: 100 }, exp: 240,
    learnset: [[1, 'wing_attack'], [36, 'aerial_ace'], [42, 'dragon_pulse'], [50, 'hurricane']], habitat: [] },

  squirtle:   { dex: 7,   name: 'Squirtle',   types: ['water'], base: { hp: 44, atk: 48, def: 65, spd: 43 }, exp: 63,
    learnset: [[1, 'tackle'], [1, 'harden'], [7, 'water_gun'], [13, 'bite'], [20, 'bubble_beam'], [28, 'aurora_beam'], [36, 'surf'], [44, 'hydro_pump']],
    evolves: { level: 16, into: 'wartortle' }, habitat: [] },
  wartortle:  { dex: 8,   name: 'Wartortle',  types: ['water'], base: { hp: 59, atk: 63, def: 80, spd: 58 }, exp: 142,
    learnset: [[1, 'tackle'], [1, 'water_gun']], evolves: { level: 36, into: 'blastoise' }, habitat: [] },
  blastoise:  { dex: 9,   name: 'Blastoise',  types: ['water'], base: { hp: 79, atk: 83, def: 100, spd: 78 }, exp: 239,
    learnset: [[1, 'water_gun'], [40, 'ice_beam']], habitat: [] },

  pikachu:    { dex: 25,  name: 'Pikachu',    types: ['electric'], base: { hp: 35, atk: 55, def: 40, spd: 90 }, exp: 112,
    learnset: [[1, 'thunder_shock'], [1, 'growl'], [6, 'quick_attack'], [15, 'swift'], [21, 'spark'], [29, 'thunderbolt'], [42, 'thunder']],
    evolves: { level: 30, into: 'raichu' }, habitat: ['forest'], minLv: 6 },
  raichu:     { dex: 26,  name: 'Raichu',     types: ['electric'], base: { hp: 60, atk: 90, def: 55, spd: 110 }, exp: 218,
    learnset: [[1, 'thunder_shock'], [1, 'quick_attack']], habitat: [] },

  caterpie:   { dex: 10,  name: 'Caterpie',   types: ['bug'], base: { hp: 45, atk: 30, def: 35, spd: 45 }, exp: 39,
    learnset: [[1, 'tackle'], [1, 'string_shot'], [9, 'bug_bite']], evolves: { level: 7, into: 'metapod' }, habitat: ['forest', 'grass'], minLv: 2 },
  metapod:    { dex: 11,  name: 'Metapod',    types: ['bug'], base: { hp: 50, atk: 20, def: 55, spd: 30 }, exp: 72,
    learnset: [[1, 'harden']], evolves: { level: 10, into: 'butterfree' }, habitat: ['forest'], minLv: 7 },
  butterfree: { dex: 12,  name: 'Butterfree', types: ['bug', 'flying'], base: { hp: 60, atk: 45, def: 50, spd: 70 }, exp: 178,
    learnset: [[1, 'confusion'], [1, 'gust'], [16, 'psybeam'], [24, 'signal_beam'], [34, 'psychic']], habitat: [] },

  pidgey:     { dex: 16,  name: 'Pidgey',     types: ['normal', 'flying'], base: { hp: 40, atk: 45, def: 40, spd: 56 }, exp: 50,
    learnset: [[1, 'tackle'], [5, 'sand_attack'], [9, 'gust'], [15, 'quick_attack'], [21, 'wing_attack'], [33, 'aerial_ace'], [44, 'hurricane']],
    evolves: { level: 18, into: 'pidgeotto' }, habitat: ['grass', 'forest'], minLv: 2 },
  pidgeotto:  { dex: 17,  name: 'Pidgeotto',  types: ['normal', 'flying'], base: { hp: 63, atk: 60, def: 55, spd: 58 }, exp: 122,
    learnset: [[1, 'gust']], evolves: { level: 36, into: 'pidgeot' }, habitat: ['grass'], minLv: 18 },
  pidgeot:    { dex: 18,  name: 'Pidgeot',    types: ['normal', 'flying'], base: { hp: 83, atk: 80, def: 75, spd: 101 }, exp: 216,
    learnset: [[1, 'gust']], habitat: [] },

  rattata:    { dex: 19,  name: 'Rattata',    types: ['normal'], base: { hp: 30, atk: 56, def: 35, spd: 72 }, exp: 51,
    learnset: [[1, 'tackle'], [4, 'quick_attack'], [10, 'bite'], [16, 'hyper_fang'], [30, 'body_slam']],
    evolves: { level: 20, into: 'raticate' }, habitat: ['grass', 'sand'], minLv: 2 },
  raticate:   { dex: 20,  name: 'Raticate',   types: ['normal'], base: { hp: 55, atk: 81, def: 60, spd: 97 }, exp: 145,
    learnset: [[1, 'hyper_fang']], habitat: ['grass'], minLv: 20 },

  sandshrew:  { dex: 27,  name: 'Sandshrew',  types: ['ground'], base: { hp: 50, atk: 75, def: 85, spd: 40 }, exp: 60,
    learnset: [[1, 'scratch'], [1, 'sand_attack'], [9, 'mud_slap'], [17, 'rock_throw'], [26, 'dig'], [38, 'earthquake']],
    evolves: { level: 22, into: 'sandslash' }, habitat: ['sand', 'rock'], minLv: 4 },
  sandslash:  { dex: 28,  name: 'Sandslash',  types: ['ground'], base: { hp: 75, atk: 100, def: 110, spd: 65 }, exp: 158,
    learnset: [[1, 'scratch']], habitat: ['rock'], minLv: 22 },

  vulpix:     { dex: 37,  name: 'Vulpix',     types: ['fire'], base: { hp: 38, atk: 41, def: 40, spd: 65 }, exp: 60,
    learnset: [[1, 'ember'], [1, 'growl'], [8, 'quick_attack'], [16, 'fire_spin'], [26, 'confusion'], [34, 'flamethrower']],
    habitat: ['grass', 'rock'], minLv: 8 },

  zubat:      { dex: 41,  name: 'Zubat',      types: ['poison', 'flying'], base: { hp: 40, atk: 45, def: 35, spd: 55 }, exp: 49,
    learnset: [[1, 'leech_life'], [5, 'poison_sting'], [11, 'bite'], [17, 'wing_attack'], [27, 'acid'], [37, 'sludge_bomb']],
    evolves: { level: 22, into: 'golbat' }, habitat: ['rock', 'forest'], minLv: 3 },
  golbat:     { dex: 42,  name: 'Golbat',     types: ['poison', 'flying'], base: { hp: 75, atk: 80, def: 70, spd: 90 }, exp: 159,
    learnset: [[1, 'leech_life']], habitat: ['rock'], minLv: 22 },

  oddish:     { dex: 43,  name: 'Oddish',     types: ['grass', 'poison'], base: { hp: 45, atk: 50, def: 55, spd: 65 }, exp: 64,
    learnset: [[1, 'acid'], [5, 'mega_drain'], [14, 'poison_sting'], [23, 'razor_leaf'], [32, 'sludge_bomb'], [40, 'solar_beam']],
    evolves: { level: 21, into: 'gloom' }, habitat: ['forest', 'grass'], minLv: 3 },
  gloom:      { dex: 44,  name: 'Gloom',      types: ['grass', 'poison'], base: { hp: 60, atk: 65, def: 70, spd: 75 }, exp: 138,
    learnset: [[1, 'acid']], habitat: ['forest'], minLv: 21 },

  growlithe:  { dex: 58,  name: 'Growlithe',  types: ['fire'], base: { hp: 55, atk: 70, def: 45, spd: 60 }, exp: 70,
    learnset: [[1, 'bite'], [1, 'ember'], [12, 'fire_fang'], [22, 'body_slam'], [30, 'flamethrower'], [40, 'fire_blast']],
    evolves: { level: 30, into: 'arcanine' }, habitat: ['grass', 'sand'], minLv: 10 },
  arcanine:   { dex: 59,  name: 'Arcanine',   types: ['fire'], base: { hp: 90, atk: 110, def: 80, spd: 95 }, exp: 194,
    learnset: [[1, 'ember'], [30, 'quick_attack']], habitat: [] },

  poliwag:    { dex: 60,  name: 'Poliwag',    types: ['water'], base: { hp: 40, atk: 50, def: 40, spd: 90 }, exp: 60,
    learnset: [[1, 'water_gun'], [6, 'tackle'], [12, 'bubble_beam'], [24, 'body_slam'], [32, 'hydro_pump']],
    evolves: { level: 25, into: 'poliwhirl' }, habitat: ['water', 'sand'], minLv: 3 },
  poliwhirl:  { dex: 61,  name: 'Poliwhirl',  types: ['water'], base: { hp: 65, atk: 65, def: 65, spd: 90 }, exp: 135,
    learnset: [[1, 'water_gun'], [28, 'low_kick']], habitat: ['water'], minLv: 25 },

  abra:       { dex: 63,  name: 'Abra',       types: ['psychic'], base: { hp: 25, atk: 20, def: 15, spd: 90 }, exp: 62,
    learnset: [[1, 'confusion'], [6, 'swift'], [11, 'night_shade']], evolves: { level: 16, into: 'kadabra' }, habitat: ['grass', 'rock'], minLv: 7 },
  kadabra:    { dex: 64,  name: 'Kadabra',    types: ['psychic'], base: { hp: 40, atk: 35, def: 30, spd: 105 }, exp: 140,
    learnset: [[1, 'confusion'], [1, 'swift'], [16, 'psybeam'], [20, 'night_shade'], [24, 'recover'], [28, 'signal_beam'], [32, 'psychic'], [36, 'thunderbolt'], [40, 'shadow_ball']], habitat: [] },

  machop:     { dex: 66,  name: 'Machop',     types: ['fighting'], base: { hp: 70, atk: 80, def: 50, spd: 35 }, exp: 61,
    learnset: [[1, 'low_kick'], [1, 'growl'], [9, 'karate_chop'], [17, 'bulk_up'], [25, 'rock_slide'], [33, 'cross_chop']],
    evolves: { level: 28, into: 'machoke' }, habitat: ['rock'], minLv: 6 },
  machoke:    { dex: 67,  name: 'Machoke',    types: ['fighting'], base: { hp: 80, atk: 100, def: 70, spd: 45 }, exp: 142,
    learnset: [[1, 'low_kick']], habitat: ['rock'], minLv: 28 },

  geodude:    { dex: 74,  name: 'Geodude',    types: ['rock', 'ground'], base: { hp: 40, atk: 80, def: 100, spd: 20 }, exp: 60,
    learnset: [[1, 'tackle'], [1, 'harden'], [6, 'rock_throw'], [12, 'mud_slap'], [18, 'rock_slide'], [30, 'earthquake'], [36, 'stone_edge']],
    evolves: { level: 25, into: 'graveler' }, habitat: ['rock'], minLv: 3 },
  graveler:   { dex: 75,  name: 'Graveler',   types: ['rock', 'ground'], base: { hp: 55, atk: 95, def: 115, spd: 35 }, exp: 137,
    learnset: [[1, 'rock_throw']], habitat: ['rock'], minLv: 25 },

  gastly:     { dex: 92,  name: 'Gastly',     types: ['ghost', 'poison'], base: { hp: 30, atk: 35, def: 30, spd: 80 }, exp: 62,
    learnset: [[1, 'lick'], [8, 'night_shade'], [15, 'confusion'], [22, 'shadow_ball'], [33, 'sludge_bomb']],
    evolves: { level: 25, into: 'haunter' }, habitat: ['forest'], minLv: 10 },
  haunter:    { dex: 93,  name: 'Haunter',    types: ['ghost', 'poison'], base: { hp: 45, atk: 50, def: 45, spd: 95 }, exp: 142,
    learnset: [[1, 'lick'], [30, 'psychic']], habitat: [] },

  magikarp:   { dex: 129, name: 'Magikarp',   types: ['water'], base: { hp: 20, atk: 10, def: 55, spd: 80 }, exp: 40,
    learnset: [[1, 'splash'], [15, 'tackle']], evolves: { level: 20, into: 'gyarados' }, habitat: ['water'], minLv: 2 },
  gyarados:   { dex: 130, name: 'Gyarados',   types: ['water', 'flying'], base: { hp: 95, atk: 125, def: 79, spd: 81 }, exp: 189,
    learnset: [[1, 'bite'], [20, 'dragon_rage'], [26, 'aurora_beam'], [32, 'hydro_pump'], [42, 'hyper_beam']], habitat: [] },

  dratini:    { dex: 147, name: 'Dratini',    types: ['dragon'], base: { hp: 41, atk: 64, def: 45, spd: 50 }, exp: 60,
    learnset: [[1, 'tackle'], [1, 'growl'], [10, 'dragon_rage'], [20, 'body_slam'], [30, 'dragon_pulse'], [40, 'hyper_beam']],
    evolves: { level: 30, into: 'dragonair' }, habitat: ['water'], minLv: 15, rare: true },
  dragonair:  { dex: 148, name: 'Dragonair',  types: ['dragon'], base: { hp: 61, atk: 84, def: 65, spd: 70 }, exp: 147,
    learnset: [[1, 'dragon_rage']], habitat: [] },
};

PG.STARTERS = ['bulbasaur', 'charmander', 'squirtle', 'pikachu'];

// Gyms are placed in the world by world.js along carved paths, farther out = later; order = difficulty.
// Badge ids of the first gyms are kept from older versions so existing saves keep their badges.
PG.GYMS = [
  { id: 'pewter',    city: 'Pewter City',    name: 'Boulder Gym', leader: 'Brock',    type: 'rock',     badge: 'Boulder Badge', aiSkill: 0.55,
    team: [['geodude', 12], ['sandshrew', 13], ['onix', 14]] },
  { id: 'cerulean',  city: 'Cerulean City',  name: 'Cascade Gym', leader: 'Misty',    type: 'water',    badge: 'Cascade Badge', aiSkill: 0.62,
    team: [['staryu', 18], ['poliwhirl', 19], ['starmie', 21]] },
  { id: 'vermilion', city: 'Vermilion City', name: 'Thunder Gym', leader: 'Lt. Surge', type: 'electric', badge: 'Thunder Badge', aiSkill: 0.68,
    team: [['voltorb', 24], ['magnemite', 25], ['raichu', 27]] },
  { id: 'celadon',   city: 'Celadon City',   name: 'Rainbow Gym', leader: 'Erika',    type: 'grass',    badge: 'Rainbow Badge', aiSkill: 0.73,
    team: [['tangela', 29], ['victreebel', 30], ['vileplume', 32]] },
  { id: 'fuchsia',   city: 'Fuchsia City',   name: 'Soul Gym',    leader: 'Koga',     type: 'poison',   badge: 'Soul Badge',    aiSkill: 0.78,
    team: [['golbat', 34], ['muk', 35], ['weezing', 37]] },
  { id: 'saffron',   city: 'Saffron City',   name: 'Marsh Gym',   leader: 'Sabrina',  type: 'psychic',  badge: 'Marsh Badge',   aiSkill: 0.84,
    team: [['kadabra', 39], ['mr_mime', 40], ['alakazam', 42]] },
  { id: 'cinnabar',  city: 'Cinnabar Island', name: 'Volcano Gym', leader: 'Blaine', type: 'fire',     badge: 'Volcano Badge', aiSkill: 0.88,
    team: [['ninetales', 44], ['rapidash', 45], ['arcanine', 47]] },
  { id: 'viridian',  city: 'Viridian City',  name: 'Earth Gym',   leader: 'Giovanni', type: 'ground',   badge: 'Earth Badge',   aiSkill: 0.93,
    team: [['dugtrio', 50], ['nidoking', 52], ['rhydon', 55]] },
];

