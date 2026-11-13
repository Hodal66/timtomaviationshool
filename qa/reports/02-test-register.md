# Detailed test register

Date 2026-11-12. Full register with all 15 required fields: `02-test-register.csv` (235 rows).

Status counts (all rows): BLOCKED 12, FAIL 1, NOT APPLICABLE 1, NOT IMPLEMENTED 4, PASS 217

| Test ID | Category | Req | Status | Defect | Objective |
|---|---|---|---|---|---|
| FT-001 | Functional - public site | WEB-01 | PASS |  | FT-001 Homepage loads with every primary section and no errors |
| FT-002 | Functional - public site | WEB-01 | PASS |  | FT-002 Every navigation item reaches its page; back/forward work; header is sticky |
| FT-003 | Functional - public site | WEB-01 | PASS |  | FT-003 Hero buttons lead to the catalogue and the application |
| FT-005 | Functional - public site | WEB-01 | PASS |  | FT-005 Homepage content matches approved records and makes no unverifiable claims |
| FT-004 | Functional - public site | WEB-01 | PASS |  | FT-004 Mobile menu opens, closes with Escape, navigates and survives scrolling |
| FT-013 | Functional - public site | SYS (routing) | PASS |  | FT-013 Course URLs are stable: direct, refreshed, new tab; unknown identifiers give 404 |
| FT-014 | Functional - public site | WEB-01 | PASS |  | FT-014 Each course shows its own content; nothing is shared between programmes |
| FT-015 | Functional - public site | WEB-01 | PASS |  | FT-015 Apply Now carries the programme into the wizard from every course button |
| FT-016 | Functional - public site | WEB-01 | PASS |  | FT-016 Related programme links open the correct programmes |
| NFT-09a | SEO (NFT-09) | NFT-09, WEB-01 | FAIL | DEF-012 | NFT-09a Initial HTML (no JavaScript) carries real content, unique titles and descriptions |
| NFT-09b | SEO (NFT-09) | NFT-09, WEB-01 | PASS |  | NFT-09b Home, sitemap and robots |
| NFT-09c | SEO (NFT-09) | NFT-09, WEB-01 | PASS |  | NFT-09c Private and unpublished pages are not indexable and absent from the sitemap |
| NFT-09d | SEO (NFT-09) | NFT-09, WEB-01 | PASS |  | NFT-09d Internal links on the main pages are not broken |
| NFT-09e | SEO (NFT-09) | NFT-09, WEB-01 | PASS | DEF-006 | NFT-09e Social previews: image, title and description present on the home and a course pag |
| FT-006 | Functional - catalogue | WEB-01 | PASS |  | FT-006 Catalogue shows exactly the published programmes from the database |
| FT-008a | Functional - catalogue | CMS-02 | PASS |  | FT-008a Category filters return exactly the matching programmes |
| FT-008b | Functional - catalogue | CMS-02 | PASS |  | FT-008b A category with no approved programme is not offered as a filter |
| FT-008c | Functional - catalogue | CMS-02 | NOT IMPLEMENTED | DEF-018 | FT-008c Filters by delivery mode, duration, branch and intake (SRS 14.1) |
| FT-009 | Functional - catalogue | CMS-02 | PASS |  | FT-009 Search: full name, part of a name, no match, upper and lower case, special characte |
| FT-010 | Functional - catalogue | CMS-02 | PASS |  | FT-010 Programme details on the page equal the database record |
| FT-011 | Functional - catalogue | CMS-02, WEB-05 | PASS |  | FT-011 Every published programme has a loading, relevant, correctly sized image |
| FT-011b | Functional - catalogue | CMS-02, WEB-05 | PASS | DEF-005 | FT-011b Course hero images have alternative text |
| FT-011c | Functional - catalogue | CMS-02, WEB-05 | PASS |  | FT-011c Images are relevant: no single photograph is reused for more than a few unrelated  |
| FT-012 | Functional - catalogue | CMS-02, WEB-05 | NOT APPLICABLE |  | FT-012 Seats and intake changes shown on the website (CMS-02, WEB-05) |
| NFT-10a | Functional - catalogue | NFT-10 | PASS |  | NFT-10a Catalogue interactions respond without delay |
| FT-017 | Functional - application journey | ADM-02 | PASS |  | FT-017 One central application route works without extra navigation |
| FT-018 | Functional - application journey | ADM-02 | PASS |  | FT-018 Manual selection and Apply Now from a course use the same wizard and the same progr |
| FT-019 | Functional - application journey | ADM-02 | PASS |  | FT-019 Validation: empty form, invalid email, invalid phone, missing fields, invalid dates |
| FT-020 | Functional - application journey | ADM-02, ADM-03, ADM-04 | PASS |  | FT-020 Valid application through the UI creates exactly one correct record (with FT-022, F |
| FT-021a | Functional - application journey | ADM-02 | PASS |  | FT-021a Rapid repeated clicks on Submit create only one application |
| FT-021b | Functional - application journey | ADM-02 | PASS | DEF-001 | FT-021b Retrying the same submission token and double POSTs create only one application |
| FT-023 | Functional - application journey | ADM-03 | PASS |  | FT-023 Document upload: oversized, unsupported, corrupted, empty and disguised files are r |
| FT-025b | Functional - application journey | ADM-04 | PASS |  | FT-025b Confirmation survives a refresh and the reference works for tracking |
| FT-026 | Functional - application journey | ADM-05 | PASS |  | FT-026 The application appears in the admissions dashboard with programme, applicant, inta |
| FT-027 | Functional - application journey | ADM-04, NTF-* | PASS |  | FT-027 Staff status changes reach the applicant, with email and WhatsApp messages |
| FT-028 | Functional - application journey | ADM-04 | PASS |  | FT-028 Applicants cannot reach other applicants' records |
| ST-01 | Functional - staff and dashboards | SYS (authentication) | PASS |  | ST-01 Sign in: wrong password and unknown user are refused with the same message; correct  |
| ST-02 | Functional - staff and dashboards | ADM-05, REP-* | PASS |  | ST-02 Dashboard queue counts equal the database |
| ST-03 | Functional - staff and dashboards | FIN-01 | PASS |  | ST-03 Finance cycle: raise invoice, verify payment, status and applicant view and messages |
| ST-04 | Functional - staff and dashboards | ADM-05 | PASS |  | ST-04 Stage rules cannot be bypassed from the board |
| ST-05 | Functional - staff and dashboards | ADM-01 | PASS |  | ST-05 Enquiries: website question reaches staff, is actionable and updates the dashboard |
| ST-06 | Functional - staff and dashboards | ADM-04, NTF-* | PASS |  | ST-06 WhatsApp queue: links are correct, sending marks done |
| ST-07 | Functional - staff and dashboards | ADM-04, NTF-* | PASS |  | ST-07 Email: sent from the school address with reference and tracking link; staff inbox al |
| ST-08 | Functional - staff and dashboards | REP-* | PASS |  | ST-08 Executive dashboard and CSV export reflect submitted applications and campaigns |
| FT-029 | Functional - course lifecycle / CMS | CMS-02 | PASS |  | FT-029 Administrator creates a draft programme; a valid central record exists and is not p |
| FT-031 | Functional - course lifecycle / CMS | CMS-01, CMS-02 | PASS |  | FT-031 Approval workflow: draft, submitted and approved are not public; only publishing ex |
| FT-007 | Functional - course lifecycle / CMS | CMS-02 | PASS | DEF-007 | FT-007 Publication controls public visibility: the published programme appears in the cata |
| FT-033 | Functional - course lifecycle / CMS | CMS-02 | PASS |  | FT-033 Fee changes made through the dashboard appear on the website (one source of truth) |
| FT-030 | Functional - course lifecycle / CMS | CMS-02 | PASS |  | FT-030 Description and image edits appear on the public page and in the catalogue |
| FT-034 | Functional - course lifecycle / CMS | CMS-02 | PASS |  | FT-034 Intake dates are one calculated source shared by the course page and the wizard |
| FT-035 | Functional - course lifecycle / CMS | CMS-03, ADM-01 | PASS |  | FT-035 Campaign landing: UTM parameters are retained through a multi-page visit into the l |
| FT-036 | Functional - course lifecycle / CMS | CMS-01 | NOT IMPLEMENTED | DEF-019 | FT-036 News, events and gallery managed in the CMS (CMS-01) |
| FT-032 | Functional - course lifecycle / CMS | CMS-02 | PASS |  | FT-032 Archiving removes public availability but keeps applicants and old references worki |
| E2E-01 | Functional - course lifecycle / CMS | CMS-02, ADM-02..05, FIN-01 (14-step scenario) | PASS |  | E2E-01 Complete business scenario, steps 1 to 14, with recorded evidence |
| SEC-01 | Security (NFT-07) | SYS (security), ASVS L2 | PASS |  | SEC-01 Every staff page and staff API refuses an unauthenticated visitor |
| SEC-02 | Security (NFT-07) | SYS (security), ASVS L2 | PASS |  | SEC-02 Forged, tampered, unsigned and expired session cookies are rejected |
| SEC-03 | Security (NFT-07) | SYS (security), ASVS L2 | PASS |  | SEC-03 Session cookie flags and logout |
| SEC-04 | Security (NFT-07) | SYS (security), ASVS L2 | PASS | DEF-002 | SEC-04 Role-based access: non-authorised roles cannot read protected data or act |
| SEC-05 | Security (NFT-07) | SYS (security), ASVS L2 | PASS |  | SEC-05 Applicant documents and assets: IDs are unguessable and staff-only; tracking needs  |
| SEC-06 | Security (NFT-07) | SYS (security), ASVS L2 | PASS |  | SEC-06 Injection: SQLi and XSS payloads in forms are stored inert and never executed |
| SEC-07 | Security (NFT-07) | SYS (security), ASVS L2 | PASS |  | SEC-07 Uploads cannot be attached to someone else's application or draft; stored files are |
| SEC-08 | Security (NFT-07) | SYS (security), ASVS L2 | PASS | DEF-003 | SEC-08 Security headers on public and staff pages |
| SEC-09 | Security (NFT-07) | SYS (security), ASVS L2 | PASS | DEF-004 | SEC-09 Rate limiting: repeated wrong passwords are locked out, and bulk API calls return 4 |
| SEC-10 | Security (NFT-07) | SYS (security), ASVS L2 | PASS |  | SEC-10 Errors do not leak internals |
| A11Y-desktop-root | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop / |
| A11Y-desktop-courses | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /courses |
| A11Y-desktop-how-to-apply | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /how-to-apply |
| A11Y-desktop-apply?course=personnel-licensing | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /apply?course=personnel-licensing |
| A11Y-desktop-contact | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /contact |
| A11Y-desktop-about | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /about |
| A11Y-desktop-track | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /track |
| A11Y-desktop-verify | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /verify |
| A11Y-desktop-login | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe desktop /login |
| A11Y-mobile-root | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile / |
| A11Y-mobile-courses | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /courses |
| A11Y-mobile-how-to-apply | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /how-to-apply |
| A11Y-mobile-apply?course=personnel-licensing | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /apply?course=personnel-licensing |
| A11Y-mobile-contact | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /contact |
| A11Y-mobile-about | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /about |
| A11Y-mobile-track | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /track |
| A11Y-mobile-verify | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /verify |
| A11Y-mobile-login | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y axe mobile /login |
| A11Y-staff-dashboard-pages-axe-de | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y staff dashboard pages (axe, desktop) |
| A11Y-keyboard-skip-link-or-logical | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y keyboard: skip link or logical tab order reaches nav, main content and the form; focu |
| A11Y-reduced-motion-animations-are | Accessibility (NFT-05) | WCAG 2.2 AA | PASS |  | A11Y reduced motion: animations are suppressed |
| RESP-360px-/ | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 360px /: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-360px-/courses | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 360px /courses: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-360px-/apply?course=personnel-licensing | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 360px /apply?course=personnel-licensing: no horizontal scroll, content visible, tap t |
| RESP-390px-/ | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 390px /: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-390px-/courses | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 390px /courses: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-390px-/apply?course=personnel-licensing | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 390px /apply?course=personnel-licensing: no horizontal scroll, content visible, tap t |
| RESP-430px-/ | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 430px /: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-430px-/courses | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 430px /courses: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-430px-/apply?course=personnel-licensing | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 430px /apply?course=personnel-licensing: no horizontal scroll, content visible, tap t |
| RESP-768px-/ | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 768px /: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-768px-/courses | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 768px /courses: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-768px-/apply?course=personnel-licensing | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 768px /apply?course=personnel-licensing: no horizontal scroll, content visible, tap t |
| RESP-1024px-/ | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1024px /: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-1024px-/courses | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1024px /courses: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-1024px-/apply?course=personnel-licensing | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1024px /apply?course=personnel-licensing: no horizontal scroll, content visible, tap  |
| RESP-1366px-/ | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1366px /: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-1366px-/courses | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1366px /courses: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-1366px-/apply?course=personnel-licensing | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1366px /apply?course=personnel-licensing: no horizontal scroll, content visible, tap  |
| RESP-1920px-/ | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1920px /: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-1920px-/courses | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1920px /courses: no horizontal scroll, content visible, tap targets >= 24px |
| RESP-1920px-/apply?course=personnel-licensing | Responsive (NFT-04) | NFT-04 | PASS |  | RESP 1920px /apply?course=personnel-licensing: no horizontal scroll, content visible, tap  |
| NFT-06a | Low bandwidth / misc | NFT-06 | PASS |  | NFT-06a Home and course pages render usable content on emulated Slow 3G |
| NFT-06b | Low bandwidth / misc | NFT-06 | PASS |  | NFT-06b Going offline during the application: the form keeps the typed data and reports th |
| NFT-06c | Low bandwidth / misc | NFT-06 | PASS |  | NFT-06c Page weight budget: home <= 500 KB transferred, course page <= 400 KB (images lazy |
| ML-01 | Low bandwidth / misc | Multilingual EN/FR/RW/SW | PASS | DEF-016 | ML-01 Multilingual EN/FR/RW (SRS: language selector) |
| PRV-01 | Low bandwidth / misc | NFT-08, Law 058/2021 | NOT IMPLEMENTED | DEF-017 | PRV-01 Privacy notice, cookie/consent notice and data-protection contact (Law 058/2021) ar |
| NFT-10 | Low bandwidth / misc | NFT-10 | PASS |  | NFT-10 Animation: every auto-moving element can be paused or respects reduced motion; no c |
| OTP-01 | Email verification and applicant dashboard | ADM-02, ADM-04 | PASS |  | OTP-01 Applying requires a verified email: /apply redirects to /start, the code arrives by |
| OTP-02 | Email verification and applicant dashboard | ADM-02, ADM-04 | PASS |  | OTP-02 Magic link from the email pre-fills the code; open redirects are refused |
| OTP-03 | Email verification and applicant dashboard | ADM-02, ADM-04 | PASS |  | OTP-03 Abuse controls: wrong codes lock after 5 tries, sending is rate limited per email,  |
| DASH-01 | Email verification and applicant dashboard | ADM-04, ADM-05 | PASS |  | DASH-01 Applicant dashboard shows the whole process: progress, documents (upload and downl |
| DASH-02 | Email verification and applicant dashboard | ADM-04, ADM-05 | PASS |  | DASH-02 Status changes made by staff show on the applicant's dashboard |
| I18N-fr | Languages, themes, tables and dashboards | Multilingual EN/FR/RW/SW | PASS |  | I18N-fr The whole public site follows the chosen language (fr) |
| I18N-rw | Languages, themes, tables and dashboards | Multilingual EN/FR/RW/SW | PASS |  | I18N-rw The whole public site follows the chosen language (rw) |
| I18N-sw | Languages, themes, tables and dashboards | Multilingual EN/FR/RW/SW | PASS |  | I18N-sw The whole public site follows the chosen language (sw) |
| I18N-en | Languages, themes, tables and dashboards | Multilingual EN/FR/RW/SW | PASS |  | I18N-en The whole public site follows the chosen language (en) |
| I18N-switch | Languages, themes, tables and dashboards | Multilingual EN/FR/RW/SW | PASS |  | I18N-switch The language menu changes the language, remembers it, and does not break the a |
| THEME-01 | Languages, themes, tables and dashboards | UX (dashboards) | PASS |  | THEME-01 Light, dark and automatic themes apply to the public site and dashboards, and per |
| DT-01 | Languages, themes, tables and dashboards | UX (dashboards) | PASS |  | DT-01 Data table: search, filter, sort, hide columns, pagination, page size and CSV downlo |
| DT-02 | Languages, themes, tables and dashboards | UX (dashboards) | PASS |  | DT-02 Bulk action: stage rules still apply to a whole selection, with clear feedback |
| SHELL-01 | Languages, themes, tables and dashboards | UX (dashboards) | PASS |  | SHELL-01 Staff navigation shows only the modules a role may use; the menu collapses and su |
| SHELL-02 | Languages, themes, tables and dashboards | UX (dashboards) | PASS |  | SHELL-02 Mobile: the menu is a drawer that opens, closes with Escape and the page does not |
| USERS-01 | Languages, themes, tables and dashboards | SYS (user administration) | PASS |  | USERS-01 Administrator adds, re-roles, resets and deletes a staff account; others cannot s |
| LIVE-01 | Languages, themes, tables and dashboards | UX (dashboards) | PASS |  | LIVE-01 The staff dashboard refreshes by itself: a new application appears without reloadi |
| NFT-03 | Not executable here |  | BLOCKED |  | Cross-browser: Firefox and Safari/WebKit |
| NFT-03b | Not executable here |  | BLOCKED |  | Real mobile devices (iOS Safari, Android Chrome) |
| NFT-01b | Not executable here |  | BLOCKED |  | Performance on a real Rwandan mobile network |
| NFT-01c | Not executable here |  | BLOCKED |  | Interaction to Next Paint (INP) field measurement |
| NFT-02b | Not executable here |  | BLOCKED |  | Load at 2,000 concurrent users per tenant (SRS target) |
| NFT-02c | Not executable here |  | BLOCKED |  | Load tests with k6 / distributed load |
| NFT-07b | Not executable here |  | BLOCKED |  | Authenticated dynamic scan (OWASP ZAP) and penetration test |
| NFT-07c | Not executable here |  | BLOCKED |  | Secure cookie flag and TLS configuration on production |
| USAB-01 | Not executable here |  | BLOCKED |  | Usability testing with real applicants and staff |
| INT-01 | Not executable here |  | BLOCKED |  | Real WhatsApp delivery and real Gmail delivery |
| INT-02 | Not executable here |  | NOT IMPLEMENTED |  | Real payment gateway (MTN MoMo / Airtel / bank) |
| PROD-01 | Not executable here |  | BLOCKED |  | Testing of the deployed production site |
| CI-01 | Not executable here |  | BLOCKED |  | CI workflow (GitHub Actions) execution |

Plus 93 unit/integration tests (rows UT-001 onward in the CSV), all PASS unless listed above.
