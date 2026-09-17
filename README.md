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

Compose runs four things: the app, Postgres, a worker that calls
`POST /api/sync/run` every 15 minutes, and optionally Caddy for TLS. The sync
endpoint decides who is actually due, so that timer only has to be more
frequent than the shortest interval, never exact.

There are two shapes of host. On a box where ports 80 and 443 are free, Caddy
can terminate TLS itself. On a box already serving other sites, an existing
nginx or Caddy proxies to the app instead, and the bundled Caddy stays off.
`docker/compose.override.yml` assumes the second, because it is the case that
goes wrong quietly: it keeps Caddy behind a profile so a plain `up` cannot take
80 and 443 out from under something else.

### 1. DNS

Point an A record at the host and let it resolve before requesting a
certificate. Behind Cloudflare's proxy, set SSL/TLS to **Full (strict)**;
on Flexible the site redirect-loops.

### 2. Configure

```bash
cd docker
cp ../.env.example .env
chmod 600 .env          # it holds the osu! client secret
```

Compose reads `.env` from the directory the compose file lives in, so it
belongs in `docker/`, not the repository root. Fill in:

| | |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `SYNC_TOKEN` | `openssl rand -hex 32` |
| `AUTH_URL` | the public HTTPS URL, exactly |
| `OSU_CLIENT_ID`, `OSU_CLIENT_SECRET` | from the osu! OAuth app |
| `BOOTSTRAP_ADMINS` | your osu! user ID, so the first sign in lands as admin |
| `DOMAIN` | only when the bundled Caddy terminates TLS |

`AUTH_URL` is the usual cause of a redirect mismatch at sign in. The osu! app's
callback URL has to match it: `https://<domain>/api/auth/callback/osu`.
`AUTH_TRUST_HOST` is already set in the compose file, which is what a proxied
deployment needs.

### 3. Start

Behind an existing proxy:

```bash
docker compose up -d --build
```

The app is published on `127.0.0.1:6500` and nothing binds 80 or 443. The
loopback prefix is not decoration: Docker writes its own iptables rules, so a
bare `6500:3000` would be reachable from the internet whatever UFW reports.

Or, on a host with 80 and 443 free, with `DOMAIN` set:

```bash
docker compose --profile edge up -d --build
```

Check what came up, and that the ports are what you expect:

```bash
docker compose ps
sudo ss -tlnp | grep 6500
```

### 4. Schema and seed

```bash
docker compose run --rm migrate
docker compose restart app
```

The runtime image is a Next standalone build, so it has no `drizzle-kit`, no
`tsx` and no `src/`. The `migrate` service runs `db:push` and `db:seed` from
the builder stage, which has all three. The seed pulls beatmap metadata when
osu! credentials are present and falls back to the sheet's own numbers when
they are not.

The restart matters: `app` has been holding connections to a Postgres that
`migrate` may have just waited on.

### 5. Reverse proxy

Only when the host already runs one. A new server block, rather than an edit to
an existing one:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name howtojump.example.com;

    location / {
        proxy_pass http://127.0.0.1:6500;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/howtojump.example.com /etc/nginx/sites-enabled/
sudo nginx -t          # must pass before the reload
sudo systemctl reload nginx
sudo certbot --nginx -d howtojump.example.com
```

`nginx -t` is what protects the other sites on the box. If it fails, remove the
symlink rather than reloading. Certbot's HTTP-01 challenge works through
Cloudflare's proxy.

For host Caddy, the whole of it is one block, and the certificate is automatic:

```
howtojump.example.com {
    reverse_proxy 127.0.0.1:6500
}
```

### 6. Verify

The ladder loads, sign in with osu! lands as admin, `/staff` is reachable, and
`docker compose logs worker --tail 20` shows the sync loop alive.

### Keeping it running

Deploy a change, re-running `migrate` only when the schema moved:

```bash
git pull && docker compose up -d --build
```

Postgres is not published on the host, so a dump goes through the container.
A crontab entry is one line, and two details there bite: `exec -T` is
required, because without a TTY the dump fails silently, and `%` has to be
escaped as `\%`.

```bash
0 4 * * * cd /srv/howtojump/docker && docker compose exec -T postgres pg_dump -U howtojump howtojump | gzip > ~/backups/htj-$(date +\%F).sql.gz
```

Docker's default `json-file` log driver has no size limit, so container logs
grow until the disk is full. Worth capping once, in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
```

That one needs `systemctl restart docker`, which restarts every container on
the host.

## Notes

- Beatmap cover art comes from `assets.ppy.sh`. Old sets genuinely 404 there;
  the UI falls back to a pack tinted placeholder rather than a broken image.
- The osu! API asks for no more than 60 requests a minute. Every call in the app
  goes through one shared token bucket in `src/lib/osu/client.ts`.
- `scores.osu_score_id` is unique. That is the idempotency key that makes
  re-running a sync safe.
