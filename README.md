# HowToJump

A judged ladder through osu! aim. Sixteen packs from Stone to GOAT, graded on
misscount, with scores tracked automatically from players' osu! accounts.

## How it works

**An entry is a beatmap plus a mod.** The same map under DT is a separate entry
with its own pack and its own leaderboard, and a score only counts when the mods
match. Everything from duplicate detection to score matching keys on
`beatmapId|mod`.

**Scores arrive on their own.** Players connect their osu! account once, and the
sync worker reads their recent plays. Anything landing on a bank entry is
imported with misscount, accuracy, combo and mods taken straight from osu!.
There is no submission form, no screenshot, and no review queue for scores.

The reason it polls rather than reading leaderboards: almost every map on the
ladder is graveyard, and graveyard maps have no beatmap leaderboard. The recent
plays endpoint returns *plays* rather than leaderboard entries, so it covers
them. Its window is the last 100 plays or 24 hours, whichever runs out first,
which is why active players are swept every 30 minutes rather than daily.

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL 16 · Drizzle ORM ·
Auth.js v5 with a custom osu! OAuth provider · plain CSS with design tokens.

There is no CSS framework. The design is a token port of [kyun.sh](https://kyun.sh):
hairline borders, squircle corners, near monochrome chrome, with pack colour as
the only real colour on the site. Dark only for now.

## Getting started

### 1. Register an osu! OAuth app

At <https://osu.ppy.sh/home/account/edit#oauth>, with callback URL
`http://localhost:6500/api/auth/callback/osu` for development. The same client
ID and secret cover both user login and beatmap lookups.

### 2. Configure

```bash
cp .env.example .env
```

Fill in `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET`, and an `AUTH_SECRET`
(`openssl rand -base64 32`). Put your own osu! user ID in `BOOTSTRAP_ADMINS` so
your first sign in lands as an admin.

### 3. Start Postgres

```bash
docker run -d --name htj-pg \
  -e POSTGRES_USER=howtojump -e POSTGRES_PASSWORD=howtojump -e POSTGRES_DB=howtojump \
  -p 5435:5432 postgres:16-alpine
```

### 4. Create the schema and seed

```bash
npm install
npm run db:push     # or db:migrate to apply the generated SQL
npm run db:seed     # grading scale, site config, and the sheet's map bank
npm run dev
```

The seed pulls beatmap metadata from the osu! API when credentials are present
and falls back to the sheet's own values when they are not, so it works offline.

## Commands

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Parser, mod and grading tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:push` | Push the schema straight to the database |
| `npm run db:seed` | Seed grades, config and the map bank |
| `npm run seed:examples` | Example bank rows for checking search; `-- --clear` removes them |
| `npm run sync` | One sync pass from the CLI |

## Layout

```
src/app          routes: public, /me, /staff, /api
src/components   UI, split into server and client pieces
src/lib
  schema.ts      Drizzle schema
  queries.ts     read side, everything pages render from
  actions.ts     server actions, each one role guarded
  auth.ts        Auth.js config and the role guards
  grading.ts     the grading scale as data
  tiers.ts       the sixteen packs
  mods.ts        mod normalisation, the entry key
  import/parse.ts  the sheet parser
  osu/client.ts  osu! API client and rate limiter
  osu/sync.ts    the score sync worker
src/db           seed, migrations, sync CLI
docker           compose, Dockerfile, Caddyfile
```

## Roles

`user` sees the public site plus their own progress. `helper` can add maps and
review the queue. `admin` can also change roles. The staff area is gated in
`src/app/staff/layout.tsx`, so no staff route is reachable by URL alone, and
every server action re-checks the role rather than trusting the UI.

## Adding maps

Staff paste a range copied out of Google Sheets (tab separated on the
clipboard), drop a CSV or TSV file, or add a single link. All three land in the
same preview, where pack, category and mod are editable per row and settable in
bulk. The parser handles the sheet's European decimal commas (`9,92`), drain
times (`3:10`), every osu! link shape, and quoted CSV cells so a title
containing a comma survives.

Rows are checked before anything is written: already on the ladder, duplicated
within the paste, missing a pack, or an unresolvable link. Nothing reaches the
ladder without a pack, enforced both in the UI and in `approveSuggestions`.

## Deploying

```bash
cd docker
cp ../.env.example .env    # secrets, plus AUTH_URL as the public HTTPS URL
docker compose up -d --build
docker compose run --rm migrate
```

Compose runs the app, Postgres, and a worker that calls `POST /api/sync/run`
every 15 minutes. The endpoint decides who is actually due, so the timer only
has to be more frequent than the shortest interval.

The app is published on `127.0.0.1:6500` for an existing reverse proxy to sit
in front of. On a host where 80 and 443 are free, `--profile edge` brings up
the bundled Caddy instead, with `DOMAIN` set.

Migrations run through `migrate` rather than the app container: the runtime
image is a Next standalone build, with no `drizzle-kit`, `tsx` or `src/`.

## Notes

- Beatmap cover art comes from `assets.ppy.sh`. Old sets genuinely 404 there;
  the UI falls back to a pack tinted placeholder rather than a broken image.
- The osu! API asks for no more than 60 requests a minute. Every call in the app
  goes through one shared token bucket in `src/lib/osu/client.ts`.
- `scores.osu_score_id` is unique. That is the idempotency key that makes
  re-running a sync safe.
