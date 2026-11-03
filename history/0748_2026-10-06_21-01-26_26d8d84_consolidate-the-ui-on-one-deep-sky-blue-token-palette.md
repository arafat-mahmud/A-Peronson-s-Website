# Commit 0748 — 26d8d84

| Field | Value |
|-------|-------|
| **Commit Number** | 0748 |
| **Commit Hash** | 26d8d84d6acaf41d3693f341451ee18dd9a70073 |
| **Parent Hash** | 15db15b65cceb12507510d182592d810db95c4c1 |
| **Author** | Tokyi |
| **Date/Time** | 2026-10-06 21:01:26 |
| **Branch** | main |
| **Files Changed** | 196 |
| **Additions** | 22611 |
| **Deletions** | 142 |
| **Net Change** | +22469 |
| **Merge Commit** | No |

## Consolidate the UI on One Deep Sky Blue Token Palette

Makes `blueTheme.css` the canonical palette (Tailwind import, `data-theme`/`data-mode` runtime, boot script), normalises violet/purple islands to sky/cyan, moves loaders to `#0ea5e9`, adds `accentClasses()` and per-page palette CSS files and a token JSON.

Original commit message: “feat(theme): consolidate on single Deep Sky Blue dynamic palette”.

## Files Changed

| File | Type | + | − | Δ |
|------|------|---|---|---|
| `src/theme/theme-tokens.json` | Added | 3383 | 0 | +3383/-0 |
| `src/theme/blueTheme.css` | Added | 986 | 0 | +986/-0 |
| `src/color palettes css/AdminPanel_color_palettes.css` | Added | 377 | 0 | +377/-0 |
| `src/color palettes css/OrgSettings_color_palettes.css` | Added | 311 | 0 | +311/-0 |
| `src/color palettes css/BuyingHouseProfile_color_palettes.css` | Added | 308 | 0 | +308/-0 |
| `src/color palettes css/CallInterface_color_palettes.css` | Added | 302 | 0 | +302/-0 |
| `src/color palettes css/ProductManagement_color_palettes.css` | Added | 299 | 0 | +299/-0 |
| `src/color palettes css/SearchResults_color_palettes.css` | Added | 299 | 0 | +299/-0 |
| `src/color palettes css/BuyerProfile_color_palettes.css` | Added | 289 | 0 | +289/-0 |
| `src/theme/blueTheme.ts` | Added | 287 | 0 | +287/-0 |
| `src/color palettes css/FactoryProfile_color_palettes.css` | Added | 283 | 0 | +283/-0 |
| `src/color palettes css/ContractVault_color_palettes.css` | Added | 276 | 0 | +276/-0 |
| `src/color palettes css/MainFeed_color_palettes.css` | Added | 273 | 0 | +273/-0 |
| `src/color palettes css/OwnerDashboard_color_palettes.css` | Added | 269 | 0 | +269/-0 |
| `src/color palettes css/Pricing_color_palettes.css` | Added | 269 | 0 | +269/-0 |
| `src/color palettes css/AdminGovernance_color_palettes.css` | Added | 266 | 0 | +266/-0 |
| `src/color palettes css/PartnerNetwork_color_palettes.css` | Added | 266 | 0 | +266/-0 |
| `src/color palettes css/TexHub_color_palettes.css` | Added | 263 | 0 | +263/-0 |
| `src/color palettes css/AgentDashboard_color_palettes.css` | Added | 259 | 0 | +259/-0 |
| `src/color palettes css/FeedItemCard_color_palettes.css` | Added | 256 | 0 | +256/-0 |
| `src/color palettes css/MemberManagement_color_palettes.css` | Added | 255 | 0 | +255/-0 |
| `src/color palettes css/index_color_palettes.css` | Added | 255 | 0 | +255/-0 |
| `src/color palettes css/AdminServerSection_color_palettes.css` | Added | 253 | 0 | +253/-0 |
| `src/color palettes css/RatingFeedback_color_palettes.css` | Added | 250 | 0 | +250/-0 |
| `src/color palettes css/BuyerRequestManagement_color_palettes.css` | Added | 247 | 0 | +247/-0 |
| `src/color palettes css/OnboardingPage_color_palettes.css` | Added | 244 | 0 | +244/-0 |
| `src/color palettes css/NotificationsCenter_color_palettes.css` | Added | 242 | 0 | +242/-0 |
| `src/color palettes css/AccessDenied_color_palettes.css` | Added | 240 | 0 | +240/-0 |
| `src/color palettes css/FeedManagement_color_palettes.css` | Added | 240 | 0 | +240/-0 |
| `src/color palettes css/HelpCenter_color_palettes.css` | Added | 240 | 0 | +240/-0 |
| `src/color palettes css/Insights_color_palettes.css` | Added | 240 | 0 | +240/-0 |
| `src/color palettes css/VerificationPage_color_palettes.css` | Added | 235 | 0 | +235/-0 |
| `src/color palettes css/Signup_color_palettes.css` | Added | 234 | 0 | +234/-0 |
| `scripts/theme-audit.py` | Added | 231 | 0 | +231/-0 |
| `src/color palettes css/NavBar_color_palettes.css` | Added | 230 | 0 | +230/-0 |
| `src/color palettes css/About_color_palettes.css` | Added | 229 | 0 | +229/-0 |
| `src/color palettes css/Terms_color_palettes.css` | Added | 229 | 0 | +229/-0 |
| `src/color palettes css/AdminSecuritySection_color_palettes.css` | Added | 228 | 0 | +228/-0 |
| `src/color palettes css/SharedPost_color_palettes.css` | Added | 223 | 0 | +223/-0 |
| `src/color palettes css/ProfilePage_color_palettes.css` | Added | 221 | 0 | +221/-0 |
| … 156 more files | — | 8324 | 142 | (smaller changes) |

### What changed per file

- **`src/theme/theme-tokens.json`** — added styling/theme. +3383/-0 lines.
- **`src/theme/blueTheme.css`** — added styling/theme. +986/-0 lines.
- **`src/color palettes css/AdminPanel_color_palettes.css`** — added styling/theme. +377/-0 lines.
- **`src/color palettes css/OrgSettings_color_palettes.css`** — added styling/theme. +311/-0 lines.
- **`src/color palettes css/BuyingHouseProfile_color_palettes.css`** — added styling/theme. +308/-0 lines.
- **`src/color palettes css/CallInterface_color_palettes.css`** — added styling/theme. +302/-0 lines.
- **`src/color palettes css/ProductManagement_color_palettes.css`** — added styling/theme. +299/-0 lines.
- **`src/color palettes css/SearchResults_color_palettes.css`** — added styling/theme. +299/-0 lines.
- **`src/color palettes css/BuyerProfile_color_palettes.css`** — added styling/theme. +289/-0 lines.
- **`src/theme/blueTheme.ts`** — added styling/theme. +287/-0 lines.
- **`src/color palettes css/FactoryProfile_color_palettes.css`** — added styling/theme. +283/-0 lines.
- **`src/color palettes css/ContractVault_color_palettes.css`** — added styling/theme. +276/-0 lines.

## Detailed Diff Analysis

- **Areas touched:** styling/theme (141 files, +21962/-0), tooling script (1 file, +231/-0), page (40 files, +112/-113), test (1 file, +135/-0), documentation (1 file, +100/-0), component (9 files, +23/-23), frontend library (2 files, +36/-0), other (1 file, +12/-6).
- **Function added** (7): `setThemeName`, `setCanonicalTheme`, `accentClasses`, `splitVariants`, `parseColorClass`, `isBorderSideClass`, `extractGradients`
- **Test case added** (13): `border colors parse with full prefixes, sides excluded`, `colored shadows incl. base utilities`, `non-color utilities sharing a prefix return null`, `multiple independent gradients in one file are all preserved`, `transparent and inherit`, `arbitrary alpha bg-white/[0.03]`, `arbitrary color + opacity incl. variant`, `multi-stop arbitrary gradients are never truncated`, `blueTheme.css defines core + semantic + mode tokens`, `tailwind.css imports the canonical theme and exposes semantic tokens` …
- **Tests:** 1 test file(s) changed: `tests/unit/themeRegression.test.js`

## Why This Change Was Needed

Colours were inconsistent across pages; a token system allows themes (inference).

## Was It Useful

Useful foundation, but very large (196 files) and generated; later the client rejected the bright blue and it was retuned to the logo navy/teal.

## Impact Analysis

Users see changed UI/behaviour on the affected pages; verify in a browser at phone and desktop widths.

## Relationship to Surrounding Commits

- **Follows:** 0747 — Fix Lighthouse Accessibility Findings on the Homepage.
- **Precedes:** 0749 — Generate a 12-Theme Runtime Palette System.

## Confidence Notes

- **Facts** (metadata, file list, line counts, symbols, routes, migrations, dependency changes, line-ending analysis) are extracted directly from git for this commit.
- **Interpretation** (title, summary, motivation, verdict) was written from the diff, the extracted symbols and the commit message; statements marked “inference” are not confirmed by the commit itself.
- Backfilled on 2026-11-03 as part of the history catch-up (commits 0732–0894).

## Optional Technical Details

- Renamed files: none.
- Binary files: none.
- Build output (`dist/`) files: 0.
