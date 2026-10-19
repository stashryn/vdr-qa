# Prioritised findings - Virtual Data Room

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

## Observations (S4, not defects)
- Revocation applies to new requests immediately, but a file already open stays readable until the page is left (signed URLs live up to 5 minutes). By design and documented, but the UI does not tell the owner.
- After revocation, a viewer sees a generic "File not found... or you don't have access". Deliberate (does not reveal existence), but a clearer "access was removed" message would help.
- "Shared with me" shows no information about who shared the item.
- When moving a file whose name already exists, the app shows a clear message and renames it. Moving `a (1).pdf` into a folder that already has it produced `a (1)(1).pdf` instead of incrementing the number.
- Dates use the browser locale ("19 жовт. 2026 р.") while the UI is English.

## Risks from documentation, not verified on production
| ID | Sev | Item | Why it matters |
|---|---|---|---|
| R-01 | S2 | Sharing by email is allowed for **not yet registered** addresses, and the sign-up form has no email-verification step (observed). Whether registration verifies ownership after submit was not tested, to avoid creating accounts on shared production. | Whoever registers an invited address could gain access to the shared content. |
| R-02 | S2 | Single 7-day JWT, no refresh, no server-side revocation | A leaked token stays valid for up to 7 days. Accepted by the author as an MVP cut. |
| R-03 | S3 | Abandoned uploads leave DB records and possibly bucket objects with no cleanup | Storage and DB growth; invisible to users. Documented by the author. |
| R-04 | S4 | Folder move is not implemented | Not a defect; confirmed that the UI does not expose it. |
