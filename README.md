# YouTube Focus Clean

Chrome Extension Manifest V3 MVP by FlegarTech.

## Folder structure

```text
YouTube/
├── content.js
├── checkout/
│   ├── .env.example
│   ├── .gitignore
│   ├── capture-order.php
│   ├── checkout.css
│   ├── config.php
│   ├── create-order.php
│   ├── index.php
│   ├── paypal.php
│   ├── start-sandbox-server.cmd
│   └── stop-sandbox-server.cmd
├── manifest.json
├── popup.css
├── popup.html
├── popup.js
├── README.md
└── styles.css
```

## What it does

- Hides the YouTube homepage feed and shows a focus message instead.
- Expands the home replacement into a full-height focus surface that follows the user's system light or dark mode automatically.
- Hides Shorts shelves and Shorts entry points where YouTube's DOM allows it.
- Hides comments on watch pages.
- Hides related videos in the right sidebar.
- Stores settings with `chrome.storage.local`.
- Reacts to both YouTube SPA route changes and dynamic DOM updates.

## Installation

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select this project folder.
5. Pin the extension if you want quick popup access.

## Checkout setup

This project now includes a real PayPal checkout starter in `checkout/`.

1. Copy `checkout\.env.example` to `checkout\.env`
2. Put your PayPal credentials and checkout base URL into `checkout\.env`
3. For local sandbox testing, set `CHECKOUT_BASE_URL=http://127.0.0.1:8080/checkout`
4. Update `checkout\start-sandbox-server.cmd` if your PHP executable is not at `C:\xampp\php\php.exe`
5. Start the local PHP server with `checkout\start-sandbox-server.cmd`
6. Open `http://127.0.0.1:8080/checkout/` to test the page directly
7. Open the extension popup and click `Open Checkout`
8. After payment, return to the popup and click `I've Paid - Unlock Here`

Important:

- The checkout uses PayPal Orders v2 with server-side create and capture.
- Secrets now belong in `checkout\.env`, not in code.
- `checkout\.env` is ignored by git.
- If you need to free the port, run `checkout\stop-sandbox-server.cmd`

## Going live later

When you're ready for live payments:

1. Host the `checkout/` app on a real PHP server and domain
2. Set `CHECKOUT_BASE_URL` in `checkout\.env` to your public checkout URL
3. Set `PAYPAL_ENVIRONMENT=live` and add live PayPal credentials to `checkout\.env`
4. Update `preferredCheckoutUrl` in `popup.js` to your public checkout page URL
5. Reload the extension

Example public checkout URL:

- `https://pay.yourdomain.com/checkout/`
- `https://yourdomain.com/checkout/`

## Testing checklist

1. Open `https://www.youtube.com/` and confirm the home feed is replaced by the focus card.
2. Open the extension popup and toggle each option on and off.
3. Confirm changes apply immediately without reloading the tab.
4. Open a regular watch page and confirm comments can be hidden and shown again.
5. Confirm the right-side related videos can be hidden and shown again.
6. Search for Shorts or navigate around the homepage and sidebar to verify Shorts entries are removed where possible.
7. Move between pages inside YouTube without a full reload and verify behavior persists.

## Fragile selector notes

YouTube changes its DOM often, so these selectors are the most likely to need maintenance:

- `ytd-browse[page-subtype="home"]` for home feed detection
- `ytd-rich-grid-renderer` and `ytd-rich-section-renderer` for the homepage recommendation feed
- `ytd-rich-shelf-renderer[is-shorts]`, `ytd-reel-shelf-renderer`, and `/shorts` links for Shorts detection
- `#secondary` and `ytd-watch-next-secondary-results-renderer` for related videos
- `ytd-comments` and `#comments` for the comment section

Fallback strategy:

- Root feature classes are applied at the document level so static CSS can keep hiding stable surfaces.
- A `MutationObserver` re-runs the logic when YouTube injects new content.
- YouTube navigation events and a lightweight URL watcher re-apply behavior during SPA page changes.
- Shorts hiding also uses link-based DOM traversal so it can hide nearby containers even when shelf markup shifts.

## Known MVP limitations

- Some Shorts links may reappear briefly before YouTube finishes rendering and the observer runs again.
- YouTube experiments can rename or restructure components, which may require selector updates.
- The extension targets the main YouTube web app and has not been tuned for every regional or experimental layout.

## V2 roadmap

- Add an allowlist for channels, pages, or specific YouTube sections.
- Add a timed focus mode with scheduled on and off hours.
- Add optional hiding for notifications, explore, and trending surfaces.
- Add backup and sync import/export for settings.
- Add visual profile presets such as Deep Work or Minimal Watch.
