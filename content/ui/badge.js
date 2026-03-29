/* global RealDeal */
RealDeal.Badge = (function () {
  "use strict";

  let host = null;
  let shadow = null;
  let badgeEl = null;
  let badgeScoreResult = null;
  let badgeScraped = null;

  const CATEGORY_COLORS = {
    green: {
      bg: "rgba(39, 108, 67, 0.86)",
      fg: "#f7fcf8",
      accent: "#9ce0b0",
      ring: "rgba(117, 177, 131, 0.36)"
    },
    yellow: {
      bg: "rgba(143, 101, 26, 0.9)",
      fg: "#fffaf1",
      accent: "#ffd589",
      ring: "rgba(219, 177, 92, 0.32)"
    },
    red: {
      bg: "rgba(142, 61, 61, 0.9)",
      fg: "#fff7f7",
      accent: "#ffb8b8",
      ring: "rgba(214, 95, 95, 0.32)"
    }
  };

  const INLINE_LABEL_ID = "realdeal-inline-label";

  function inject(scoreResult, scraped) {
    remove();

    host = document.createElement("div");
    host.id = "realdeal-badge-host";
    shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

        #rd-badge {
          --rd-bg: rgba(39, 108, 67, 0.86);
          --rd-fg: #f7fcf8;
          --rd-accent: #9ce0b0;
          --rd-ring: rgba(117, 177, 131, 0.36);
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          max-width: 310px;
          padding: 8px 10px 8px 8px;
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.06)),
            var(--rd-bg);
          color: var(--rd-fg);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow:
            0 18px 38px rgba(15, 23, 42, 0.24),
            0 0 0 1px var(--rd-ring);
          backdrop-filter: blur(16px) saturate(1.2);
          -webkit-backdrop-filter: blur(16px) saturate(1.2);
          cursor: pointer;
          user-select: none;
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
          animation: rd-badge-in 220ms ease both;
        }

        #rd-badge:hover {
          transform: translateY(-2px);
          box-shadow:
            0 22px 44px rgba(15, 23, 42, 0.28),
            0 0 0 1px var(--rd-ring);
        }

        #rd-badge:active {
          transform: translateY(0);
        }

        .rd-score {
          width: 38px;
          height: 38px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.22);
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.04em;
          flex: 0 0 auto;
        }

        .rd-copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .rd-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          opacity: 0.82;
          text-transform: uppercase;
        }

        .rd-title {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rd-meta {
          font-size: 11px;
          color: var(--rd-accent);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        #rd-close {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: inherit;
          cursor: pointer;
          flex: 0 0 auto;
          transition: background 160ms ease, opacity 160ms ease;
        }

        #rd-close:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        #rd-close svg {
          width: 14px;
          height: 14px;
        }

        @keyframes rd-badge-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          #rd-badge {
            animation: none;
            transition: none;
          }
        }
      </style>

      <div id="rd-badge" title="Open the RealDeal analysis panel">
        <div class="rd-score"></div>
        <div class="rd-copy">
          <span class="rd-label">RealDeal</span>
          <span class="rd-title"></span>
          <span class="rd-meta"></span>
        </div>
        <button id="rd-close" type="button" aria-label="Dismiss RealDeal badge">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
          </svg>
        </button>
      </div>
    `;

    badgeEl = shadow.getElementById("rd-badge");
    bindBadgeEvents();
    paint(scoreResult, scraped);
  }

  function bindBadgeEvents() {
    badgeEl.addEventListener("click", (event) => {
      if (event.target.closest("#rd-close")) {
        remove();
        return;
      }

      if (badgeScoreResult && badgeScraped) {
        RealDeal.SidePanel.toggle(badgeScoreResult, badgeScraped);
      }
    });
  }

  function paint(scoreResult, scraped) {
    badgeScoreResult = scoreResult;
    badgeScraped = scraped;
    const colors = CATEGORY_COLORS[scoreResult.category] || CATEGORY_COLORS.yellow;
    badgeEl.style.setProperty("--rd-bg", colors.bg);
    badgeEl.style.setProperty("--rd-fg", colors.fg);
    badgeEl.style.setProperty("--rd-accent", colors.accent);
    badgeEl.style.setProperty("--rd-ring", colors.ring);

    shadow.querySelector(".rd-score").textContent = String(scoreResult.score);
    shadow.querySelector(".rd-title").textContent = scoreResult.verdict || "Pricing signals loaded";
    shadow.querySelector(".rd-meta").textContent = buildBadgeMeta(scoreResult, scraped);
  }

  function update(scoreResult, scraped) {
    if (!badgeEl) {
      inject(scoreResult, scraped);
      return;
    }

    paint(scoreResult, scraped);
  }

  function remove() {
    if (host?.parentNode) {
      host.remove();
    }

    host = null;
    shadow = null;
    badgeEl = null;
    badgeScoreResult = null;
    badgeScraped = null;
    removeInlineLabel();
  }

  function isInjected() {
    return Boolean(host && host.isConnected);
  }

  function syncInlineLabel(scoreResult, scraped) {
    removeInlineLabel();

    if (!scraped || scoreResult.lowestEverPrice == null) {
      return;
    }

    const priceEl = document.querySelector(
      "#priceblock_ourprice, #priceblock_dealprice, .a-price, .product-price, [class*='price--current'], [class*='currentPrice'], [data-testid='pdp-price'], [itemprop='price'], .priceToPay"
    );

    if (!priceEl) {
      return;
    }

    const label = document.createElement("span");
    const currentPrice = scraped.currentPrice;
    const isAtLow = currentPrice != null && currentPrice <= scoreResult.lowestEverPrice * 1.01;
    label.id = INLINE_LABEL_ID;
    label.textContent = isAtLow
      ? `RealDeal low match: ${RealDeal.Utils.formatPrice(scoreResult.lowestEverPrice, scraped.currency)}`
      : `Lowest tracked: ${RealDeal.Utils.formatPrice(scoreResult.lowestEverPrice, scraped.currency)}`;

    Object.assign(label.style, {
      display: "inline-flex",
      alignItems: "center",
      marginTop: "6px",
      padding: "6px 10px",
      borderRadius: "999px",
      border: "1px solid rgba(117, 177, 131, 0.24)",
      background: "rgba(117, 177, 131, 0.08)",
      color: isAtLow ? "#2f7f49" : "#5d6c63",
      fontSize: "12px",
      fontWeight: "600",
      lineHeight: "1.3",
      letterSpacing: "0.01em",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    });

    priceEl.insertAdjacentElement("afterend", label);
  }

  function removeInlineLabel() {
    document.getElementById(INLINE_LABEL_ID)?.remove();
  }

  function buildBadgeMeta(scoreResult, scraped) {
    if (!scraped) {
      return "Open to inspect";
    }

    if (scoreResult.trueDiscountPct != null) {
      return `${scoreResult.trueDiscountPct}% real discount`;
    }

    if (scraped.currentPrice != null) {
      return RealDeal.Utils.formatPrice(scraped.currentPrice, scraped.currency);
    }

    return "Live pricing";
  }

  return {
    inject,
    update,
    remove,
    isInjected,
    syncInlineLabel,
    removeInlineLabel,
    _settings: null
  };
})();
