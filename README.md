# TAS-One — Timtom Aviation School

Next.js 15 + Prisma + Neon Postgres, deployed on Vercel. One database serves the public website, the admin console and the applicant tracking page.

## Public website (`src/app/(site)`)
Home, About, Courses (catalogue with search and filters), course pages, Admissions (`/how-to-apply`), Contact, the application wizard (`/apply`) and application tracking (`/track`).
Styles live in `src/app/site.css` (tokens at the top). Staff screens use `src/app/globals.css`.

## How content reaches the site
Admin > Courses (draft, review, approve, publish) writes the `Programme` records. Only `PUBLISHED` rows are read by the public pages (`src/lib/catalogue-data.ts`). Publishing, unpublishing and seat changes call `revalidatePath`, so the public pages update immediately.

## Course images
1. Upload one in Admin > Courses > the course (stored in the database, served from `/api/assets/…`), or set a path under `/images`.
2. Otherwise `src/lib/images.ts` maps a subject area to a photo, if one is configured.
3. Otherwise the page shows aviation artwork. Add licensed photos in `public/images/areas` and list them in `images.ts`; no component changes are needed.

## Applications and the staff journey
Every published course is open for registration all year. There are no seats, deadlines or intake set-up to maintain.
1. `/apply` asks for programme, branch, schedule and preferred start (the next four quarterly intakes are calculated in `src/lib/intakes.ts`), then details, education and documents. Progress autosaves; uploads are stored in Postgres and are never public.
2. `src/lib/application.ts` creates the application in one place: applicant, document checklist, optional registration invoice, lead and campaign attribution.
3. Staff see it at once: **Today** (`/dashboard`) shows the queues, **Admissions** has the board, documents, notes, placement (branch, schedule, intake) and invoice controls, **Payments** lets Finance verify money, **Enquiries** lists website questions.
4. Applicants follow all of it on `/track`: placement, next step, documents, invoice and a progress timeline (internal notes stay private).

## Notifications
Every status change, document request, invoice, payment, placement change and rejection creates a message for the applicant (`src/lib/notify.ts`). Email goes out automatically from `timtomaviationschool@gmail.com` once `SMTP_PASS` is set; new applications and enquiries also alert that inbox. WhatsApp messages wait in **Messages** (`/messages`) with a one-click "Open WhatsApp" link, so staff send them from the school's number (+250 788 519 634). Failures never block admissions work and are visible in the message log.

## Environment variables
Provided by the Neon integration: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
Set in Vercel: `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (creates the first admin on the next deploy).
Email: `SMTP_PASS` (a Gmail app password for the sender account). Optional: `SMTP_USER`, `EMAIL_FROM_ADDRESS`, `STAFF_ALERT_EMAIL`, `NEXT_PUBLIC_CONTACT_EMAIL`.
Optional: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_LINKEDIN_URL`, `NEXT_PUBLIC_X_URL`, `NEXT_PUBLIC_YOUTUBE_URL`. Social links appear in the footer only when set.

The build runs `prisma migrate deploy` and `prisma db seed` before `next build`.
Data residency: Vercel and Neon are outside Rwanda. Use sample data until production hosting is decided (SRS section 6).
