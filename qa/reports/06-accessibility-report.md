# Accessibility report (NFT-05, NFT-04)

Date 2026-11-12. Standard: WCAG 2.2 AA. Automated: axe-core with rule sets wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, on 9 public pages at desktop (1366) and mobile (390) plus 6 staff pages. Automated checks find roughly a third of WCAG problems, so this is **not** a certification; manual screen-reader review and user testing with disabled people were not done (BLOCKED).

Results: 42 of 42 accessibility and responsive tests PASS.

## Findings from the campaign (all fixed and retested)

| Finding | Impact | Where | Status |
|---|---|---|---|
| Colour contrast 4.03:1 (muted text on light blue) | serious | apply wizard option cards | FIXED (DEF-008) |
| Colour contrast on success pills | serious | admissions, payments, courses (staff) | FIXED (DEF-008) |
| Hero photographs with empty alt text | serious (WCAG 1.1.1) | course pages | FIXED (DEF-005) |
| Footer links shorter than 24 px | WCAG 2.2 SC 2.5.8 | all public pages | FIXED (DEF-009) |

Current axe violations at serious/critical level: **none**. Remaining lower-impact findings logged by axe in the last full run: none.

## Also verified
- Keyboard: tabbing through the application form reaches interactive elements in order, with a visible focus indicator on each (A11Y keyboard test).
- Reduced motion: no infinite animations run when the user prefers reduced motion.
- Responsive: no horizontal scrolling and no target smaller than 24 px at 360, 390, 430, 768, 1024, 1366 and 1920 px on the home, catalogue and application pages (21 combinations); home page screenshots in `qa/evidence/RESP-home-*.png`.
- Mobile menu opens, closes with Escape and returns focus (FT-004).

## Not verified
Screen-reader announcements, zoom to 400%, text-spacing overrides, captions/transcripts for the new gallery video and audio (no captions mechanism exists yet), and the media library upload screen (new, not covered by axe).
