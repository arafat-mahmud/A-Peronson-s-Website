# Commit 0858 — 981fc37

| Field | Value |
|-------|-------|
| **Commit Number** | 0858 |
| **Commit Hash** | 981fc37da5134c67cc2a5aa059e307ca3cf91eb9 |
| **Parent Hash** | ed0e71b9923fe9c7f3e31d652b3f7fcba225a0a6, 376ffcd2308cd8542d27b1ff8d9e659caafd0660 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 03:01:05 |
| **Branch** | main |
| **Files Changed** | 4 |
| **Additions** | 2459 |
| **Deletions** | 480 |
| **Net Change** | +1979 |
| **Merge Commit** | Yes |

## Merge the Support Client Chat UI Workstream

Merge commit bringing WS4 (support page, hook, realtime client).

Original commit message: “merge: WS4 client chat UI (feat/ws4-client-ui)”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/SupportReports.jsx` | Modified | 1444 | 480 | +1444/-480 |
| `src/hooks/useSupportCase.js` | Added | 399 | 0 | +399/-0 |
| `tests/unit/frontend-support-case.test.js` | Added | 319 | 0 | +319/-0 |
| `src/lib/caseRealtime.js` | Added | 297 | 0 | +297/-0 |

### What changed per file

- **`src/pages/SupportReports.jsx`** — modified page. function added: `decodeStoredText`; function added: `fileNameOf`; function added: `isImageAttachment`; function added: `safeExternalUrl`; function added: `getPriorityColor`; function added: `SignedAttachmentPreview` ….
- **`src/hooks/useSupportCase.js`** — added frontend library. function added: `compareBySequence`; function added: `mergeMessages`; function added: `mergeAttachments`; function added: `upsertProgress`; function added: `toAttachmentPayload`; function added: `buildAttachmentPayload` ….
- **`tests/unit/frontend-support-case.test.js`** — added test. function added: `caseRow`; function added: `defaultResponses`; function added: `installApi`; test case added: `loads the case with the bearer token when it mounts`; test case added: `subscribes to the case event stream`; test case added: `send posts to the case messages endpoint and appends the message and the reply` ….
- **`src/lib/caseRealtime.js`** — added frontend library. function added: `isPlainObject`; function added: `isCaseEventType`; function added: `caseStreamPath`; function added: `normalizeCaseEvent`; function added: `parseSseLine`; function added: `createFrameParser` ….

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +1444/-480), frontend library (2 files, +696/-0), test (1 file, +319/-0).
- **Function added** (56): `compareBySequence`, `mergeMessages`, `mergeAttachments`, `upsertProgress`, `toAttachmentPayload`, `buildAttachmentPayload`, `applyStatusEvent`, `applyReportEvent`, `applyCaseEvent`, `applySent` …
- **Function removed** (1): `submitReport`
- **Test case added** (11): `loads the case with the bearer token when it mounts`, `subscribes to the case event stream`, `send posts to the case messages endpoint and appends the message and the reply`, `send carries attachments in the shape contracts.md 3 defines`, `a ready response moves the case to investigating`, `a response that is not ready leaves the case collecting`, `confirm posts to the case confirm endpoint`, `applies the five contract event types from contracts.md 4`, `ignores an event type that is not one of the five`, `send posts nothing when no case is open` …
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-support-case.test.js`
- **Merge:** diff shown against the first parent; the content was authored in the merged branch's commits.

## Why This Change Was Needed

Integrate parallel branch.

## Was It Useful

Neutral. Merge.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. As a merge, its effect equals that of the merged branch commits.

## Relationship to Surrounding Commits

- **Follows:** 0857 — Merge the Admin Console and Retention Workstream.
- **Precedes:** 0859 — Finish Investigations: Report, Email, Escalation and Completion.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
