export const NAMES = [
  "Alchemist", "Baba Yaga", "Banana", "Blimp", "Centaur", "Cheerleader",
  "Coach", "Copycat", "Dicemonger", "Duelist", "Egg", "Flip Flop",
  "Genius", "Gunk", "Hare", "Heckler", "Huge Baby", "Hypnotist",
  "Inchworm", "Lackey", "Leaptoad", "Legs", "Lovable Loser", "Magician",
  "Mastermind", "M.O.U.T.H.", "Party Animal", "Rocket Scientist", "Romantic", "Scoocher",
  "Sisyphus", "Skipper", "Stickler", "Suckerfish", "Third Wheel", "Twin",
] as const;
export type Name = (typeof NAMES)[number];

const BEFORE_RACE = new Set<Name>(["Egg", "Twin", "Sisyphus"]);

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

// The rulebook doesn't print the Wild Wilds layout (arrows, rocks, stars), so
// it's left for the caller to supply as a Track.

/** Gold and silver chip values, by race. */
export const GOLD = [3, 4, 4, 5];
export const SILVER = [2, 3, 3, 4];

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
  prediction: Name | null;
  trips: number;
  uses: number;
};

export type Policy = {
  /** Higher is better. Used for Egg, Twin, Copycat ties, Mastermind and drafting. */
  rating(name: Name): number;
  reroll(race: Race, r: Racer, roll: number, left: number): boolean;
  alchemist(race: Race, r: Racer, roll: number): boolean;
  rocket(race: Race, r: Racer, roll: number): boolean;
  legs(race: Race, r: Racer): boolean;
  genius(race: Race, r: Racer): number;
  mastermind(race: Race, r: Racer): Name;
  flipFlop(race: Race, r: Racer): Racer | null;
  hypnotist(race: Race, r: Racer): Racer | null;
  thirdWheel(race: Race, r: Racer): number | null;
  cheerleader(race: Race, r: Racer): boolean;
  duel(race: Race, duelist: Racer, other: Racer): boolean;
  suckerfish(race: Race, r: Racer, to: number): boolean;
};

export const defaultPolicy: Policy = {
  rating: () => 0,
  reroll(race, r, roll, left) {
    if (race.has(r, "Alchemist") && roll <= 2) return false;
    if (race.has(r, "Sisyphus") && roll === 6) return true;
    return roll <= (left >= 2 ? 4 : 3);
  },
  alchemist: () => true,
  rocket: (race, r, roll) => roll >= 4 || r.pos + 2 * roll >= race.track.length,
  legs: () => true,
  genius: () => 6,
  mastermind(race, r) {
    return best([r.name, ...race.racers.map((o) => o.name)], race.policy.rating);
  },
  flipFlop(race, r) {
    // A Copycat would copy the new leader's Flip Flop and swap straight back, forever.
    const ahead = race.onTrack().filter((o) => o !== r && o.pos - r.pos >= 4 && !race.powers(o).includes("Copycat"));
    return ahead.sort((a, b) => b.pos - a.pos)[0] ?? null;
  },
  hypnotist(race, r) {
    // Pulling back any racer at all ping-pongs forever against a Copycat.
    const ahead = race.onTrack().filter((o) => o.seat !== r.seat && o.pos - r.pos > 3);
    return ahead.sort((a, b) => b.pos - a.pos)[0] ?? null;
  },
  thirdWheel(race, r) {
    const counts = new Map<number, number>();
    for (const o of race.onTrack()) counts.set(o.pos, (counts.get(o.pos) ?? 0) + 1);
    const pairs = [...counts].filter(([pos, n]) => n === 2 && pos > r.pos).map(([pos]) => pos);
    return pairs.length ? Math.max(...pairs) : null;
  },
  cheerleader: (race, r) => race.last().includes(r),
  duel(race, duelist, other) {
    // TODO(human): decide whether the Duelist calls a duel against `other`.
    return true;
  },
  suckerfish: (_race, r, to) => to > r.pos,
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
  log: string[] | null;
  current: Racer;
  finishers: Racer[] = [];
  queue: Racer[] = [];
  turns = 0;
  loops = 0;
  eliminations = 0;
  seen = new Set<string>();
  depth = 0;

  constructor(o: RaceOptions) {
    this.track = o.track ?? MILD_MILE;
    this.policy = { ...defaultPolicy, ...o.policy };
    this.rng = o.rng ?? Math.random;
    this.dice = [...(o.dice ?? [])];
    this.winners = o.winners ?? [];
    this.deck = o.deck ?? NAMES.filter((n) => !o.racers.includes(n));
    this.bank = o.bank ?? o.racers.map(() => 0);
    this.log = o.log ? [] : null;
    this.racers = o.racers.map((name, seat) => ({
      name, seat, pos: 0, tripped: false, place: null, eliminated: null,
      bronze: 0, copied: [], turns: 0, prediction: null, trips: 0, uses: 0,
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
    const ps = [r.name, ...r.copied];
    if (ps.includes("Copycat") && depth < 2) {
      const lead = this.lead().filter((o) => o !== r);
      if (lead.length) {
        const target = lead.reduce((a, b) => (this.policy.rating(b.name) > this.policy.rating(a.name) ? b : a));
        for (const p of this.powers(target, depth + 1)) if (p !== "Copycat" && !BEFORE_RACE.has(p)) ps.push(p);
      }
    }
    return ps;
  }

  has(r: Racer, p: Name) {
    return this.powers(r).includes(p);
  }

  holders(p: Name) {
    return this.byPriority().filter((r) => this.has(r, p));
  }

  state() {
    return this.racers.map((r) => `${r.pos}${r.tripped ? "t" : ""}${this.active(r) ? "" : "x"}`).join(",");
  }

  /** Runs a power and lets Scoocher react, completing an infinite loop only once. */
  use(owner: Racer, p: Name, effect: () => void = () => {}) {
    const key = `${owner.seat}:${p}:${this.state()}`;
    if (this.seen.has(key) || this.depth > MAX_DEPTH) {
      this.loops++;
      return;
    }
    // Only a repeat within its own chain of triggers is a loop.
    this.seen.add(key);
    this.depth++;
    try {
      owner.uses++;
      this.say(`${owner.name}: ${p}`);
      effect();
      for (const s of this.holders("Scoocher")) {
        if (s !== owner) this.use(s, "Scoocher", () => this.move(s, 1));
      }
    } finally {
      this.seen.delete(key);
      this.depth--;
    }
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
      const m = this.racers.find((m) => m.prediction === r.name && (m === r || this.active(m)));
      if (m) {
        m.uses++;
        if (m !== r) m.place = 2;
        this.finishers.push(m);
        this.say(`${m.name} predicted it`);
      }
    }
    if (this.finishers.length >= 2) throw new RaceOver();
  }

  baby(pos: number, r: Racer) {
    if (pos <= 0 || pos >= this.track.length) return null;
    return this.at(pos).find((b) => b !== r && this.has(b, "Huge Baby")) ?? null;
  }

  warp(r: Racer, pos: number) {
    const b = this.baby(pos, r);
    if (b) {
      pos--;
      this.use(b, "Huge Baby");
    }
    this.say(`${r.name} warps ${r.pos} → ${pos}`);
    r.pos = pos;
    this.arrive(r);
  }

  move(r: Racer, dist: number) {
    if (!this.active(r) || dist === 0) return;
    const n = this.track.length;
    const from = r.pos;
    const followers = this.holders("Suckerfish").filter((s) => s !== r && s.pos === from);
    let to = from;
    let skipped = 0;
    if (this.has(r, "Leaptoad")) {
      const step = Math.sign(dist);
      let left = Math.abs(dist);
      while (left > 0) {
        to += step;
        if (to <= 0) { to = 0; break; }
        if (to >= n) { to += (left - 1) * step; break; }
        if (this.at(to).some((o) => o !== r)) skipped++;
        else left--;
      }
    } else {
      to = Math.max(0, from + dist);
    }
    if (to > n) {
      const s = this.holders("Stickler").find((s) => s !== r);
      if (s) {
        this.say(`${r.name} overshoots`);
        this.use(s, "Stickler");
        return;
      }
    }
    const b = to < n ? this.baby(to, r) : null;
    if (b) to--;
    const passed = this.onTrack().filter((o) => o !== r && o.pos > from && (to >= n || o.pos < to));
    const riders = followers.filter((s) => this.policy.suckerfish(this, s, Math.min(to, n)));
    this.say(`${r.name} moves ${from} → ${Math.min(to, n)}`);
    // Suckerfish arrive together with the racer they ride, so Romantic sees both stops.
    if (to >= n) {
      this.finish(r);
      for (const s of riders) this.use(s, "Suckerfish", () => this.finish(s));
    } else {
      for (const q of [r, ...riders]) q.pos = to;
      this.arrive(r, passed);
      for (const s of riders) this.use(s, "Suckerfish", () => this.arrive(s, passed));
    }
    if (b) this.use(b, "Huge Baby");
    for (let i = 0; i < skipped; i++) this.use(r, "Leaptoad");
  }

  duel(d: Racer, q: Racer) {
    if (d.pos !== q.pos || !this.active(d) || !this.active(q) || !this.policy.duel(this, d, q)) return;
    this.use(d, "Duelist", () => {
      const mine = this.d6();
      const theirs = this.d6();
      this.move(mine >= theirs ? d : q, 2);
    });
  }

  arrive(r: Racer, passed: Racer[] = []) {
    if (!this.active(r)) return;
    const at = r.pos;
    const space = this.track.spaces[at];
    if (space?.star) r.bronze++;
    if (space?.trip) this.trip(r);
    if (space?.arrow) this.move(r, space.arrow);
    const here = () => this.active(r) && r.pos === at;
    for (const o of this.byPriority()) {
      for (const p of this.powers(o)) {
        if (!this.active(o)) break;
        switch (p) {
          case "Banana":
            if (passed.includes(o)) this.use(o, p, () => this.trip(r));
            break;
          case "Centaur":
            if (o === r) for (const q of passed) if (this.active(q)) this.use(o, p, () => this.move(q, -2));
            break;
          case "Baba Yaga":
            if (!here()) break;
            if (o === r) {
              const others = this.at(at).filter((q) => q !== o);
              if (others.length) this.use(o, p, () => others.forEach((q) => this.trip(q)));
            } else if (o.pos === at) this.use(o, p, () => this.trip(r));
            break;
          case "M.O.U.T.H.":
            if (o === r && here()) {
              const others = this.at(at).filter((q) => q !== o);
              if (others.length === 1) this.use(o, p, () => this.eliminate(others[0]));
            }
            break;
          case "Romantic":
            if (here() && this.at(at).length === 2) this.use(o, p, () => this.move(o, 2));
            break;
          case "Duelist":
            if (!here()) break;
            for (const q of o === r ? this.at(at).filter((q) => q !== o) : o.pos === at ? [r] : []) this.duel(o, q);
            break;
          case "Huge Baby":
            if (o === r && here() && at > 0) {
              const others = this.at(at).filter((q) => q !== o);
              if (others.length) {
                this.use(o, p, () => {
                  for (const q of others) {
                    q.pos = at - 1;
                    this.arrive(q);
                  }
                });
              }
            }
            break;
        }
      }
    }
  }

  beforeRace() {
    const gain = (r: Racer, name: Name, depth: number) => {
      if (depth > 2) return;
      let pick: Name | undefined;
      if (name === "Egg") {
        const options = shuffle(this.deck, this.rng).slice(0, 3);
        if (options.length) {
          pick = best(options, this.policy.rating);
          this.deck = this.deck.filter((n) => n !== pick);
        }
      } else if (name === "Twin") {
        const options = this.winners.filter((n) => n !== "Twin");
        if (options.length) pick = best(options, this.policy.rating);
      } else if (name === "Sisyphus") {
        r.bronze += 4;
      }
      if (pick) {
        r.copied.push(pick);
        this.say(`${r.name} gains ${pick}`);
        gain(r, pick, depth + 1);
      }
    };
    for (const r of this.racers) gain(r, r.name, 0);
    // Everyone shares the Start, and a Duelist only needs to share a space to duel.
    for (const d of this.holders("Duelist")) for (const q of this.at(d.pos)) if (q !== d) this.duel(d, q);
  }

  turn(r: Racer) {
    this.current = r;
    const start = r.pos;
    r.turns++;
    this.say(`— ${r.name}'s turn at ${start}`);
    if (r.turns === 1 && this.has(r, "Mastermind")) {
      this.use(r, "Mastermind", () => (r.prediction = this.policy.mastermind(this, r)));
    }
    const lead = this.lead();
    if (r.tripped) {
      r.tripped = false;
    } else if (this.has(r, "Hare") && lead.length === 1 && lead[0] === r && this.onTrack().length > 1) {
      // A Hare left alone on the track would never move again.
      this.use(r, "Hare");
    } else {
      this.beforeMain(r);
      if (this.active(r)) this.main(r, start);
    }
    if (this.active(r) && Math.abs(r.pos - start) <= 1) {
      for (const h of this.holders("Heckler")) this.use(h, "Heckler", () => this.move(h, 2));
    }
  }

  beforeMain(r: Racer) {
    const last = this.last();
    if (this.has(r, "Lovable Loser") && last.length === 1 && last[0] === r) {
      this.use(r, "Lovable Loser", () => r.bronze++);
    }
    if (this.has(r, "Cheerleader") && this.policy.cheerleader(this, r)) {
      this.use(r, "Cheerleader", () => {
        for (const q of last) this.move(q, 2);
        this.move(r, 1);
      });
    }
    if (this.has(r, "Party Animal")) {
      this.use(r, "Party Animal", () => {
        for (const q of this.byPriority()) if (q !== r) this.move(q, Math.sign(r.pos - q.pos));
      });
    }
    if (this.has(r, "Hypnotist")) {
      const t = this.policy.hypnotist(this, r);
      if (t) this.use(r, "Hypnotist", () => this.warp(t, r.pos));
    }
    if (this.has(r, "Third Wheel")) {
      const pos = this.policy.thirdWheel(this, r);
      if (pos !== null) this.use(r, "Third Wheel", () => this.warp(r, pos));
    }
  }

  main(r: Racer, start: number) {
    if (this.has(r, "Flip Flop")) {
      const t = this.policy.flipFlop(this, r);
      if (t) {
        this.use(r, "Flip Flop", () => {
          [r.pos, t.pos] = [t.pos, r.pos];
          this.say(`${r.name} swaps with ${t.name}`);
          this.arrive(r);
          this.arrive(t);
        });
        return;
      }
    }
    const used: [Racer, Name][] = [];
    let base: number;
    let rocket = false;
    if (this.has(r, "Legs") && this.policy.legs(this, r)) {
      base = 5;
      used.push([r, "Legs"]);
    } else {
      const guess = this.has(r, "Genius") ? this.policy.genius(this, r) : null;
      let roll = this.d6();
      if (this.has(r, "Magician")) {
        for (let left = 2; left > 0 && this.policy.reroll(this, r, roll, left); left--) {
          roll = this.d6();
          this.use(r, "Magician");
        }
      }
      const dicemongers = this.holders("Dicemonger");
      if (dicemongers.length && this.policy.reroll(this, r, roll, 1)) {
        roll = this.d6();
        this.use(dicemongers[0], "Dicemonger", () => {
          for (const d of dicemongers) if (d !== r) this.move(d, 1);
        });
      }
      this.say(`${r.name} rolls ${roll}`);
      if (guess === roll) this.use(r, "Genius", () => this.queue.unshift(r));
      let skip = false;
      if (roll === 6 && this.has(r, "Sisyphus")) {
        skip = true;
        this.use(r, "Sisyphus", () => {
          if (this.bank[r.seat] + r.bronze > 0) r.bronze--;
          this.warp(r, 0);
        });
      }
      for (const o of this.byPriority()) {
        if (roll === 1 && o !== r && !skip && this.has(o, "Inchworm")) {
          skip = true;
          this.use(o, "Inchworm", () => this.move(o, 1));
        }
        if (roll === 1 && this.has(o, "Skipper")) this.use(o, "Skipper", () => this.queue.push(o));
        if (roll === 6 && o !== r && !skip && this.has(o, "Lackey")) this.use(o, "Lackey", () => this.move(o, 2));
      }
      if (skip || !this.active(r)) return;
      base = roll;
      if (roll <= 2 && this.has(r, "Alchemist") && this.policy.alchemist(this, r, roll)) {
        base = 4;
        used.push([r, "Alchemist"]);
      }
      if (this.has(r, "Rocket Scientist") && this.policy.rocket(this, r, roll)) {
        base *= 2;
        rocket = true;
        used.push([r, "Rocket Scientist"]);
      }
    }
    let dist = base;
    if (this.has(r, "Blimp")) {
      dist += start < this.track.corner2 ? 3 : -1;
      used.push([r, "Blimp"]);
    }
    if (this.has(r, "Hare")) {
      dist += 2;
      used.push([r, "Hare"]);
    }
    for (const c of this.holders("Coach")) {
      if (c.pos === r.pos) {
        dist++;
        used.push([c, "Coach"]);
      }
    }
    for (const g of this.holders("Gunk")) {
      if (g !== r) {
        dist--;
        used.push([g, "Gunk"]);
      }
    }
    if (this.has(r, "Party Animal")) {
      const k = this.at(r.pos).length - 1;
      if (k) {
        dist += k;
        used.push([r, "Party Animal"]);
      }
    }
    for (const [o, p] of used) this.use(o, p);
    if (!this.active(r)) return;
    this.move(r, Math.max(0, dist));
    if (rocket) this.trip(r);
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
  const schedule = o.schedule ?? [MILD_MILE, MILD_MILE, MILD_MILE, MILD_MILE];
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
      first,
      log: o.log,
    });
    const result = race.run();
    deck = race.deck;
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
