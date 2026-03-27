# RealDeal — Fake Sale Detector

A Chrome extension (Manifest V3) that helps shoppers determine whether a "sale" price is genuinely a discount or a retailer trick.

## Features

- **Price History Tracking** — automatically logs prices on every visit, stored 100% locally
- **Trust Score (0–100)** — color-coded badge: Green = Legit, Yellow = Questionable, Red = Likely Fake
- **Trick Detection:**
  - Fake "Was" Price — item has been "on sale" for 80%+ of tracked history
  - Inflated Original Price — the "original" price was never actually charged
  - Artificial Urgency — countdown timers, "Only X left!", "Sale ends in…"
  - Pre-Sale Price Spike — price was raised 1–3 weeks before the "sale"
  - Subscription Price Disguise — monthly charge styled as a one-time price
- **Price History Chart** — native canvas chart (no dependencies), 30/60/90 day views
- **Inline Label** — "📉 Lowest tracked: $X" injected near the price on the page
- **Export CSV** — download your full price history
- **Settings** — configure retention period, toggle detections, clear data

## Supported Sites

| Site | Scraper |
|------|---------|
| Amazon (.com, .co.uk, .de, .fr, .es, .it, .ca, .com.au, .nl, .pl, .se) | Dedicated |
| Walmart | Dedicated |
| eBay (.com, .co.uk, .de, .fr, .es, .it) | Dedicated |
| AliExpress | Dedicated |
| Zalando (all EU TLDs + Zalando Lounge) | Dedicated |
| About You (all EU TLDs + about-you.de) | Dedicated |
| Zara | Dedicated |
| H&M | Dedicated |
| Etsy, Target, Best Buy, OTTO, ASOS | Generic fallback |
| Any other e-commerce site | Generic (JSON-LD + CSS heuristics) |

## Installation

### Step 1 — Generate Icons

1. Open `icons/generate-icons.html` in Chrome
2. Click "Download" for each icon (16, 48, 128)
3. Save them as `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`

### Step 2 — Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `RealDeal/` folder

The RealDeal icon will appear in your Chrome toolbar.

### Step 3 — Start Shopping

Navigate to any supported product page. RealDeal will automatically:
- Scrape the current price
- Store it in your local price history
- Display the Trust Score badge (bottom-right corner)
- Inject a "Lowest tracked" label near the price

Click the badge to open the full analysis panel with the price history chart.

## Project Structure

```
RealDeal/
├── manifest.json             — MV3 extension manifest
├── background.js             — Service worker (badge updates, storage pruning)
├── content/
│   ├── utils.js              — Shared utilities (parsing, formatting, DOM helpers)
│   ├── storage.js            — chrome.storage.local wrapper
│   ├── main.js               — Orchestrator (ties everything together)
│   ├── scrapers/
│   │   ├── base.js           — Base scraper class
│   │   ├── amazon.js
│   │   ├── walmart.js
│   │   ├── ebay.js
│   │   ├── aliexpress.js
│   │   ├── zalando.js
│   │   ├── aboutyou.js
│   │   ├── zara.js
│   │   ├── hm.js
│   │   ├── generic.js        — JSON-LD + CSS fallback scraper
│   │   └── index.js          — Scraper registry
│   ├── analyzers/
│   │   ├── trick-detector.js — Detects all 5 pricing tricks
│   │   └── trust-score.js    — Calculates 0–100 trust score
│   └── ui/
│       ├── badge.js          — Floating badge (Shadow DOM)
│       └── sidepanel.js      — Detail panel with canvas chart (Shadow DOM)
├── popup/
│   ├── popup.html / .js / .css — Extension toolbar popup
├── settings/
│   ├── settings.html / .js / .css — Settings & history management page
└── icons/
    ├── generate-icons.html   — Open in browser to generate PNG icons
    ├── icon16.png            — (generate using generate-icons.html)
    ├── icon48.png
    └── icon128.png
```

## Adding a New Scraper

1. Create `content/scrapers/mysite.js` extending `RealDeal.ScraperBase`:

```javascript
/* global RealDeal */
RealDeal.ScraperMySite = (function () {
  class MySiteScraper extends RealDeal.ScraperBase {
    constructor() { super('mysite'); }

    canHandle() {
      return /mysite\.com/i.test(location.hostname);
    }

    scrape() {
      const name          = this._text(['h1.product-title']);
      const currentPrice  = this._price(['.price-current']);
      const originalPrice = this._price(['del.price-was']);
      if (!name || currentPrice == null) return null;

      return this._build({
        name, currentPrice, originalPrice,
        currency: this._currency(this._text(['.price-current']) || '')
      });
    }
  }
  return new MySiteScraper();
})();
```

2. Add the file to the `js` array in `manifest.json` (before `index.js`)
3. Register it in `content/scrapers/index.js` (before `ScraperGeneric`)
4. Add the hostname patterns to `host_permissions` and `content_scripts.matches` in `manifest.json`

## Privacy

- **Zero telemetry** — no analytics, no crash reports, no external requests
- **Local only** — all price data lives in `chrome.storage.local` on your device
- **You control the data** — clear history anytime from Settings

## Tech Stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript (no framework, no bundler required)
- Native Canvas API for charts (no Chart.js dependency)
- Shadow DOM for UI isolation
- `chrome.storage.local` for persistence
