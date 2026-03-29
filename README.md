# YouTube Focus Clean

YouTube Focus Clean is a production-ready Chrome extension that turns YouTube into a more intentional workspace by hiding distracting surfaces, automating focus windows, and keeping optional exceptions for the pages or channels you actually want.

## Product summary

- Product type: Chrome extension with an optional hosted PayPal checkout helper in `checkout/`
- Primary users: knowledge workers, students, creators, and anyone who wants a calmer YouTube experience
- Main flows:
  - open YouTube without the algorithmic home feed taking over
  - switch between focus profiles or snooze protection temporarily
  - buy or support through a validated hosted checkout URL or PayPal.Me fallback

## Architecture

- `shared.js`: shared domain and storage logic, input sanitizers, schedule rules, allowlist rules, analytics helpers, and PayPal.Me validation
- `background.js`: MV3 service worker for startup normalization and global shortcuts
- `script.js` + `popup.html` + `styles.css`: premium popup UX and user controls
- `content.js` + `content.css`: YouTube DOM orchestration, homepage replacement, shield enforcement, and lightweight page-level feedback
- `checkout/`: optional PHP PayPal order/capture flow for a hosted payment page
- `scripts/`: release automation and PHP lint helpers
- `tests/`: critical shared-logic regression tests

## Core features

- Hide the homepage feed and replace it with a branded focus surface
- Hide Shorts shelves and entry links
- Hide comments and sidebar recommendations on watch pages
- Hide Explore navigation, notifications, and topic chips
- Apply quick profiles: `Essentials`, `Flow`, and `Deep Work`
- Save a focus intention that appears in both the popup and the homepage replacement
- Snooze all shields for 15 minutes
- Limit shields to a scheduled focus window
- Add allowlist rules for pages or channels you want left untouched
- Export and import settings backups
- Track simple local analytics such as protected views, allowlist hits, and snoozes
- Open premium and support CTAs through validated PayPal.Me links or a hosted checkout URL

## Project structure

```text
YouTube-Focus-master/
|-- assets/
|-- background.js
|-- content.css
|-- content.js
|-- docs/
|   `-- CHROME_WEB_STORE_HANDOFF.md
|-- icons/
|-- checkout/
|   |-- capture-order.php
|   |-- checkout.css
|   |-- config.php
|   |-- create-order.php
|   |-- index.php
|   |-- paypal.php
|   |-- start-sandbox-server.cmd
|   `-- stop-sandbox-server.cmd
|-- manifest.json
|-- popup.html
|-- script.js
|-- shared.js
|-- styles.css
|-- package.json
|-- tsconfig.json
|-- eslint.config.js
|-- tests/
`-- scripts/
```

## Prerequisites

- Node.js 24 or newer
- npm 10 or newer
- PHP 8.3 or newer if you want to use or validate the hosted checkout

## Setup

1. Install dependencies with `npm install`
2. Open Chrome and go to `chrome://extensions`
3. Enable Developer mode
4. Click **Load unpacked**
5. Select this project folder
6. Reload the extension after any manifest change

## Scripts

- `npm run lint`: ESLint for extension, tooling, and tests
- `npm run typecheck`: TypeScript JS checking for shared/runtime logic
- `npm run test`: Vitest regression tests for critical shared logic
- `npm run php:lint`: syntax validation for the hosted checkout PHP files
- `npm run build`: creates a Chrome Web Store upload zip in `dist/`
- `npm run verify`: full release validation pipeline

## Keyboard shortcuts

- `Alt+Shift+S`: snooze or resume shields globally
- `Alt+Shift+M`: enable `Deep Work` globally
- Popup-only shortcuts:
  - `/`: focus the intention field
  - `1` to `7`: toggle the individual shields
  - `M`: enable `Deep Work`
  - `S`: snooze or resume shields

You can review or customize global shortcuts in `chrome://extensions/shortcuts`.

## Allowlist rule examples

- `@yourchannel`
- `/feed/subscriptions`
- `/watch?v=abc123`
- `youtube.com/@yourchannel`

Rules are matched as simple page or URL fragments against the current YouTube URL.

## Payment configuration

The extension supports two payment paths:

1. Hosted checkout: set `preferredCheckoutUrl` in `shared.js` to your deployed `checkout/` URL
2. PayPal.Me fallback: keep `preferredCheckoutUrl` empty and configure the PayPal.Me values in `shared.js`

PayPal.Me links are validated before the popup opens them. Invalid or unsafe links are disabled in the UI.

### Hosted checkout setup

1. Copy `checkout/.env.example` to `checkout/.env`
2. Add your PayPal credentials and public checkout base URL
3. For local sandbox testing, set `CHECKOUT_BASE_URL=http://127.0.0.1:8080/checkout`
4. Start a local server, for example with `php -S 127.0.0.1:8080 -t .`
5. Open `http://127.0.0.1:8080/checkout/`

## Release flow

1. Run `npm run verify`
2. Review `dist/release-metadata.json`
3. Upload `dist/youtube-focus-clean-v1.2.0.zip` to the Chrome Web Store dashboard
4. Follow [CHROME_WEB_STORE_HANDOFF.md](/c:/Users/Uporabnik/Documents/FlegarTech/Youtube-Focus-master/docs/CHROME_WEB_STORE_HANDOFF.md)

## Manual QA checklist

1. Open `https://www.youtube.com/` and confirm the feed is replaced by the focus experience
2. Toggle all seven shields and confirm updates land instantly without a page refresh
3. Test `Essentials`, `Flow`, and `Deep Work`
4. Set a focus intention and confirm it appears on the homepage replacement surface
5. Enable a schedule and verify shields pause outside the active window
6. Add an allowlist rule and confirm matching pages stop being modified
7. Test snooze, export backup, and import backup
8. Trigger the global shortcuts from `chrome://extensions/shortcuts`
9. Verify the premium and support CTAs open the intended payment destination
10. If you use hosted checkout, open `checkout/?mode=premium&amount=10` and verify amount validation and PayPal rendering

## Selector maintenance notes

YouTube changes its DOM often, so these selectors are the most likely to need future maintenance:

- `ytd-browse[page-subtype="home"]` for homepage detection
- `ytd-rich-grid-renderer` and `ytd-rich-section-renderer` for homepage recommendations
- `ytd-rich-shelf-renderer[is-shorts]`, `ytd-reel-shelf-renderer`, and `/shorts` links for Shorts detection
- `#secondary` and `ytd-watch-next-secondary-results-renderer` for related videos
- `ytd-comments` and `#comments` for the comment section
- top-bar notification and guide navigation selectors for extra shields
