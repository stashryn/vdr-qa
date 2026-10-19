# vdr-qa - QA automation for Virtual Data Room
Playwright + TypeScript. One stack for API and UI (testing pyramid: many API tests, few E2E).
```
npm install && npx playwright install chromium
cp .env.example .env
npm run test:api     # fast, majority of coverage
npm run test:e2e     # few UI smoke tests
```
**Before first run:** open `fixtures/routes.ts` and confirm routes/payloads against DevTools -> Network.
Add new tests under `tests/api` or `tests/e2e`; keep data unique via `uniq()` and clean up in `finally`.
