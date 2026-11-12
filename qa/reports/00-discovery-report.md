# Discovery report

Date 2026-11-12. Written before test execution and updated with what was found.

## What exists
Public site (home, about, catalogue with area filter and search, course pages with fees/FAQs/intake dates, how to apply, contact, track application, certificate verification, gallery), the 7-step application wizard with autosaved drafts and document upload, notifications (email via SMTP, WhatsApp queue via wa.me links), staff dashboards (admissions board and detail, payments verification, enquiries, messages, certificates, timetable, attendance, executive view, course lifecycle Draft > Submitted > Approved > Published > Archived), staff authentication with 7 roles, Cloudinary media library and gallery (added during this campaign).
Stack: Next.js 15 (App Router, server actions), React 19, Prisma 6 on PostgreSQL (Neon in production), Vercel hosting.

## What is incomplete or missing
- DEF-016 Multilingual EN/FR/RW not implemented
- DEF-017 No privacy notice, consent/cookie notice or data-protection contact
- DEF-018 Catalogue filters by delivery mode, duration, branch and intake do not exist (only area and search)
- DEF-019 CMS manages programme content and the media gallery, but not news or events
- Of the 201 SRS requirements, only those in admissions, finance verification, content, enquiries, notifications, timetable and attendance basics are built; see the traceability matrix section B for the rest (NOT TESTED).
- No payment gateway, no PDF admission letters, no student app, no LMS, HR or reports beyond the executive page.

## What cannot be tested in this environment
- NFT-03 Cross-browser: Firefox and Safari/WebKit: Only Chromium is installed in the test environment; Firefox and WebKit cannot be downloaded here.
- NFT-03b Real mobile devices (iOS Safari, Android Chrome): No physical devices. Chromium device emulation was used instead (NFT-04).
- NFT-01b Performance on a real Rwandan mobile network: No access to real networks. Emulated Slow 3G (400 kbps, 400 ms) was used (NFT-06a).
- NFT-01c Interaction to Next Paint (INP) field measurement: INP needs real-user data; lab Total Blocking Time (30-160 ms) is only a proxy.
- NFT-02b Load at 2,000 concurrent users per tenant (SRS target): Single sandbox machine shares CPU with the load generator; 1,000 connections already produces client timeouts. Not demonstrated.
- NFT-02c Load tests with k6 / distributed load: k6 not available; autocannon used.
- NFT-07b Authenticated dynamic scan (OWASP ZAP) and penetration test: ZAP not installed and no external network access to fetch it. A targeted manual/automated security suite was run instead.
- NFT-07c Secure cookie flag and TLS configuration on production: Local test runs over HTTP; verify the Secure flag and TLS on the HTTPS site.
- USAB-01 Usability testing with real applicants and staff: Requires real participants.
- INT-01 Real WhatsApp delivery and real Gmail delivery: Messages tested against a fake SMTP sink and wa.me links; no real notifications were sent, by design.
- PROD-01 Testing of the deployed production site: Deployment protection (SSO) is on and production data must not be touched; all tests ran on a dedicated local copy with its own database.
- CI-01 CI workflow (GitHub Actions) execution: Not executed in this environment; see qa/ci/qa.yml for the proposed workflow.

## Test environment
Local PostgreSQL 16 database `tas_qa` (a name guard refuses to run against anything else), production build served on localhost, fake SMTP server, Chromium via Playwright. All data created by tests is labelled QA. No production data was touched and no real notifications or payments were sent.
