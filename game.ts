import { type Powers, RACERS } from "./racers.ts";
import RATINGS from "./ratings.json" with { type: "json" };

export const NAMES = [
  "Alchemist", "Baba Yaga", "Banana", "Blimp", "Centaur", "Cheerleader",
  "Coach", "Copycat", "Dicemonger", "Duelist", "Egg", "Flip Flop",
  "Genius", "Gunk", "Hare", "Heckler", "Huge Baby", "Hypnotist",
  "Inchworm", "Lackey", "Leaptoad", "Legs", "Lovable Loser", "Magician",
  "Mastermind", "M.O.U.T.H.", "Party Animal", "Rocket Scientist", "Romantic", "Scoocher",
  "Sisyphus", "Skipper", "Stickler", "Suckerfish", "Third Wheel", "Twin",
] as const;
export type Name = (typeof NAMES)[number];

export type Space = { arrow?: number; trip?: boolean; star?: boolean };
export type Track = {
  name: string;
  /** Spaces are 0 (Start) to length - 1; reaching `length` crosses the finish line. */
  length: number;
  /** Blimp's "second corner". */
  corner2: number;
  spaces: Record<number, Space>;
};

export const MILD_MILE: Track = { name: "Mild Mile", length: 30, corner2: 15, spaces: {} };

/** From the board; the rulebook doesn't show it. Arrows point back along the bottom row at 16 and 24. */
export const WILD_WILDS: Track = {
  name: "Wild Wilds",
  length: 30,
  corner2: 15,
  spaces: {
    1: { star: true },
    5: { trip: true },
    7: { arrow: 3 },
    11: { arrow: 1 },
    13: { star: true },
    16: { arrow: -4 },
    17: { trip: true },
    23: { arrow: 2 },
    24: { arrow: -2 },
    26: { trip: true },
  },
};

/** Gold and silver chip values, by race. */
export const GOLD = [3, 4, 4, 5];
export const SILVER = [2, 3, 3, 4];
/** Points in bronze chips in the box, shared by the whole game: 16 one-point and 9 three-point. */
export const BRONZE = 16 + 9 * 3;

export type Racer = {
  name: Name;
  seat: number;
  /** Whose racer it is; the same as `seat` except in the two-racer variants. */
  player: number;
  pos: number;
  tripped: boolean;
  place: number | null;
  eliminated: number | null;
  /** Bronze chips gained (or lost) this race. */
  bronze: number;
  /** Powers gained before the race (Egg, Twin). */
  copied: Name[];
  turns: number;
  /** Mastermind's predicted winner. */
  prediction: Name | null;
  /** Genius's predicted roll. */
  guess: number | null;
  trips: number;
  uses: number;
};

export type Policy = {
  /** Higher is better. Used for Egg, Twin, Copycat ties, Mastermind and drafting. */
  rating(name: Name): number;
  /** Whether to reroll the main move, with `left` rerolls to go. */
  reroll(race: Race, r: Racer, roll: number, left: number): boolean;
  /** Overrides for racers' optional choices; see `Powers.choose` in `racers.ts`. */
  choose: Partial<Record<Name, NonNullable<Powers["choose"]>>>;
};

export const defaultPolicy: Policy = {
  // Draft value from `lineup.ts --write`: points a game over an average pick.
  rating: (name) => RATINGS.draft[name],
  reroll(race, r, roll, left) {
    if (race.has(r, "Alchemist") && roll <= 2) return false;
    if (race.has(r, "Sisyphus") && roll === 6) return true;
    return roll <= (left >= 2 ? 4 : 3);
  },
  choose: {},
};

function best(names: Name[], rating: (n: Name) => number): Name {
  return names.reduce((a, b) => (rating(b) > rating(a) ? b : a));
}

/**
 * The best assignment of racers to races, by points per race (`ratings.json` by default):
 * `order[i]` is the race `team[i]` plays in. A race listed twice takes two racers.
 */
export function assign(team: Name[], points: Record<Name, number[]> = RATINGS.points, races = [0, 1, 2, 3].slice(4 - team.length)) {
  let value = -Infinity;
  let order: number[] = [];
  const go = (i: number, left: number[], v: number, o: number[]) => {
    if (i === team.length) {
      if (v > value) [value, order] = [v, o];
      return;
    }
    left.forEach((race, j) => {
      if (left.indexOf(race) === j) go(i + 1, [...left.slice(0, j), ...left.slice(j + 1)], v + points[team[i]][race], [...o, race]);
    });
  };
  go(0, races, 0, []);
  return { value, order };
}

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Not an Error, so throwing it doesn't capture a stack trace every race.
class RaceOver {}

export type RaceOptions = {
  /** One racer per seat, in clockwise order. */
  racers: Name[];
  /** Each seat's player, when players race two racers each. Defaults to one player per seat. */
  players?: number[];
  track?: Track;
  rng?: () => number;
  /** Scripted die rolls, used before `rng`. */
  dice?: number[];
  policy?: Partial<Policy>;
  /** Racers who won earlier races this game, for Twin. */
  winners?: Name[];
  /** Undrawn racer cards, for Egg. Defaults to every racer not in this race. */
  deck?: Name[];
  /** Points each player already has, so Sisyphus can't lose chips that don't exist. */
  bank?: number[];
  /** Bronze points left in the box. */
  supply?: number;
  first?: number;
  log?: boolean;
  rules?: Partial<Rules>;
  /** Snapshot each turn so choices can be decided by `Race.playout`. */
  playouts?: boolean;
};

/** Readings of rules that are still unsettled, for `sensitivity.ts`. */
export type Rules = {
  /**
   * A main move pushed below 0 moves backwards. Alex Hague said yes, Richard Garfield thought it
   * was capped at 0: https://boardgamegeek.com/thread/3598754
   */
  backwards: boolean;
  /**
   * Powers a stop or pass triggers are all checked first, then resolve in turn order even if the
   * board has changed, as Richard Garfield plays it (by his own account, not a ruling):
   * https://boardgamegeek.com/thread/3635297/article/47086150
   */
  queue: boolean;
};

const RULES: Rules = { backwards: false, queue: false };

export type RaceResult = {
  racers: Racer[];
  /** Seats in finishing order. A Mastermind who predicted themself appears twice. */
  finishers: number[];
  turns: number;
  /** Times the infinite-loop rule cut a chain short. */
  loops: number;
  stalled: boolean;
};

type Hook = [owner: Racer, power: Name, hooks: Powers];

const MAX_TURNS = 1000;
const MAX_DEPTH = 200;

export class Race {
  racers: Racer[];
  track: Track;
  policy: Policy;
  rng: () => number;
  dice: number[];
  winners: Name[];
  deck: Name[];
  bank: number[];
  supply: number;
  rules: Rules;
  log: string[] | null;
  current: Racer;
  finishers: Racer[] = [];
  queue: Racer[] = [];
  /** Effects that wait until the main move is done, like Rocket Scientist's trip. */
  afterMain: (() => void)[] = [];
  turns = 0;
  loops = 0;
  eliminations = 0;
  seen = new Set<string>();
  depth = 0;
  hooks = new Map<string, Hook[]>();
  /** For `playout`: the race as this turn started, and the dice and choices since. */
  playouts: boolean;
  snapshot: Race | null = null;
  rolled: number[] = [];
  chosen: (readonly [seat: number, power: Name, choice: unknown])[] = [];
  /** Choices a playout replays or forces, used in order. */
  forced: (readonly [seat: number, power: Name, choice: unknown])[] = [];

  constructor(o: RaceOptions) {
    this.track = o.track ?? MILD_MILE;
    this.policy = { ...defaultPolicy, ...o.policy, choose: { ...defaultPolicy.choose, ...o.policy?.choose } };
    this.rng = o.rng ?? Math.random;
    this.dice = [...(o.dice ?? [])];
    this.winners = o.winners ?? [];
    this.deck = o.deck ?? NAMES.filter((n) => !o.racers.includes(n));
    this.bank = o.bank ?? o.racers.map(() => 0);
    this.supply = o.supply ?? BRONZE;
    this.rules = { ...RULES, ...o.rules };
    this.playouts = o.playouts ?? false;
    this.log = o.log ? [] : null;
    this.racers = o.racers.map((name, seat) => ({
      name, seat, player: o.players?.[seat] ?? seat, pos: 0, tripped: false, place: null, eliminated: null,
      bronze: 0, copied: [], turns: 0, prediction: null, guess: null, trips: 0, uses: 0,
    }));
    this.current = this.racers[o.first ?? 0];
  }

  d6() {
    const roll = this.dice.shift() ?? 1 + Math.floor(this.rng() * 6);
    if (this.playouts) this.rolled.push(roll);
    return roll;
  }

  /** A copy of this race to play on, with its own random numbers and no dice scripted. */
  clone(rng: () => number): Race {
    const c: Race = Object.assign(Object.create(Race.prototype), this);
    c.racers = this.racers.map((r) => ({ ...r, copied: [...r.copied] }));
    const same = (r: Racer) => c.racers[r.seat];
    c.current = same(this.current);
    c.finishers = this.finishers.map(same);
    c.queue = this.queue.map(same);
    c.rng = rng;
    c.dice = [];
    c.winners = [...this.winners];
    c.deck = [...this.deck];
    c.bank = [...this.bank];
    c.afterMain = [];
    c.seen = new Set();
    c.depth = 0;
    c.hooks = new Map();
    c.log = null;
    c.playouts = false;
    c.snapshot = null;
    c.forced = [];
    return c;
  }

  /**
   * Plays the rest of the race `k` times from the start of this turn: the same dice and choices
   * up to now, then `me` choosing `choice` the next time its power `p` asks, then fresh dice and
   * default choices. Returns `value` of each result, averaged.
   */
  playout(me: Racer, p: Name, choice: unknown, k: number, value: (result: RaceResult, me: Racer) => number) {
    let total = 0;
    for (let i = 0; i < k; i++) {
      const sim = this.snapshot!.clone(mulberry32(Math.floor(this.rng() * 2 ** 32)));
      // A choice of racer means the same seat in the copy.
      const own = (x: unknown) => (x && typeof x === "object" && "seat" in x ? sim.racers[(x as Racer).seat] : x);
      sim.dice = [...this.rolled];
      sim.forced = [...this.chosen, [me.seat, p, choice] as const].map(([seat, q, c]) => [seat, q, own(c)] as const);
      const result = sim.race(sim.current);
      total += value(result, result.racers[me.seat]);
    }
    return total / k;
  }

  say(s: string) {
    this.log?.push(s);
  }

  active(r: Racer) {
    return r.place === null && r.eliminated === null;
  }

  /** Whether `r` is still on the track at `at`. */
  stays(r: Racer, at: number) {
    return this.active(r) && r.pos === at;
  }

  onTrack() {
    return this.racers.filter((r) => this.active(r));
  }

  at(pos: number) {
    return this.onTrack().filter((r) => r.pos === pos);
  }

  lead() {
    const on = this.onTrack();
    const max = Math.max(...on.map((r) => r.pos));
    return on.filter((r) => r.pos === max);
  }

  last() {
    const on = this.onTrack();
    const min = Math.min(...on.map((r) => r.pos));
    return on.filter((r) => r.pos === min);
  }

  /** Active racers, starting with the current player and going clockwise. */
  byPriority() {
    const n = this.racers.length;
    const order: Racer[] = [];
    for (let i = 0; i < n; i++) {
      const r = this.racers[(this.current.seat + i) % n];
      if (this.active(r)) order.push(r);
    }
    return order;
  }

  powers(r: Racer, depth = 0): Name[] {
    if (!this.active(r)) return [];
    const ps: Name[] = [r.name, ...r.copied];
    for (const p of [...ps]) {
      const target = depth < 2 ? RACERS[p].copies?.(this, r) : null;
      if (!target) continue;
      for (const q of this.powers(target, depth + 1)) if (!RACERS[q].copies && !RACERS[q].beforeRace) ps.push(q);
    }
    return ps;
  }

  has(r: Racer, p: Name) {
    return this.powers(r).includes(p);
  }

  /** `r`'s own powers. */
  own(r: Racer): [Name, Powers][] {
    return this.powers(r).map((p) => [p, RACERS[p]]);
  }

  /** Every power on the track, in priority order. Don't mutate the result: it's cached. */
  all(): Hook[] {
    // Powers depend only on whose turn it is, who's still racing, and the lead, for copiers.
    let key = `${this.current.seat}:`;
    for (const r of this.racers) key += this.active(r) ? "1" : "0";
    if (this.racers.some((r) => [r.name, ...r.copied].some((p) => RACERS[p].copies))) {
      key += `:${this.lead().map((r) => r.seat)}`;
    }
    let hooks = this.hooks.get(key);
    if (!hooks) {
      hooks = this.byPriority().flatMap((o) => this.powers(o).map((p): Hook => [o, p, RACERS[p]]));
      this.hooks.set(key, hooks);
    }
    return hooks;
  }

  choose(me: Racer, p: Name, ...args: any[]): any {
    const i = this.forced.findIndex(([seat, q]) => seat === me.seat && q === p);
    if (i >= 0) return this.forced.splice(i, 1)[0][2];
    const choice = (this.policy.choose[p] ?? RACERS[p].choose)!(this, me, ...args);
    if (this.playouts) this.chosen.push([me.seat, p, choice]);
    return choice;
  }

  best(names: Name[]) {
    return best(names, this.policy.rating);
  }

  gain(r: Racer, p: Name) {
    if (r.copied.length >= 2) return;
    r.copied.push(p);
    this.hooks.clear();
    this.say(`${r.name} gains ${p}`);
    RACERS[p].beforeRace?.(this, r);
  }

  state() {
    return this.racers.map((r) => `${r.pos}${r.tripped ? "t" : ""}${this.active(r) ? "" : "x"}`).join(",");
  }

  /** Runs `effect` unless it would repeat itself, completing an infinite loop only once. */
  once(key: string, effect: () => void) {
    key = `${key}:${this.state()}`;
    if (this.seen.has(key) || this.depth > MAX_DEPTH) {
      this.loops++;
      return;
    }
    // Only a repeat within its own chain of triggers is a loop.
    this.seen.add(key);
    this.depth++;
    try {
      effect();
    } finally {
      this.seen.delete(key);
      this.depth--;
    }
  }

  /** Runs a power and lets others react to it. */
  use(owner: Racer, p: Name, effect: () => void = () => {}) {
    this.once(`${owner.seat}:${p}`, () => {
      owner.uses++;
      this.say(`${owner.name}: ${p}`);
      effect();
      for (const [o, , h] of this.all()) if (this.active(o)) h.onPower?.(this, o, owner);
    });
  }

  /** Takes up to `n` bronze points from the box, or returns -`n`. */
  bronze(r: Racer, n: number) {
    n = Math.min(n, this.supply);
    r.bronze += n;
    this.supply -= n;
  }

  trip(r: Racer) {
    if (!this.active(r)) return;
    r.tripped = true;
    r.trips++;
    this.say(`${r.name} trips`);
  }

  eliminate(r: Racer) {
    r.eliminated = this.eliminations++;
    this.say(`${r.name} is eliminated`);
    this.lastOneLeft();
  }

  /** Fiddly details 6: the last racer left ends the race, taking 1st or 2nd. */
  lastOneLeft() {
    const on = this.onTrack();
    if (on.length === 1 && this.finishers.length < 2) this.finish(on[0]);
  }

  finish(r: Racer) {
    r.pos = this.track.length;
    r.place = this.finishers.length + 1;
    this.finishers.push(r);
    this.say(`${r.name} finishes #${r.place}`);
    if (r.place === 1) {
      const m = [r, ...this.onTrack()].find((m) => [m.name, ...m.copied].some((p) => RACERS[p].onWin?.(this, m, r)));
      if (m) {
        m.uses++;
        if (m !== r) m.place = 2;
        this.finishers.push(m);
        this.say(`${m.name} predicted it`);
      }
    }
    if (this.finishers.length >= 2) throw new RaceOver();
    this.lastOneLeft();
  }

  /** The power that keeps `r` off `pos`, if any. */
  blocker(r: Racer, pos: number) {
    return this.all().find(([o, , h]) => h.blocks?.(this, o, r, pos));
  }

  warp(r: Racer, pos: number) {
    const b = this.blocker(r, pos);
    if (b) {
      pos--;
      this.use(b[0], b[1]);
    }
    this.say(`${r.name} warps ${r.pos} → ${pos}`);
    r.pos = pos;
    this.arrive(r);
  }

  move(r: Racer, dist: number) {
    this.moveTogether([[r, dist]]);
  }

  /**
   * Moves racers at the same time, like Party Animal does. Racers that arrive together, including
   * Suckerfish riding along, don't count as stopping with each other.
   */
  moveTogether(moves: [Racer, number][]) {
    const n = this.track.length;
    const landed: { r: Racer; passed: Racer[]; riders: [Racer, Name][]; b?: Hook; path?: [Name, Powers]; skipped: number }[] = [];
    for (const [r, dist] of moves) {
      if (!this.active(r) || dist === 0) continue;
      const from = r.pos;
      const path = this.own(r).find(([, h]) => h.path);
      let { to, skipped } = path?.[1].path!(this, r, from, dist) ?? { to: Math.max(0, from + dist), skipped: 0 };
      if (to > n) {
        const s = this.all().find(([o, , h]) => h.stopsOvershoot?.(this, o, r));
        if (s) {
          this.say(`${r.name} overshoots`);
          this.use(s[0], s[1]);
          continue;
        }
      }
      const b = to < n ? this.blocker(r, to) : undefined;
      if (b) to--;
      const passed = this.onTrack().filter((o) =>
        o !== r && (to > from ? o.pos > from && (to >= n || o.pos < to) : o.pos < from && o.pos > to)
      );
      const riders = this.all().filter(([o, p, h]) => h.rides && o !== r && o.pos === from && this.choose(o, p, Math.min(to, n), r));
      this.say(`${r.name} moves ${from} → ${Math.min(to, n)}`);
      if (to >= n) this.finish(r);
      else for (const q of [r, ...riders.map(([s]) => s)]) q.pos = to;
      landed.push({ r, passed, riders, b, path, skipped });
    }
    const together = landed.flatMap(({ r, riders }) => [r, ...riders.map(([s]) => s)]);
    for (const { r, passed, riders, b, path, skipped } of landed) {
      // Riders arrive with the racer they ride, which resolves first.
      if (r.place !== null) for (const [s, p] of riders) this.use(s, p, () => this.finish(s));
      else {
        this.arrive(r, passed, together);
        for (const [s, p] of riders) this.use(s, p, () => this.arrive(s, passed, together));
      }
      if (b) this.use(b[0], b[1]);
      if (path) for (let i = 0; i < skipped; i++) this.use(r, path[0]);
    }
  }

  arrive(r: Racer, passed: Racer[] = [], together: Racer[] = []) {
    if (!this.active(r)) return;
    const at = r.pos;
    const space = this.track.spaces[at];
    if (space?.star) this.bronze(r, 1);
    if (space?.trip) this.trip(r);
    if (space?.arrow) this.once(`${r.seat}:arrow`, () => this.move(r, space.arrow!));
    this.resolve((o, h) => [h.onArrive?.(this, o, r, at, together), h.onPass?.(this, o, r, passed)]);
  }

  /** Lets passing powers react to `r` having passed `passed`. */
  pass(r: Racer, passed: Racer[]) {
    this.resolve((o, h) => [h.onPass?.(this, o, r, passed)]);
  }

  /**
   * Resolves the powers an event triggers, in turn order. Each checks its condition just before
   * its effect, or with `rules.queue`, all are checked first and then all resolve.
   */
  resolve(trigger: (o: Racer, h: Powers) => ((() => void) | void)[]) {
    const queued: (() => void)[] = [];
    for (const [o, , h] of this.all()) {
      if (!this.active(o)) continue;
      for (const effect of trigger(o, h)) {
        if (!effect) continue;
        if (this.rules.queue) queued.push(effect);
        else effect();
      }
    }
    for (const effect of queued) effect();
  }

  beforeRace() {
    for (const r of this.racers) RACERS[r.name].beforeRace?.(this, r);
    for (const [o, , h] of this.all()) if (this.active(o)) h.start?.(this, o);
  }

  turn(r: Racer) {
    this.current = r;
    if (this.playouts) {
      this.snapshot = this.clone(this.rng);
      this.rolled = [];
      this.chosen = [];
    }
    const start = r.pos;
    r.turns++;
    this.say(`— ${r.name}'s turn at ${start}`);
    const skip = this.own(r).find(([, h]) => h.skipsMain?.(this, r));
    for (const [, h] of this.own(r)) if (this.active(r)) h.startTurn?.(this, r);
    if (!this.active(r)) return;
    // A tripped racer recovers at its main move, even if it tripped earlier this turn.
    if (r.tripped) r.tripped = false;
    else if (skip) this.use(r, skip[0]);
    else this.main(r, start);
    if (!this.active(r)) return;
    const moved = Math.abs(r.pos - start);
    for (const [o, , h] of this.all()) if (this.active(o)) h.endTurn?.(this, o, r, moved);
  }

  main(r: Racer, start: number) {
    const used: [Racer, Name][] = [];
    this.afterMain = [];
    let base: number | null = null;
    for (const [p, h] of this.own(r)) {
      const replaced = h.replaceMain?.(this, r);
      if (replaced === true) return;
      if (typeof replaced === "number") {
        base = replaced;
        used.push([r, p]);
        break;
      }
    }
    if (base === null) {
      for (const [, h] of this.own(r)) h.beforeRoll?.(this, r);
      let roll = this.d6();
      const rerollers = this.own(r).filter(([, h]) => h.rerolls);
      let left = rerollers.reduce((sum, [, h]) => sum + h.rerolls!, 0);
      for (; left > 0 && this.policy.reroll(this, r, roll, left); left--) {
        roll = this.d6();
        this.use(r, rerollers[0][0]);
      }
      const granters = this.all().filter(([, , h]) => h.onReroll);
      if (granters.length && this.policy.reroll(this, r, roll, 1)) {
        roll = this.d6();
        this.use(granters[0][0], granters[0][1], () => {
          for (const [o, , h] of granters) h.onReroll!(this, o, r);
        });
      }
      this.say(`${r.name} rolls ${roll}`);
      let skipped = false;
      for (const [o, , h] of this.all()) if (this.active(o) && h.onRoll?.(this, o, r, roll, skipped)) skipped = true;
      if (skipped || !this.active(r)) return;
      base = roll;
      for (const [p, h] of this.own(r)) {
        const b = h.base?.(this, r, roll, base) ?? base;
        if (b !== base) {
          base = b;
          used.push([r, p]);
        }
      }
    }
    let dist = base;
    for (const [o, p, h] of this.all()) {
      const d = this.active(o) ? (h.modify?.(this, o, r, start) ?? 0) : 0;
      if (d) {
        dist += d;
        used.push([o, p]);
      }
    }
    for (const [o, p] of used) this.use(o, p);
    if (!this.active(r)) return;
    this.move(r, this.rules.backwards ? dist : Math.max(0, dist));
    for (const f of this.afterMain) f();
  }

  run(): RaceResult {
    try {
      this.beforeRace();
    } catch (e) {
      if (!(e instanceof RaceOver)) throw e;
    }
    return this.race();
  }

  /** Runs turns until the race ends, starting with `next`'s turn if given. */
  race(next?: Racer): RaceResult {
    let stalled = false;
    try {
      let seat = this.current.seat;
      const n = this.racers.length;
      // A race can end before the first turn, from Duelist's duels on the Start.
      while (this.onTrack().length && this.finishers.length < 2) {
        if (++this.turns > MAX_TURNS) {
          stalled = true;
          break;
        }
        let r = next ?? this.queue.shift();
        next = undefined;
        while (r && !this.active(r)) r = this.queue.shift();
        if (!r) {
          for (let i = 0; i < n; i++) {
            const q = this.racers[(seat + i) % n];
            if (this.active(q)) {
              r = q;
              break;
            }
          }
        }
        this.turn(r!);
        seat = (r!.seat + 1) % n;
      }
    } catch (e) {
      if (!(e instanceof RaceOver)) throw e;
    }
    return {
      racers: this.racers,
      finishers: this.finishers.map((r) => r.seat),
      turns: this.turns,
      loops: this.loops,
      stalled,
    };
  }
}

export type GameOptions = {
  players: number;
  rng?: () => number;
  policy?: Partial<Policy>;
  /** Racers per player in race order. Drafted when omitted. */
  teams?: Name[][];
  /** A player's draft pick from `row`, given every team so far; undefined picks by rating. */
  pick?: (player: number, row: Name[], teams: Name[][]) => Name | undefined;
  /**
   * A player's racer for race `race` (0–3) from `hands[player]`, given everyone's remaining hands
   * and the scores so far; undefined plays the best race order for the rest of the hand.
   */
  choose?: (player: number, hands: Name[][], race: number, scores: number[]) => Name | undefined;
  schedule?: Track[];
  log?: boolean;
  /** The 2-player and 3-player variants: each player drafts 8 and races two at a time. */
  double?: boolean;
};

export type GameResult = {
  teams: Name[][];
  /** Players in the order they picked in the first draft round, if drafted. */
  drafters: number[];
  scores: number[];
  races: RaceResult[];
  logs: string[][];
};

/**
 * Snake drafts twice by rating (or uses `teams`, in race order), then runs four races, each
 * player choosing a racer before each one, and scores them. `teams` in the result is the order
 * racers were played in.
 */
export function playGame(o: GameOptions): GameResult {
  const rng = o.rng ?? Math.random;
  const policy = { ...defaultPolicy, ...o.policy };
  const schedule = o.schedule ?? [MILD_MILE, WILD_WILDS, MILD_MILE, WILD_WILDS];
  let deck = shuffle([...NAMES], rng);
  let teams = o.teams;
  let drafters: number[] = [];
  if (teams) {
    deck = deck.filter((n) => !teams!.flat().includes(n));
  } else {
    const drafted: Name[][] = Array.from({ length: o.players }, () => []);
    let first = Math.floor(rng() * o.players);
    // Snake drafts of rows of 2 per player, or in the variants, 8 cards twice for 2 players and 6
    // cards four times for 3.
    const rows = !o.double ? [2, 2].map((k) => k * o.players) : o.players === 2 ? [8, 8] : [6, 6, 6, 6];
    for (const [round, size] of rows.entries()) {
      const row = deck.splice(0, size);
      const order = Array.from({ length: o.players }, (_, i) => (first + i) % o.players);
      if (round === 0) drafters = [...order];
      const snake = [...order, ...[...order].reverse()];
      for (let k = 0; row.length; k++) {
        const p = snake[k % snake.length];
        const pick = o.pick?.(p, row, drafted) ?? best(shuffle(row, rng), policy.rating);
        row.splice(row.indexOf(pick), 1);
        drafted[p].push(pick);
      }
      first = (first + 1) % o.players;
    }
    teams = drafted;
  }
  const each = o.double ? 2 : 1;
  const hands = teams.map((t) => [...t]);
  const played: Name[][] = teams.map(() => []);
  const scores = teams.map(() => 0);
  const races: RaceResult[] = [];
  const logs: string[][] = [];
  const winners: Name[] = [];
  let supply = BRONZE;
  let first = Math.floor(rng() * o.players);
  for (let i = 0; i < schedule.length; i++) {
    // Everyone reveals at once, so each choice sees only the hands and scores so far.
    const picks = hands.map((hand, p) => {
      if (o.teams) return hand.slice(0, each);
      const pick = each === 1 ? o.choose?.(p, hands, i, scores) : undefined;
      if (pick) return [pick];
      const races = [0, 1, 2, 3].slice(i).flatMap((race) => Array(each).fill(race));
      const { order } = assign(hand, RATINGS.points, races);
      return hand.filter((_, k) => order[k] === i);
    });
    picks.forEach((ps, p) => {
      for (const pick of ps) hands[p].splice(hands[p].indexOf(pick), 1);
      played[p].push(...ps);
    });
    const race = new Race({
      racers: picks.flat(),
      players: picks.flatMap((ps, p) => ps.map(() => p)),
      track: schedule[i],
      rng,
      policy,
      winners,
      deck,
      bank: scores,
      supply,
      first: first * each,
      log: o.log,
    });
    const result = race.run();
    deck = race.deck;
    supply = race.supply;
    const gained = teams.map(() => 0);
    result.finishers.forEach((seat, place) => {
      gained[result.racers[seat].player] += [GOLD, SILVER][place]?.[i] ?? 0;
    });
    for (const r of result.racers) gained[r.player] += r.bronze;
    gained.forEach((g, p) => (scores[p] += g));
    const winner = result.racers.find((r) => r.place === 1);
    if (winner) winners.push(winner.name);
    if (o.double) {
      // The player with fewer points in the last race goes first; ties roll off.
      const low = Math.min(...gained);
      const tied = gained.map((g, p) => [g, p]).filter(([g]) => g === low).map(([, p]) => p);
      first = tied[Math.floor(rng() * tied.length)];
    } else {
      const out = result.racers.filter((r) => r.eliminated !== null).sort((a, b) => a.eliminated! - b.eliminated!);
      first = (out[0] ?? result.racers.filter((r) => r.place === null).sort((a, b) => a.pos - b.pos)[0] ?? result.racers[0]).player;
    }
    races.push(result);
    logs.push(race.log ?? []);
  }
  return { teams: played, drafters, scores, races, logs };
}
