# Chrome Web Store Handoff

## Upload artifact

- Build the release package with `npm run build`
- Upload `dist/youtube-focus-clean-v1.2.0.zip` in the Chrome Web Store developer dashboard

## Pre-upload checks

- Confirm the extension version in `manifest.json`
- Reload the unpacked extension locally and smoke-test popup, home feed shielding, watch page shielding, allowlist, schedule, snooze, and shortcuts
- If you use the hosted PayPal checkout, ensure `shared.js` points `preferredCheckoutUrl` at your public `checkout/` deployment
- If you use PayPal.Me fallback, confirm the `premiumPayPalMeBaseUrl`, `premiumAmount`, `premiumCurrency`, and `donationPayPalMeBaseUrl` values are correct
- If you deploy `checkout/`, copy `checkout/.env.example` to `checkout/.env` and add live or sandbox credentials

## Manual dashboard inputs still required

- Chrome Web Store listing text and imagery
- Final category, language, and privacy disclosures
- Public host/domain for `checkout/` if you want the hosted checkout flow instead of direct PayPal.Me fallback
- PayPal live credentials, if you plan to use the hosted `checkout/` flow in production

## Upload checklist

- Upload the new zip
- Review permission footprint: only `storage`
- Verify command shortcuts in the dashboard notes if desired
- Publish or submit for review

## Post-upload smoke test

- Install from the built package or store listing
- Confirm popup loads without console errors
- Confirm `Alt+Shift+S` and `Alt+Shift+M` work
- Confirm premium/support CTAs open the expected URL
- Confirm YouTube home, Shorts, comments, sidebar, Explore, notifications, and topic-chip shields behave correctly
