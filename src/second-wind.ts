import type { Name, Race, Racer } from "./game.ts";
import { landing, others, type Powers, rolled } from "./racers.ts";

/** Swaps two racers' spaces, a warp for both, like Flip Flop. */
function swap(race: Race, a: Racer, b: Racer) {
  if (a.pos === b.pos) return;
  [a.pos, b.pos] = [b.pos, a.pos];
  race.say(`${a.name} swaps with ${b.name}`);
  race.arrive(a);
  race.arrive(b);
}

/** An index into `weights`, drawn in proportion to them. */
function draw(race: Race, weights: number[]) {
  let x = race.rng() * weights.reduce((s, w) => s + w, 0);
  return weights.findIndex((w) => (x -= w) < 0);
}

const opponentFirst = (me: Racer, qs: Racer[]) => qs.find((o) => o !== me && o.player !== me.player) ?? qs.find((o) => o !== me);

// The Second Wind expansion's cards (power name: text), from the card list at
// https://johnnlds.github.io/Magical-Athlete-Racers/. There's no rulebook for them yet, so every
// reading beyond the card's text is ours, and listed with the card.
export const SECOND_WIND_RACERS: Partial<Record<Name, Powers>> = {
  /**
   * HUUAARRGGHHH!!!!: When I roll a 1 or 2 for my main move, I transform into a W.E.R.E.M.O.U.T.H.
   * who eliminates any racers I pass.
   *
   * For the rest of the race, and starting with that roll's move.
   */
  "Bite Mark": {
    onRoll(race, me, roller, roll) {
      if (me === roller && roll >= 1 && roll <= 2 && !me.state.were) race.use(me, "Bite Mark", () => (me.state.were = true));
    },
    onPass(race, me, mover, passed) {
      if (mover !== me || !me.state.were) return;
      return () => {
        for (const q of passed) if (race.active(q)) race.use(me, "Bite Mark", () => race.eliminate(q));
      };
    },
  },

  /**
   * BLUNDERTRAIL: When I'm in last place, triple my main move roll. When I'm not, I move backwards
   * for my main move instead.
   *
   * Tied for last counts as last, so the first turn triples. Modifiers lengthen a backward move.
   */
  "Blunderdog": {
    base: (race, me, _roll, base) => (race.last().includes(me) ? base * 3 : -base),
  },

  /**
   * SLEIGHT OF PAW: Instead of rolling for my main move, I secretly set my die to any number. If
   * the player to my right guesses the number, I don't move.
   *
   * Both sides play the guessing game's equilibrium: Cheatah sets 4, 5 or 6 in proportion to 1/4,
   * 1/5 and 1/6, and the guesser guesses them 7/37, 13/37 and 17/37 of the time, so Cheatah moves
   * 120/37 ≈ 3.24 on average. Setting the die isn't a roll, so it doesn't trigger Lackey or
   * Inchworm.
   */
  "Cheatah": {
    choose(race, me) {
      const set = 4 + draw(race, [15, 12, 10]);
      const right = race.racers[(me.seat + race.racers.length - 1) % race.racers.length];
      const guess = right.player === me.player ? 0 : 4 + draw(race, [7, 13, 17]);
      return set === guess ? 0 : set;
    },
    replaceMain(race, me) {
      const set: number = race.choose(me, "Cheatah");
      if (set) return set;
      race.use(me, "Cheatah");
      return true;
    },
  },

  /**
   * BON MOTS: I can make racers ahead of me reroll their main move once per turn.
   *
   * After their own rerolls and before Dicemonger's, when the roll lands better than an average
   * one would.
   */
  "Critic": {
    choose: (race, me, roller: Racer, roll: number) =>
      roller.player !== me.player && landing(race, roller.pos + roll, 15) > rolled(race, roller.pos, 15),
    forcesReroll: (race, me, roller, roll) => roller.pos > me.pos && race.choose(me, "Critic", roller, roll),
  },

  /**
   * QUELLE DRAMATIQUE!: If I'm in last place at the start of my turn, I swap spaces with the lead
   * racer. Otherwise, I swap with the last place racer.
   *
   * A warp, like Flip Flop's. Tied for last counts as last.
   */
  "Diva": {
    startTurn(race, me) {
      const last = race.last();
      const t = opponentFirst(me, last.includes(me) ? race.lead() : last);
      if (t && t.pos !== me.pos) race.use(me, "Diva", () => swap(race, me, t));
    },
  },

  /**
   * TAKE A DIVE: The racer who finishes 1st is eliminated instead. I get their power.
   *
   * Once a race: the next racer across takes 1st.
   */
  "Doppelgängster": {
    steals: (_race, me) => !me.state.stole && (me.state.stole = true),
  },

  /**
   * GLORPOR: I get -1 to my main move. When the race ends, I get 3 points if I'm not past the
   * second corner.
   */
  "Gloth": {
    modify: (_race, me, mover) => (mover === me ? -1 : 0),
    endRace(race, me) {
      if (me.pos > race.track.corner2) return;
      me.uses++;
      race.say(`${me.name}: Gloth`);
      race.bronze(me, 3);
    },
  },

  /**
   * PIGGYBACK: I start my race on a hog that gives +2 to its rider's main move. When a racer stops
   * on the hog's space, they take it.
   *
   * The hog leaves the race with its rider.
   */
  "Hog Knight": {
    beforeRace(_race, me) {
      me.state.rider = me.seat;
    },
    modify: (_race, me, mover) => (mover.seat === me.state.rider ? 2 : 0),
    onArrive(race, me, mover, at, together) {
      if (me.state.rider === undefined) return;
      const rider = race.racers[me.state.rider];
      if (mover === rider || !race.stays(mover, at) || !race.active(rider) || rider.pos !== at) return;
      if (together.includes(mover) && together.includes(rider)) return;
      return () => race.use(me, "Hog Knight", () => (me.state.rider = mover.seat));
    },
  },

  /**
   * BOIOIOING: When I end my turn 1 space behind a racer, I take an extra turn.
   */
  "Hopfrog": {
    endTurn(race, me, mover) {
      if (mover === me && others(race, me, me.pos + 1).length) race.use(me, "Hopfrog", () => race.queue.unshift(me));
    },
  },

  /**
   * MONOPOLIZE: When a racer stops on my space, they pay me 1 point. If they can't, they trip.
   *
   * Not when we arrive together, like other powers about stopping together (Fiddly details 2).
   */
  "Hotel": {
    onArrive(race, me, mover, at, together) {
      if (mover === me || mover.player === me.player || !race.stays(mover, at) || me.pos !== at) return;
      if (together.includes(mover) && together.includes(me)) return;
      return () =>
        race.use(me, "Hotel", () => {
          if (race.points(mover.player) <= 0) return race.trip(mover);
          mover.bronze--;
          me.bronze++;
        });
    },
  },

  /**
   * FLIGHT RISK: I get +3 to my main move. If I roll a 6 for my main move, I'm eliminated.
   */
  "Icarus": {
    modify: (_race, me, mover) => (mover === me ? 3 : 0),
    onRoll(race, me, roller, roll) {
      if (me !== roller || roll !== 6) return;
      race.use(me, "Icarus", () => race.eliminate(me));
      return true;
    },
  },

  /**
   * REGISLIDE: At the start of my turn, I can trip the lead racer.
   *
   * Any opponent tied for the lead, unless I lead alone.
   */
  "Kingtripper": {
    choose: (race, me) => race.lead().find((o) => o.player !== me.player && !o.tripped) ?? null,
    startTurn(race, me) {
      const lead = race.lead();
      if (lead.length === 1 && lead[0] === me) return;
      const t: Racer | null = race.choose(me, "Kingtripper");
      if (t) race.use(me, "Kingtripper", () => race.trip(t));
    },
  },

  /**
   * GET OVER HERE: Once per race, at the start of my turn, I can warp all other racers to my space
   * and trip them.
   *
   * Once an opponent is 6 or more spaces ahead.
   */
  "Kraken": {
    choose: (race, me) => race.onTrack().some((o) => o.player !== me.player && o.pos - me.pos >= 6),
    startTurn(race, me) {
      if (me.state.used || !race.choose(me, "Kraken")) return;
      me.state.used = true;
      race.use(me, "Kraken", () => {
        const qs = race.byPriority().filter((o) => o !== me);
        for (const q of qs) race.warp(q, me.pos);
        for (const q of qs) race.trip(q);
      });
    },
  },

  /**
   * TROIS REVOIR: When other racers roll a 3 for their main move, they move backwards instead.
   *
   * Backwards 3, plus or minus modifiers.
   */
  "Le Saboteur": {
    onRoll(race, me, roller, roll, skipped) {
      if (roller !== me && roll === 3 && !skipped) race.use(me, "Le Saboteur", () => (race.backward = true));
    },
  },

  /**
   * FLEXOMANCY: When I roll this for my main move… 1: I move 7. 2: The last place racer warps to
   * me. 3: I warp to another racer and trip them. 4: I move 4 and take an extra turn. 5: The lead
   * racer moves backwards 5. 6: I move 6 and trip any racers I pass.
   *
   * On 2, 3 and 5 I don't move. Ties pick an opponent, and on 5 I move back if I lead alone. On 3 I
   * warp to the racer farthest ahead.
   */
  "Magical Athlete": {
    choose: (race, me) => race.onTrack().filter((o) => o !== me).sort((a, b) => b.pos - a.pos || +(a.player === me.player) - +(b.player === me.player))[0] ?? null,
    onRoll(race, me, roller, roll, skipped) {
      if (roller !== me || skipped) return;
      const p = "Magical Athlete";
      if (roll === 2) {
        const t = race.last().find((o) => o !== me);
        race.use(me, p, () => t && race.warp(t, me.pos));
        return true;
      }
      if (roll === 3) {
        const t: Racer | null = race.choose(me, p);
        race.use(me, p, () => {
          if (!t) return;
          race.warp(me, t.pos);
          race.trip(t);
        });
        return true;
      }
      if (roll === 5) {
        const t = opponentFirst(me, race.lead()) ?? me;
        race.use(me, p, () => race.move(t, -5));
        return true;
      }
      if (roll === 4) race.use(me, p, () => race.queue.unshift(me));
      if (roll === 6) {
        race.use(me, p, () => (me.state.trample = true));
        race.afterMain.push(() => (me.state.trample = false));
      }
    },
    base: (_race, _me, roll, base) => (roll === 1 ? 7 : base),
    onPass(race, me, mover, passed) {
      if (mover === me && me.state.trample) return () => race.use(me, "Magical Athlete", () => passed.forEach((q) => race.trip(q)));
    },
  },

  /**
   * TUNNELIN': If there aren't any racers within 1 space of me, I can skip rolling for my main move
   * and move 6 instead.
   */
  "Mole": {
    choose: (race, me) => landing(race, me.pos + 6) >= rolled(race, me.pos),
    replaceMain: (race, me) =>
      !race.onTrack().some((o) => o !== me && Math.abs(o.pos - me.pos) <= 1) && race.choose(me, "Mole") ? 6 : false,
  },

  /**
   * YES! MORE!: I roll all six dice for my main move and pick any number that was rolled more than
   * once.
   *
   * With no number twice, my roll is 0.
   */
  "Mr. Dice Guy": {
    choose: (race, me, options: number[]) =>
      options.reduce((a, b) => (landing(race, me.pos + b, 15) >= landing(race, me.pos + a, 15) ? b : a)),
    roll(race, me) {
      const dice = Array.from({ length: 6 }, () => race.d6(me));
      const options = [1, 2, 3, 4, 5, 6].filter((k) => dice.filter((d) => d === k).length > 1);
      race.use(me, "Mr. Dice Guy");
      return options.length ? race.choose(me, "Mr. Dice Guy", options) : 0;
    },
  },

  /**
   * GLOBSTER MASH: When I roll a 1 or 2 for my main move, I draw a racer card and get its power for
   * the rest of the race.
   *
   * Every time, with no limit, and never its "before my race" power. I still move the 1 or 2.
   */
  "Mush": {
    onRoll(race, me, roller, roll) {
      if (me !== roller || roll < 1 || roll > 2 || !race.deck.length) return;
      const card = race.deck[Math.floor(race.rng() * race.deck.length)];
      race.use(me, "Mush", () => {
        race.deck = race.deck.filter((n) => n !== card);
        race.gain(me, card, false);
      });
    },
  },

  /**
   * GRUDGE MATCH: When other racers roll for their main move, I can roll too. If I roll the same, I
   * move that amount.
   *
   * Every time: rolling is using my power, so Scoocher moves even when I miss, as with Genius.
   */
  "Nemesis": {
    onRoll(race, me, roller, roll) {
      if (roller === me || roll < 1) return;
      race.use(me, "Nemesis", () => {
        if (race.d6(me) === roll) race.move(me, roll);
      });
    },
  },

  /**
   * HUGELY RICH: I start the race on the first corner of the track.
   *
   * Space 12, set there before the race rather than stopping there.
   */
  "Nepo Baby": {
    beforeRace(race, me) {
      me.pos = race.track.corner1;
    },
  },

  /**
   * VOID: Racers ahead of me get -1 to their main move and have no powers.
   *
   * Ahead when the move starts, for the -1.
   */
  "Null": {
    modify: (_race, me, mover, start) => (mover !== me && start > me.pos ? -1 : 0),
  },

  /**
   * SKULLDIGGERY: I get +1 to my main move for each racer ahead of me.
   *
   * Racers who've finished count.
   */
  "Overtaker": {
    modify: (race, me, mover, start) =>
      mover === me ? race.racers.filter((o) => o.place !== null || (race.active(o) && o.pos > start)).length : 0,
  },

  /**
   * NOISE COMPLAINT: All sixes must be rerolled. When they are, I move 1.
   *
   * Every die anyone rolls, not only main moves.
   */
  "Party Pooper": {
    rerollsSixes: true,
  },

  /**
   * TUMMY TIME: Whenever a racer passes me, I trip. While I'm tripped, double my roll for my main
   * move instead of skipping it.
   *
   * Taking that main move is how I recover.
   */
  "Penguin": {
    rollsTripped: true,
    base: (race, _me, _roll, base) => (race.recovering ? base * 2 : base),
    onPass(race, me, mover, passed) {
      if (mover !== me && passed.includes(me)) return () => race.use(me, "Penguin", () => race.trip(me));
    },
  },

  /**
   * RUN IT BACK: After my first race, I race as an extra racer for my player in all remaining
   * races.
   *
   * Nothing within a race, so it's a racer with no power here.
   */
  "Re-Runner": {},

  /**
   * GUYS, WATCH!: After I roll for my main move, I can keep rolling and adding each amount to my
   * move. If I ever roll the same or lower, I don't move.
   *
   * I roll again while that's worth more on average than stopping, which is after a 1, 2 or 3,
   * and stop once the move would finish.
   */
  "Show-Off": {
    base(race, me, roll, base) {
      let total = base;
      let last = roll;
      const keepGoing = () => [1, 2, 3, 4, 5, 6].reduce((s, x) => s + (x > last ? total + x : 0), 0) / 6 > total;
      while (me.pos + total < race.track.length && keepGoing()) {
        const x = race.d6(me);
        race.use(me, "Show-Off");
        if (x <= last) return null;
        total += x;
        last = x;
      }
      return total;
    },
  },

  /**
   * TWIN FLAME: Before my race, I pick any opposing racer. When I start my turn within 5 spaces of
   * them, I warp to their space.
   *
   * Behind them or ahead. I pick the best-rated opponent.
   */
  "Soulmate": {
    choose: (race, me) =>
      race.racers.filter((o) => o.player !== me.player).reduce<Racer | null>((a, b) =>
        !a || race.policy.rating(b.name, race) > race.policy.rating(a.name, race) ? b : a, null),
    beforeRace(race, me) {
      const t: Racer | null = race.choose(me, "Soulmate");
      if (t) me.state.mate = t.seat;
    },
    startTurn(race, me) {
      if (me.state.mate === undefined) return;
      const t = race.racers[me.state.mate];
      if (race.active(t) && t.pos !== me.pos && Math.abs(t.pos - me.pos) <= 5) race.use(me, "Soulmate", () => race.warp(me, t.pos));
    },
  },

  /**
   * TERMINAL VELOCITY: I get +1 to my main move for each point my player has. I am eliminated if
   * I'm 4+ spaces in the lead at the start of my turn.
   */
  "Speed Demon": {
    modify: (race, me, mover) => (mover === me ? Math.max(0, race.points(me.player)) : 0),
    startTurn(race, me) {
      const rest = race.onTrack().filter((o) => o !== me);
      if (rest.length && me.pos - Math.max(...rest.map((o) => o.pos)) >= 4) race.use(me, "Speed Demon", () => race.eliminate(me));
    },
  },

  /**
   * CRY FOUL: If all other racers are 5+ spaces ahead of me at the start of my turn, the race is
   * cancelled and I get 3 points.
   *
   * Racers who've finished count as ahead, and keep their chips.
   */
  "Spoilsport": {
    startTurn(race, me) {
      const rest = race.racers.filter((o) => o !== me && o.eliminated === null);
      if (!rest.length || rest.some((o) => o.pos < me.pos + 5)) return;
      me.uses++;
      race.say(`${me.name}: Spoilsport`);
      race.bronze(me, 3);
      race.end();
    },
  },

  /**
   * STEP UP: The racer to my left gets +2 to their main move. If they finish 1st, I get 3 points.
   *
   * To my left is next in turn order.
   */
  "Stepdad": {
    modify: (race, me, mover) => (mover !== me && mover.seat === (me.seat + 1) % race.racers.length ? 2 : 0),
    onFirst(race, me, winner) {
      if (winner !== me && winner.seat === (me.seat + 1) % race.racers.length) race.use(me, "Stepdad", () => race.bronze(me, 3));
    },
  },

  /**
   * EXHIBIT B: When I pass any racers, I get 1 point.
   *
   * 1 a move, however many I pass.
   */
  "Streaker": {
    onPass(race, me, mover, passed) {
      if (mover === me && passed.length) return () => race.use(me, "Streaker", () => race.bronze(me, 1));
    },
  },

  /**
   * STOP TRAFFIC: Other racers within 1 space of me roll a 1 for all rolls.
   */
  "Stunner": {
    stuns: (_race, me, roller) => roller !== me && Math.abs(roller.pos - me.pos) <= 1,
  },

  /**
   * MARSWAPIAL: When I end my turn within 1 space of another racer, I can swap who controls which
   * racer: their player takes my card and I take theirs.
   *
   * Each player keeps the chips they already have. I swap for an opponent 1 space ahead.
   */
  "Switcharoo": {
    choose: (race, me) =>
      race.onTrack().find((o) => o.player !== me.player && o.pos === me.pos + 1) ?? null,
    endTurn(race, me, mover) {
      if (mover !== me) return;
      const t: Racer | null = race.choose(me, "Switcharoo");
      if (t) {
        race.use(me, "Switcharoo", () => {
          [me.player, t.player] = [t.player, me.player];
          [me.bronze, t.bronze] = [t.bronze, me.bronze];
        });
      }
    },
  },

  /**
   * REAR END: At the start of my turn, I can warp to the space behind the next racer ahead of me.
   */
  "Tail": {
    choose: (race, me, to: number) => landing(race, to, 15) > me.pos,
    startTurn(race, me) {
      const ahead = race.onTrack().filter((o) => o.pos > me.pos);
      if (!ahead.length) return;
      const to = Math.min(...ahead.map((o) => o.pos)) - 1;
      if (to > me.pos && race.choose(me, "Tail", to)) race.use(me, "Tail", () => race.warp(me, to));
    },
  },

  /**
   * POWER WASH: At the end of my turn, roll a die and trip every racer within that many spaces
   * ahead of me.
   */
  "The Hose": {
    endTurn(race, me, mover) {
      if (mover !== me) return;
      race.use(me, "The Hose", () => {
        const d = race.d6(me);
        for (const q of race.onTrack()) if (q.pos > me.pos && q.pos - me.pos <= d) race.trip(q);
      });
    },
  },

  /**
   * THE METHOD: Before my race, I copy an opposing racer's power.
   *
   * The best-rated one, with its "before my race" power, as Egg and Twin get theirs.
   */
  "Understudy": {
    choose: (race, _me, options: Name[]) => race.best(options),
    beforeRace(race, me) {
      const options = race.racers.filter((o) => o.player !== me.player && o.name !== "Understudy").map((o) => o.name);
      if (options.length) race.gain(me, race.choose(me, "Understudy", options));
    },
  },
};
