# Commit 0733 — 285a654

| Field | Value |
|-------|-------|
| **Commit Number** | 0733 |
| **Commit Hash** | 285a6545e07ef93dd859197c79eec6a42051f8e4 |
| **Parent Hash** | 83a8a9a38d1724a1d50bc72863f9f7004f1a2b6c |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-03 18:01:58 |
| **Branch** | main |
| **Files Changed** | 130 |
| **Additions** | 8858 |
| **Deletions** | 190 |
| **Net Change** | +8668 |
| **Merge Commit** | No |

## Apply Buyer Final Directives to Settings, Owner Console and Boosts

Implements a batch of client directives: standalone Settings is trimmed to profile/theme/security/notifications/verification; Automation, Assistant and Branding panels move into the Owner Dashboard; Subscription becomes 'Subscription and Billing'; the Boosts tab is replaced by a per-post Boost button and a `/boosts/:id` details page; profile pages are unified and the chatbot gets a guard. The commit also carries a large batch of history files and a new `CODEBASE.md`.

Original commit message: “feat: buyer final directives - settings trim, owner console panels, boosts page, profile unification, chatbot guard, homepage links, help search fix”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/pages/OrgSettings.jsx` | Modified | 126 | 102 | +126/-102 |
| `history/0646_2026-08-09_01-53-24_d7959c8_neon-observe-tui-full-implementation-and-infrastructure.md` | Added | 213 | 0 | +213/-0 |
| `history/0647_2026-08-29_18-58-43_7eef21b_ink-tui-implementation-and-real-data-wiring.md` | Added | 190 | 0 | +190/-0 |
| `history/0672_2026-09-12_12-16-33_8ba7f32_performance-health-endpoint-preload-prefetch.md` | Added | 187 | 0 | +187/-0 |
| `src/pages/BoostDetailsPage.jsx` | Added | 173 | 0 | +173/-0 |
| `CODEBASE.md` | Added | 168 | 0 | +168/-0 |
| `history/0673_2026-09-12_12-45-16_d6f154f_remove-contact-sales-about-page.md` | Added | 158 | 0 | +158/-0 |
| `history/0674_2026-09-12_13-00-50_2fd48f2_hide-search-bar-when-logged-out.md` | Added | 152 | 0 | +152/-0 |
| `docs/plans/2026-10-03-buyer-final-directives.md` | Added | 144 | 0 | +144/-0 |
| `history/0723_2026-09-19_12-28-38_77bdb78_comprehensive-audit-remediation-66-issues.md` | Added | 138 | 0 | +138/-0 |
| `history/0670_2026-09-12_00-21-44_2664fb8_contract-sales-flow-mobile-scroll.md` | Added | 135 | 0 | +135/-0 |
| `history/0729_2026-09-20_13-00-19_711bb27_add-subscription-cancel-forensic-analysis.md` | Added | 129 | 0 | +129/-0 |
| `history/0648_2026-08-31_00-06-47_77db487_ink-tui-visible-calculation-fix-and-dist-rebuild.md` | Added | 123 | 0 | +123/-0 |
| `history/0730_2026-09-20_13-17-00_d05425f_fix-lc-type-video-embed-chatbot-faq.md` | Added | 119 | 0 | +119/-0 |
| `history/0652_2026-08-31_22-10-10_b58826d_theme-provider-returns-resolved-theme-for-page-sync.md` | Added | 112 | 0 | +112/-0 |
| `history/0731_2026-09-20_13-18-04_83a8a9a_update-forensic-audit-report-all-fixes.md` | Added | 112 | 0 | +112/-0 |
| `history/0682_2026-09-12_19-08-22_55ee_feat-migrate-all-47-images-to-lazyimage-seo-cls.md` | Added | 111 | 0 | +111/-0 |
| `history/0728_2026-09-20_12-32-36_b8e94bc_remove-dead-code-fix-navdropdown-transparency.md` | Added | 109 | 0 | +109/-0 |
| `history/0654_2026-08-31_22-32-12_6323be3_member-management-infinite-loop-fix.md` | Added | 106 | 0 | +106/-0 |
| `history/0653_2026-08-31_22-18-13_60273a3_orgsettings-theme-picker-uses-thememode-for-button-highlighting.md` | Added | 105 | 0 | +105/-0 |
| `history/index.md` | Modified | 100 | 5 | +100/-5 |
| `history/0671_2026-09-12_00-33-01_4729564_verified-documents-table-mobile-layout.md` | Added | 104 | 0 | +104/-0 |
| `history/0698_2026-09-14_21-16-55_c68577f_allow-ai-crawlers-on-public-pages.md` | Added | 104 | 0 | +104/-0 |
| `history/0697_2026-09-14_20-45-14_947f989_reduce-initial-js-bundle-76-percent.md` | Added | 101 | 0 | +101/-0 |
| `history/0649_2026-08-31_21-42-03_0872f28_fix-login-page-oversized-icons-and-compact-padding.md` | Added | 99 | 0 | +99/-0 |
| `history/0704_2026-09-16_19-51-42_2b082a9_add-filter-panel-with-click-outside-close.md` | Added | 99 | 0 | +99/-0 |
| `history/0663_2026-09-11_17-58-34_c38f6da_cleanup-signup-fields-error-position-fonts.md` | Added | 97 | 0 | +97/-0 |
| `history/0656_2026-09-02_21-46-13_e60ca22_cleanup-remove-88-temp-analysis-files.md` | Added | 95 | 0 | +95/-0 |
| `history/0661_2026-09-11_17-19-34_e772eb6_enable-content-mode-toggle.md` | Added | 94 | 0 | +94/-0 |
| `history/0681_2026-09-12_18-50-51_872b_feat-advanced-seo-structured-data-faqpage-schema-noindex-protected-404.md` | Added | 94 | 0 | +94/-0 |
| `history/0710_2026-09-16_22-45-29_6d0e742_feat-public-shared-post-pages.md` | Added | 94 | 0 | +94/-0 |
| `history/0658_2026-09-11_16-08-09_6c95387_fix-export-data-fields-add-whatsapp-archives.md` | Added | 91 | 0 | +91/-0 |
| `history/0650_2026-08-31_21-47-53_4f599c6_icon-component-dual-prop-support-for-svg-sizing.md` | Added | 89 | 0 | +89/-0 |
| `history/0655_2026-09-01_23-23-06_a83971c_cleanup-remove-15-unused-files.md` | Added | 89 | 0 | +89/-0 |
| `history/0724_2026-09-19_15-47-55_2aa9c3a_update-audit-statuses-to-implemented.md` | Added | 87 | 0 | +87/-0 |
| `history/0664_2026-09-11_18-26-32_19625e8_allow-horizontal-scroll-helpcenter-mobile.md` | Added | 86 | 0 | +86/-0 |
| `history/0727_2026-09-19_20-14-54_21cc9d6_fix-tdz-crash-move-getcurrentuser-before-memo.md` | Added | 86 | 0 | +86/-0 |
| `history/0703_2026-09-16_19-11-34_c8746ba_add-other-category-option-in-onboarding.md` | Added | 85 | 0 | +85/-0 |
| `history/0651_2026-08-31_21-56-17_556c04b_add-missing-requirement-price-columns-migration.md` | Added | 84 | 0 | +84/-0 |
| `history/0667_2026-09-11_19-26-24_fa74d1b_privacy-policy-ai-removal-language-rewrite.md` | Added | 84 | 0 | +84/-0 |
| … 90 more files | — | 4186 | 83 | (smaller changes) |

### What changed per file

- **`src/pages/OrgSettings.jsx`** — modified page. function removed: `OrgSettings`; function added: `OrgSettings`.
- **`history/0646_2026-08-09_01-53-24_d7959c8_neon-observe-tui-full-implementation-and-infrastructure.md`** — added history log. +213/-0 lines.
- **`history/0647_2026-08-29_18-58-43_7eef21b_ink-tui-implementation-and-real-data-wiring.md`** — added history log. +190/-0 lines.
- **`history/0672_2026-09-12_12-16-33_8ba7f32_performance-health-endpoint-preload-prefetch.md`** — added history log. +187/-0 lines.
- **`src/pages/BoostDetailsPage.jsx`** — added page. function added: `BoostDetailsPage`.
- **`CODEBASE.md`** — added documentation. +168/-0 lines.
- **`history/0673_2026-09-12_12-45-16_d6f154f_remove-contact-sales-about-page.md`** — added history log. +158/-0 lines.
- **`history/0674_2026-09-12_13-00-50_2fd48f2_hide-search-bar-when-logged-out.md`** — added history log. +152/-0 lines.
- **`docs/plans/2026-10-03-buyer-final-directives.md`** — added documentation. +144/-0 lines.
- **`history/0723_2026-09-19_12-28-38_77bdb78_comprehensive-audit-remediation-66-issues.md`** — added history log. +138/-0 lines.
- **`history/0670_2026-09-12_00-21-44_2664fb8_contract-sales-flow-mobile-scroll.md`** — added history log. +135/-0 lines.
- **`history/0729_2026-09-20_13-00-19_711bb27_add-subscription-cancel-forensic-analysis.md`** — added history log. +129/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** history log (91 files, +7791/-52), page (9 files, +442/-121), documentation (25 files, +554/-0), component (3 files, +48/-14), API route (1 file, +14/-3), other (1 file, +9/-0).
- **Route removed** (2): `GET /settings`, `POST /settings`
- **Function added** (3): `BoostDetailsPage`, `handleClickOutside`, `OrgSettings`
- **Function removed** (1): `OrgSettings`
- **Tests:** 0 test file(s) changed — behaviour changes in this commit are not covered by new tests in the same commit.

## Why This Change Was Needed

Client feedback asked that nothing appear in two places and that boosts be reached from the post itself (inferred from the commit body and the later client decision of 26/09).

## Was It Useful

Useful. Implements explicit client decisions; mixing 100+ history/doc files into a feature commit makes the change harder to review.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths. API behaviour changes for the touched endpoints/services; clients relying on old responses may be affected.

## Relationship to Surrounding Commits

- **Follows:** 0732 — Publish History Files for Commits 0640 and 0641.
- **Precedes:** 0734 — Fix CSP-Blocked Font Loader and NavBar Temporal-Dead-Zone Crash.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: `history/new_commits.txt`.
- Build output (`dist/`) files: 0.
