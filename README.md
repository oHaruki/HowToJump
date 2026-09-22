# Project Aim

Ranked osu! aim. Sixteen packs of aim maps from Stone to GOAT, graded on
misscount, with scores tracked automatically from players' osu! accounts.

Play a map from the bank with the right mods and it counts. There is no
submission form, no screenshot and no review queue, because the score comes
from osu! rather than from a picture of osu!.

## The two ideas it rests on

**An entry is a beatmap plus a mod.** The same map under DT is a separate entry
with its own pack and its own leaderboard, and a score only counts when the
mods match. Everything from duplicate detection to score matching keys on
`beatmapId|mod`. Hidden is the exception: it moves no notes, so it never splits
an entry.

**Scores arrive on their own.** Players connect their osu! account once and the
worker reads their recent plays; anything landing on a bank entry is imported
with misscount, accuracy, combo and mods taken straight from osu!.

Almost every map on the ladder is graveyard, and graveyard maps have no beatmap
leaderboard, so the worker reads plays rather than leaderboards. osu! cannot
push a score, so every minute it reads play counts fifty players to a request
and fetches recent plays only for the players whose count went up. A score
usually lands within a minute, and everyone is swept once a day as a backstop.

## Levels

Every play earns EXP: its pack's value times the share its grade earns, which
falls with every miss on one curve rather than stepping from grade to grade. A
category's level adds up a player's best ten plays in it, so grinding easy maps
does not help and a new map never lowers anyone. The main level is the average
of the five categories, and the leaderboard ranks by the EXP behind it.

Maps reach the bank through staff: helpers paste rows from the grading sheet
into a queue, and an admin approves what the ladder actually holds.

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL 16 · Drizzle ORM · Auth.js v5
with a custom osu! OAuth provider · plain CSS, no framework.

## Running it

Register an osu! OAuth app at <https://osu.ppy.sh/home/account/edit#oauth> with
`http://localhost:6500/api/auth/callback/osu` as the callback. The same client
covers both login and beatmap lookups.

```bash
cp .env.example .env.local
# OSU_CLIENT_ID, OSU_CLIENT_SECRET, an AUTH_SECRET (openssl rand -base64 32),
# and your own osu! user ID in BOOTSTRAP_ADMINS

docker run -d --name htj-pg \
  -e POSTGRES_USER=howtojump -e POSTGRES_PASSWORD=howtojump -e POSTGRES_DB=howtojump \
  -p 5435:5432 postgres:16-alpine

npm install
npm run db:deploy
npm run dev
```

`db:deploy` is the same step production runs, and safe to repeat whenever you
pull. It pulls beatmap metadata from the osu! API when credentials are present
and falls back to the sheet's own values when they are not.

| | |
|---|---|
| `npm run dev` | Development server on 6500 |
| `npm test` | Parser, mod, grading and level tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:deploy` | Bring the database up to this build |
| `npm run sync` | One sync pass from the CLI |
| `npm run levels:rebuild` | Recompute every player's levels now |

## Deploying

```bash
cd docker && docker compose up -d --build
```

The same command after a `git pull`, with nothing to run by hand. Every `up`
brings the database up to the build first and starts the app only once that has
finished. Compose runs the app, Postgres, and a worker calling
`POST /api/sync/run` every minute.

The app is published on `127.0.0.1:6500` for an existing reverse proxy to sit
in front of. Where 80 and 443 are free, `--profile edge` brings up the bundled
Caddy instead, with `DOMAIN` set.
