# Commit 0805 — 31a075d

| Field | Value |
|-------|-------|
| **Commit Number** | 0805 |
| **Commit Hash** | 31a075d558210d1b52ac4472e611dead0d1031a1 |
| **Parent Hash** | 571e8f1e63109f1a1fc3c048278fa4bfef8111be |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-19 15:52:05 |
| **Branch** | main |
| **Files Changed** | 9 |
| **Additions** | 517 |
| **Deletions** | 81 |
| **Net Change** | +436 |
| **Merge Commit** | No |

## Sign Every Gated Download and Normalise Paths First

`signPaths` reduces any URL to its pathname before signing; new `useSignedSrc` and `SignedMedia`; chat media fixed; tests.

Original commit message: “fix(uploads): sign every gated egress, and normalise paths before signing”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/unit/frontend-signed-file.test.js` | Modified | 173 | 3 | +173/-3 |
| `src/lib/signedFile.js` | Modified | 122 | 21 | +122/-21 |
| `src/components/chat/AttachmentPreviewModal.jsx` | Modified | 51 | 34 | +51/-34 |
| `src/hooks/useSignedSrc.js` | Added | 59 | 0 | +59/-0 |
| `src/components/chat/SignedMedia.jsx` | Added | 58 | 0 | +58/-0 |
| `src/components/chat/FileAttachmentCard.jsx` | Modified | 24 | 7 | +24/-7 |
| `src/pages/ContractVault.jsx` | Modified | 18 | 5 | +18/-5 |
| `src/pages/ChatInterface.jsx` | Modified | 7 | 6 | +7/-6 |
| `src/pages/chat/RightPanel.jsx` | Modified | 5 | 5 | +5/-5 |

### What changed per file

- **`tests/unit/frontend-signed-file.test.js`** — modified test. function added: `captureAnchorClicks`; test case added: `sends the bearer token, the method and the path list`; test case added: `normalises an absolute url to its pathname before signing`; test case added: `keys the result by the normalised path, not the path passed in`; test case added: `never calls the setter when the server refuses the path`; test case added: `never calls the setter when the sign request fails outright` ….
- **`src/lib/signedFile.js`** — modified frontend library. function added: `isGatedAssetPath`; function added: `toSignablePath`; function added: `signOne`; function added: `signAndDownload`.
- **`src/components/chat/AttachmentPreviewModal.jsx`** — modified component. +51/-34 lines.
- **`src/hooks/useSignedSrc.js`** — added frontend library. function added: `useSignedSrc`.
- **`src/components/chat/SignedMedia.jsx`** — added component. function added: `SignedImage`; function added: `SignedVideo`.
- **`src/components/chat/FileAttachmentCard.jsx`** — modified component. function added: `safeDownloadName`.
- **`src/pages/ContractVault.jsx`** — modified page. +18/-5 lines.
- **`src/pages/ChatInterface.jsx`** — modified page. +7/-6 lines.
- **`src/pages/chat/RightPanel.jsx`** — modified page. +5/-5 lines.

## Detailed Diff Analysis

- **Areas touched:** frontend library (2 files, +181/-21), test (1 file, +173/-3), component (3 files, +133/-41), page (3 files, +30/-16).
- **Function added** (9): `safeDownloadName`, `SignedImage`, `SignedVideo`, `useSignedSrc`, `isGatedAssetPath`, `toSignablePath`, `signOne`, `signAndDownload`, `captureAnchorClicks`
- **Test case added** (14): `sends the bearer token, the method and the path list`, `normalises an absolute url to its pathname before signing`, `keys the result by the normalised path, not the path passed in`, `never calls the setter when the server refuses the path`, `never calls the setter when the sign request fails outright`, `signOne returns the url, or null when refused`, `signAndDownload clicks an anchor carrying the download attribute`, `signAndDownload clicks nothing when the server refuses the path`, `isGatedAssetPath mirrors the server`, `returns an empty string until the server hands back a url` …
- **Tests:** 1 test file(s) changed: `tests/unit/frontend-signed-file.test.js`

## Why This Change Was Needed

Chat media broke and three gated paths were still fetched unsigned.

## Was It Useful

Useful. Security and functionality.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0804 — Biome-Format the Chat Right Panel.
- **Precedes:** 0806 — Restore a Missing LazyImage Import in the Chat Panel.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
