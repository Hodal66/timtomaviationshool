# Performance report (NFT-01, NFT-02, NFT-06)

Date 2026-11-12. **Environment:** local production build (`next start`) on a shared sandbox machine with a local PostgreSQL; no CDN and no real network. Lab results only: treat them as indicative, not as production field data. Mobile = Lighthouse default simulated slow 4G with 4x CPU slowdown; desktop = Lighthouse desktop preset.

## Lighthouse (after fixes)

| Page / mode | Perf | A11y | Best pract. | SEO | LCP ms | FCP ms | TBT ms | CLS | TTFB ms | Transfer KB |
|---|---|---|---|---|---|---|---|---|---|---|
| apply-desktop | 100 | 98 | 96 | 66 | 791 | 461 | 0 | 0.0 | 12 | 252 |
| apply-mobile | 96 | 98 | 96 | 66 | 2649 | 1479 | 96 | 0.002 | 15 | 242 |
| course-desktop | 99 | 99 | 96 | 100 | 864 | 500 | 0 | 0.0 | 21 | 273 |
| course-mobile | 95 | 99 | 96 | 100 | 2856 | 1606 | 83 | 0 | 52 | 273 |
| courses-desktop | 99 | 98 | 96 | 100 | 831 | 501 | 0 | 0 | 5 | 313 |
| courses-mobile | 97 | 98 | 96 | 100 | 2521 | 1637 | 42 | 0 | 19 | 333 |
| gallery-desktop | 100 | 98 | 96 | 100 | 481 | 467 | 0 | 0.0 | 5 | 240 |
| gallery-mobile | 99 | 98 | 96 | 100 | 1998 | 1471 | 32 | 0.0 | 13 | 240 |
| home-desktop | 98 | 98 | 96 | 100 | 840 | 840 | 0 | 0 | 10 | 347 |
| home-mobile | 94 | 98 | 96 | 100 | 2940 | 1545 | 36 | 0 | 20 | 368 |

**Core Web Vitals targets (LCP < 2.5 s, CLS <= 0.1):** FAIL for apply-mobile, course-mobile, courses-mobile, home-mobile (all LCP; CLS passes everywhere). See DEF-013. The apply page originally failed CLS (0.39 mobile) and was fixed (DEF-010). The SEO score of 66 on the apply page is the intentional `noindex`.

**INP:** BLOCKED as a field metric. Lab Total Blocking Time is 30-160 ms on mobile, which suggests no long main-thread tasks, but it is not INP.

## Low bandwidth (NFT-06)

Emulated Slow 3G (400 kbps, 400 ms round trip), time until the page headline is visible:

- /: headline visible 1555 ms, 23 KB so far
- /courses/personnel-licensing: headline visible 1422 ms, 9 KB so far
- /apply?course=personnel-licensing: headline visible 965 ms, 8 KB so far

Page weight budgets (home <= 500 KB, course <= 400 KB, images lazy loaded): PASS. Going offline mid-application keeps the typed data and resumes saving when back online: PASS (NFT-06b). Real Rwandan network tests: BLOCKED.

## Load and scalability (NFT-02)

Tool: autocannon, 10 s per step, one pass per concurrency level. The load generator and the server share the same machine, so capacity here understates a real deployment; the p95/p99 figures include that contention.

```
/                                 10 rps 1057 p50 8 p97.5 18 p99 19 max 28 ms | 2xx 10570 non2xx 0 errors 0 timeouts 0
/                                 50 rps 1099 p50 44 p97.5 67 p99 81 max 133 ms | 2xx 12084 non2xx 0 errors 0 timeouts 0
/                                100 rps 1045 p50 92 p97.5 120 p99 143 max 251 ms | 2xx 11492 non2xx 0 errors 0 timeouts 0
/                                250 rps 1081 p50 228 p97.5 276 p99 294 max 516 ms | 2xx 10809 non2xx 0 errors 0 timeouts 0
/                                500 rps 1082 p50 457 p97.5 519 p99 526 max 878 ms | 2xx 11905 non2xx 0 errors 0 timeouts 0
/                               1000 rps 1059 p50 98 p97.5 189 p99 931 max 9954 ms | 2xx 10588 non2xx 0 errors 835 timeouts 835
/courses                          10 rps 662 p50 13 p97.5 25 p99 28 max 565 ms | 2xx 6619 non2xx 0 errors 0 timeouts 0
/courses                          50 rps 740 p50 65 p97.5 92 p99 129 max 171 ms | 2xx 7398 non2xx 0 errors 0 timeouts 0
/courses                         100 rps 697 p50 140 p97.5 171 p99 252 max 347 ms | 2xx 6974 non2xx 0 errors 0 timeouts 0
/courses                         250 rps 719 p50 343 p97.5 381 p99 572 max 730 ms | 2xx 7189 non2xx 0 errors 0 timeouts 0
/courses                         500 rps 713 p50 118 p97.5 199 p99 1696 max 9891 ms | 2xx 7133 non2xx 0 errors 348 timeouts 348
/courses                        1000 rps 656 p50 116 p97.5 203 p99 2315 max 9877 ms | 2xx 6559 non2xx 0 errors 886 timeouts 886
/courses/personnel-licensing      10 rps 852 p50 10 p97.5 19 p99 20 max 832 ms | 2xx 8521 non2xx 0 errors 0 timeouts 0
/courses/personnel-licensing      50 rps 982 p50 48 p97.5 72 p99 95 max 135 ms | 2xx 10799 non2xx 0 errors 0 timeouts 0
/courses/personnel-licensing     100 rps 980 p50 100 p97.5 123 p99 138 max 249 ms | 2xx 9801 non2xx 0 errors 0 timeouts 0
/courses/personnel-licensing     250 rps 965 p50 256 p97.5 304 p99 361 max 558 ms | 2xx 9650 non2xx 0 errors 0 timeouts 0
/courses/personnel-licensing     500 rps 955 p50 519 p97.5 582 p99 587 max 1041 ms | 2xx 9546 non2xx 0 errors 0 timeouts 0
/courses/personnel-licensing    1000 rps 942 p50 102 p97.5 164 p99 1273 max 9993 ms | 2xx 9419 non2xx 0 errors 863 timeouts 863
```

**Reading the results:** pages are served from the Next.js cache at roughly 700-1,100 requests per second on this machine with no errors up to 500 concurrent connections. At 1,000 connections the client records timeouts (e.g. 835 of ~11,400 on the home page) while the server keeps answering at the same rate, so this is the limit of the test setup, not a measured capacity of the production platform.

**Before the fix (DEF-011):** the course page was not cached and managed about 100 requests/s, with timeouts from 250 connections. After the fix it serves about 950 requests/s with no errors up to 500 connections.

**SRS capacity target (2,000 concurrent users per tenant): NOT DEMONSTRATED.** Recorded as a limitation. Dynamic endpoints (application submit, staff dashboards) were not load tested beyond the functional concurrency test (25 simultaneous applicants, integration test) and 3 simultaneous identical submissions; an API p95 < 1 s target for those endpoints has therefore not been measured under load.
