# Test Plan - Virtual Data Room (Product QA)

## 1. Scope
In: auth, folders (CRUD, nesting, breadcrumbs, delete-warning), files (upload, view, rename, move, delete), sharing (public link, per-email, revoke), access control.
Out (not built per README): folder move, search, versioning, refresh tokens, EDITOR role.

## 2. Approach (risk-based)
Priority = impact x likelihood. Product is a due-diligence tool, so **confidentiality of data and correctness of revocation come first**.
| Level | What | Share of effort |
|---|---|---|
| API automation | authz/IDOR, sharing/revoke, validation, conflicts | ~60% of automation |
| UI E2E (few) | login, upload->view, share->revoke, refresh/deep link | ~10% |
| Exploratory (manual) | UX, edge cases, error states, drag&drop, progress | main source of findings |
| Out of this round | performance (100k files), cross-browser, a11y, security scan | next iteration |

## 3. Risk areas (P0 -> P2)
- **P0** Cross-user data exposure (IDOR, breadcrumbs above share boundary, client cache after logout, public token handling).
- **P0** Revoke does not take effect (links, per-email, nested content, 5-min signed URLs window).
- **P1** Upload: multi-file, progress, retry duplicates, non-PDF/oversize, interrupted upload, same-name conflicts.
- **P1** Folder delete: preview correctness, storage cleanup, deleting a folder someone is currently viewing.
- **P1** Validation on backend (names: empty, whitespace, long, unicode, `/`, case-insensitive duplicates).
- **P2** UX polish, keyboard (row click vs Download button), error messages, responsive.

## 4. Exploratory charters (60-90 min each)
1. Explore sharing as owner and grantee: every share type x every resource type x revoke.
2. Explore upload under bad conditions: big file, wrong type, offline mid-upload, many files, same names.
3. Explore folder tree: deep nesting, long/odd names, delete preview vs. reality, concurrent views.
4. Explore session/auth: logout, token expiry, two users in one browser, direct URL access.

## 5. Entry / exit criteria
Entry: app deployed, test accounts work. Exit: no open P0/P1 without a mitigation decision; P0 regression suite green.

## 6. Environment & data
Production deployment only (no staging). Tests create unique `*-qa-<ts>` data and clean up. Do not touch others' data.
