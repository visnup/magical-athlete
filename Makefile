# Regenerates results/ and charts/ from whatever changed. A rule names the last file its script
# writes, since make 3.81 has no grouped targets.
SRC := $(filter-out %.test.ts,$(wildcard src/*.ts)) src/ratings.json
RACES := results/races-wild-6p.parquet
RESULTS := $(RACES) results/lineup-draft.parquet results/twin-rated.parquet results/choices-third-wheel.parquet \
	results/games-5p.parquet results/games-3p.parquet results/games-2p-double.parquet results/games-3p-double.parquet \
	results/draft-5p.parquet results/endgame-5p.parquet results/sensitivity-queue-wild.parquet results/playouts.parquet

.PHONY: all test
all: charts/sensitivity.svg

test:
	node --test

$(RACES): scripts/races.ts $(SRC)
	node scripts/races.ts
results/lineup-draft.parquet: scripts/lineup.ts $(RACES)
	node scripts/lineup.ts
results/twin-rated.parquet: scripts/twin.ts $(RACES)
	node scripts/twin.ts
results/choices-third-wheel.parquet: scripts/choices.ts $(SRC)
	node scripts/choices.ts
results/games-5p.parquet: scripts/games.ts $(SRC)
	node scripts/games.ts
results/games-3p.parquet: scripts/games.ts $(SRC)
	node scripts/games.ts --players 3
results/games-%p-double.parquet: scripts/games.ts $(SRC)
	node scripts/games.ts --double --players $*
results/draft-5p.parquet: scripts/draft.ts $(SRC)
	node scripts/draft.ts
results/endgame-5p.parquet: scripts/endgame.ts scripts/draft.ts scripts/spread.ts $(RACES)
	node scripts/endgame.ts
results/sensitivity-queue-wild.parquet: scripts/sensitivity.ts $(RACES)
	node scripts/sensitivity.ts
results/playouts.parquet: scripts/playouts.ts $(SRC)
	node scripts/playouts.ts

charts/sensitivity.svg: scripts/charts.ts scripts/matchups.ts scripts/spread.ts $(RESULTS)
	node scripts/charts.ts
