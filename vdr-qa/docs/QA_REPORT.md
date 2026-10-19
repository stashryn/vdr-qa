# QA Report - Virtual Data Room

**Tested:** production deployment (web: virtual-data-room-ten.vercel.app, API: virtual-data-room-production.up.railway.app)
**Methods:** risk-based test plan, automated API/UI tests (Playwright, run in GitHub Actions), manual exploratory testing.
**Repository with tests and docs:** https://github.com/stashryn/vdr-qa

## 1. Testing approach
A data room holds confidential due-diligence material, so I prioritised in this order: (1) who can see what, (2) whether revoking access works, (3) upload and folder correctness, (4) UX and polish.
Testing pyramid: most automated coverage is at API level (fast, deterministic, where the authorization logic lives), a few UI smoke tests on top, and manual exploratory testing for UX, error states and edge cases that automation cannot judge. Automated tests create unique data and clean up after themselves.
Constraint: `john` and `viewer` are the demo accounts from the README and already contained data I did not create, so I worked only in my own `stas-*` folders and left existing data untouched.

## 2. What was tested
**Automated (39 tests):** authentication and token handling, authorization on folders (viewer vs owner), folder validation/duplicates/cascade delete, sharing (per-user, public link, revoke, inheritance, breadcrumb leakage, deleting a folder someone is viewing), upload-intent validation, UI smoke (login, refresh on deep link).
**Manual:** login/session, cache after logout, folders (nesting, invalid names, duplicates, rename, long names), uploads (multi-file, drag-and-drop, non-PDF, name conflicts, large file, network interruption), file operations (rename, move, move conflicts, download, delete, keyboard), folder deletion warning, sharing (per-user read-only, revocation, public link, revoked link), refresh/back/404/mobile width, unimplemented features, language.

## 3. Findings (prioritised)
No S1 (data exposure) or S2 (broken core flow) defect was found. All verified findings are S3.

| ID | Sev | Type | Title | Evidence |
|---|---|---|---|---|
| F-01 | S3 | Bug | `POST /files/{id}/complete` returns **500** instead of the documented 400 when the object is not in storage | Automated test, failed on both attempts |
| F-04 | S3 | Bug | After a network interruption during upload, **Retry always fails** with "status 400"; the file never appears | Manual, repeated; same file uploads fine on a normal connection (201) |
| F-05 | S3 | Accessibility | A file **cannot be opened with the keyboard**: rows are not focusable, only the "⋮" menu is reachable with Tab | Manual |
| F-03 | S3 | UI bug | A long folder name without spaces creates a **horizontal scrollbar for the whole list** instead of being truncated | Manual, screenshot |
| F-02 | S3 | Product issue | The repository's About link points to `virtual-data-room-seven.vercel.app` which returns **404 DEPLOYMENT_NOT_FOUND** | Manual, screenshot |

**F-01 detail.** Steps: create an upload intent, upload no bytes, call `/complete`. Expected 400 "Upload did not finish - please try again" (documented as safe to retry). Actual 500. Impact: an interrupted upload surfaces as a server error instead of an actionable message. Test: `tests/api/files.spec.ts`.
**F-04 detail.** Steps: start a multi-MB upload, go offline mid-upload, restore the network, press Retry. Expected: upload completes. Actual: immediate "Upload failed with status 400"; the message is technical and gives no guidance. Workaround: close the message and upload again. Hypothesis (not verified): Retry calls `/complete` without re-sending the bytes, so the server rightly rejects it. Possibly related to F-01.
**F-05 detail.** Impact: keyboard and screen-reader users cannot open documents, the product's main action. Hypothesis: rows are clickable elements without button/link semantics. Severity would rise to S2 if the "⋮" menu also has no "open" action (not checked).

### Observations (S4, not defects)
- Revocation applies to new requests immediately, but a file already open stays readable until the page is left (signed URLs live up to 5 minutes). By design and documented, but the UI does not tell the owner.
- After revocation, a viewer sees a generic "File not found... or you don't have access". Deliberate (does not reveal existence), but a clearer "access was removed" message would help.
- "Shared with me" shows no information about who shared the item.
- When moving a file whose name already exists, the app shows a clear message and renames it. Moving `a (1).pdf` into a folder that already has it produced `a (1)(1).pdf` instead of incrementing the number.
- Dates use the browser locale ("19 жовт. 2026 р.") while the UI is English.

### Risks from documentation, not verified on production
| ID | Sev | Item | Why it matters |
|---|---|---|---|
| R-01 | S2 | Sharing by email is allowed for **not yet registered** addresses, and the sign-up form has no email-verification step (observed). Whether registration verifies ownership after submit was not tested, to avoid creating accounts on shared production. | Whoever registers an invited address could gain access to the shared content. |
| R-02 | S2 | Single 7-day JWT, no refresh, no server-side revocation | A leaked token stays valid for up to 7 days. Accepted by the author as an MVP cut. |
| R-03 | S3 | Abandoned uploads leave DB records and possibly bucket objects with no cleanup | Storage and DB growth; invisible to users. Documented by the author. |
| R-04 | S4 | Folder move is not implemented | Not a defect; confirmed that the UI does not expose it. |

## 4. Verified good (regression areas the author listed as past bugs)
- Viewer gets 404 on read, breadcrumbs, delete-preview, rename and delete of an owner's folder; read-only enforced in the UI.
- Breadcrumbs for a shared folder start at the shared folder; names above the share boundary are not revealed (API test + manual).
- No data from the previous user visible after logout and login as another user.
- Revoking a share takes effect right away for the next action; revoked public link shows "This link has been revoked. Ask the owner for a new one."
- Deleting a folder that a grantee is viewing gives that user a clean 404 (automated).
- Delete warning matches reality ("5 files (3.4 MB)" vs my own count).
- Duplicate names rejected case-insensitively and ignoring surrounding spaces; empty, whitespace-only and over-long names rejected with clear messages.
- Multi-file upload with per-file progress, drag-and-drop with highlight, non-PDF rejected, name conflicts resolved with a notice, close button present after an upload error, PDF opens inline, Download uses the correct file name, large file (~MB) uploads correctly.
- Refresh on nested routes works; unknown route shows "Folder not found"; usable at phone width; no unimplemented features visible; UI text in English; login errors do not reveal which emails exist.

## 5. Automated coverage
39 tests: **37 passed, 1 failed (F-01), 1 skipped** (logout cache leak as a UI test, left as `fixme` because the manual check already covered it).
Pyramid: 36 API tests (auth, authorization, folders, file-upload validation, sharing) and 3 UI smoke tests. Runs in GitHub Actions on demand and on push.
**Not covered by automation:** real file upload end to end through the signed URL, file rename/move conflicts, view and download URL behaviour, pagination at scale, public-link browsing endpoints, drag-and-drop, cross-browser.
**Not tested at all:** files above 50 MB, behaviour with many thousands of items, performance, accessibility beyond the keyboard check, security scanning, the Share dialog reopened on an item with an existing public link, and a freshly opened revoked public link in a clean browser (verified only by API test returning 410 and by clicking a file in an open page).

## 6. Release readiness
**GO with conditions** for the stated goal, an MVP demo.
The highest-risk area, access control and revocation, behaved correctly in every automated and manual check, and no data-exposure or core-flow defect was found. Conditions before calling it ready:
1. Fix or consciously accept F-04 (broken Retry is the only recovery action after a failed upload) and F-01 (500 on an expected error).
2. Fix F-05 or confirm another keyboard path to open a file; otherwise the product is not usable without a mouse.
3. Decide on R-01 (email ownership) before any real use with confidential data; for a demo it is acceptable.
4. Fix the About link (F-02) so a reviewer lands on the live app.

## 7. What to test or automate next
1. Automate the upload flow end to end (intent, PUT to signed URL, complete) and the interrupted-upload scenario (F-01/F-04 regression).
2. Verify R-01 on a staging copy: register an address that already has a pending share.
3. Automate file rename/move conflicts and public-link browsing endpoints.
4. Performance and pagination with thousands of items; files at and above 50 MB.
5. Accessibility pass (focus order, labels, screen reader) and cross-browser run; add the logout cache-leak UI test.
6. Add the suite to CI on every change to the product and keep the F-01 test as a regression guard.

## 8. Where AI was used
I used Claude (Anthropic) as a supporting tool during test planning and automation development. It helped structure the initial test plan, suggest test scenarios based on the API contracts, and draft parts of the Playwright tests and documentation.
My main contribution was reviewing the proposed scenarios, adapting them to the actual application, running the automated suite in GitHub Actions, and investigating the results. I also performed the manual and exploratory testing myself, identified and documented F-02 to F-05, analysed the F-01 failure, and assessed the severity and release impact of the findings.
AI helped speed up repetitive tasks, but the final test selection, verification of findings, prioritisation, and release recommendation were based on my own testing and judgement. I verified reported behaviour against the deployed application and checked relevant assumptions against the API implementation and CI results.
