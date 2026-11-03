# Commit 0803 — dfacb2c

| Field | Value |
|-------|-------|
| **Commit Number** | 0803 |
| **Commit Hash** | dfacb2c633b693ccea9b37ea3009c07dedc8dc19 |
| **Parent Hash** | 88a921d4bcddce61960dac909c4ede3b07bef8df |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 14:20:39 |
| **Branch** | main |
| **Files Changed** | 5 |
| **Additions** | 252 |
| **Deletions** | 54 |
| **Net Change** | +198 |
| **Merge Commit** | No |

## Sign Private File URLs in the Client

ContractVault and chat attachments fetch a signed URL before opening/rendering; failures degrade gracefully; tests.

Original commit message: “feat(uploads): sign private file urls on the client”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/components/chat/AttachmentPreviewModal.jsx` | Modified | 64 | 35 | +64/-35 |
| `src/lib/signedFile.js` | Added | 87 | 0 | +87/-0 |
| `tests/unit/frontend-signed-file.test.js` | Added | 72 | 0 | +72/-0 |
| `src/components/chat/FileAttachmentCard.jsx` | Modified | 17 | 15 | +17/-15 |
| `src/pages/ContractVault.jsx` | Modified | 12 | 4 | +12/-4 |

### What changed per file

- **`src/components/chat/AttachmentPreviewModal.jsx`** — modified component. function removed: `safeDownloadName`.
- **`src/lib/signedFile.js`** — added frontend library. function added: `signPaths`; function added: `signAndOpen`; function added: `signAndAssign`.
- **`tests/unit/frontend-signed-file.test.js`** — added test. test case added: `returns the server payload for each path`; test case added: `sends the bearer token`; test case added: `returns false when the server refuses the path`; test case added: `returns false on a network failure`; test case added: `opens the signed url`; test case added: `assigns the signed url to a setter`.
- **`src/components/chat/FileAttachmentCard.jsx`** — modified component. function removed: `safeDownloadName`.
- **`src/pages/ContractVault.jsx`** — modified page. +12/-4 lines.

## Detailed Diff Analysis

- **Areas touched:** component (2 files, +81/-50), frontend library (1 file, +87/-0), test (1 file, +72/-0), page (1 file, +12/-4).
- **Function added** (3): `signPaths`, `signAndOpen`, `signAndAssign`
- **Function removed** (1): `safeDownloadName`
- **Test case added** (6): `returns the server payload for each path`, `sends the bearer token`, `returns false when the server refuses the path`, `returns false on a network failure`, `opens the signed url`, `assigns the signed url to a setter`
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-signed-file.test.js`

## Why This Change Was Needed

No unsigned private path should reach the DOM.

## Was It Useful

Useful. Security.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0802 — Biome-Format ContractVault.
- **Precedes:** 0804 — Biome-Format the Chat Right Panel.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
