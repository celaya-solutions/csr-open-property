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
- With the app running: `pnpm smoke`
- `pnpm db:export -- exports/my-backup.db`

## Railway backend

Create one service from this repository. Add a volume mounted at `/app/data`. Set:

- `DB_PATH=/app/data/app.db`
- `UPLOAD_PATH=/app/data/uploads`
- `APP_PASSWORD` to a classroom-safe password
- `SESSION_SECRET` to a new long random value

The app creates its schema at startup because the Railway volume is not present during builds.

## Vercel frontend

Copy `vercel.example.json` to `vercel.json`. Replace `YOUR-RAILWAY-DOMAIN` with the Railway service domain. Import the repository into Vercel and deploy. Browser calls to `/api/*` stay on the Vercel origin and are rewritten to Railway.

## Safety and current limits

Use fake data only. Never enter customer, tenant, patient, payment, health, or private contact data.

Hosting offers change. As recorded on September 1, 2026, Vercel Hobby documents 200 projects and 50 domains per project. Railway documents a no-card $5 trial for up to 30 days, then $1 monthly free credit; trial volumes may later be removed. Check the linked course lesson before deployment.

Custom domains are optional. Connect a Namecheap domain to Vercel; Vercel continues routing `/api` to Railway.

## Celaya Solutions

- Research Course Edition
- hello@celayasolutions.com
- https://www.celayasolutions.com
- (915) 755-5705

Forks and modifications are welcome for noncommercial use. Keep the Celaya Solutions Research Course Edition branding and follow `LICENSE`.
