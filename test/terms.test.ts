import assert from "node:assert/strict";
import { test } from "node:test";
import { mulberry32, type Name, Race, type RaceOptions, WILD_WILDS } from "../src/game.ts";

function setup(names: Name[], pos: number[], dice: number[] = [], o: Partial<RaceOptions> = {}) {
  const race = new Race({ racers: names, dice, rng: mulberry32(1), ...o });
  race.racers.forEach((r, i) => (r.pos = pos[i]));
  return race;
}

const names = (rs: { name: Name }[]) => rs.map((r) => r.name);

// Terms, p. 23 of the August 2026 printing.

test("Ahead/Behind: if racers share a space, they're neither ahead nor behind each other", () => {
  let race = setup(["Alchemist", "Banana"], [3, 3], [3]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].tripped, false);
  race = setup(["Alchemist", "Banana"], [0, 3], [3]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].tripped, false);
});

test("Alone: when a racer isn't sharing their space", () => {
  let race = setup(["Lovable Loser", "Banana"], [0, 0], [1]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].bronze, 0);
  race = setup(["Hare", "Banana"], [10, 10], [1]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 13);
});

test("Last place: the racer(s) currently closest to the Start space", () => {
  const race = setup(["Banana", "Legs", "Gunk"], [0, 0, 5]);
  assert.deepEqual(names(race.last()), ["Banana", "Legs"]);
});

test("Lead: doesn't count racers who have already crossed the finish line", () => {
  const race = setup(["Legs", "Banana", "Gunk"], [30, 10, 5]);
  race.racers[0].place = 1;
  assert.deepEqual(names(race.lead()), ["Banana"]);
});

test("Main move: roll your die and move that many spaces", () => {
  let race = setup(["Banana", "Legs"], [0, 20], [4]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 4);
  // Gunk changes main moves, not a Romantic's power move.
  race = setup(["Legs", "Romantic", "Banana", "Gunk"], [0, 0, 4, 20]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 4);
  assert.equal(race.racers[1].pos, 2);
});

test('Move: "moving 0" doesn\'t count as moving', () => {
  const race = setup(["Banana", "Gunk", "Romantic", "Legs"], [5, 10, 0, 5], [1]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 5);
  assert.equal(race.racers[2].pos, 0);
});

test("Passing: when a racer starts a move behind a racer and ends the same move ahead of them", () => {
  const race = setup(["Alchemist", "Banana"], [0, 2], [3]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].tripped, true);
});

test("Passing: or if they're moving backwards, they start ahead and end behind", () => {
  const race = setup(["Centaur", "Legs", "Banana"], [0, 3, 2], [5]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[1].pos, 1);
  assert.equal(race.racers[1].tripped, true);
});

test("Sharing a space: temporarily occupying the same space while moving doesn't count", () => {
  const race = setup(["M.O.U.T.H.", "Banana"], [0, 2], [4]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[1].eliminated, null);
});

test("Space: the Start space counts as a space", () => {
  const race = setup(["Centaur", "Legs", "Romantic"], [0, 1, 0], [5]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[1].pos, 0);
  assert.equal(race.racers[2].pos, 2);
});

test("Stopping on a space: arriving by other means, like warping, counts", () => {
  const race = setup(["Hypnotist", "Banana", "Baba Yaga"], [0, 10, 0], [1]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[1].pos, 0);
  assert.equal(race.racers[1].tripped, true);
});

test("Trip: skip your next main move without rolling, recover on it, and finish the current move", () => {
  let race = setup(["Banana", "Legs"], [0, 20], [6]);
  race.racers[0].tripped = true;
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 0);
  assert.equal(race.racers[0].tripped, false);
  assert.deepEqual(race.dice, [6]);
  race = setup(["Alchemist", "Banana"], [0, 2], [5]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 5);
  assert.equal(race.racers[0].tripped, true);
});

test('Warp: don\'t count it as "moving" for triggering powers, passing racers, etc.', () => {
  const race = setup(["Third Wheel", "Suckerfish", "Banana", "Legs", "Lackey"], [0, 0, 3, 8, 8], [1]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 9);
  assert.equal(race.racers[0].tripped, false);
  assert.equal(race.racers[1].pos, 0);
});

// Fiddly details, p. 23.

test("Fiddly details 6: if there is ever only one racer left, the race ends and that racer places", () => {
  const race = setup(["M.O.U.T.H.", "Banana"], [0, 3], [3]);
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].place, 1);
});

// Track info, p. 23.

test("Arrows: move the number shown, as a separate move that's never part of your main move", () => {
  let race = setup(["Banana", "Gunk"], [2, 20], [6], { track: WILD_WILDS });
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 10);
  race = setup(["Banana", "Legs"], [10, 20], [6], { track: WILD_WILDS });
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].pos, 12);
});

test("Trip: when you stop on a space with a rock, you trip", () => {
  const race = setup(["Banana", "Legs"], [0, 20], [5], { track: WILD_WILDS });
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].tripped, true);
});

test("Star: when you stop on a space with a star, take a bronze 1 point chip", () => {
  let race = setup(["Banana", "Legs"], [0, 20], [1], { track: WILD_WILDS });
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].bronze, 1);
  // Only while the box has bronze chips left.
  race = setup(["Banana", "Legs"], [0, 20], [1], { track: WILD_WILDS, supply: 0 });
  race.turn(race.racers[0]);
  assert.equal(race.racers[0].bronze, 0);
});
