# Database setup on Vercel

## Recommendation
Use **Neon Postgres** via the Vercel Marketplace (Storage tab > Create Database > Neon).
It is real PostgreSQL, which is what SRS section 6 specifies, so nothing changes when
TAS-One later moves to Rwanda-hosted infrastructure.

| Need | Choice |
|---|---|
| Main database | Neon Postgres (Vercel Marketplace) |
| ORM / migrations | Prisma or Drizzle, migrations committed to git |
| Files (documents, certificates) | Vercel Blob for the prototype; S3-compatible storage in Rwanda for production |
| Cache / rate limits / sessions | Upstash Redis (Marketplace) |
| Auth | Auth.js for the prototype; Keycloak per SRS for production |

## Steps
1. Vercel dashboard > project > Storage > Create > Neon. Connect to Production, Preview and Development.
   Vercel injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (for migrations).
2. `vercel env pull .env.local` to get the variables locally.
3. `npm i prisma @prisma/client`, then `npx prisma init`. Use the pooled URL for the app and the unpooled URL as `directUrl`.
4. Model the core entities from SRS section 11: Student, Applicant, Programme, Intake, ClassGroup, Attendance, Grade, Certificate, Invoice, Payment, Branch.
5. Enable Neon branching so every Vercel Preview deployment gets its own database copy.
6. Run `prisma migrate deploy` in the build command (`prisma generate && prisma migrate deploy && next build`).

## Cautions
- The SRS requires personal data in Rwanda (Law 058/2021). Vercel and Neon regions are outside Rwanda, so use the prototype with sample data only. Plan the production move before real student records go in.
- Keep a branch_id column on every table to support Kigali, Nyamata and Goma without code changes.
- Store money as integer minor units with a currency column (RWF, USD, CDF).
