# Store Listing Template

## Name

RealDeal - Fake Sale Detector

## Short Description

Spot fake discounts, inflated prices, and misleading urgency on product pages.

## Detailed Description

RealDeal helps you understand whether a sale is actually a good deal.

On supported product pages, RealDeal:

- tracks price history locally on your device
- calculates a trust score for the current deal
- flags common retailer tricks like fake "was" prices, inflated anchors, urgency messaging, and pre-sale price spikes
- shows a clean in-page side panel with price history and verdicts
- lets you save target prices and get notified when they are reached

RealDeal keeps your data local. No analytics, no external price-history service, and no hidden tracking.

## Category Suggestions

- Shopping
- Productivity

## Permission Justification

- `storage`: saves price history, settings, targets, and recent product state locally
- `activeTab`: reads the current product page when the user opens the popup
- `scripting`: supports extension interaction with the active page
- `alarms`: prunes old history based on retention settings
- `notifications`: sends target-price-hit notifications

## Suggested Screenshot Captions

1. Popup trust score with price reality metrics
2. In-page analysis panel with price history chart
3. Settings dashboard with retention, exports, and privacy controls
4. Target notification and recent-product workflow
