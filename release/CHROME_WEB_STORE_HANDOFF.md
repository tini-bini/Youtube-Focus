# Chrome Web Store Handoff

## Upload Target

- Dashboard: Chrome Web Store Developer Dashboard
- Artifact: `dist/realdeal-chrome-extension-v1.2.0.zip`
- Extension version: `1.2.0`

## Included Release Work

- Premium popup and settings UX
- Target price notifications
- Recent-product quick access
- Scraper confidence surfacing
- JSON import/export and CSV export
- Repo-native lint, validation, tests, and packaging scripts

## Manual Inputs Still Required

- Real PayPal.me links in `shared/config.js`
- Store screenshots
- Promo images and small/large tiles
- Final privacy policy URL if you want one listed publicly
- Final store listing text if you want wording different from the template in `release/STORE_LISTING_TEMPLATE.md`

## Upload Steps

1. Run `python scripts/release_validate.py`.
2. Confirm `dist/realdeal-chrome-extension-v1.2.0.zip` exists.
3. Open the Chrome Web Store Developer Dashboard.
4. Upload the zip artifact.
5. Review permissions:
   - `storage`
   - `activeTab`
   - `scripting`
   - `alarms`
   - `notifications`
6. Paste in the store listing copy from `release/STORE_LISTING_TEMPLATE.md`.
7. Upload screenshots and promotional assets.
8. If you configured PayPal.me links, run the final manual payment-link verification checklist below.

## Final Manual PayPal Verification

Only needed after real PayPal.me links are added.

1. Replace the empty `baseUrl` values in `shared/config.js`.
2. Reload the unpacked extension in Chrome.
3. Open the popup and settings page.
4. Verify support buttons become enabled.
5. Click each support action and confirm:
   - the generated URL uses `https://paypal.me/<handle>/<amount>`
   - the expected amount is prefilled
   - the link opens in a new tab
   - the same behavior works on a narrow/mobile-sized viewport
6. Rerun `python scripts/release_validate.py`.

## Rollback Plan

If the uploaded build behaves unexpectedly:

1. Revert to the previous tagged or committed version.
2. Repackage with `python scripts/package_release.py`.
3. Re-upload the older zip.
