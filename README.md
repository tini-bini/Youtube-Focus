# RealDeal - Fake Sale Detector

RealDeal is a production-ready Chrome extension that helps shoppers detect fake discounts, inflated anchor prices, artificial urgency, and misleading sale claims directly on product pages.

## Product Summary

- Product type: Chrome extension (Manifest V3)
- Primary users: online shoppers comparing deals across major retailers
- Main flows:
  1. Open a supported product page and see the trust score badge, inline history hints, and the full analysis side panel.
  2. Save a target price and receive a browser notification when the current price reaches it.
  3. Review recent products, manage retention settings, export history, and import/export JSON backups.

## Core Features

- Dedicated scrapers for Amazon, Walmart, eBay, AliExpress, Zalando, About You, Zara, and H&M
- Generic fallback scraping using JSON-LD, meta tags, microdata, and DOM heuristics
- Trust score with fake-sale analysis and verdicts
- Floating badge plus on-page side panel with price history chart
- Local-only storage using `chrome.storage.local`
- Target price tracking with notification support
- Recent products rail in the popup
- JSON backup and restore plus CSV export
- PayPal.me support flow validation and disabled states when links are not configured

## Architecture

- `shared/`
  Cross-surface configuration, storage keys, formatting helpers, theme helpers, and PayPal.me utilities.
- `content/`
  Product scraping, analysis logic, local storage persistence, and Shadow DOM in-page UI.
- `popup/`
  Fast decision surface with page analysis, quick toggles, targets, recent products, and support actions.
- `settings/`
  Retention controls, exports/imports, privacy messaging, and support-link diagnostics.
- `scripts/`
  Repo-native lint, contract checks, JavaScript syntax compilation, packaging, and release validation.
- `tests/`
  Python-driven unit tests that execute real JavaScript logic through QuickJS.

## Repository Layout

```text
background.js
manifest.json
shared/
content/
popup/
settings/
scripts/
tests/
release/
dist/
```

## Local Setup

1. Install Python 3.12 or newer.
2. Install dev dependencies:

```powershell
python -m pip install -r requirements-dev.txt
```

3. Load the unpacked extension in Chrome:

```text
chrome://extensions -> Developer mode -> Load unpacked -> select this repository root
```

## Development and QA Commands

Lint:

```powershell
python scripts/lint_repo.py
```

Contract/type checks:

```powershell
python scripts/typecheck_repo.py
```

JavaScript syntax compilation:

```powershell
python scripts/check_js_syntax.py
```

Unit tests:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

Full release validation:

```powershell
python scripts/release_validate.py
```

Package the upload artifact:

```powershell
python scripts/package_release.py
```

## Build and Release Output

The release package is created at:

```text
dist/realdeal-chrome-extension-v<version>.zip
```

The package includes only the files required for Chrome Web Store upload.

## PayPal.me Configuration

PayPal support links are configured in:

```text
shared/config.js
```

Current behavior:

- Empty or invalid PayPal.me links are rejected by validation.
- Disabled states are shown in the popup and settings when links are missing.
- Amount-prefilled links are generated in canonical `https://paypal.me/<handle>/<amount>` form.

Before a live release, replace the empty `baseUrl` values in `shared/config.js` with real PayPal.me links and rerun:

```powershell
python scripts/release_validate.py
```

## Environment Variables

This project does not require environment variables for local runtime or packaging.

## Security and Privacy Notes

- No external servers are contacted for price analysis.
- All product history remains in `chrome.storage.local`.
- No credentials, API keys, or secrets are stored in the repository.
- PayPal support links are validated before UI navigation is enabled.

## Release Handoff

Use the materials in `release/` for manual dashboard upload:

- `release/CHROME_WEB_STORE_HANDOFF.md`
- `release/STORE_LISTING_TEMPLATE.md`

## Manual Verification Before Upload

1. Load the unpacked extension in Chrome.
2. Visit at least one supported product page and one unsupported page.
3. Verify:
   - popup loading, no-product, unavailable, and product states
   - side panel opens from the badge and with `Alt+Shift+D`
   - target price save and clear flows
   - recent products populate
   - settings save, reset, export, import, and clear flows
4. If PayPal links are configured, confirm each PayPal CTA opens the expected PayPal.me URL on desktop and mobile-sized layouts.

## Version

- Extension version: `1.2.0`
