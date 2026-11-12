# TAS-One — Timtom Aviation School Management Platform

Next.js 15 + Prisma + Neon Postgres, deployed on Vercel.

- `src/app` staff console: dashboard, admissions board, programmes, payments, certificates, public `/verify`.
- `prisma/schema.prisma` data model; `prisma/migrations` SQL; `prisma/seed.ts` idempotent seed.
- `public/prototype.html` the original clickable prototype (served at `/prototype.html`).
- `/api/health` checks the database connection.

## Environment variables (Vercel)
Provided by the Neon integration: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
Set by you: `AUTH_SECRET` (done), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (creates the first admin on the next deploy).

The build runs `prisma migrate deploy` and `prisma db seed` before `next build`.

## Local
```bash
vercel env pull .env.local   # needs the Vercel CLI
npm install
npm run dev
```
See [docs/database-setup.md](docs/database-setup.md).
