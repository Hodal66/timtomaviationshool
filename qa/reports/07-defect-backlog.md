# Defect backlog

Date 2026-11-12. 19 defects: 11 fixed and retested, 8 open.

## Critical (0)

None found.

## High (5)

### DEF-001 Simultaneous double submission creates several applications for one person
- **Status:** FIXED - verified
- **Found by:** FT-021b
- **Root cause:** The duplicate check ran outside the transaction, so parallel requests all passed it.
- **Fix / acceptance criteria:** Transaction-scoped advisory lock on email and phone, duplicate re-checked inside the lock. Accept: 3 parallel submissions with the same contact produce exactly 1 record (FT-021b, integration test).

### DEF-002 Broken access control: any signed-in role could read applicant lists, invoices and certificates
- **Status:** FIXED - verified
- **Found by:** SEC-04
- **Root cause:** The middleware only checks that a valid session exists; the pages never checked the role for viewing (only for actions).
- **Fix / acceptance criteria:** Least-privilege view checks (canViewApplicants, reports). Accept: lecturer, marketing and academic roles are redirected from /admissions, /payments and /certificates (SEC-04).

### DEF-011 Course pages not cached: ~100 requests/s and timeouts from 250 concurrent connections
- **Status:** FIXED - verified
- **Found by:** NFT-02 load test
- **Root cause:** Dynamic route without generateStaticParams was rendered on every request (Cache-Control: no-store).
- **Fix / acceptance criteria:** generateStaticParams returning [] enables ISR. Re-run: ~950 req/s, 0 errors up to 500 connections.

### DEF-016 Multilingual EN/FR/RW not implemented
- **Status:** OPEN - NOT IMPLEMENTED
- **Found by:** ML-01
- **Root cause:** Not built; SRS requires three languages.
- **Fix / acceptance criteria:** Language selector, translated UI and content for FR and RW. Accept: ML-01 passes and key journeys pass in each language.

### DEF-017 No privacy notice, consent/cookie notice or data-protection contact
- **Status:** OPEN - NOT IMPLEMENTED
- **Found by:** PRV-01
- **Root cause:** Not built.
- **Fix / acceptance criteria:** Publish privacy policy and DPO contact, consent wording on the application form, retention rules. Legal adequacy for Law 058/2021 is for management and the DPO, not for automated tests.

## Medium (11)

### DEF-003 No HTTP security headers
- **Status:** FIXED - verified
- **Found by:** SEC-08
- **Root cause:** Never configured.
- **Fix / acceptance criteria:** CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy on all routes (SEC-08). Residual: see DEF-014.

### DEF-004 No brute-force protection on staff sign-in and no throttling of public APIs
- **Status:** FIXED with limitation (see DEF-015)
- **Found by:** SEC-09
- **Root cause:** Never implemented.
- **Fix / acceptance criteria:** Lockout after 10 failed sign-ins per account / 30 per address in 15 minutes; per-address limits on apply, upload, draft and tracking APIs. Accept: SEC-09.

### DEF-005 Course photographs have empty alternative text
- **Status:** FIXED - verified
- **Found by:** FT-011b
- **Root cause:** Decorative alt="" used for meaningful hero photos.
- **Fix / acceptance criteria:** alt = programme name (FT-011b).

### DEF-007 Sitemap stays stale for up to an hour after a course is published
- **Status:** FIXED - verified
- **Found by:** FT-007
- **Root cause:** Sitemap cached 3600 s and not revalidated by publish/unpublish.
- **Fix / acceptance criteria:** Revalidated on every course change, cache lowered to 300 s (FT-007).

### DEF-008 Colour contrast below 4.5:1 (muted text on light-blue, success pills)
- **Status:** FIXED - verified
- **Found by:** A11Y axe
- **Root cause:** Palette values too light.
- **Fix / acceptance criteria:** Darker --mute and --ok tokens; axe reports zero serious/critical issues on 9 public pages x 2 viewports and 6 staff pages.

### DEF-010 Layout shift on the apply page (CLS 0.39 mobile, 0.16 desktop; limit 0.1)
- **Status:** FIXED - verified
- **Found by:** Lighthouse
- **Root cause:** Loading placeholder shorter than the form, footer jumped.
- **Fix / acceptance criteria:** Reserve form height while loading. Lighthouse CLS 0.002 mobile.

### DEF-012 Duplicate programme names in the imported catalogue produce duplicate page titles
- **Status:** OPEN (content decision)
- **Found by:** NFT-09a
- **Root cause:** The imported source lists some programmes twice.
- **Fix / acceptance criteria:** School to merge or rename duplicates. Accept: NFT-09a passes (unique titles across all published courses).

### DEF-013 Mobile LCP above 2.5 s in the throttled lab run on home (2.9 s), course (2.9 s), apply (2.6 s) and catalogue (2.5 s) pages
- **Status:** OPEN
- **Found by:** NFT-01
- **Root cause:** Render-blocking Google Fonts stylesheet and hero imagery under simulated slow 4G; local server, no CDN. Preconnect hints added, not enough on their own.
- **Fix / acceptance criteria:** Self-host fonts (next/font) and size/prioritise the hero image. Accept: Lighthouse mobile LCP <= 2.5 s on these four pages, confirmed on the deployed site.

### DEF-015 Rate-limit counters live in server memory, so they are per instance
- **Status:** OPEN
- **Found by:** SEC-09 review
- **Root cause:** No shared store.
- **Fix / acceptance criteria:** Back the limiter with a shared store (Redis/Upstash or a database table). Accept: lockout holds across instances.

### DEF-018 Catalogue filters by delivery mode, duration, branch and intake do not exist (only area and search)
- **Status:** OPEN - NOT IMPLEMENTED
- **Found by:** FT-008c
- **Root cause:** Not built.
- **Fix / acceptance criteria:** Add the four filters. Accept: FT-008c passes.

### DEF-019 CMS manages programme content and the media gallery, but not news or events
- **Status:** OPEN - PARTLY IMPLEMENTED
- **Found by:** FT-036
- **Root cause:** News/events content types not built (gallery added with the Cloudinary media library, not yet covered by automated tests).
- **Fix / acceptance criteria:** Add news and events and test the media library end to end. Accept: FT-036 passes.

## Low (3)

### DEF-006 No default Open Graph or Twitter card metadata on the home page and site-wide
- **Status:** FIXED - verified
- **Found by:** NFT-09e
- **Root cause:** Metadata only set on course pages.
- **Fix / acceptance criteria:** Site-wide defaults in the root layout (NFT-09e).

### DEF-009 Footer links shorter than 24 px (WCAG 2.2 target size)
- **Status:** FIXED - verified
- **Found by:** RESP
- **Root cause:** Link rows 20 px tall.
- **Fix / acceptance criteria:** min-height 32 px (RESP, 21 combinations).

### DEF-014 CSP allows inline scripts ('unsafe-inline')
- **Status:** OPEN
- **Found by:** SEC-08 review
- **Root cause:** Next.js inline bootstrap scripts without a nonce.
- **Fix / acceptance criteria:** Move to nonce-based CSP in middleware. Accept: CSP without 'unsafe-inline' for script-src and all journeys still pass.

## Not defects, but tracked
- INT-02 Real payment gateway (MTN MoMo / Airtel / bank): **NOT IMPLEMENTED**. Payments are recorded and verified manually by Finance; no gateway integration exists (FIN-02, FIN-03).
