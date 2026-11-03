# Commit 0850 — 376ffcd

| Field | Value |
|-------|-------|
| **Commit Number** | 0850 |
| **Commit Hash** | 376ffcd2308cd8542d27b1ff8d9e659caafd0660 |
| **Parent Hash** | 9f14f9378ef5b36118d8c8d017dc163462706477 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 02:37:23 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 1444 |
| **Deletions** | 480 |
| **Net Change** | +964 |
| **Merge Commit** | No |

## Turn the Support Page into a Chat-First Investigation Flow

Replaces the support form with a message list and composer on the case API.

Original commit message: “feat(support): make the support page a chat-first investigation flow”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/SupportReports.jsx` | Modified | 1444 | 480 | +1444/-480 |

### What changed per file

- **`src/pages/SupportReports.jsx`** — modified page. function added: `decodeStoredText`; function added: `fileNameOf`; function added: `isImageAttachment`; function added: `safeExternalUrl`; function added: `getPriorityColor`; function added: `SignedAttachmentPreview` ….

## Detailed Diff Analysis

- **Areas touched:** page (1 file, +1444/-480).
- **Function added** (25): `decodeStoredText`, `fileNameOf`, `isImageAttachment`, `safeExternalUrl`, `getPriorityColor`, `SignedAttachmentPreview`, `progressIcon`, `MessageBubble`, `TranscriptPanel`, `InvestigationProgressPanel` …
- **Function removed** (1): `submitReport`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Client-facing part of the portal.

## Was It Useful

Useful. Large UI rewrite of one page.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0849 — Test the Report Renderer and Delivery Outcome.
- **Precedes:** 0851 — Add the Admin Support Case Console.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
