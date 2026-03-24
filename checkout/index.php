<?php

declare(strict_types=1);

require __DIR__ . '/paypal.php';

$clientId = paypalClientId();
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
    ? 'Free keeps the homepage feed and Shorts clean. Premium monthly also unlocks comments, sidebar cleanup, and full Monk Mode. This MVP uses a quick PayPal payment plus browser activation inside the extension.'
    : 'Real PayPal checkout. Test the payment flow here first, then swap the credentials to live.';
$productName = $isPremiumMode ? 'YouTube Focus Clean Premium' : $itemName;
$productCopy = $isPremiumMode
    ? 'Suggested monthly support amount. After checkout, return to the extension and click "I\'ve Paid - Unlock Here".'
    : 'One-time payment with no shipping required.';
$modePill = $isPremiumMode ? 'Premium monthly' : 'Support';
$environment = paypalEnvironment();
$environmentClass = $environment === 'live' ? 'pill-live' : 'pill-sandbox';
$environmentLabel = ucfirst($environment);
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FlegarTech Checkout</title>
    <link rel="stylesheet" href="checkout.css" />
    <script
      src="https://www.paypal.com/sdk/js?client-id=<?= htmlspecialchars($clientId, ENT_QUOTES) ?>&currency=<?= htmlspecialchars($currency, ENT_QUOTES) ?>&intent=capture&components=buttons"
      data-sdk-integration-source="button-factory"
    ></script>
  </head>
  <body>
    <main class="shell">
      <section class="hero-card">
        <p class="eyebrow">FlegarTech Checkout</p>
        <h1><?= htmlspecialchars($heroTitle, ENT_QUOTES) ?></h1>
        <p class="hero-copy">
          <?= htmlspecialchars($heroCopy, ENT_QUOTES) ?>
        </p>
      </section>

      <section class="checkout-card">
        <div class="product-row">
          <div>
            <p class="section-label">Product</p>
            <h2><?= htmlspecialchars($productName, ENT_QUOTES) ?></h2>
            <p class="section-copy"><?= htmlspecialchars($productCopy, ENT_QUOTES) ?></p>
          </div>
          <div class="product-pills">
            <span class="pill pill-mode"><?= htmlspecialchars($modePill, ENT_QUOTES) ?></span>
            <span class="pill <?= htmlspecialchars($environmentClass, ENT_QUOTES) ?>">
              <?= htmlspecialchars($environmentLabel, ENT_QUOTES) ?>
            </span>
          </div>
        </div>

        <div class="amount-panel">
          <p class="section-label">Choose amount</p>
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
            <div class="amount-input-wrap">
              <span class="currency"><?= htmlspecialchars($currency, ENT_QUOTES) ?></span>
              <input
                id="amount-input"
                type="number"
                min="1"
                max="1000"
                step="0.01"
                value="<?= htmlspecialchars($defaultAmount, ENT_QUOTES) ?>"
              />
            </div>
          </label>
        </div>

        <?php if ($isPremiumMode): ?>
          <div class="note-panel">
            Premium access is still activated in the extension for this MVP, so after payment
            go back and click <strong>I've Paid - Unlock Here</strong>.
          </div>
        <?php endif; ?>

        <div id="status-banner" class="status-banner" hidden></div>
        <div id="paypal-button-container" class="paypal-button-shell"></div>
      </section>
    </main>

    <script>
      const checkoutConfig = {
        currency: "<?= htmlspecialchars($currency, ENT_QUOTES) ?>",
        defaultAmount: "<?= htmlspecialchars($defaultAmount, ENT_QUOTES) ?>"
      };

      const amountInput = document.getElementById("amount-input");
      const presetButtons = Array.from(document.querySelectorAll("[data-amount]"));
      const statusBanner = document.getElementById("status-banner");

      presetButtons.forEach((button) => {
        button.addEventListener("click", () => {
          amountInput.value = button.dataset.amount;
          syncActivePreset(button.dataset.amount);
        });
      });

      amountInput.addEventListener("input", () => {
        syncActivePreset(amountInput.value);
      });

      paypal.Buttons({
        style: {
          shape: "pill",
          color: "blue",
          layout: "vertical",
          label: "paypal"
        },
        createOrder: async () => {
          clearStatus();

          const response = await fetch("create-order.php", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              amount: amountInput.value,
              currency: checkoutConfig.currency
            })
          });

          const data = await response.json();

          if (!response.ok || !data.id) {
            throw new Error(data.error || "Could not create PayPal order.");
          }

          return data.id;
        },
        onApprove: async (data) => {
          clearStatus();

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

          showStatus(
            "Payment captured: " +
              capture.amount +
              " " +
              capture.currency +
              (capture.payer ? " for " + capture.payer : "") +
              ".",
            false
          );
        },
        onError: (error) => {
          showStatus(error.message || "Something went wrong with PayPal checkout.", true);
        },
        onCancel: () => {
          showStatus("Checkout was cancelled.", true);
        }
      }).render("#paypal-button-container");

      syncActivePreset(checkoutConfig.defaultAmount);

      function syncActivePreset(currentAmount) {
        const normalized = Number.parseFloat(currentAmount || "0").toFixed(2);

        presetButtons.forEach((button) => {
          button.classList.toggle("is-active", button.dataset.amount === normalized);
        });
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
    </script>
  </body>
</html>
