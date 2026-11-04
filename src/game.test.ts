import assert from "node:assert/strict";
import { test } from "node:test";
import { mulberry32, NAMES, type Name, playGame, Race, type RaceOptions, shuffle } from "./game.ts";

function setup(names: Name[], pos: number[], dice: number[] = [], o: Partial<RaceOptions> = {}) {
  const race = new Race({ racers: names, dice, rng: mulberry32(1), ...o });
  race.racers.forEach((r, i) => (r.pos = pos[i]));
  return race;
}

test("rulebook example: Romantic passes Scoocher and Banana", () => {
  const race = setup(["Romantic", "Scoocher", "Banana"], [1, 3, 4], [5]);
  const [romantic, scoocher, banana] = race.racers;
  race.turn(romantic);
  assert.equal(romantic.tripped, true);
  assert.equal(romantic.pos, 8);
  assert.equal(scoocher.pos, 5);
  assert.equal(banana.pos, 4);
});

test("Scoocher and Huge Baby loop once", () => {
  const race = setup(["Alchemist", "Scoocher", "Huge Baby"], [0, 4, 5], [2]);
  const [alchemist, scoocher] = race.racers;
  race.turn(alchemist);
  assert.equal(alchemist.pos, 4);
  assert.equal(scoocher.pos, 4);
  assert.ok(race.loops > 0);
});

test("random races finish, except rare rules deadlocks", () => {
  const rng = mulberry32(42);
  const seen = new Set<Name>();
  let stalled = 0;
  for (let i = 0; i < 20000; i++) {
    const names = shuffle([...NAMES], rng).slice(0, 2 + (i % 5));
    names.forEach((n) => seen.add(n));
    const result = new Race({ racers: names, rng }).run();
    stalled += +result.stalled;
    assert.ok(result.finishers.length <= 2);
  }
  // e.g. four racers on the last space with Coach (+1) and Stickler (exact finishes only), or
  // Flip Flop and Copycat as the last two left, swapping every turn
  assert.ok(stalled < 25, `${stalled} stalled`);
  assert.equal(seen.size, NAMES.length);
});

test("variants: your second racer counts as another racer, but not as another player's", () => {
  // Inchworm eats its own teammate's 1.
  let race = setup(["Banana", "Inchworm"], [0, 0], [1], { players: [0, 0] });
  race.turn(race.racers[0]);
  assert.deepEqual(race.racers.map((r) => r.pos), [0, 1]);
  // Hypnotist doesn't pull back its own player's racer.
  race = setup(["Hypnotist", "Banana"], [0, 10], [1], { players: [0, 0] });
  race.turn(race.racers[0]);
  assert.deepEqual(race.racers.map((r) => r.pos), [1, 10]);
});

test("variants draft 8 racers each and race two at a time", () => {
  for (const players of [2, 3]) {
    const game = playGame({ players, double: true, rng: mulberry32(players) });
    assert.ok(game.teams.every((t) => t.length === 8));
    assert.ok(game.races.every((r) => r.racers.length === 2 * players));
    assert.equal(new Set(game.teams.flat()).size, 8 * players);
  }
});

test("playouts replay this turn, force a choice, and play the rest out", () => {
  let wins: number[] = [];
  const race = new Race({
    racers: ["Legs", "Banana"],
    rng: mulberry32(3),
    playouts: true,
    policy: {
      choose: {
        Legs: (r, me) => {
          if (r.snapshot && !wins.length) wins = [true, false].map((c) => r.playout(me, "Legs", c, 200, (_, x) => +(x.place === 1)));
          return true;
        },
      },
    },
  });
  race.run();
  assert.ok(wins[0] > wins[1], `${wins}`);
});

test("full games score four races", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const game = playGame({ players: 3 + (i % 4), rng });
    assert.equal(game.races.length, 4);
    assert.ok(game.scores.every(Number.isFinite));
  }
});
