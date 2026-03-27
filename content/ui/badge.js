// RealDeal — Floating Trust Score Badge
// Injects a small fixed badge in the bottom-right corner of product pages.
// Uses Shadow DOM to isolate styles from the host page.

/* global RealDeal */
RealDeal.Badge = (function () {
  'use strict';

  let host = null;
  let shadow = null;
  let badgeEl = null;

  const CATEGORY_COLORS = {
    green:  { bg: 'rgba(34, 197, 94, 0.78)', fg: '#fff', ring: 'rgba(22, 163, 74, 0.55)', border: 'rgba(255,255,255,0.26)' },
    yellow: { bg: 'rgba(234, 179, 8, 0.80)', fg: '#fff', ring: 'rgba(202, 138, 4, 0.55)', border: 'rgba(255,255,255,0.28)' },
    red:    { bg: 'rgba(239, 68, 68, 0.80)', fg: '#fff', ring: 'rgba(220, 38, 38, 0.55)', border: 'rgba(255,255,255,0.26)' }
  };

  function inject(scoreResult, scraped) {
    remove(); // clean up any previous badge

    host   = document.createElement('div');
    host.id = 'realdeal-badge-host';
    shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);

    const cat    = scoreResult.category;
    const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.yellow;
    const score  = scoreResult.score;
    const emoji  = cat === 'green' ? '✓' : cat === 'red' ? '✕' : '!';

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        #rd-badge {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 8px;
          background: ${colors.bg};
          color: ${colors.fg};
          border-radius: 50px;
          border: 1px solid ${colors.border};
          padding: 8px 14px 8px 8px;
          box-shadow: 0 16px 34px rgba(15,23,42,0.18), 0 0 0 1px ${colors.ring};
          backdrop-filter: blur(16px) saturate(1.25);
          -webkit-backdrop-filter: blur(16px) saturate(1.25);
          cursor: pointer;
          user-select: none;
          animation: rd-slideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
          transition: transform 0.15s, box-shadow 0.15s;
          max-width: 280px;
        }
        #rd-badge:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 40px rgba(15,23,42,0.22), 0 0 0 1px ${colors.ring};
        }
        #rd-badge:active { transform: translateY(0); }

        .rd-score-circle {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.24);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 13px;
          flex-shrink: 0;
        }
        .rd-text { display: flex; flex-direction: column; min-width: 0; }
        .rd-title { font-size: 11px; font-weight: 700; opacity: 0.88; letter-spacing: 0.04em; text-transform: uppercase; }
        .rd-verdict { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }

        #rd-close {
          background: none; border: none; color: inherit; cursor: pointer;
          font-size: 16px; padding: 0 0 0 4px; opacity: 0.7; flex-shrink: 0;
          line-height: 1;
        }
        #rd-close:hover { opacity: 1; }

        @keyframes rd-slideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      </style>

      <div id="rd-badge" title="Click to see price history">
        <div class="rd-score-circle">${score}</div>
        <div class="rd-text">
          <span class="rd-title">RealDeal Score</span>
          <span class="rd-verdict">${escapeHtml(scoreResult.verdict)}</span>
        </div>
        <button id="rd-close" title="Dismiss">✕</button>
      </div>
    `;

    badgeEl = shadow.getElementById('rd-badge');

    badgeEl.addEventListener('click', (e) => {
      if (e.target.id === 'rd-close') { remove(); return; }
      RealDeal.SidePanel.toggle(scoreResult, scraped);
    });

  }

  function remove() {
    if (host && host.parentNode) host.remove();
    host = shadow = badgeEl = null;
    _removeInlineLabel();
  }

  function update(scoreResult, scraped) {
    if (!badgeEl) { inject(scoreResult, scraped); return; }

    const cat    = scoreResult.category;
    const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.yellow;
    const score  = scoreResult.score;

    badgeEl.style.background  = colors.bg;
    badgeEl.style.border      = `1px solid ${colors.border}`;
    badgeEl.style.boxShadow   = `0 16px 34px rgba(15,23,42,0.18), 0 0 0 1px ${colors.ring}`;
    shadow.querySelector('.rd-score-circle').textContent = score;
    shadow.querySelector('.rd-verdict').textContent      = scoreResult.verdict;

  }

  function isInjected() {
    return !!(host && host.isConnected);
  }

  // ── Inline label ──────────────────────────────────────────────────────────

  const INLINE_LABEL_ID = 'realdeal-inline-label';

  function _injectInlineLabel(scoreResult, scraped) {
    _removeInlineLabel();

    const lowest = scoreResult.lowestEverPrice;
    if (!lowest || !scraped) return;

    const U      = RealDeal.Utils;
    const isLow  = scraped.currentPrice != null && scraped.currentPrice <= lowest * 1.01;
    const text   = isLow
      ? `📉 Lowest price tracked: ${U.formatPrice(lowest, scraped.currency)}`
      : `📉 Lowest tracked: ${U.formatPrice(lowest, scraped.currency)}`;

    const label = document.createElement('span');
    label.id    = INLINE_LABEL_ID;
    label.textContent = text;
    Object.assign(label.style, {
      display:       'inline-block',
      marginTop:     '4px',
      fontSize:      '12px',
      color:         isLow ? '#16a34a' : '#6b7280',
      fontWeight:    '500',
      letterSpacing: '0.01em',
      fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    });

    // Try to insert near the price on the page
    const priceEl = document.querySelector(
      '#priceblock_ourprice, #priceblock_dealprice, .a-price, ' +
      '.product-price, [class*="price--current"], [class*="currentPrice"], ' +
      '[data-testid="pdp-price"], [itemprop="price"], .priceToPay'
    );
    if (priceEl) {
      priceEl.insertAdjacentElement('afterend', label);
    }
  }

  function _removeInlineLabel() {
    document.getElementById(INLINE_LABEL_ID)?.remove();
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return {
    inject,
    remove,
    update,
    isInjected,
    syncInlineLabel: _injectInlineLabel,
    removeInlineLabel: _removeInlineLabel,
    _settings: null
  };
})();
