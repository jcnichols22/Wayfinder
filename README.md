# Wayfinder

A self-hosted, mobile-first **Progressive Web App** for field IT support technicians to track site visits, tickets, time onsite, and mileage — replacing manual notes-apps + spreadsheets with fast, one-handed data entry and CSV exports for Workday and ServiceNow.

Built for a **single technician**, self-hosted on your own server, exposed safely through **Cloudflare** with no forwarded ports.

## Features

- **Fast visit tracking** — pick a location (favorites float to the top), optionally add ticket numbers, tap **Start Visit**; one tap to **End Visit** when you leave.
- **Ticket tracking** — attach multiple ticket numbers (INC/SCTASK/etc.) to a single visit.
- **Automatic mileage** — starting a new visit after a previous one at a different location auto-calculates driving distance between the two addresses (no GPS required) via a pluggable routing provider (OpenRouteService, Google Maps, or MapQuest).
- **Editable visit times** — forgot to end a visit,or started it the wrong day? On the **Daily** report, tap **Edit times**, fix the start/end, and duration recalculates automatically. You can even move a visit to a different day.
- **Daily & monthly reports + dashboard** — visits, time, tickets, mileage, and notes at a glance; this-month totals, top locations, active-visit status. You can also delete a visit outright.
- **CSV export** — daily, weekly, monthly, or custom date range, formatted for Workday mileage reporting and quick reference when logging time in ServiceNow.
- **Offline-first PWA** — install it to your Android or iPhone home screen; start/end visits and add tickets while offline, sync automatically when you're back online (with a clear "N pending / syncing" status banner)\.
- **Dark mode, large touch targets, mobile-first** — designed to be used one-handed, walking between buildings.

## Tech Stack

| Layer        | Choice                                                        |
|--------------|--------------------------------------------------------------|
| Frontend     | React + Vite + TypeScript + Tailwind CSS + PWA (custom service worker) |
| Backend      | Node.js + Express + TypeScript                             |
| Database      | SQLite via Prisma ORM (persisted in a Docker volume       |
| Auth          | Local single-user login; JWT session cookie (httpOnly, secure in production)|
| Mileage      | OpenRouteService (default), Google Maps Distance Matrix, or MapQuest Directions (pick one via env var)|
| Deploy        | Docker Compose; Nginx (web image); Nginx Proxy Manager; optional Cloudflare Tunnel|

## Project Structure

```
wayfinder/
  apps/
    api/            Express + Prisma backend
      prisma/        schema.prisma, migrations/, seed.ts
      src/
        routes/       auth, locations, visits, reports, sync, plan
        services/     visitService, mileageProvider, csv
        middleware/   requireAuth
        lib/          auth (JWT/cookie), prisma
        __tests__/    vitest suite (visit lifecycle, tickets, CSV, mileage fallback)
    web/            React + Vite PWA frontend
      src/
        pages/        Home, Dashboard, DailyReport, MonthlyReport, Locations, Plan, Login
        components/   BottomNav, LocationPicker, TicketEditor, SyncBanner
        lib/          api client, offline queue (IndexedDB via idb-keyval)
        hooks/        useAuth, useLiveDuration
        public/       sw.js (custom service worker), icons/, apple-touch-icon.png
  docker-compose.yml     # api + web (+ optional cloudflared)
  .env.example
  README.md
```

## Local Development

Requires Node.js 20+.

```bash
npm install

# Configure environment (root and per-app, every see below nota not needed)
cp .env.example .env    # for Docker; for local dev copy into apps/api/.env
# Set at minimum AUTH_PASSWORD (or AUTH_PASSWORD_HASH)and JWT_SECRET

cd apps/api
npx prisma migrate dev --name init     # create dev.db and apply schema
npm run seed                            # seedsthe starting locations

# Terminal 1 — API:  http://localhost:4000
npm run dev:api

# Terminal 2 — Web: http://localhost:5173 (proxies /api to the backend)
npm run dev:web
```

Log in with the username/password from `apps/api/.env`.

### Tests

```bash
npm run test:api    # vitest — visit lifecycle, tickets, CSV, mileage fallback
npm run test:web    # vitest + testing-library — components, CSV URL builder
npm test              # both
```

## Docker Deployment

```bash
cp .env.example .env
# edit .env: set AUTH_USERNAME, AUTH_PASSWORD_HASH (or AUTH_PASSWORD), JWT_SECRET,
# CORS_ORIGIN,Mileage provider key (if any),and optionally CLOUDFLARE_TUNNEL_TOKEN.



docker compose up -d --build
```

This starts two (or three) containers:

- **`field-tracker-api`** — Express API. Runs `prisma migrate deploy` on startup, and stores its SQLite file in the `field-tracker-data` Docker volume (persists across restarts/upgrades).
- **`field-tracker-web`** — Nginx serving the built PWA, mapping host port `8090` → container port `80`, and proxying `/api/*` to the `api` container on the same network. Point Nginx Proxy Manager (or another reverse proxy) at this port,orto reach it directly at `http://<host>:8090`.
- **`field-tracker-cloudflared`** *(optional)* — throws real Cloudflare Tunnel when `CLOUDFLARE_TUNNEL_TOKEN` is set, exposing the web container over the internet **without opening any ports** on your router.

Generate a bcrypt password hash before deploying:

```bash
cd apps/api && npm install && node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

Then set `AUTH_PASSWORD_HASH` (and either remove or ignore `AUTH_PASSWORD`; the hash takes precedence).

### Public access via Cloudflare Tunnel (no port forwarding)

1. In Cloudflare Zero Trust → **Networks → Tunnels**,create a tunnel using **Cloudflared**; copy the tunnel token (`eyJ...`).
2. Add it to `.env`: `CLOUDFLARE_TUNNEL_TOKEN=<token>`,then `docker compose up -d` (starts the `cloudflared` service automatically).
3. In the tunnel dashboard → **Public Hostname** → add: subdomain `tracker`, domain `thelabrack.com`, type `HTTP`, URL `web:80` (internal Docker service name + port on the compose network).
4. *(Recommended)* Put **Cloudflare Access** in front: Zero Trust → Access → Applications → add a **Self-hosted** application for the hostname, with an **Email**-type Allow policy for your own address. Google means anyone reaching the app first hits a Cloudflare one-time-code login wall before your app's own login.

### Nginx Proxy Manager (or bring-your-own reverse proxy)

If you run Nginx Proxy Manager on a host on your LAN:

1. Add a Proxy Host: domain `tracker.thelabrack.com`, scheme `http`, forward to the Wayfinder host's IP on port `8090`.
2. Enable **Websockets Support**; mark **Publicly Accessible** (optional);leave **Cache Assets** disabled (so updates aren't stale-served).
3. Set `CORS_ORIGIN=https://tracker.thelabrack.com` in `.env` and `FORCE_SECURE_COOKIE=true` (already the default in production unless set to `"false"`);`docker compose up -d`.



Whatever reverse-proxy topology you use, keep **HTTPS** at public edge (Cloudflare,or Let's Encrypt via NPM),and let Wayfinder serve the app over plain HTTP behind it — the service worker and secure-cookie semantics stay consistentaut.



### Environment variables

See `.env.example` for every variable with descriptions. Key ones:

- **Auth:** `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` (bcrypt) / `AUTH_PASSWORD` (plaintext fallback for dev only), `JWT_SECRET`.
- **Security:** `CORS_ORIGIN` (comma-separated allowed origins), `FORCE_SECURE_COOKIE` (defaults true in production; set `"false"` to serve over plain HTTP behind a LAN proxy).
- **Mileage:** `MILEAGE_PROVIDER` (openrouteservice | google | mapquest), plus the matching `*_API_KEY`.
- **Exposure:** `CLOUDFLARE_TUNNEL_TOKEN` (starts the optional cloudflared service when set).

### Persistent storage & backups

The SQLite database lives in the `field-tracker-data` named Docker volume (mounted at `/app/data/field-tracker.db`). To back it up:

```bash
docker run --rm -v field-tracker_field-tracker-data:/data -v "$PWD":/backup \
  alpine tar czf /backup/field-tracker-backup-$(date +%F).tar.gz -C /data .
```

Restore by extracting that tarball back into the volume, then `docker compose restart api`.(Recommended: run the backup nightly via cron.)

### Database migrations

```bash
# Inside the api container (or locally against apps/api)
npx prisma migrate deploy    # applies pending migrations — auto-run on container start
npx prisma migrate dev       # create a new migration during development
```

### Seeding data

The starting locations are seeded idempotently by name via:

```bash
cd apps/api && npm run seed
```

Re-running is safe — locations that already exist are skipped.



## How Mileage Calculation Works

Mileage is calculated **address-to-address**, not via GPS. When you start a new visit and there was a previous, already-ended visit at a *different* location, Wayfinder automatically:

1. Looks up stored addresses for both locations.
2. Calls the configured routing provider (`MILEAGE_PROVIDER`) to get driving distance.

3. Saves a `Mileage` record: from-location → to-location, distance in miles.



If no provider API key is configured, or the call fails,visit creation is **not** blocked — the app records `distanceMiles: 0` and `estimated: true` so you can correct numbers manually later without losing the visit data.



## How Offline Mode & Syncing Works

Wayfinder is an installable PWA with a **custom service worker** (public/sw.js) tuned for hosted-host authentication flows (e.g. Cloudflare Access/Cloudflare login):

- **Navigation + API** use **NetworkFirst** — always try thenetwork,fall back to cache only when genuinely offline/So login/auth pages are never served stale from cache.
- **Static assets** (JS/CSS/fonts/images) use CacheFirst/StaleWhileRevalidate style caching for fast repeat loads.
- The SW **never precaches the app shell** — the HTML entry always hits the network first,so you don't get trapped in a stale-auth loop after a deploy.
- On startup,the app **unregisters any stale service workers** and re-registers the current one,so updates propagate without manual cache clears..</cuts>

For data writes (starting a visit, adding a ticket, ending a visit), if the network request fails:

1. The action is queued in IndexedDB instead of being lost.
2. The UI reflects the change locally immediately, so you can keep working (e.g. the visit shows as "pending" live).
3. When the browser reports online (or every 30s while the app is open),the queue is flushed **in order** to the server. Each queued action carries a client-generated `clientId`,so retries are safe and never duplicate visits..
4. A banner at the top shows "You're offline" or "Syncing N pending items…" with a **Details** toggle listing the queued actions (type, location, queued time). So you always know what's pending..

**Known MVP limitation:** this is a reliable *offline queue*,not full background sync — the queue only flushes while the app is open (on load,on the `online` event,and every 30s). True background sync even with the app closed is on the roadmap.



## Roadmap

- GPS "did you mean to start a visit here?" nudges (still no required GPS tracking).
- Multi-technician support (requires moving from single-user auth to a real user table).
- Push notifications (e.g. "Active visit running 3+ hours — did you forget to end it?").
- ServiceNow/Workday direct API integration (beyond CSV export).