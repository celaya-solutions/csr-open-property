# OpenProperty: Research Course Edition

This is the Celaya Solutions Research Course Edition. It is a full-stack practice app with fake seed data.

## Local start

1. Install Node 22 and pnpm.
2. Copy `.env.example` to `.env` and choose an app password and a long random session secret.
3. Run `pnpm install`.
4. Run `pnpm dev`.
5. Open the Vite URL shown in the terminal.

The frontend runs through Vite. The Hono API uses `PORT`. SQLite uses `DB_PATH`; uploads use `UPLOAD_PATH`.

## Checks

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- With the app running: `pnpm smoke`
- `pnpm db:export -- exports/my-backup.db`

## Railway

Create one service from this repository. It serves both the API and the built
screen, so there is nothing else to deploy. Add a volume mounted at `/app/data`. Set:

- `DB_PATH=/app/data/app.db`
- `UPLOAD_PATH=/app/data/uploads`
- `APP_PASSWORD` to a classroom-safe password
- `SESSION_SECRET` to a new long random value

Railway runs `pnpm build` (which writes `dist/`) and then `pnpm start`. The app creates its schema at startup because the Railway volume is not present during builds.

Open the Railway service domain and the app is there. `/api/*` is the API; every other path is handed the built screen.

## Safety and current limits

Use fake data only. Never enter customer, tenant, patient, payment, health, or private contact data.

Hosting offers change. As recorded on September 1, 2026, Railway documents a no-card $5 trial for up to 30 days, then $1 monthly free credit; trial volumes may later be removed. Check the linked course lesson before deployment.

Custom domains are optional. Point a Namecheap domain at the Railway service.

## Celaya Solutions

- Research Course Edition
- hello@celayasolutions.com
- https://www.celayasolutions.com
- (915) 755-5705

See `UPSTREAM.md` and the preserved license before sharing.
