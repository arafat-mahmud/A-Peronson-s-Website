# Commit 0789 — 752ab06

| Field | Value |
|-------|-------|
| **Commit Number** | 0789 |
| **Commit Hash** | 752ab063f46b9b71ee5ba284e32cfb89b70cfb59 |
| **Parent Hash** | c99350606f6c22cb730ddc21875a3afaa8335722 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-18 23:03:21 |
| **Branch** | main |
| **Files Changed** | 1 |
| **Additions** | 1230 |
| **Deletions** | 0 |
| **Net Change** | +1230 |
| **Merge Commit** | No |

## Plan Signed-URL Access Control for Private Uploads

Seven-task TDD plan: hook repair, HMAC signing core, document-based authorization, signed routes, client signing, email fix, docs.

Original commit message: “docs(plan): upload access control implementation plan”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `docs/plans/2026-10-18-upload-access-control.md` | Added | 1230 | 0 | +1230/-0 |

### What changed per file

- **`docs/plans/2026-10-18-upload-access-control.md`** — added documentation. test case added: `classifies gated and public prefixes`; test case added: `resolves paths inside the uploads root`; test case added: `refuses to escape the uploads root`; test case added: `signs a path into a verifiable url`; test case added: `accepts a freshly minted signature`; test case added: `rejects a tampered user id` ….

## Detailed Diff Analysis

- **Areas touched:** documentation (1 file, +1230/-0).
- **Route added** (2): `POST /sign`, `GET /content`
- **Function added** (16): `uploadsRoot`, `readSecret`, `isGatedPath`, `resolveWithinUploads`, `toPublicPath`, `canonical`, `signFileUrl`, `verifySignedFile`, `isAdminRole`, `idList` …
- **Test case added** (39): `classifies gated and public prefixes`, `resolves paths inside the uploads root`, `refuses to escape the uploads root`, `signs a path into a verifiable url`, `accepts a freshly minted signature`, `rejects a tampered user id`, `rejects a swapped path`, `rejects an expired url`, `rejects a truncated signature without throwing`, `fails closed when the secret is unset` …
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Private files (contracts, chat media) were served from a public static mount.

## Was It Useful

Useful. Planning for a real security gap.

## Impact Analysis

No runtime behaviour change.

## Relationship to Surrounding Commits

- **Follows:** 0788 — Refresh the Codebase Atlas.
- **Precedes:** 0790 — Apply Pre-Flight Rulings to the Upload Plan.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
