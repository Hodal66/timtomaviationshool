# Security report (NFT-07)

Date 2026-11-12. Scope: a selection of OWASP ASVS Level 2 areas, tested **actively but only against the dedicated local QA environment**. This is not a penetration test and no external scanner (ZAP) was available. Nothing was tested against production.

## Results

| Test | Area | Status | Initial finding / note |
|---|---|---|---|
| SEC-01 | Every staff page and staff API refuses an unauthenticated visitor | PASS |  |
| SEC-02 | Forged, tampered, unsigned and expired session cookies are rejected | PASS |  |
| SEC-03 | Session cookie flags and logout | PASS |  |
| SEC-04 | Role-based access: non-authorised roles cannot read protected data or act | PASS | Initially FAILED (DEF-002), fixed |
| SEC-05 | Applicant documents and assets: IDs are unguessable and staff-only; tracking needs reference AND contact | PASS |  |
| SEC-06 | Injection: SQLi and XSS payloads in forms are stored inert and never executed | PASS |  |
| SEC-07 | Uploads cannot be attached to someone else's application or draft; stored files are served inert | PASS |  |
| SEC-08 | Security headers on public and staff pages | PASS | Initially FAILED (DEF-003), fixed |
| SEC-09 | Rate limiting: repeated wrong passwords are locked out, and bulk API calls return 429 | PASS | Initially FAILED (DEF-004), fixed |
| SEC-10 | Errors do not leak internals | PASS |  |

## What was covered
- **Authentication and session (ASVS V2/V3):** unauthenticated access to 10 staff pages and the document/export APIs is refused; forged, `alg: none`, garbage and expired tokens are rejected; the session cookie is HttpOnly and SameSite=Lax; sign-out ends access; same error message for unknown user and wrong password (ST-01); lockout after repeated failures.
- **Access control (V4):** role matrix for lecturer, finance, marketing and academic roles on admissions, payments, certificates and course admin. Found and fixed DEF-002 (any signed-in role could read applicant data). Applicant documents are staff-only and identified by unguessable IDs; tracking requires reference plus contact.
- **Injection and XSS (V5):** SQL-injection and script payloads in application fields, search, slugs, tracking and sign-in are stored inert and never executed in the staff views; no server errors.
- **Uploads (V12):** oversized, empty, corrupted, disguised (wrong signature) and script files are refused (FT-023); uploads cannot be attached to another person's draft or application; file names are sanitised.
- **Configuration (V14):** security headers present on all routes; error responses do not leak stack traces or database details; `X-Powered-By` removed.

## Not covered / limitations
- Secure cookie flag and TLS settings: only verifiable on the HTTPS deployment (BLOCKED).
- Server-action forgery: staff actions were exercised through the UI; hand-crafted action POSTs for every action were not attempted. Every action contains its own role check (reviewed in code), but this was not exhaustively exercised.
- No MFA or password policy exists for staff accounts; not assessed against ASVS V2 requirements for MFA.
- CSP still allows inline scripts (DEF-014); rate limits are per instance (DEF-015).
- Dependency vulnerability scanning and secret scanning of the repository were not run.
- A Cloudinary API secret was shared in chat during this work and must be rotated.

## Privacy (NFT-08)
Automated tests cannot establish legal compliance with Law 058/2021. Findings for management and the DPO: there is no privacy notice, consent wording or data-protection contact on the site (DEF-017); applicants' identity documents and personal data are stored in the application database (uploads as database records), retention and deletion rules are not defined (drafts are purged after 30 days; submitted applications are not); email and phone are used for WhatsApp/email notifications without an opt-out choice.
