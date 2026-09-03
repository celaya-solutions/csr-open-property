> **Celaya Solutions Research Course Edition.** Read [COURSE_EDITION.md](COURSE_EDITION.md) before you start. Use fake data only.

# OpenProperty

Project 04 on the [Zero to Agent project shelf](https://zerotoagent.org/course/landing.html#projects). Core track. You fork this at Level 6 and it stays yours through Level 9.

Software for someone who rents out places to live. Buildings and the units inside them, the people renting them, the lease each person signed, the rent charged every month, what actually got paid, and the repairs waiting to be done.

## Why this one is on the shelf

It is the first project where the computer has to be right about money and dates. Rent is charged once per lease per month, and generating it twice by accident would be a real bug with a real cost. A payment lands against a charge and the charge changes state on its own. That rule lives in your code, not in a form somebody fills in, and getting it wrong is visible immediately.

Pick this one if you want a project where the hard part is the thinking, not the number of screens.

## What you have to change to pass

The same five things are asked of every project on the shelf:

1. A change you can see on the screen.
2. A change to the server or to what gets stored.
3. The frontend live on Vercel.
4. The backend running on Railway, still running tomorrow.
5. A three minute demo: the problem, the before, the after.

## Run it on your machine

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Open the address the terminal prints. Set `APP_PASSWORD` and `SESSION_SECRET` in `.env` first; the server refuses to serve without them. The database file is created on the first run, with three sample properties, five units, and three vendors so the screens are not blank.

Checks before you hand anything in:

```bash
pnpm build
pnpm typecheck
pnpm smoke          # with the app already running
pnpm db:export -- exports/my-backup.db
```

There is a `db:migrate` script left over from the source project that expects a different database tool. You do not need it. The schema is applied for you when the server starts.

## Where to look when you want to change something

| What you want to change | Where it lives |
| --- | --- |
| Any screen | `src/client/components/` |
| Which screen shows for which address | `src/client/hooks/use-router.ts` |
| How data loads and saves | `src/client/hooks/use-app-state.ts` |
| Dates, money, and color helpers | `src/client/lib/utils.ts` |
| What the API does | `src/server/index.ts` |
| What gets stored | `src/server/schema.sql` |
| The class password gate and how the server starts | `src/server/node.ts` |

## What it stores

A property holds units. A tenant is a person. A lease connects one or more tenants to a unit for a stretch of time at a monthly rent. Rent charges are generated per lease per month, and payments are recorded against those charges. Work orders can point at a property, a unit, and a vendor. Settings hold the rent rules: due day, late fee, grace days.

## Putting it online

The screen goes on Vercel. The server and the database go on Railway, on a volume, so the ledger is still there the next morning. Step by step in [COURSE_EDITION.md](COURSE_EDITION.md). Copy `vercel.example.json` to `vercel.json` and replace `YOUR-RAILWAY-DOMAIN` with your Railway address, or the live page will have no server to talk to.

## What it deliberately does not do

The source project drew a line and the course keeps it. There is no listing syndication, no real credit or background screening, no text message blasts, no card or bank payment processing, and no public portal for tenants or owners. Every one of those means handling somebody's real money or real private information, and this is a classroom app running on fake data. If you want to add one, talk to an instructor first.

## Built with

React 19 and TypeScript on Vite for the screen, with Tailwind and a vendored copy of shadcn/ui components. Hono on Node 22 for the API. SQLite for storage.

## Source and license

Imported from an open source property management project. The source project, the exact commit, and what was changed for the course are recorded in [UPSTREAM.md](UPSTREAM.md). The original MIT license and copyright notice are kept in [LICENSE](LICENSE) and stay with any copy you make. Package names still carry the source project's identifiers so the build keeps working.

This is a course edition, not a product. It is free and noncommercial, and the Celaya Solutions Research Course Edition notice stays on it.
