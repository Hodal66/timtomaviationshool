# TAS-One quality assurance: executive report

Date 2026-11-12. Tester: Claude (automated QA). Environment: dedicated local copy with its own database. **Production was not tested.**

## Recommendation: NOT READY
The tested journeys work and several serious problems were found and fixed during the campaign, but open High defects and unimplemented Must requirements remain (details in 08-release-decision.md).

## Numbers
- Browser tests (Playwright, Chromium): 124 PASS, 1 FAIL (duplicate page titles, DEF-012), 3 NOT IMPLEMENTED (each confirms a missing feature and has a defect), 1 NOT APPLICABLE (seat display, removed by product-owner decision).
- Unit and integration tests (Vitest): 93 of 93 pass. Coverage of the business-logic modules: statements 99.18%, branches 90.42%, functions 86.66%.
- Defects: 21 logged, 12 fixed and retested, 9 open (1 High).
- Items that could not be tested here: 12 (Firefox/Safari, real devices and networks, ZAP, 2,000-user capacity, usability sessions, production, real WhatsApp/Gmail delivery).

## Most important findings
1. **Applicant data was visible to every signed-in role** (DEF-002, High). Fixed and retested.
2. **Parallel duplicate submissions created several applications** (DEF-001, High). Fixed and retested.
3. **Course pages could handle only about 100 requests per second and timed out under 250 simultaneous visitors** (DEF-011, High). Fixed: about 950 requests per second, no errors up to 500 connections locally.
4. Missing security headers, no sign-in lockout or API throttling, accessibility contrast and alt-text problems, a stale sitemap and a layout shift on the apply page were found and fixed.
5. **Added and tested in the second phase:** email verification with a 6-digit code before applying; an applicant dashboard (progress, documents upload and download, invoices, activity, profile); a new gradient dashboard shell with light and dark themes; data tables with search, filters, sorting, column choice, pagination, CSV export and bulk actions; staff account management; live refresh; four languages (English, Kinyarwanda, Kiswahili, French).
6. **Still open:** no privacy notice or consent wording (High); translations need native-speaker review (Medium), mobile loading speed slightly above the 2.5 s target in the lab, duplicate programme names in the catalogue, missing catalogue filters, no news/events in the CMS.

## Honest limits of this report
Lab results from one sandbox machine are indicative only. Cross-browser, real-device, real-network, real-user, full penetration and legal-compliance questions are outside what was demonstrated. All numbers in these reports are generated from stored results by `qa/tools/build_reports.py`.

## Where to look
00-discovery-report, 02-test-register (.csv is the full register), 03-rtm, 04-performance-report, 05-security-report, 06-accessibility-report, 07-defect-backlog, 08-release-decision. Raw evidence: `qa/evidence`, `qa/perf`, `qa/reports/e2e-results.json`.
