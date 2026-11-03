# Commit 0813 — 05942cd

| Field | Value |
|-------|-------|
| **Commit Number** | 0813 |
| **Commit Hash** | 05942cd0c9dc324b8981dc79f6306b69c1ce6298 |
| **Parent Hash** | 082fcc3683938d9dc423269c843593857bc2e647 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 21:20:08 |
| **Branch** | main |
| **Files Changed** | 10 |
| **Additions** | 966 |
| **Deletions** | 85 |
| **Net Change** | +881 |
| **Merge Commit** | No |

## Create Document Rows at Upload Time

Uploads for chat, calls and search create their Document row immediately (new `privateDocumentService`), instead of relying on a disabled AI backfill; tests.

Original commit message: “fix(uploads): write the Document row at upload time, not in a backfill”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/server-private-documents.test.js` | Added | 267 | 0 | +267/-0 |
| `tests/unit/server-file-access.test.js` | Modified | 187 | 16 | +187/-16 |
| `tests/unit/server-uploads-registry.test.js` | Added | 137 | 0 | +137/-0 |
| `server/services/fileAccessService.js` | Modified | 105 | 30 | +105/-30 |
| `server/services/uploadsService.js` | Modified | 101 | 13 | +101/-13 |
| `server/services/privateDocumentService.js` | Added | 82 | 0 | +82/-0 |
| `server/controllers/searchController.js` | Modified | 48 | 23 | +48/-23 |
| `server/controllers/callSessionController.js` | Modified | 15 | 0 | +15/-0 |
| `server/controllers/messageController.js` | Modified | 14 | 1 | +14/-1 |
| `server/server.js` | Modified | 10 | 2 | +10/-2 |

### What changed per file

- **`tests/unit/server-private-documents.test.js`** — added test. function added: `fakeRes`; test case added: `writes a chat_attachment row naming the uploader and the file`; test case added: `writes the row for a non-media attachment too`; test case added: `writes a call_recording row naming the owning call and the uploader`; test case added: `writes a search_image row naming the uploader`.
- **`tests/unit/server-file-access.test.js`** — modified test. test case added: `allows the uploader of a chat attachment without a message`; test case added: `denies a recording to a caller who only pointed their own session at it`; test case added: `denies a call recording row that names no call session`; test case added: `resolves the owning call session by id, not by recording_url`; test case added: `allows the uploader of a search image`; test case added: `denies a search image to anyone but the uploader` ….
- **`tests/unit/server-uploads-registry.test.js`** — added test. function added: `createdRow`; test case added: `creates a row for a file that has none, whatever the moderation flag says`; test case added: `creates a row for a non-media file`; test case added: `creates a row for a search image`; test case added: `creates a row for a contract pdf and for a public feed file`; test case added: `creates a row for a file sitting directly in the uploads root` ….
- **`server/services/fileAccessService.js`** — modified server service. function removed: `canAccessChatAttachment`; function added: `friendMatchIdsFor`; function added: `canAccessChatAttachment`; function added: `canAccessSearchImage`; function removed: `canUserAccessDocument`; function added: `canUserAccessDocument`.
- **`server/services/uploadsService.js`** — modified server service. function added: `entityTypeForFolder`; function added: `baseNameOf`; function added: `ensureDocumentRowsForExistingFiles`.
- **`server/services/privateDocumentService.js`** — added server service. function added: `text`; function added: `recordPrivateUpload`.
- **`server/controllers/searchController.js`** — modified API controller. +48/-23 lines.
- **`server/controllers/callSessionController.js`** — modified API controller. +15/-0 lines.
- **`server/controllers/messageController.js`** — modified API controller. +14/-1 lines.
- **`server/server.js`** — modified server. +10/-2 lines.

## Detailed Diff Analysis

- **Areas touched:** test (3 files, +591/-16), server service (3 files, +288/-43), API controller (3 files, +77/-24), server (1 file, +10/-2).
- **Function added** (11): `friendMatchIdsFor`, `canAccessChatAttachment`, `canAccessSearchImage`, `canUserAccessDocument`, `text`, `recordPrivateUpload`, `entityTypeForFolder`, `baseNameOf`, `ensureDocumentRowsForExistingFiles`, `fakeRes` …
- **Function removed** (2): `canAccessChatAttachment`, `canUserAccessDocument`
- **Test case added** (22): `allows the uploader of a chat attachment without a message`, `denies a recording to a caller who only pointed their own session at it`, `denies a call recording row that names no call session`, `resolves the owning call session by id, not by recording_url`, `allows the uploader of a search image`, `denies a search image to anyone but the uploader`, `denies a search image row that points outside the search folder`, `denies the scanner`, `authorizes a chat attachment through its write-time row`, `authorizes a search image through its write-time row` …
- **Tests:** 3 test file(s) changed: `tests/unit/server-file-access.test.js`, `tests/unit/server-private-documents.test.js`, `tests/unit/server-uploads-registry.test.js`

## Why This Change Was Needed

Files uploaded without a row were unreachable (or mis-authorized).

## Was It Useful

Useful. Correctness of the access model.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0812 — Record the Upload Access-Control Fix in AGENTS.md.
- **Precedes:** 0814 — Require UPLOADS_SIGNING_SECRET at Boot.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
