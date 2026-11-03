import { type Name, type Race, type Racer, shuffle } from "./game.ts";

/**
 * A racer's rules as hooks. The engine calls "own" hooks only for the racer whose turn or move it
 * is, and the rest for every racer on the track, starting with the current player and going
 * clockwise.
 */
export type Powers = {
  /** The default for this racer's optional choice. `Policy.choose` can override it. */
  choose?: (race: Race, me: Racer, ...args: any[]) => any;
  /** Own. Before the race, including powers gained here. */
  beforeRace?(race: Race, me: Racer): void;
  /** Once everyone's powers are set, before the first turn. */
  start?(race: Race, me: Racer): void;
  /** Own. Whether to skip the main move this turn, decided as the turn starts. */
  skipsMain?(race: Race, me: Racer): boolean;
  /** Own. At the start of my turn, even if I'm tripped. */
  startTurn?(race: Race, me: Racer): void;
  /** Own. `true` if the main move is done, or a number to move instead of rolling. */
  replaceMain?(race: Race, me: Racer): boolean | number;
  /** Own. Rerolls of the main move. */
  rerolls?: number;
  /** Grants anyone one reroll per turn; called when someone takes it. */
  onReroll?(race: Race, me: Racer, roller: Racer): void;
  /** Own. Before rolling for the main move. */
  beforeRoll?(race: Race, me: Racer): void;
  /** After the main move's final roll. Returns true if the roller skips the move. */
  onRoll?(race: Race, me: Racer, roller: Racer, roll: number, skipped: boolean): boolean | void;
  /** Own. Replaces the main move's distance before modifiers. */
  base?(race: Race, me: Racer, roll: number, base: number): number;
  /** Added to anyone's main move. */
  modify?(race: Race, me: Racer, mover: Racer, start: number): number;
  /**
   * After `mover` stops on `at`, having arrived at the same time as `together`. Returns the effect
   * if it triggers, so the engine can resolve it at once or queue it (`Rules.queue`).
   */
  onArrive?(race: Race, me: Racer, mover: Racer, at: number, together: Racer[]): (() => void) | void;
  /** After `mover` passes `passed`. Returns the effect, like `onArrive`. */
  onPass?(race: Race, me: Racer, mover: Racer, passed: Racer[]): (() => void) | void;
  /** After `mover`'s turn, which ended `moved` spaces from where it started. */
  endTurn?(race: Race, me: Racer, mover: Racer, moved: number): void;
  /** After another racer's power happens. */
  onPower?(race: Race, me: Racer, owner: Racer): void;
  /** Own. Where a move of `dist` from `from` ends, and how many spaces it skipped. */
  path?(race: Race, me: Racer, from: number, dist: number): { to: number; skipped: number };
  /** Whether `mover` may not cross the finish line, having overshot. */
  stopsOvershoot?(race: Race, me: Racer, mover: Racer): boolean;
  /** Whether `mover` can't stop on `pos`, and goes one space back instead. */
  blocks?(race: Race, me: Racer, mover: Racer, pos: number): boolean;
  /** Moves along with racers that leave its space. */
  rides?: boolean;
  /** When `winner` finishes 1st. Returns true to finish 2nd. */
  onWin?(race: Race, me: Racer, winner: Racer): boolean;
  /** Whose powers this racer has too. */
  copies?(race: Race, me: Racer): Racer | null;
};

const others = (race: Race, me: Racer, at = me.pos) => race.at(at).filter((q) => q !== me);

/** The one other racer `me` stopped with, unless they arrived at the same time (Fiddly details 2). */
function stoppedWith(race: Race, mover: Racer, at: number, together: Racer[]) {
  if (!race.stays(mover, at)) return null;
  const qs = others(race, mover, at);
  return qs.length === 1 && !(together.includes(mover) && together.includes(qs[0])) ? qs[0] : null;
}

/**
 * What stopping on `to` is worth, in spaces, for choices that pick where to land: an arrow's move
 * counts, a star is worth about 3 spaces and a rock costs a turn's roll. Crossing the finish beats
 * any space.
 */
function landing(race: Race, to: number) {
  const n = race.track.length;
  let at = Math.max(0, to);
  let bonus = 0;
  for (let i = 0; i < 3 && at < n; i++) {
    const space = race.track.spaces[at];
    if (space?.star) bonus += 3;
    if (space?.trip) bonus -= 3.5;
    if (!space?.arrow) break;
    at = Math.max(0, at + space.arrow);
  }
  return at >= n ? n + 10 : at + bonus;
}

/** `landing` averaged over a die roll from `from`. */
const rolled = (race: Race, from: number) => [1, 2, 3, 4, 5, 6].reduce((s, d) => s + landing(race, from + d), 0) / 6;

function duel(race: Race, me: Racer, q: Racer) {
  if (me.pos !== q.pos || !race.active(me) || !race.active(q) || !race.choose(me, "Duelist", q)) return;
  race.use(me, "Duelist", () => {
    const mine = race.d6();
    const theirs = race.d6();
    race.move(mine >= theirs ? me : q, 2);
  });
}

// Each racer's flavor text, card (power name: text), and notes from the August 2026 printing of the
// rulebook (`magical-athlete-2026-08.pdf`, pp. 24–27), then anything else in it that names the
// racer, and official rulings on BoardGameGeek from Richard Garfield (designer) and Alex Hague
// (CMYK).
export const RACERS: Record<Name, Powers> = {
  /**
   * Forever seeking the ancient secret of turning This into That.
   *
   * TRANSMUTE 'N' SCOOT: When I roll a 1 or 2 for my main move, I can move 4 instead.
   */
  "Alchemist": {
    choose: (race, me, roll: number) => landing(race, me.pos + 4) >= landing(race, me.pos + roll),
    base: (race, me, roll, base) => (roll <= 2 && race.choose(me, "Alchemist", roll) ? 4 : base),
  },

  /**
   * This property is going fast.
   *
   * LEG IT: Trip any racer that stops on my space, or when I stop on theirs.
   *
   * If I share a space with the Duelist, we can duel, but the Duelist will still trip.
   *
   * The Hypnotist can cast their spell on me, but they still trip.
   */
  "Baba Yaga": {
    onArrive(race, me, mover, at) {
      if (!race.stays(mover, at)) return;
      if (mover === me) {
        const qs = others(race, me);
        if (qs.length) return () => race.use(me, "Baba Yaga", () => qs.forEach((q) => race.trip(q)));
      } else if (me.pos === at) {
        return () => race.use(me, "Baba Yaga", () => race.trip(mover));
      }
    },
  },

  /**
   * No more edible than you or I.
   *
   * THE SLIP: I trip any racer that passes me.
   *
   * Under Huge Baby: If I stop on Banana's space and move them back, it counts as passing them and
   * I trip.
   *
   * Example, p. 16: Banana's power is to trip any racer that passes them, so after the Romantic
   * finishes their full main move, they trip! That means they skip their next main move.
   */
  "Banana": {
    onPass(race, me, mover, passed) {
      if (passed.includes(me)) return () => race.use(me, "Banana", () => race.trip(mover));
    },
  },

  /**
   * Built to fly, born to explode.
   *
   * BLOW IT: When I start my turn before the second corner of the track, I get +3 to my main
   * move. On or after that corner, I get -1.
   */
  "Blimp": {
    modify: (race, me, mover, start) => (mover !== me ? 0 : start < race.track.corner2 ? 3 : -1),
  },

  /**
   * Here's the kicker.
   *
   * HOOFWHACK: When I pass a racer, they move backwards 2.
   *
   * A racer can't be hoofwhacked any farther back than the Start space.
   */
  "Centaur": {
    onPass(race, me, mover, passed) {
      if (mover !== me) return;
      return () => {
        for (const q of passed) if (race.active(q)) race.use(me, "Centaur", () => race.move(q, -2));
      };
    },
  },

  /**
   * A being of pure pep.
   *
   * RAH RAH: At the start of my turn, I can make the racers in last place move 2. If I do, I
   * move 1.
   *
   * If there is more than one racer in last place, they all move. But I only move 1 regardless of
   * how many racers are in last.
   *
   * If I cheer for myself, those are two separate moves: move 2 then move 1.
   */
  "Cheerleader": {
    // Cheering every turn beat cheering only from last place by about half a point a race, unless
    // my own move lands somewhere worse than where I am, like a rock.
    choose: (race, me) => landing(race, (race.last().includes(me) ? me.pos + 2 : me.pos) + 1) >= me.pos,
    startTurn(race, me) {
      const last = race.last();
      if (!race.choose(me, "Cheerleader")) return;
      race.use(me, "Cheerleader", () => {
        for (const q of last) race.move(q, 2);
        race.move(me, 1);
      });
    },
  },

  /**
   * Believing in yourself is even more important when you are some kind of lizard.
   *
   * GOOD HUSTLE: Everyone on my space gets +1 to their main move, including me.
   *
   * I get my power's benefit too!
   *
   * Under Legs: My power counts as my main move, so can be gooped by Gunk or get the hustle bonus
   * from Coach.
   */
  "Coach": {
    modify: (_race, me, mover) => (mover.pos === me.pos ? 1 : 0),
  },

  /**
   * Very similar to another, different cat.
   *
   * COPY THAT: I have the power of the racer currently in the lead. If there's a tie, I pick.
   *
   * I persistently have the power of the lead racer, not just on my turn. If there's ever a
   * contradiction between me and the racer I'm copying, their power takes priority. I never copy
   * "before my race" powers. If there's a tied lead, I can't switch my power mid-action.
   *
   * Fiddly details 8, p. 23: If there's a tie for the lead or last place, and a power like Copy
   * Cat's would target them, they pick which to target.
   *
   * Alex Hague, 2026-01-02: "you can't switch your power 'mid-action' but mid turn is OK if they
   * have separate moments where they would trigger"
   * https://boardgamegeek.com/thread/3637654/article/47097397
   */
  "Copycat": {
    copies(race, me) {
      const lead = race.lead().filter((o) => o !== me);
      return lead.length ? lead.reduce((a, b) => (race.policy.rating(b.name) > race.policy.rating(a.name) ? b : a)) : null;
    },
  },

  /**
   * He picked his career from a d100 table.
   *
   * DICEY DEALS: Anyone can reroll their main move once per turn. When another racer does it, I
   * move 1.
   *
   * If someone else rerolls, I move before they move.
   *
   * Under Scoocher: With Dicemonger, I move for each reroll.
   */
  "Dicemonger": {
    onReroll(race, me, roller) {
      if (me !== roller) race.move(me, 1);
    },
  },

  /**
   * When you've got a rapier, everything looks like a duel.
   *
   * DUEL!: Whenever a racer shares my space, I can shout DUEL! We roll our dice and whoever rolls
   * highest moves 2. I win ties.
   *
   * I can duel multiple times in a turn, including when it's not my turn. I just need to be
   * sharing a space to immediately declare a duel. I can't interrupt actions in progress, like
   * between a roll and a move.
   *
   * Under Baba Yaga: If I share a space with the Duelist, we can duel, but the Duelist will still
   * trip.
   *
   * Under Stickler: This includes any movement from main moves, powers, etc. For example, if the
   * Duelist wins a duel on the final space before the finish line, they don't cross.
   *
   * Richard Garfield, 2025-11-26, on dueling your own other racer in the variants: "Yes"
   * https://boardgamegeek.com/thread/3617971/article/46942516
   */
  "Duelist": {
    // A 58% win always pays: declining near the finish, or against racers a loss would carry
    // across the line, scored lower over 200,000 races.
    choose: () => true,
    start(race, me) {
      for (const q of others(race, me)) duel(race, me, q);
    },
    onArrive(race, me, mover, at) {
      if (!race.stays(mover, at)) return;
      const qs = mover === me ? others(race, me) : me.pos === at ? [mover] : [];
      return () => qs.forEach((q) => duel(race, me, q));
    },
  },

  /**
   * You should see the chicken.
   *
   * SCRAMBLE: Before my race, draw 3 new racers from the deck and pick one. I have its powers.
   *
   * You should still use my racer token! I still get any "before race" powers.
   */
  "Egg": {
    choose: (race, _me, options: Name[]) => race.best(options),
    beforeRace(race, me) {
      const options = shuffle(race.deck, race.rng).slice(0, 3);
      if (!options.length) return;
      const pick: Name = race.choose(me, "Egg", options);
      race.deck = race.deck.filter((n) => n !== pick);
      race.gain(me, pick);
    },
  },

  /**
   * Ever searching for its lost twin.
   *
   * FLOP FLIP: I can skip rolling for my main move and swap spaces with another racer instead.
   *
   * My flop flip is a warp: it doesn't count as a move and I don't roll. I never occupy the same
   * space as a racer I switch places with. We flop flip simultaneously.
   *
   * Terms, p. 23, Stopping on a space: Racers are stopped on a space after they've finished moving
   * onto it, or otherwise arriving there by other means, like through Flip Flop's warping power.
   */
  "Flip Flop": {
    choose(race, me) {
      // A Copycat would copy the new leader's Flip Flop and swap straight back, forever.
      const roll = rolled(race, me.pos);
      const better = race.onTrack().filter((o) => o !== me && landing(race, o.pos) > roll && !race.powers(o).includes("Copycat"));
      return better.sort((a, b) => landing(race, b.pos) - landing(race, a.pos))[0] ?? null;
    },
    replaceMain(race, me) {
      const t: Racer | null = race.choose(me, "Flip Flop");
      if (!t) return false;
      race.use(me, "Flip Flop", () => {
        [me.pos, t.pos] = [t.pos, me.pos];
        race.say(`${me.name} swaps with ${t.name}`);
        race.arrive(me);
        race.arrive(t);
      });
      return true;
    },
  },

  /**
   * And yet a fool in the ways of love.
   *
   * THINK GOOD: I can predict what number I'll roll for my main move. If I'm right, I take an
   * extra turn.
   *
   * If I'm racing against Skipper and I predict a 1, Skipper steals the next turn, since their
   * power triggers after mine.
   *
   * When playing with multiple racers, if I predict right, I get an extra turn but not my other
   * racer(s).
   *
   * Alex Hague, 2025-10-19: "Scoocher works with wrong predictions, since it's still using the
   * power, just missing the bonus."
   * https://boardgamegeek.com/thread/3595157/article/46761348
   */
  "Genius": {
    choose: () => 6,
    beforeRoll(race, me) {
      race.use(me, "Genius", () => (me.guess = race.choose(me, "Genius")));
    },
    onRoll(race, me, roller, roll) {
      if (me === roller && roll === me.guess) race.queue.unshift(me);
    },
  },

  /**
   * A bit of a hugger.
   *
   * GOOP 'EM: Other racers get -1 to their main move.
   *
   * My goop reduces the move amount, not the die roll number. So it doesn't make a 6 into a 5 and
   * keep the Lackey from doing their job.
   *
   * Under Legs: My power counts as my main move, so can be gooped by Gunk or get the hustle bonus
   * from Coach.
   *
   * Under Scoocher: When Gunk is on the board, I scooch 1 for every -1 that affects a racer's main
   * move.
   *
   * Fiddly details 7, p. 23: If multiple powers change the value of a move—like Rocket Scientist
   * and Gunk—resolve in turn order.
   */
  "Gunk": {
    modify: (_race, me, mover) => (mover === me ? 0 : -1),
  },

  /**
   * The only thing he can't outrun is hubris.
   *
   * HUBRIS: I get +2 to my main move. When I start my turn alone in the lead, I skip my main move.
   *
   * Richard Garfield, 2025-09-27, asked whether Scoocher moves every time Hare gets its +2: "Rule
   * of thumb: If the board changes in a way that would not happen if you had a racer with no
   * power, then a power has been used."
   * https://boardgamegeek.com/thread/3582942/article/46664996
   */
  "Hare": {
    skipsMain(race, me) {
      const lead = race.lead();
      return lead.length === 1 && lead[0] === me;
    },
    modify: (_race, me, mover) => (mover === me ? 2 : 0),
  },

  /**
   * It's constructive criticism.
   *
   * SCHADENFREUDE: When a racer ends their turn within 1 space of where they started, I move 2.
   *
   * My power works for racers recovering from tripping.
   *
   * Alex Hague, 2025-09-25: "Heckler triggers himself and that's true for any 'a racer' power"
   * https://boardgamegeek.com/thread/3582124/article/46658473
   *
   * Richard Garfield, 2025-12-09, asked whether it counts racers standing up, racers that don't
   * move at all, and Heckler itself: "Yes. Heckler is often quite good."
   * https://boardgamegeek.com/thread/3624534/article/46999371
   */
  "Heckler": {
    endTurn(race, me, _mover, moved) {
      if (moved <= 1) race.use(me, "Heckler", () => race.move(me, 2));
    },
  },

  /**
   * She's 30.
   *
   * REALLY HUGE: No one can ever be on my space, besides the Start. Whenever that would happen,
   * put the racer on the space behind me instead.
   *
   * I'm a unique case: when other racers are put behind me because of my power, that doesn't
   * count as a move: it's like they just stopped on that space instead. If I stop on Banana's space
   * and move them back, it counts as passing them and I trip.
   *
   * Under Party Animal: If Huge Baby parties onto my space, everyone there gets put 1 space back.
   */
  "Huge Baby": {
    blocks: (race, me, mover, pos) => mover !== me && me.pos === pos && pos > 0 && pos < race.track.length,
    onArrive(race, me, mover, at) {
      if (mover !== me || !race.stays(me, at) || at === 0) return;
      const qs = others(race, me);
      if (!qs.length) return;
      return () =>
        race.use(me, "Huge Baby", () => {
          for (const q of qs) q.pos = at - 1;
          for (const q of qs) race.arrive(q, [], qs);
          race.pass(me, qs);
        });
    },
  },

  /**
   * Implanted this false bio himself.
   *
   * HSSSSST: At the start of my turn, I can warp a racer to my space.
   *
   * Under Baba Yaga: The Hypnotist can cast their spell on me, but they still trip.
   */
  "Hypnotist": {
    choose(race, me) {
      // A Copycat would copy the new leader's Hypnotist and pull straight back, forever, and Baba
      // Yaga would trip us every time.
      const ahead = race.onTrack().filter((o) =>
        o.player !== me.player && o.pos > me.pos && !race.powers(o).some((p) => p === "Copycat" || p === "Baba Yaga")
      );
      return ahead.sort((a, b) => b.pos - a.pos)[0] ?? null;
    },
    startTurn(race, me) {
      const t: Racer | null = race.choose(me, "Hypnotist");
      if (t) race.use(me, "Hypnotist", () => race.warp(t, me.pos));
    },
  },

  /**
   * Give her an inch and she'll take an inch.
   *
   * WRIGGLE: When another racer rolls a 1 for their main move, they skip that move and I move 1.
   *
   * If another racer rolls a 1 and the Skipper is also on the track with me, I wriggle 1 and then
   * the Skipper takes their turn.
   */
  "Inchworm": {
    onRoll(race, me, roller, roll, skipped) {
      if (roll !== 1 || me === roller || skipped) return;
      race.use(me, "Inchworm", () => race.move(me, 1));
      return true;
    },
  },

  /**
   * If you're happy, he's happy.
   *
   * VERY GOOD SIRE: When another racer rolls a 6 for their main move, I move 2.
   *
   * I do my move before the other racer, if it matters.
   *
   * Under Gunk: My goop reduces the move amount, not the die roll number. So it doesn't make a 6
   * into a 5 and keep the Lackey from doing their job.
   */
  "Lackey": {
    onRoll(race, me, roller, roll, skipped) {
      if (roll === 6 && me !== roller && !skipped) race.use(me, "Lackey", () => race.move(me, 2));
    },
  },

  /**
   * Frequently seen from below.
   *
   * JUMPFROG: I skip spaces with other racers on them.
   *
   * Yes, even if I'm moving backwards.
   *
   * Under Scoocher: With Leaptoad, I move for each space skipped. If they jumpfrog over 2
   * consecutive occupied spaces, I move 1 twice.
   */
  "Leaptoad": {
    path(race, me, from, dist) {
      const n = race.track.length;
      const step = Math.sign(dist);
      let left = Math.abs(dist);
      let to = from;
      let skipped = 0;
      while (left > 0) {
        to += step;
        if (to <= 0) return { to: 0, skipped };
        if (to >= n) return { to: to + (left - 1) * step, skipped };
        if (others(race, me, to).length) skipped++;
        else left--;
      }
      return { to, skipped };
    },
  },

  /**
   * Has arms, too, but who cares.
   *
   * JOG: I can skip rolling for my main move and move 5 instead.
   *
   * My power counts as my main move, so can be gooped by Gunk or get the hustle bonus from Coach.
   */
  "Legs": {
    choose: (race, me) => landing(race, me.pos + 5) >= rolled(race, me.pos),
    replaceMain: (race, me) => (race.choose(me, "Legs") ? 5 : false),
  },

  /**
   * Top of her class at Loser Academy. Which is bad.
   *
   * D'AWW: At the start of my turn, I get 1 point chip if I'm alone in last place.
   */
  "Lovable Loser": {
    startTurn(race, me) {
      const last = race.last();
      if (last.length === 1 && last[0] === me) race.use(me, "Lovable Loser", () => race.bronze(me, 1));
    },
  },

  /**
   * He can also cast fireball.
   *
   * POOF: I can reroll my main move up to two times.
   *
   * I must use whatever my last roll is.
   *
   * Under Scoocher: I scooch 1 on each Magician reroll, even if it's not used.
   */
  "Magician": {
    rerolls: 2,
  },

  /**
   * The one scheme he can't pull off is getting his parents back together.
   *
   * KNOW-IT-ALL: At the start of my first turn, I predict which racer will win. If I'm right, the
   * race ends immediately and I finish 2nd.
   *
   * If I predict myself, I can win both 1st and 2nd.
   */
  "Mastermind": {
    choose: (race, me) => race.best([me.name, ...race.racers.map((o) => o.name)]),
    startTurn(race, me) {
      if (me.turns === 1) race.use(me, "Mastermind", () => (me.prediction = race.choose(me, "Mastermind")));
    },
    onWin: (_race, me, winner) => me.prediction === winner.name,
  },

  /**
   * Mastication Orifice Utilized Toward Hunger.
   *
   * CHOMP: When I stop on a space with exactly one other racer, they're eliminated from the race.
   *
   * Fiddly details 2, p. 23: Powers involving stopping on a space together don't trigger if racers
   * arrive at the same time.
   */
  "M.O.U.T.H.": {
    onArrive(race, me, mover, at, together) {
      if (mover !== me) return;
      const q = stoppedWith(race, me, at, together);
      if (q) return () => race.use(me, "M.O.U.T.H.", () => race.eliminate(q));
    },
  },

  /**
   * They put a hat on an animal and this happened.
   *
   * ANIMAL MAGNETISM: At the start of my turn, all racers move 1 space towards me. Each other
   * racer on my space gives me +1 to my main move.
   *
   * If Huge Baby parties onto my space, everyone there gets put 1 space back.
   *
   * Under Romantic: If two racers move together simultaneously, like with the Party Animal or
   * Suckerfish, my power doesn't trigger.
   */
  "Party Animal": {
    startTurn(race, me) {
      race.use(me, "Party Animal", () => {
        race.moveTogether(race.byPriority().filter((q) => q !== me).map((q) => [q, Math.sign(me.pos - q.pos)]));
      });
    },
    modify: (race, me, mover) => (mover === me ? others(race, me).length : 0),
  },

  /**
   * Moonlights as a brain surgeon.
   *
   * KABLOOEY: I can double my main move roll. When I do, I trip.
   *
   * I roll THEN decide whether to kablooey.
   *
   * Fiddly details 7, p. 23: If multiple powers change the value of a move—like Rocket Scientist
   * and Gunk—resolve in turn order.
   */
  "Rocket Scientist": {
    choose: (race, me, roll: number) => landing(race, me.pos + 2 * roll) - 3.5 >= landing(race, me.pos + roll),
    base(race, me, roll, base) {
      if (!race.choose(me, "Rocket Scientist", roll)) return base;
      race.afterMain.push(() => race.trip(me));
      return base * 2;
    },
  },

  /**
   * The last of her species.
   *
   * AH, LOVE!: When anyone stops on a space with exactly one other racer, I move 2.
   *
   * If two racers move together simultaneously, like with the Party Animal or Suckerfish, my
   * power doesn't trigger.
   *
   * Fiddly details 2, p. 23: Powers involving stopping on a space together don't trigger if racers
   * arrive at the same time.
   *
   * Example, p. 16: It's the Romantic's turn, and they roll a 5 for their main move. While they
   * move 5 spaces, they pass Scoocher and Banana. … Now the Romantic is thrilled, because their
   * power is that when exactly 2 racers are stopped on a space, they get to move 2. Even though
   * they're tripped, they can still use their power.
   */
  "Romantic": {
    onArrive(race, me, mover, at, together) {
      if (stoppedWith(race, mover, at, together)) return () => race.use(me, "Romantic", () => race.move(me, 2));
    },
  },

  /**
   * Ope, just gonna scooch by you there.
   *
   * SCOOCH SCOOCH: When another racer's power happens, I move 1.
   *
   * When Gunk is on the board, I scooch 1 for every -1 that affects a racer's main move. With
   * Dicemonger, I move for each reroll. With Leaptoad, I move for each space skipped. If they
   * jumpfrog over 2 consecutive occupied spaces, I move 1 twice. I scooch 1 on each Magician
   * reroll, even if it's not used.
   *
   * Fiddly details 1, p. 23: If you reroll for any reason, treat the previous number you rolled as
   * if it never happened. The reroll action itself can still trigger powers like Scoocher.
   *
   * Fiddly details 5, p. 23: If you run into an infinite loop, complete it once in order, then
   * stop. Some powers can interact many times but aren't a loop, like Scoocher/Suckerfish. If you
   * ever enter a loop where no one can finish or move at all, the race ends immediately: no one
   * gets the remaining points unless they've already finished.
   *
   * Example, p. 16: Scoocher is thrilled, because their power is moving 1 whenever anyone's power
   * happens. So they move 1 and stop on the same space as Banana. … Of course, since another power
   * is triggered, Scoocher moves another 1.
   *
   * Richard Garfield, 2025-09-27: "Rule of thumb: If the board changes in a way that would not
   * happen if you had a racer with no power, then a power has been used."
   * https://boardgamegeek.com/thread/3582942/article/46664996
   *
   * Alex Hague, 2025-10-19: "Scoocher works with wrong predictions, since it's still using the
   * power, just missing the bonus."
   * https://boardgamegeek.com/thread/3595157/article/46761348
   */
  "Scoocher": {
    onPower(race, me, owner) {
      if (owner !== me) race.use(me, "Scoocher", () => race.move(me, 1));
    },
  },

  /**
   * Stays humble, keeps grinding.
   *
   * KEEP ROLLIN': Before my race, I take 4 point chips. When I roll a 6 for my main move, instead
   * of moving, I warp to the Start and lose 1 point chip.
   *
   * If I roll more than 4 sixes, I continue to lose points, assuming I have any. I don't get my
   * main move after warping.
   */
  "Sisyphus": {
    beforeRace(race, me) {
      race.bronze(me, 4);
    },
    onRoll(race, me, roller, roll) {
      if (me !== roller || roll !== 6) return;
      race.use(me, "Sisyphus", () => {
        if (race.bank[me.player] + me.bronze > 0) race.bronze(me, -1);
        race.warp(me, 0);
      });
      return true;
    },
  },

  /**
   * The wheel is fake, he just goes forward like everyone else.
   *
   * SALTY DOG: When anyone rolls a 1 for their main move, I go next in turn order.
   *
   * After I go, turn order continues to my left. (Unless I roll a 1 and go again!)
   *
   * Under Inchworm: If another racer rolls a 1 and the Skipper is also on the track with me, I
   * wriggle 1 and then the Skipper takes their turn.
   *
   * Under Genius: If I'm racing against Skipper and I predict a 1, Skipper steals the next turn,
   * since their power triggers after mine.
   */
  "Skipper": {
    onRoll(race, me, _roller, roll) {
      if (roll === 1) race.use(me, "Skipper", () => (race.queue = [me]));
    },
  },

  /**
   * Proofread this rulebook without asking.
   *
   * ACTUALLY...: Other racers can only cross the finish line by moving the exact amount they need.
   * If they overshoot, they don't move.
   *
   * This includes any movement from main moves, powers, etc. For example, if the Duelist wins a
   * duel on the final space before the finish line, they don't cross.
   */
  "Stickler": {
    stopsOvershoot: (_race, me, mover) => mover !== me,
  },

  /**
   * Has abandonment issues.
   *
   * SUCKER!: When a racer starts a move on my space, I can move with them.
   *
   * If I start moving with a racer, I can't stop until they finish their full move. I can cross
   * the finish line using my power. I arrive at the space at the same time, but for finishing and
   * triggering powers, the racer I'm moving with resolves first.
   *
   * Under Romantic: If two racers move together simultaneously, like with the Party Animal or
   * Suckerfish, my power doesn't trigger.
   *
   * Fiddly details 5, p. 23: Some powers can interact many times but aren't a loop, like
   * Scoocher/Suckerfish.
   */
  "Suckerfish": {
    // Riding another player's Scoocher home only ever finishes 2nd behind it, so within a roll of
    // the finish, stay put and try to roll in first.
    choose: (race, me, to: number, mover: Racer) =>
      to > me.pos && !(race.track.length - me.pos <= 6 && race.has(mover, "Scoocher") && mover.player !== me.player),
    rides: true,
  },

  /**
   * Searching for her throther half.
   *
   * ROLL THROUGH: At the start of my turn, I can warp to any space with exactly 2 racers on it.
   *
   * I still get my main move after warping.
   */
  "Third Wheel": {
    choose(race, me) {
      const counts = new Map<number, number>();
      for (const o of race.onTrack()) counts.set(o.pos, (counts.get(o.pos) ?? 0) + 1);
      const pairs = [...counts].filter(([pos, n]) => n === 2 && pos > me.pos).map(([pos]) => pos);
      return pairs.length ? Math.max(...pairs) : null;
    },
    startTurn(race, me) {
      const pos: number | null = race.choose(me, "Third Wheel");
      if (pos !== null) race.use(me, "Third Wheel", () => race.warp(me, pos));
    },
  },

  /**
   * Not related to anyone, just identical to everyone.
   *
   * DOUBLE DIP: Before my race, I can pick a racer who won a previous race and race with their
   * powers.
   *
   * You should still use my racer token! I still get any "before race" powers.
   */
  "Twin": {
    choose: (race, _me, options: Name[]) => race.best(options),
    beforeRace(race, me) {
      const options = race.winners.filter((n) => n !== "Twin");
      if (options.length) race.gain(me, race.choose(me, "Twin", options));
    },
  },
};
