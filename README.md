# Data Room - QA assignment

Product QA work for the Virtual Data Room (https://github.com/evo9/virtual-data-room).
Tested deployment: https://virtual-data-room-ten.vercel.app (API: https://virtual-data-room-production.up.railway.app)

## Where to find what

| Deliverable | Location |
|---|---|
| Test plan | [vdr-qa/docs/TEST_PLAN.md](vdr-qa/docs/TEST_PLAN.md) |
| Prioritised findings | [vdr-qa/docs/FINDINGS.md](vdr-qa/docs/FINDINGS.md) |
| Final QA report (approach, coverage, release readiness, next steps, AI usage) | [vdr-qa/docs/QA_REPORT.md](vdr-qa/docs/QA_REPORT.md) |
| API tests (testing pyramid base) | [vdr-qa/tests/api](vdr-qa/tests/api) |
| UI smoke tests | [vdr-qa/tests/e2e](vdr-qa/tests/e2e) |
| Framework helpers (API client, route map) | [vdr-qa/fixtures](vdr-qa/fixtures) |
| CI pipeline | [.github/workflows/qa.yml](.github/workflows/qa.yml) |

## Automated tests
Playwright + TypeScript, one stack for API and UI: 36 API tests and 3 UI smoke tests.
Covers authentication, authorization (owner vs viewer), folders, upload validation, and sharing/revocation.
Run them on GitHub: **Actions -> qa -> Run workflow** (credentials are stored as repository secrets).

Latest result: 37 passed, 1 skipped, 1 failing/expected-failing test that reproduces defect **F-01**
(`POST /files/{id}/complete` returns 500 instead of the documented 400). It stays in the suite as a regression guard.

## Run locally
