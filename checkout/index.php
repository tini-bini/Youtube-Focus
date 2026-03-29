<?php

declare(strict_types=1);

require __DIR__ . '/paypal.php';

$checkoutError = null;
$clientId = '';

try {
    $clientId = paypalClientId();
} catch (Throwable $exception) {
    $checkoutError = $exception->getMessage();
}

$currency = paypalCurrency();
$itemName = paypalItemName();
$mode = isset($_GET['mode']) && $_GET['mode'] === 'premium' ? 'premium' : 'support';
$isPremiumMode = $mode === 'premium';
$requestedAmount = trim((string) ($_GET['amount'] ?? ''));

if (preg_match('/^\d+(\.\d{1,2})?$/', $requestedAmount) === 1) {
    $defaultAmount = number_format((float) $requestedAmount, 2, '.', '');
} else {
    $defaultAmount = $isPremiumMode ? '4.99' : '5.00';
}

$presetAmounts = $isPremiumMode
    ? ['4.99', '7.99', '12.99']
    : ['5.00', '10.00', '20.00'];

$heroTitle = $isPremiumMode ? 'Unlock premium monthly' : 'Support YouTube Focus Clean';
$heroCopy = $isPremiumMode
    ? 'Free already cleans up the homepage feed and Shorts. Premium adds comments, sidebar cleanup, and a quieter Deep Work profile across watch pages too.'
    : 'Support the project with a clean PayPal checkout that matches the extension experience.';
$productName = $isPremiumMode ? 'YouTube Focus Clean Premium' : $itemName;
$productCopy = $isPremiumMode
    ? 'Suggested monthly support amount. After payment, return to the extension and click "I\'ve Paid - Unlock Here".'
    : 'One-time payment with no shipping or account creation required.';
$modePill = $isPremiumMode ? 'Premium monthly' : 'Support';
$environment = paypalEnvironment();
$environmentClass = $environment === 'live' ? 'pill-live' : 'pill-sandbox';
$environmentLabel = ucfirst($environment);
$summaryLines = $isPremiumMode
    ? [
        'Homepage feed shield',
        'Shorts cleanup',
        'Comments shield',
        'Sidebar recommendation shield',
        'Deep Work profile and browser unlock flow',
    ]
    : [
        'Keeps the extension maintained and improving',
        'Funds selector updates when YouTube changes',
        'Supports premium-quality UX polish and new workflows',
    ];
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FlegarTech Checkout</title>
    <link rel="stylesheet" href="checkout.css" />
    <?php if ($checkoutError === null): ?>
      <script
        src="https://www.paypal.com/sdk/js?client-id=<?= htmlspecialchars($clientId, ENT_QUOTES) ?>&currency=<?= htmlspecialchars($currency, ENT_QUOTES) ?>&intent=capture&components=buttons"
        data-sdk-integration-source="button-factory"
      ></script>
    <?php endif; ?>
  </head>
  <body>
    <main class="shell">
      <section class="hero-card">
        <div class="hero-copy-block">
          <p class="eyebrow">FlegarTech Checkout</p>
          <div class="hero-heading-row">
            <h1><?= htmlspecialchars($heroTitle, ENT_QUOTES) ?></h1>
            <div class="hero-pills">
              <span class="pill pill-mode"><?= htmlspecialchars($modePill, ENT_QUOTES) ?></span>
              <span class="pill <?= htmlspecialchars($environmentClass, ENT_QUOTES) ?>">
                <?= htmlspecialchars($environmentLabel, ENT_QUOTES) ?>
              </span>
            </div>
          </div>
          <p class="hero-copy">
            <?= htmlspecialchars($heroCopy, ENT_QUOTES) ?>
          </p>
        </div>

        <div class="hero-stats">
          <article class="mini-stat">
            <span class="mini-stat-value"><?= htmlspecialchars($currency, ENT_QUOTES) . ' ' . htmlspecialchars($defaultAmount, ENT_QUOTES) ?></span>
            <span class="mini-stat-label">Starting amount</span>
          </article>
          <article class="mini-stat">
            <span class="mini-stat-value">Secure</span>
            <span class="mini-stat-label">PayPal capture flow</span>
          </article>
        </div>
      </section>

      <section class="checkout-layout">
        <section class="checkout-card" id="checkout-card">
          <div class="product-row">
            <div>
              <p class="section-label">Payment</p>
              <h2><?= htmlspecialchars($productName, ENT_QUOTES) ?></h2>
              <p class="section-copy"><?= htmlspecialchars($productCopy, ENT_QUOTES) ?></p>
            </div>
          </div>

          <div class="amount-panel">
            <div class="amount-header">
              <div>
                <p class="section-label">Choose amount</p>
                <p class="section-copy amount-copy">Use a preset or enter a custom amount below.</p>
              </div>
              <div class="amount-preview" id="amount-preview">
                <?= htmlspecialchars($currency, ENT_QUOTES) . ' ' . htmlspecialchars($defaultAmount, ENT_QUOTES) ?>
              </div>
            </div>

            <div class="preset-grid">
              <?php foreach ($presetAmounts as $presetAmount): ?>
                <button
                  class="preset-button<?= $presetAmount === $defaultAmount ? ' is-active' : '' ?>"
                  type="button"
                  data-amount="<?= htmlspecialchars($presetAmount, ENT_QUOTES) ?>"
                >
                  <?= htmlspecialchars($currency, ENT_QUOTES) . ' ' . htmlspecialchars($presetAmount, ENT_QUOTES) ?>
                </button>
              <?php endforeach; ?>
            </div>

            <label class="amount-field" for="amount-input">
              <span>Custom amount</span>
              <div class="amount-input-wrap" id="amount-input-wrap">
                <span class="currency"><?= htmlspecialchars($currency, ENT_QUOTES) ?></span>
                <input
                  id="amount-input"
                  type="number"
                  min="1"
                  max="1000"
                  step="0.01"
                  inputmode="decimal"
                  value="<?= htmlspecialchars($defaultAmount, ENT_QUOTES) ?>"
                />
              </div>
            </label>
          </div>

          <?php if ($isPremiumMode): ?>
            <div class="note-panel">
              Premium access is still activated inside the extension for this version, so after payment
              go back and click <strong>I've Paid - Unlock Here</strong>.
            </div>
          <?php endif; ?>

          <div
            id="status-banner"
            class="status-banner<?= $checkoutError !== null ? ' is-error' : '' ?>"
            <?= $checkoutError !== null ? '' : 'hidden' ?>
          >
            <?= $checkoutError !== null ? htmlspecialchars($checkoutError, ENT_QUOTES) : '' ?>
          </div>
          <div id="paypal-button-container" class="paypal-button-shell"></div>
        </section>

        <aside class="summary-card">
          <p class="section-label">What you're supporting</p>
          <h2>Built to make YouTube feel intentional again.</h2>
          <p class="section-copy">
            <?= htmlspecialchars($isPremiumMode ? 'Premium sharpens the full experience across home and watch pages.' : 'Support keeps the extension fast, polished, and resilient as YouTube changes its UI.', ENT_QUOTES) ?>
          </p>

          <ul class="summary-list">
            <?php foreach ($summaryLines as $summaryLine): ?>
              <li><?= htmlspecialchars($summaryLine, ENT_QUOTES) ?></li>
            <?php endforeach; ?>
          </ul>

          <div class="summary-footer">
            <div>
              <span class="summary-label">Total today</span>
              <strong class="summary-total" id="summary-total">
                <?= htmlspecialchars($currency, ENT_QUOTES) . ' ' . htmlspecialchars($defaultAmount, ENT_QUOTES) ?>
              </strong>
            </div>
            <p class="summary-note">
              PayPal renders securely below. If payment succeeds, you'll see confirmation here immediately.
            </p>
          </div>
        </aside>
      </section>
    </main>

    <script>
      const checkoutConfig = {
        currency: "<?= htmlspecialchars($currency, ENT_QUOTES) ?>",
        defaultAmount: "<?= htmlspecialchars($defaultAmount, ENT_QUOTES) ?>",
        isPremiumMode: <?= $isPremiumMode ? 'true' : 'false' ?>,
        isReady: <?= $checkoutError === null ? 'true' : 'false' ?>
      };

      const amountInput = document.getElementById("amount-input");
      const amountInputWrap = document.getElementById("amount-input-wrap");
      const amountPreview = document.getElementById("amount-preview");
      const summaryTotal = document.getElementById("summary-total");
      const presetButtons = Array.from(document.querySelectorAll("[data-amount]"));
      const statusBanner = document.getElementById("status-banner");
      const checkoutCard = document.getElementById("checkout-card");

      presetButtons.forEach((button) => {
        button.addEventListener("click", () => {
          if (checkoutCard.dataset.busy === "true") {
            return;
          }

          amountInput.value = button.dataset.amount;
          syncAmountUi();
        });
      });

      amountInput.addEventListener("input", () => {
        syncAmountUi();
      });

      if (checkoutConfig.isReady && window.paypal && typeof window.paypal.Buttons === "function") {
        paypal.Buttons({
          style: {
            shape: "pill",
            color: "gold",
            layout: "vertical",
            label: "paypal"
          },
          createOrder: async () => {
            clearStatus();
            const normalizedAmount = getNormalizedAmount();

            if (!normalizedAmount) {
              throw new Error("Enter an amount between 1.00 and 1000.00.");
            }

            setBusy(true);
            showStatus("Creating secure PayPal checkout...", false);

            try {
              const response = await fetch("create-order.php", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  amount: normalizedAmount,
                  currency: checkoutConfig.currency
                })
              });

              const data = await response.json();

              if (!response.ok || !data.id) {
                throw new Error(data.error || "Could not create PayPal order.");
              }

              clearStatus();
              return data.id;
            } finally {
              setBusy(false);
            }
          },
          onApprove: async (data) => {
            clearStatus();
            setBusy(true);
            showStatus("Capturing payment...", false);

            try {
              const response = await fetch("capture-order.php", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  orderID: data.orderID
                })
              });

              const capture = await response.json();

              if (!response.ok) {
                throw new Error(capture.error || "Could not capture PayPal order.");
              }

              const nextStep = checkoutConfig.isPremiumMode
                ? ' Return to the extension and click "I\'ve Paid - Unlock Here".'
                : "";

              showStatus(
                "Payment captured: " +
                  capture.amount +
                  " " +
                  capture.currency +
                  (capture.payer ? " for " + capture.payer : "") +
                  "." +
                  nextStep,
                false
              );
            } finally {
              setBusy(false);
            }
          },
          onError: (error) => {
            setBusy(false);
            showStatus(error.message || "Something went wrong with PayPal checkout.", true);
          },
          onCancel: () => {
            setBusy(false);
            showStatus("Checkout was cancelled.", true);
          }
        }).render("#paypal-button-container");
      } else if (checkoutConfig.isReady) {
        showStatus("PayPal SDK did not load. Refresh and try again.", true);
      }

      syncAmountUi();

      function syncAmountUi() {
        const normalizedAmount = getNormalizedAmount(false);

        presetButtons.forEach((button) => {
          button.classList.toggle("is-active", normalizedAmount !== null && button.dataset.amount === normalizedAmount);
        });

        const previewAmount = normalizedAmount || checkoutConfig.defaultAmount;
        const text = checkoutConfig.currency + " " + previewAmount;

        amountPreview.textContent = text;
        summaryTotal.textContent = text;
        amountInputWrap.classList.toggle("is-invalid", normalizedAmount === null);
      }

      function getNormalizedAmount(showValidation = true) {
        const numericValue = Number.parseFloat((amountInput.value || "").trim());
        const isValid = Number.isFinite(numericValue) && numericValue >= 1 && numericValue <= 1000;

        if (!isValid) {
          if (showValidation) {
            showStatus("Enter an amount between 1.00 and 1000.00.", true);
          }

          return null;
        }

        return numericValue.toFixed(2);
      }

      function showStatus(message, isError) {
        statusBanner.hidden = false;
        statusBanner.textContent = message;
        statusBanner.classList.toggle("is-error", Boolean(isError));
        statusBanner.classList.toggle("is-success", !isError);
      }

      function clearStatus() {
        statusBanner.hidden = true;
        statusBanner.textContent = "";
        statusBanner.classList.remove("is-error", "is-success");
      }

      function setBusy(isBusy) {
        checkoutCard.dataset.busy = isBusy ? "true" : "false";
        amountInput.disabled = isBusy;
        presetButtons.forEach((button) => {
          button.disabled = isBusy;
        });
      }
    </script>
  </body>
</html>
