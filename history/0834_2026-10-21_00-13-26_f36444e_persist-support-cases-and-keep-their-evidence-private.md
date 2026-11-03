# Commit 0834 — f36444e

| Field | Value |
|-------|-------|
| **Commit Number** | 0834 |
| **Commit Hash** | f36444ec1a889efd081e3468ddb56e26273c8b79 |
| **Parent Hash** | 69129ec82c0c4748ffba74e214975a0a6c6e7096 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-21 00:13:26 |
| **Branch** | main |
| **Files Changed** | 15 |
| **Additions** | 1326 |
| **Deletions** | 20 |
| **Net Change** | +1306 |
| **Merge Commit** | No |

## Persist Support Cases and Keep Their Evidence Private

Adds SupportCase/Message/Investigation/Attachment models, migration and `caseService`; support evidence becomes private; migration script for old attachments; tests.

Original commit message: “feat(support): case persistence and private evidence storage”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `tests/integration/support-evidence-access.test.js` | Added | 313 | 0 | +313/-0 |
| `scripts/db/migrate-support-attachments.mjs` | Added | 274 | 0 | +274/-0 |
| `tests/unit/server-case-service.test.js` | Added | 169 | 0 | +169/-0 |
| `server/services/documentService.js` | Modified | 135 | 5 | +135/-5 |
| `server/services/caseService.js` | Added | 132 | 0 | +132/-0 |
| `prisma/migrations/20261020000000_add_support_investigation_cases/migration.sql` | Added | 105 | 0 | +105/-0 |
| `prisma/schema.prisma` | Modified | 90 | 0 | +90/-0 |
| `tests/unit/server-file-access.test.js` | Modified | 37 | 0 | +37/-0 |
| `server/controllers/documentController.js` | Modified | 25 | 8 | +25/-8 |
| `server/services/fileAccessService.js` | Modified | 16 | 3 | +16/-3 |
| `server/services/privateDocumentService.js` | Modified | 13 | 1 | +13/-1 |
| `server/services/uploadsService.js` | Modified | 8 | 1 | +8/-1 |
| `server/utils/signedFileUrl.js` | Modified | 5 | 1 | +5/-1 |
| `tests/unit/server-signed-file-url.test.js` | Modified | 3 | 1 | +3/-1 |
| `package.json` | Modified | 1 | 0 | +1/-0 |

### What changed per file

- **`tests/integration/support-evidence-access.test.js`** — added test. function added: `buildApp`; test case added: `a different user sees an empty collection, not somebody else`; test case added: `the uploader sees their own evidence`; test case added: `an admin sees the full collection`; test case added: `an owner sees the full collection`; test case added: `the legacy support_ticket type is scoped the same way` ….
- **`scripts/db/migrate-support-attachments.mjs`** — added tooling script. function added: `text`; function added: `resolveSource`; function added: `isAlreadyMoved`; function added: `fileExists`; function added: `freeTargetName`; function added: `moveFile` ….
- **`tests/unit/server-case-service.test.js`** — added test. test case added: `opens the case in the collecting state`; test case added: `a case with no subject still opens`; test case added: `refuses to open a case with no owner`; test case added: `the first message of a case is sequence 1`; test case added: `the sequence continues from the last message`; test case added: `allocates the sequence inside a transaction` ….
- **`server/services/documentService.js`** — modified server service. function added: `isSupportEvidenceEntityType`; function added: `supportEvidencePublicPath`; function added: `saveSupportEvidence`; function removed: `listDocuments`; function added: `listDocuments`; function added: `canListSupportEvidence`.
- **`server/services/caseService.js`** — added server service. function added: `text`; function added: `createCase`; function added: `appendCaseMessage`; function added: `getCaseWithMessages`; function added: `listCasesForUser`; function added: `listCasesAdmin` ….
- **`prisma/migrations/20261020000000_add_support_investigation_cases/migration.sql`** — added database migration. table created: `support_cases`; table created: `support_case_messages`; table created: `support_investigations`; table created: `support_case_attachments`.
- **`prisma/schema.prisma`** — modified database schema. Prisma model added: `SupportCase`; Prisma model added: `SupportCaseMessage`; Prisma model added: `SupportInvestigation`; Prisma model added: `SupportCaseAttachment`.
- **`tests/unit/server-file-access.test.js`** — modified test. test case added: `allows the uploader of a support attachment`; test case added: `denies a support attachment to anyone but the uploader`; test case added: `allows an owner over a support attachment`; test case added: `denies a system-owned support attachment to everyone but an admin`.
- **`server/controllers/documentController.js`** — modified API controller. +25/-8 lines.
- **`server/services/fileAccessService.js`** — modified server service. +16/-3 lines.
- **`server/services/privateDocumentService.js`** — modified server service. +13/-1 lines.
- **`server/services/uploadsService.js`** — modified server service. +8/-1 lines.

## Detailed Diff Analysis

- **Areas touched:** test (4 files, +522/-1), server service (5 files, +304/-10), tooling script (1 file, +274/-0), database migration (1 file, +105/-0), database schema (1 file, +90/-0), API controller (1 file, +25/-8), server (1 file, +5/-1), dependencies (1 file, +1/-0).
- **Prisma model added** (4): `SupportCase`, `SupportCaseMessage`, `SupportInvestigation`, `SupportCaseAttachment`
- **Table created** (4): `support_cases`, `support_case_messages`, `support_investigations`, `support_case_attachments`
- **Function added** (23): `text`, `resolveSource`, `isAlreadyMoved`, `fileExists`, `freeTargetName`, `moveFile`, `processRow`, `run`, `createCase`, `appendCaseMessage` …
- **Function removed** (1): `listDocuments`
- **Test case added** (26): `a different user sees an empty collection, not somebody else`, `the uploader sees their own evidence`, `an admin sees the full collection`, `an owner sees the full collection`, `the legacy support_ticket type is scoped the same way`, `a listing with no caller is empty`, `other entity types keep their existing listing behaviour`, `writes the bytes into /uploads/support and anchors them with a row`, `routes the legacy support_ticket type into the gated namespace as well`, `leaves the other document paths where they were` …
- **Tests:** 4 test file(s) changed: `tests/integration/support-evidence-access.test.js`, `tests/unit/server-case-service.test.js`, `tests/unit/server-file-access.test.js`, `tests/unit/server-signed-file-url.test.js`
- **Database:** includes a Prisma migration; it runs on deploy via `prisma migrate deploy`.

## Why This Change Was Needed

Support uploads were stored as public documents.

## Was It Useful

Useful. New feature with a privacy fix.

## Impact Analysis

API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected. Database schema changes on the next deploy; backwards compatibility depends on the migration being additive. Dependency set changes; a fresh install is required.

## Relationship to Surrounding Commits

- **Follows:** 0833 — Require Explicit Deny for Sensitive Reads.
- **Precedes:** 0835 — Check Case Ownership and Cap Clarification Rounds.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
