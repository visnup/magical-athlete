import { type Powers, RACERS } from "./racers.ts";

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
  rating: () => 0,
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

class RaceOver extends Error {}

export type RaceOptions = {
  /** One racer per seat, in clockwise order. */
  racers: Name[];
  track?: Track;
  rng?: () => number;
  /** Scripted die rolls, used before `rng`. */
  dice?: number[];
  policy?: Partial<Policy>;
  /** Racers who won earlier races this game, for Twin. */
  winners?: Name[];
  /** Undrawn racer cards, for Egg. Defaults to every racer not in this race. */
  deck?: Name[];
  /** Points each seat already has, so Sisyphus can't lose chips that don't exist. */
  bank?: number[];
  /** Bronze points left in the box. */
  supply?: number;
  first?: number;
  log?: boolean;
};

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

  constructor(o: RaceOptions) {
    this.track = o.track ?? MILD_MILE;
    this.policy = { ...defaultPolicy, ...o.policy, choose: { ...defaultPolicy.choose, ...o.policy?.choose } };
    this.rng = o.rng ?? Math.random;
    this.dice = [...(o.dice ?? [])];
    this.winners = o.winners ?? [];
    this.deck = o.deck ?? NAMES.filter((n) => !o.racers.includes(n));
    this.bank = o.bank ?? o.racers.map(() => 0);
    this.supply = o.supply ?? BRONZE;
    this.log = o.log ? [] : null;
    this.racers = o.racers.map((name, seat) => ({
      name, seat, pos: 0, tripped: false, place: null, eliminated: null,
      bronze: 0, copied: [], turns: 0, prediction: null, guess: null, trips: 0, uses: 0,
    }));
    this.current = this.racers[o.first ?? 0];
  }

  d6() {
    return this.dice.shift() ?? 1 + Math.floor(this.rng() * 6);
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
    const c = this.current.seat;
    return this.onTrack().sort((a, b) => ((a.seat - c + n) % n) - ((b.seat - c + n) % n));
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

  /** Every power on the track, in priority order. */
  all(): Hook[] {
    return this.byPriority().flatMap((o) => this.powers(o).map((p): Hook => [o, p, RACERS[p]]));
  }

  choose(me: Racer, p: Name, ...args: any[]): any {
    return (this.policy.choose[p] ?? RACERS[p].choose)!(this, me, ...args);
  }

  best(names: Name[]) {
    return best(names, this.policy.rating);
  }

  gain(r: Racer, p: Name) {
    if (r.copied.length >= 2) return;
    r.copied.push(p);
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
    if (!this.active(r) || dist === 0) return;
    const n = this.track.length;
    const from = r.pos;
    const path = this.own(r).find(([, h]) => h.path);
    let { to, skipped } = path?.[1].path!(this, r, from, dist) ?? { to: Math.max(0, from + dist), skipped: 0 };
    if (to > n) {
      const s = this.all().find(([o, , h]) => h.stopsOvershoot?.(this, o, r));
      if (s) {
        this.say(`${r.name} overshoots`);
        this.use(s[0], s[1]);
        return;
      }
    }
    const b = to < n ? this.blocker(r, to) : undefined;
    if (b) to--;
    const passed = this.onTrack().filter((o) => o !== r && o.pos > from && (to >= n || o.pos < to));
    const riders = this.all().filter(([o, p, h]) => h.rides && o !== r && o.pos === from && this.choose(o, p, Math.min(to, n), r));
    this.say(`${r.name} moves ${from} → ${Math.min(to, n)}`);
    // Riders arrive together with the racer they ride, so Romantic sees both stops.
    if (to >= n) {
      this.finish(r);
      for (const [s, p] of riders) this.use(s, p, () => this.finish(s));
    } else {
      for (const [s] of riders) s.pos = to;
      r.pos = to;
      this.arrive(r, passed);
      for (const [s, p] of riders) this.use(s, p, () => this.arrive(s, passed));
    }
    if (b) this.use(b[0], b[1]);
    if (path) for (let i = 0; i < skipped; i++) this.use(r, path[0]);
  }

  arrive(r: Racer, passed: Racer[] = []) {
    if (!this.active(r)) return;
    const at = r.pos;
    const space = this.track.spaces[at];
    if (space?.star) this.bronze(r, 1);
    if (space?.trip) this.trip(r);
    if (space?.arrow) this.once(`${r.seat}:arrow`, () => this.move(r, space.arrow!));
    for (const [o, , h] of this.all()) if (this.active(o)) h.onArrive?.(this, o, r, at, passed);
  }

  beforeRace() {
    for (const r of this.racers) RACERS[r.name].beforeRace?.(this, r);
    for (const [o, , h] of this.all()) if (this.active(o)) h.start?.(this, o);
  }

  turn(r: Racer) {
    this.current = r;
    const start = r.pos;
    r.turns++;
    this.say(`— ${r.name}'s turn at ${start}`);
    for (const [, h] of this.own(r)) h.startTurn?.(this, r);
    if (r.tripped) {
      r.tripped = false;
    } else {
      const skip = this.own(r).find(([, h]) => h.skipsMain?.(this, r));
      if (skip) this.use(r, skip[0]);
      else {
        for (const [, h] of this.own(r)) if (this.active(r)) h.beforeMain?.(this, r);
        if (this.active(r)) this.main(r, start);
      }
    }
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
    this.move(r, Math.max(0, dist));
    for (const f of this.afterMain) f();
  }

  run(): RaceResult {
    let stalled = false;
    try {
      this.beforeRace();
      let seat = this.current.seat;
      const n = this.racers.length;
      while (this.onTrack().length) {
        if (++this.turns > MAX_TURNS) {
          stalled = true;
          break;
        }
        let r = this.queue.shift();
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
  schedule?: Track[];
  log?: boolean;
};

export type GameResult = {
  teams: Name[][];
  scores: number[];
  races: RaceResult[];
  logs: string[][];
};

/** Snake drafts twice (or uses `teams`), then runs four races and scores them. */
export function playGame(o: GameOptions): GameResult {
  const rng = o.rng ?? Math.random;
  const policy = { ...defaultPolicy, ...o.policy };
  const schedule = o.schedule ?? [MILD_MILE, WILD_WILDS, MILD_MILE, WILD_WILDS];
  let deck = shuffle([...NAMES], rng);
  let teams = o.teams;
  if (teams) {
    deck = deck.filter((n) => !teams!.flat().includes(n));
  } else {
    const drafted: Name[][] = Array.from({ length: o.players }, () => []);
    let first = Math.floor(rng() * o.players);
    for (let round = 0; round < 2; round++) {
      const row = deck.splice(0, 2 * o.players);
      const order = Array.from({ length: o.players }, (_, i) => (first + i) % o.players);
      for (const p of [...order, ...order.reverse()]) {
        const pick = best(shuffle(row, rng), policy.rating);
        row.splice(row.indexOf(pick), 1);
        drafted[p].push(pick);
      }
      first = (first + 1) % o.players;
    }
    teams = drafted.map((t) => shuffle(t, rng));
  }
  const scores = teams.map(() => 0);
  const races: RaceResult[] = [];
  const logs: string[][] = [];
  const winners: Name[] = [];
  let supply = BRONZE;
  let first = Math.floor(rng() * o.players);
  for (let i = 0; i < schedule.length; i++) {
    const race = new Race({
      racers: teams.map((t) => t[i]),
      track: schedule[i],
      rng,
      policy,
      winners,
      deck,
      bank: scores,
      supply,
      first,
      log: o.log,
    });
    const result = race.run();
    deck = race.deck;
    supply = race.supply;
    result.finishers.forEach((seat, place) => {
      scores[seat] += [GOLD, SILVER][place]?.[i] ?? 0;
    });
    for (const r of result.racers) scores[r.seat] += r.bronze;
    const winner = result.racers.find((r) => r.place === 1);
    if (winner) winners.push(winner.name);
    const out = result.racers.filter((r) => r.eliminated !== null).sort((a, b) => a.eliminated! - b.eliminated!);
    first = (out[0] ?? result.racers.filter((r) => r.place === null).sort((a, b) => a.pos - b.pos)[0] ?? result.racers[0]).seat;
    races.push(result);
    logs.push(race.log ?? []);
  }
  return { teams, scores, races, logs };
}
