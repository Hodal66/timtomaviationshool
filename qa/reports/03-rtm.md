# Requirements traceability matrix

Date 2026-11-12. Source of requirement IDs: the SRS v2.0 requirement table (201 rows parsed) plus the website and non-functional IDs used in the QA master prompt (WEB-xx, FT-xxx, NFT-xx), which are not in the SRS table.

## A. Requirements that have tests

| Requirement | SRS title | Priority | Tests | Result |
|---|---|---|---|---|
| ADM-01 | Capture every enquiry (website, WhatsApp, Facebook, Instagram, | Must P1 | FT-035, ST-05 | PASS |
| ADM-02 | One online application wizard for all programmes, completable on a | Must P1 | E2E-01, FT-017, FT-018, FT-019, FT-020, FT-021a, FT-021b, OTP-01 ... | PASS |
| ADM-03 | Upload A2 certificate, transcripts, ID/passport and photos from the | Must P1 | FT-020, FT-023 | PASS |
| ADM-04 | Status tracker (Submitted → Documents verified → Registration paid → | Must P1 | DASH-01, DASH-02, FT-020, FT-025b, FT-027, FT-028, OTP-01, OTP-02 ... | PASS |
| ADM-05 | Admissions board (kanban) per branch with filters, bulk actions, notes | Must P1 | DASH-01, DASH-02, FT-026, ST-02, ST-04 | PASS |
| CMS-01 | Headless CMS: pages, news, events, gallery, FAQs editable by staff | Must P1 | FT-031, FT-036 | PARTIAL (some tests NOT IMPLEMENTED) |
| CMS-02 | Course pages generated from the catalogue with live fees, intakes and | Must P1 | E2E-01, FT-007, FT-008a, FT-008b, FT-008c, FT-009, FT-010, FT-011 ... | PARTIAL (some tests NOT IMPLEMENTED) |
| CMS-03 | Campaign landing pages with UTM tracking feeding ADM-01 | Must P1 | FT-035 | PASS |
| FIN-01 | Automatic invoices: registration fee (paid before classes start), trai | Must P1 | E2E-01, ST-03 | PASS |
| Law 058/2021 |  |   | PRV-01 | NOT IMPLEMENTED |
| Multilingual EN/FR/RW/SW |  |   | I18N-en, I18N-fr, I18N-rw, I18N-sw, I18N-switch, ML-01 | PASS |
| NFT-04 |  |   | RESP-1024px-/, RESP-1024px-/apply?course=personnel-licensing, RESP-1024px-/courses, RESP-1366px-/, RESP-1366px-/apply?course=personnel-licensing, RESP-1366px-/courses, RESP-1920px-/, RESP-1920px-/apply?course=personnel-licensing ... | PASS |
| NFT-06 |  |   | NFT-06a, NFT-06b, NFT-06c | PASS |
| NFT-08 |  |   | PRV-01 | NOT IMPLEMENTED |
| NFT-09 |  |   | NFT-09a, NFT-09b, NFT-09c, NFT-09d, NFT-09e | FAIL |
| NFT-10 |  |   | NFT-10, NFT-10a | PASS |
| NTF-* |  |   | FT-027, ST-06, ST-07 | PASS |
| REP-* |  |   | ST-02, ST-08 | PASS |
| WCAG 2.2 AA |  |   | A11Y-desktop-about, A11Y-desktop-apply?course=personnel-licensing, A11Y-desktop-contact, A11Y-desktop-courses, A11Y-desktop-how-to-apply, A11Y-desktop-login, A11Y-desktop-root, A11Y-desktop-track ... | PASS |
| WEB-01 |  |   | FT-001, FT-002, FT-003, FT-004, FT-005, FT-006, FT-014, FT-015 ... | FAIL |
| WEB-05 |  |   | FT-011, FT-011b, FT-011c, FT-012 | PASS |

## B. SRS requirements with no test in this campaign (171 of 201)

These are not claimed as passing. Most belong to modules that are not built yet (prototype scope covers admissions, finance verification, course lifecycle, enquiries, notifications, timetable and attendance basics). Status for every row: NOT TESTED / see discovery report for built vs not built.

| ID | Title | Priority | Status |
|---|---|---|---|
| ADM-06 | Configurable entry requirements per programme, checked | Must P1 | NOT TESTED |
| ADM-07 | Signed PDF admission letter with QR code, welcome pack and first- | Must P1 | NOT TESTED |
| ADM-08 | Referral codes for alumni and partners with tracked conversions | Must P2 | NOT TESTED |
| ADM-09 | Scholarships, discounts and sponsorship with approval workflow | Must P2 | NOT TESTED |
| ADM-10 | Applicants under 18 are detected from date of birth; a parent or | Must P1 | NOT TESTED |
| PRG-01 | Structured catalogue: name, type (IATA, ICAO, advanced certificate, | Must P1 | NOT TESTED |
| PRG-02 | Intake cycle: a new intake every 3 months (January, April, July, | Must P1 | NOT TESTED |
| PRG-03 | Sessions: weekday (Monday–Friday, three 2-hour sessions) and | Must P1 | NOT TESTED |
| PRG-04 | Catalogue changes publish automatically to website, app, brochures | Must P1 | NOT TESTED |
| PRG-05 | Learning outcomes per module mapped to assessments and IATA/ICAO | Must P2 | NOT TESTED |
| PRG-06 | Waitlists with automatic seat offers | Must P2 | NOT TESTED |
| TTB-01 | One-click enrolment into a class group (intake × programme × branch × | Must P1 | NOT TESTED |
| TTB-02 | Drag-and-drop timetable builder with clash detection for lecturer, room | Must P1 | NOT TESTED |
| TTB-03 | Personal timetables in apps with Google/Outlook/phone calendar sync | Must P1 | NOT TESTED |
| TTB-04 | Room, lab and equipment booking (Amadeus terminals, projectors) | Must P2 | NOT TESTED |
| TTB-05 | Automatic notices and make-up proposals for cancelled classes | Must P2 | NOT TESTED |
| ATT-01 | Attendance by rotating QR code, roll-call or online join log in under 30 | Must P1 | NOT TESTED |
| ATT-02 | Offline capture on the lecturer phone with later sync | Must P1 | NOT TESTED |
| ATT-03 | Alerts when attendance falls below a threshold (default 80%) | Must P1 | NOT TESTED |
| ATT-04 | Staff attendance and teaching-hour logs feeding payroll | Must P2 | NOT TESTED |
| LMS-01 | Course spaces with lessons, slides, videos, readings and | Must P1 | NOT TESTED |
| LMS-02 | Live online classes with recording and automatic attendance (detailed | Must P1 | NOT TESTED |
| LMS-03 | Practice quiz bank modelled on IATA/ICAO exam style | Must P2 | NOT TESTED |
| LMS-04 | Class forums and Q&A moderated by lecturers | Must P2 | NOT TESTED |
| LMS-05 | Practical-skills logbook signed off by lecturers | Must P2 | NOT TESTED |
| LMS-06 | AI study assistant answering only from approved course material, with | Must P3 | NOT TESTED |
| ASM-01 | Configurable grading schemes (continuous assessment, weekly Friday | Must P1 | NOT TESTED |
| ASM-02 | Grade entry with moderation and approval before publishing | Must P1 | NOT TESTED |
| ASM-03 | Results and transcripts visible in the app once approved | Must P1 | NOT TESTED |
| ASM-04 | IATA/ICAO exam tracking: registration, fees paid to IATA/ICAO, dates, | Must P1 | NOT TESTED |
| ASM-05 | Appeals and re-sit workflow | Must P2 | NOT TESTED |
| ASM-06 | Online proctored tests for remote and weekend students | Must P3 | NOT TESTED |
| CRT-01 | Generate local and advanced certificates from templates with unique | Must P1 | NOT TESTED |
| CRT-02 | Public verification page by QR scan or number | Must P1 | NOT TESTED |
| CRT-03 | Revocation and reissue with audit trail | Must P1 | NOT TESTED |
| CRT-04 | Record IATA/ICAO certificates received, clearly marked as issued by | Must P1 | NOT TESTED |
| CRT-05 | Digital credentials (Open Badges / W3C Verifiable Credentials) | Must P3 | NOT TESTED |
| FIN-02 | Pay in-app by MTN MoMo Pay, Airtel Money (direct merchant APIs), | Must P1 | NOT TESTED |
| FIN-03 | Automatic reconciliation of mobile-money and bank statements; | Must P1 | NOT TESTED |
| FIN-04 | Installment plans, reminders and live balance in the app | Must P1 | NOT TESTED |
| FIN-05 | Multi-currency (RWF, USD, CDF) with daily rates and branch cash | Must P1 | NOT TESTED |
| FIN-06 | RRA-compliant electronic receipts (EBM) | Must P2 | NOT TESTED |
| FIN-07 | Refunds, credits and sponsor/company billing with approvals | Must P2 | NOT TESTED |
| FIN-08 | Collections, debtor ageing and branch P&L reports; accounting export | Must P2 | NOT TESTED |
| FIN-09 | Fraud controls: duplicate or reused payment references flagged, | Must P1 | NOT TESTED |
| HRM-01 | Non-teaching staff profiles with qualifications, contract and branch | Must P2 | NOT TESTED |
| HRM-02 | Leave and availability calendar for all staff; lecturer teaching availability | Must P1 | NOT TESTED |
| HRM-03 | Contracts, leave, appraisals and training records | Must P2 | NOT TESTED |
| HRM-04 | Payroll preparation for salaried staff (lecturer payments follow LEC-17 | Must P2 | NOT TESTED |
| HRM-05 | Recruitment of non-teaching staff (lecturer recruitment is in 7.19) | Must P2 | NOT TESTED |
| BRN-01 | Branches as configuration — Kigali (main), Bugesera–Nyamata, Goma | Must P1 | NOT TESTED |
| BRN-02 | Per-branch address, phone, email, currency, language, rooms, staff and | Must P1 | NOT TESTED |
| BRN-03 | Branch comparison dashboard | Must P2 | NOT TESTED |
| BRN-04 | Asset and inventory register | Must P3 | NOT TESTED |
| BRN-05 | New countries configured with their own legal entity, currency, tax | Must P4 | NOT TESTED |
| CAR-01 | Air Fares & Ticketing internships: application, placement, supervisor, | Must P2 | NOT TESTED |
| CAR-02 | Airport internship guidance for East African airports with system- | Must P2 | NOT TESTED |
| CAR-03 | Job board fed by the airline and industry network; apply with verified | Must P2 | NOT TESTED |
| CAR-04 | Automatic CV and career profile from results and certificates | Must P3 | NOT TESTED |
| CAR-05 | Alumni directory, mentoring, events and referral rewards | Must P3 | NOT TESTED |
| CAR-06 | Graduate outcome surveys at 6 and 12 months | Must P3 | NOT TESTED |
| COM-01 | Unified inbox for WhatsApp Business, SMS, email, web chat and in-app | Must P1 | NOT TESTED |
| COM-02 | Lifecycle message templates in English, French and Kinyarwanda | Must P1 | NOT TESTED |
| COM-03 | Announcements by audience with read receipts | Must P1 | NOT TESTED |
| COM-04 | Help centre and chatbot with hand-over to staff | Must P2 | NOT TESTED |
| COM-05 | Support tickets with response targets and satisfaction rating | Must P2 | NOT TESTED |
| CMS-04 | Data export for brochures and flyers so print never conflicts with the | Must P2 | NOT TESTED |
| SYS-01 | Role- and branch-based permissions configurable without code | Must P1 | NOT TESTED |
| SYS-02 | Single sign-on by phone + one-time code, email or Google; two-factor | Must P1 | NOT TESTED |
| SYS-03 | Audit log of all changes to grades, payments, certificates and | Must P1 | NOT TESTED |
| SYS-04 | Approval workflow builder (discounts, refunds, grade changes) | Must P2 | NOT TESTED |
| SYS-05 | Import tools for Google Forms, Excel and paper records | Must P1 | NOT TESTED |
| SYS-06 | Multi-tenant mode for other schools under their own brand | Must P4 | NOT TESTED |
| SYS-07 | Open partner APIs and developer portal for airlines, airports, | Must P4 | NOT TESTED |
| SYS-08 | National ID verification through Irembo/NIDA where legally permitted | Must P3 | NOT TESTED |
| STU-01 | Personal home screen: today's classes, attendance, next payment, | Must P1 | NOT TESTED |
| STU-02 | Update own profile, contacts, photo and emergency contact; changes | Must P1 | NOT TESTED |
| STU-03 | Request a change of session (weekday/weekend, | Must P1 | NOT TESTED |
| STU-04 | Pay fees, choose an installment plan and see a live statement of | Must P1 | NOT TESTED |
| STU-05 | Download every personal document instantly (see 7.17), or one ZIP with | Must P1 | NOT TESTED |
| STU-06 | Request letters that need approval (e.g. recommendation, visa or | Must P1 | NOT TESTED |
| STU-07 | Submit assignments, see feedback and grades, and lodge appeals | Must P1 | NOT TESTED |
| STU-08 | Register for IATA/ICAO exams and track exam fees, dates and results | Must P1 | NOT TESTED |
| STU-09 | Apply for internships and jobs with a verified profile | Must P2 | NOT TESTED |
| STU-10 | Book an appointment with admissions, finance, a lecturer or careers | Must P2 | NOT TESTED |
| STU-11 | Raise support tickets and chat; rate the answer | Must P1 | NOT TESTED |
| STU-12 | Digital student ID card with QR, usable for attendance and access | Must P1 | NOT TESTED |
| STU-13 | Give course and lecturer feedback each module | Must P2 | NOT TESTED |
| STU-14 | Clearance at the end of the programme (finance, library, equipment) | Must P2 | NOT TESTED |
| STU-15 | Self-service target: 80% of student requests completed without staff | Must P3 | NOT TESTED |
| DCM-01 | Every document is generated from an approved template, numbered, | Must P1 | NOT TESTED |
| DCM-02 | Instant download as PDF; bulk download (ZIP) for students and staff | Must P1 | NOT TESTED |
| DCM-03 | Digital signature and official stamp applied automatically by authorised | Must P2 | NOT TESTED |
| DCM-04 | Templates in English, French and Kinyarwanda | Must P1 | NOT TESTED |
| DCM-05 | Secure share link with expiry for a third party (embassy, employer, | Must P2 | NOT TESTED |
| DCM-06 | Version history, reissue and revocation with audit trail | Must P1 | NOT TESTED |
| DCM-07 | Uploaded documents (ID, A2 certificate, transcripts) stored encrypted | Must P1 | NOT TESTED |
| DCM-08 | Retention rules per document type with secure deletion | Must P2 | NOT TESTED |
| MON-01 | Live system health dashboard: availability and response time of each | Must P1 | NOT TESTED |
| MON-02 | Integration health: status, last success, error rate and queue backlog | Must P1 | NOT TESTED |
| MON-03 | Branch connectivity: online status, bandwidth and latency of Kigali, | Must P1 | NOT TESTED |
| MON-04 | Offline sync status: devices with unsynced attendance or grades, and | Must P1 | NOT TESTED |
| MON-05 | Data-flow checks run automatically: every payment linked to an invoice, | Must P2 | NOT TESTED |
| MON-06 | Message delivery rates by channel (sent, delivered, read, failed) | Must P1 | NOT TESTED |
| MON-07 | End-to-end synthetic tests every 15 minutes for key journeys (apply, | Must P2 | NOT TESTED |
| MON-08 | Alerts by SMS/WhatsApp/email to IT and the product owner with | Must P1 | NOT TESTED |
| MON-09 | Monthly connectivity and integration health report to management | Must P1 | NOT TESTED |
| LEC-01 | Create a lecturer record: personal details, ID, qualifications, licences | Must P1 | NOT TESTED |
| LEC-02 | Read: searchable lecturer directory and full profile with history (classes | Must P1 | NOT TESTED |
| LEC-03 | Update details with field-level permissions; sensitive changes (bank | Must P1 | NOT TESTED |
| LEC-04 | Archive instead of delete: a lecturer is deactivated, history is kept for | Must P1 | NOT TESTED |
| LEC-05 | Bulk import and export of lecturer records (Excel/CSV) with validation | Must P1 | NOT TESTED |
| LEC-06 | Lecturer self-service: update own availability, contact details and | Must P1 | NOT TESTED |
| LEC-07 | Create vacancies per subject and branch; publish to the School website | Must P1 | NOT TESTED |
| LEC-08 | Online application with CV, certificates and licences; automatic | Must P1 | NOT TESTED |
| LEC-09 | Shortlisting with scoring, interview and demo-lesson scheduling, and | Must P2 | NOT TESTED |
| LEC-10 | Offer letter, digital contract signature and onboarding checklist | Must P1 | NOT TESTED |
| LEC-11 | Talent pool of past applicants and on-call lecturers for quick | Must P2 | NOT TESTED |
| LEC-12 | Assign lecturers to modules and class groups with workload view | Must P1 | NOT TESTED |
| LEC-13 | One-tap lesson report after each session: topic covered (picked from | Must P1 | NOT TESTED |
| LEC-14 | Automatic weekly and monthly teaching reports per lecturer, generated | Must P1 | NOT TESTED |
| LEC-15 | Compliance tracker: syllabus coverage %, lesson reports on time, | Must P1 | NOT TESTED |
| LEC-16 | Substitute lecturer request and approval when a lecturer cannot attend | Must P1 | NOT TESTED |
| LEC-17 | Pay models per contract: per hour, per session, per module or monthly, | Must P1 | NOT TESTED |
| LEC-18 | Automatic payment claim each month (or per module) built from | Must P1 | NOT TESTED |
| LEC-19 | Clearance checklist before payment: lesson reports complete, | Must P1 | NOT TESTED |
| LEC-20 | Approval chain: coordinator → Head of Academics → Finance, with | Must P1 | NOT TESTED |
| LEC-21 | Payment by bank transfer or MoMo; withholding tax applied per RRA | Must P2 | NOT TESTED |
| LEC-22 | Lecturer sees each claim's status (submitted, cleared, approved, paid) | Must P1 | NOT TESTED |
| LEC-23 | End-of-contract clearance: final grades, equipment and materials | Must P2 | NOT TESTED |
| LEC-24 | Evaluation from student feedback, class observation and compliance | Must P2 | NOT TESTED |
| LEC-25 | Reports: lecturer list, workload, hours delivered, lesson-report | Must P1 | NOT TESTED |
| RES-01 | Add resources by drag-and-drop upload, bulk upload (many files or a | Must P1 | NOT TESTED |
| RES-02 | Describe each resource with title, type, programme, module, topic, | Must P1 | NOT TESTED |
| RES-03 | Update metadata, replace a file with a new version, and keep version | Must P1 | NOT TESTED |
| RES-04 | Delete safely: archive with a 30-day recycle bin and restore; permanent | Must P1 | NOT TESTED |
| RES-05 | Review workflow: lecturer submits, coordinator approves before | Must P1 | NOT TESTED |
| RES-06 | Visibility control: per class group, programme, intake, branch, all | Must P1 | NOT TESTED |
| RES-07 | Scheduled release and expiry dates (e.g. answer keys after the test) | Must P1 | NOT TESTED |
| RES-08 | Copy a whole module's resources to a new intake in one action | Must P1 | NOT TESTED |
| RES-09 | Accepted formats: PDF, Office files, images, MP4, MP3, ZIP, | Must P1 | NOT TESTED |
| RES-10 | Broken-link and outdated-content checker with reminders to resource | Must P2 | NOT TESTED |
| RES-11 | One search box with filters (programme, module, type, language, | Must P1 | NOT TESTED |
| RES-12 | My resources: resources for my current classes shown first, plus | Must P1 | NOT TESTED |
| RES-13 | Open in the browser or app without downloading (PDF reader, video | Must P1 | NOT TESTED |
| RES-14 | Download one file, several selected files, or a whole module as one ZIP | Must P1 | NOT TESTED |
| RES-15 | Offline library in the app: save resources for offline study; they update | Must P1 | NOT TESTED |
| RES-16 | Low-bandwidth mode: videos stream in adaptive quality with an audio- | Must P1 | NOT TESTED |
| RES-17 | Bookmarks, highlights and personal notes kept in the student's account | Must P2 | NOT TESTED |
| RES-18 | Accessibility: captions and transcripts for videos, text-to-speech, | Must P2 | NOT TESTED |
| RES-19 | Students rate resources, report a problem, and request a missing | Must P2 | NOT TESTED |
| RES-20 | Progress indicator: which required resources a student has opened or | Must P2 | NOT TESTED |
| RES-21 | Licence field on every resource; protected items can be view-only, | Must P1 | NOT TESTED |
| RES-22 | IATA, ICAO and other licensed publications are linked or delivered only | Must P1 | NOT TESTED |
| RES-23 | Physical library catalogue per branch: borrowing, returns, reservations, | Must P2 | NOT TESTED |
| RES-24 | Resource usage reports: views, downloads, most and least used, per | Must P2 | NOT TESTED |
| RES-25 | Resources served through a content delivery network for non-personal | Must P1 | NOT TESTED |
| VCL-01 | For each online or hybrid session in the timetable, TAS-One creates the | Must P1 | NOT TESTED |
| VCL-02 | One-tap Join from the app, timetable, reminder notification or calendar; | Must P1 | NOT TESTED |
| VCL-03 | Students stay inside the TAS-One experience: the app opens Meet | Must P2 | NOT TESTED |
| VCL-04 | Automatic attendance from Meet participant records: join time, leave | Must P1 | NOT TESTED |
| VCL-05 | Per-session attendance rules configurable per programme (the overall | Must P1 | NOT TESTED |
| VCL-06 | Absentees and late joiners notified the same day; repeated absence | Must P1 | NOT TESTED |
| VCL-07 | Lecturer sees a live and post-class attendance list and can correct it | Must P1 | NOT TESTED |
| VCL-08 | Recordings saved automatically and published to the class's resources | Must P1 | NOT TESTED |
| VCL-09 | Engagement signals where available: chat, polls, questions answered, | Must P2 | NOT TESTED |
| VCL-10 | Hybrid classes: on-campus QR attendance and online Meet attendance | Must P1 | NOT TESTED |
| VCL-11 | Fallback: if Meet data is unavailable, the lecturer confirms attendance | Must P1 | NOT TESTED |
| VCL-12 | Video provider configurable: Google Meet by default; an embeddable | Must P3 | NOT TESTED |
| PRF-01 | Weekly training report generated automatically every Monday at 08:00 | Must P1 | NOT TESTED |
| PRF-02 | Report contents per class and per student: attendance (online and on | Must P1 | NOT TESTED |
