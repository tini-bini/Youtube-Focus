// RealDeal - Floating Analysis Panel
// Detailed overlay showing price history chart, tricks list, and recommendation.
// Users can drag the panel by the header and resize it from the bottom-right corner.

/* global RealDeal */
RealDeal.SidePanel = (function () {
  'use strict';

  let host = null;
  let shadow = null;
  let isOpen = false;
  let currentPeriod = 90;
  let currentScore = null;
  let currentScraped = null;
  let panelFrame = null;
  let windowResizeHandler = null;
  let redrawQueued = false;

  function toggle(scoreResult, scraped) {
    if (isOpen) { close(); return; }
    open(scoreResult, scraped);
  }

  function open(scoreResult, scraped) {
    close();

    currentScore = scoreResult;
    currentScraped = scraped;
    panelFrame = _clampFrame(panelFrame || _getDefaultFrame());

    host = document.createElement('div');
    host.id = 'realdeal-panel-host';
    shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);

    shadow.innerHTML = _buildHTML(scoreResult, scraped);
    _attachStyles();
    _attachEvents(scoreResult, scraped);
    _applyFrame();
    _drawChart(scoreResult.history, currentPeriod, scraped?.currency);

    windowResizeHandler = RealDeal.Utils.debounce(() => {
      panelFrame = _clampFrame(panelFrame || _getDefaultFrame());
      _applyFrame();
      _scheduleChartRedraw();
    }, 60);
    window.addEventListener('resize', windowResizeHandler);

    isOpen = true;
  }

  function close() {
    if (windowResizeHandler) {
      window.removeEventListener('resize', windowResizeHandler);
      windowResizeHandler = null;
    }

    if (host?.parentNode) host.remove();
    host = null;
    shadow = null;
    isOpen = false;
  }

  function _buildHTML(sr, scraped) {
    const U = RealDeal.Utils;
    const currency = scraped?.currency || 'USD';
    const catLabel = { green: 'Legit Deal', yellow: 'Questionable', red: 'Likely Fake' };
    const catColor = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };
    const cat = sr.category;

    const lowestStr = U.formatPrice(sr.lowestEverPrice, currency);
    const currentStr = U.formatPrice(scraped?.currentPrice, currency);
    const daysTracked = sr.daysTracked;

    const trickRows = sr.tricks.length
      ? sr.tricks.map(t => `
          <div class="rd-trick rd-trick--${t.severity}">
            <div class="rd-trick-header">
              <span class="rd-trick-dot"></span>
              <strong>${esc(t.label)}</strong>
              <span class="rd-trick-sev">${t.severity}</span>
            </div>
            <p>${esc(t.description)}</p>
          </div>`).join('')
      : '<p class="rd-no-tricks">No pricing tricks detected.</p>';

    const deductionRows = sr.deductions?.length
      ? sr.deductions.map(d => `<div class="rd-deduction"><span>${esc(d.reason)}</span><span class="rd-pts">${d.points}</span></div>`).join('')
      : '';

    return `
      <div id="rd-panel">
        <div id="rd-panel-header">
          <div id="rd-panel-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="#0f172a"></rect>
              <path d="M6.8 14.1L10.2 17.2L17.2 10.2" stroke="#75b183" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M13.8 10.2H17.2V13.6" stroke="#dfeee3" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            RealDeal
          </div>
          <div id="rd-panel-score-wrap">
            <div id="rd-panel-score" style="background:${catColor[cat]}">${sr.score}</div>
            <div id="rd-panel-cat" style="color:${catColor[cat]}">${catLabel[cat] || 'Unknown'}</div>
          </div>
          <button id="rd-panel-close" title="Close">x</button>
        </div>

        <div id="rd-panel-body">
          ${scraped?.name ? `<h2 id="rd-product-name" title="${esc(scraped.name)}">${esc(scraped.name)}</h2>` : ''}

          <div id="rd-stats-row">
            <div class="rd-stat">
              <div class="rd-stat-value">${currentStr}</div>
              <div class="rd-stat-label">Current Price</div>
            </div>
            <div class="rd-stat">
              <div class="rd-stat-value" style="color:#22c55e">${lowestStr}</div>
              <div class="rd-stat-label">Lowest Tracked</div>
            </div>
            <div class="rd-stat">
              <div class="rd-stat-value">${daysTracked > 0 ? `${daysTracked}d` : '-'}</div>
              <div class="rd-stat-label">Days Tracked</div>
            </div>
            <div class="rd-stat">
              <div class="rd-stat-value">${sr.trueDiscountPct != null ? `${sr.trueDiscountPct}%` : '-'}</div>
              <div class="rd-stat-label">True Discount</div>
            </div>
          </div>

          ${sr.claimedDiscountPct && sr.trueDiscountPct != null && (sr.claimedDiscountPct - sr.trueDiscountPct) > 10 ? `
          <div id="rd-discount-warning">
            Page claims <strong>${sr.claimedDiscountPct}% off</strong> but true discount vs history is only <strong>~${sr.trueDiscountPct}%</strong>
          </div>` : ''}

          <div id="rd-verdict-box" style="border-color:${catColor[cat]}">
            ${esc(sr.verdict)}
          </div>

          <div id="rd-chart-section">
            <div id="rd-chart-header">
              <span>Price History</span>
              <div id="rd-period-tabs">
                <button class="rd-tab ${currentPeriod === 30 ? 'active' : ''}" data-period="30">30d</button>
                <button class="rd-tab ${currentPeriod === 60 ? 'active' : ''}" data-period="60">60d</button>
                <button class="rd-tab ${currentPeriod === 90 ? 'active' : ''}" data-period="90">90d</button>
              </div>
            </div>
            <div id="rd-chart-wrap">
              <canvas id="rd-chart" width="400" height="160"></canvas>
              <div id="rd-chart-empty" style="display:none">Not enough data yet - visit this page again to build history</div>
            </div>
          </div>

          <div id="rd-tricks-section">
            <h3>Pricing Tricks Detected</h3>
            ${trickRows}
          </div>

          ${deductionRows ? `
          <details id="rd-score-details">
            <summary>Score breakdown</summary>
            <div id="rd-deductions">${deductionRows}</div>
          </details>` : ''}
        </div>

        <div id="rd-panel-footer">
          <span>All data stored locally - never shared</span>
          <a id="rd-settings-link" href="#">Settings</a>
        </div>

        <button id="rd-resize-handle" title="Resize panel" aria-label="Resize panel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 10L10 4"></path>
            <path d="M7 10L10 7"></path>
            <path d="M10 10L10 10"></path>
          </svg>
        </button>
      </div>
    `;
  }

  function _attachStyles() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const bg = isDark ? 'rgba(15, 23, 42, 0.80)' : 'rgba(255, 255, 255, 0.74)';
    const bg2 = isDark ? 'rgba(30, 41, 59, 0.68)' : 'rgba(248, 250, 252, 0.66)';
    const bg3 = isDark ? 'rgba(51, 65, 85, 0.36)' : 'rgba(255, 255, 255, 0.54)';
    const fg = isDark ? '#e2e8f0' : '#0f172a';
    const fg2 = isDark ? '#94a3b8' : '#64748b';
    const border = isDark ? 'rgba(148, 163, 184, 0.20)' : 'rgba(148, 163, 184, 0.24)';
    const hover = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.12)';
    const panelShadow = isDark ? '0 26px 58px rgba(2, 6, 23, 0.44)' : '0 26px 58px rgba(15, 23, 42, 0.18)';

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; margin: 0; padding: 0; }

      #rd-panel {
        position: fixed;
        width: 420px;
        height: 720px;
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        min-width: 320px;
        min-height: 360px;
        background: ${bg};
        color: ${fg};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        z-index: 2147483646;
        box-shadow: ${panelShadow};
        border: 1px solid ${border};
        border-radius: 20px;
        backdrop-filter: blur(22px) saturate(1.15);
        -webkit-backdrop-filter: blur(22px) saturate(1.15);
        overflow: hidden;
        animation: rd-floatIn 0.28s ease both;
      }
      @keyframes rd-floatIn {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      #rd-panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 16px;
        border-bottom: 1px solid ${border};
        background: ${bg2};
        flex-shrink: 0;
        cursor: grab;
        user-select: none;
      }
      #rd-panel-header:active { cursor: grabbing; }
      #rd-panel-logo {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 800;
        font-size: 15px;
        color: #75b183;
        flex: 1;
      }
      #rd-panel-score-wrap { display: flex; align-items: center; gap: 6px; }
      #rd-panel-score {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 14px;
        color: #fff;
      }
      #rd-panel-cat { font-size: 11px; font-weight: 700; }
      #rd-panel-close {
        background: ${bg3};
        border: 1px solid ${border};
        cursor: pointer;
        font-size: 16px;
        color: ${fg2};
        padding: 6px 9px;
        border-radius: 999px;
        line-height: 1;
      }
      #rd-panel-close:hover { background: ${hover}; color: ${fg}; }

      #rd-panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      #rd-product-name {
        font-size: 13px;
        font-weight: 600;
        color: ${fg};
        line-height: 1.4;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      #rd-stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .rd-stat {
        background: ${bg3};
        border-radius: 10px;
        padding: 10px 6px;
        text-align: center;
        border: 1px solid ${border};
        backdrop-filter: blur(10px);
      }
      .rd-stat-value { font-size: 15px; font-weight: 800; color: ${fg}; }
      .rd-stat-label { font-size: 10px; color: ${fg2}; margin-top: 2px; }

      #rd-verdict-box {
        border: 2px solid;
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 600;
        background: ${bg3};
      }

      #rd-discount-warning {
        background: rgba(254, 243, 199, 0.72);
        color: #92400e;
        border: 1px solid rgba(245, 158, 11, 0.28);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 12px;
        backdrop-filter: blur(10px);
      }

      #rd-chart-section { display: flex; flex-direction: column; gap: 8px; }
      #rd-chart-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 700;
      }
      #rd-period-tabs { display: flex; gap: 4px; }
      .rd-tab {
        background: ${bg3};
        border: 1px solid ${border};
        color: ${fg2};
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
        transition: background 0.15s, border-color 0.15s;
      }
      .rd-tab.active, .rd-tab:hover {
        background: rgba(99, 102, 241, 0.88);
        color: #fff;
        border-color: rgba(129, 140, 248, 0.6);
      }
      #rd-chart-wrap {
        border: 1px solid ${border};
        border-radius: 10px;
        background: ${bg3};
        overflow: hidden;
        position: relative;
        backdrop-filter: blur(10px);
      }
      #rd-chart { display: block; width: 100% !important; }
      #rd-chart-empty {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: ${fg2};
        text-align: center;
        padding: 20px;
      }

      #rd-tricks-section h3 {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: ${fg2};
        margin-bottom: 8px;
      }
      .rd-trick {
        border-radius: 10px;
        padding: 10px 12px;
        margin-bottom: 8px;
        border-left: 3px solid;
        backdrop-filter: blur(10px);
      }
      .rd-trick--high   { background: rgba(254, 242, 242, 0.70); border-color: #ef4444; color: #7f1d1d; }
      .rd-trick--medium { background: rgba(255, 251, 235, 0.70); border-color: #f59e0b; color: #78350f; }
      .rd-trick--low    { background: rgba(240, 249, 255, 0.72); border-color: #38bdf8; color: #0c4a6e; }
      .rd-trick-header  { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
      .rd-trick-dot     { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
      .rd-trick-sev     { margin-left: auto; font-size: 10px; font-weight: 700; text-transform: uppercase; opacity: 0.7; }
      .rd-trick p       { font-size: 12px; line-height: 1.5; }
      .rd-no-tricks     { font-size: 12px; color: ${fg2}; }

      #rd-score-details {
        border: 1px solid ${border};
        border-radius: 10px;
        overflow: hidden;
        background: ${bg3};
      }
      #rd-score-details summary {
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        background: ${bg3};
        color: ${fg2};
      }
      #rd-deductions { padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; }
      .rd-deduction  { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; color: ${fg}; }
      .rd-pts        { font-weight: 700; color: #ef4444; white-space: nowrap; }

      #rd-panel-footer {
        padding: 10px 16px;
        border-top: 1px solid ${border};
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: ${fg2};
        flex-shrink: 0;
        background: ${bg2};
      }
      #rd-settings-link { color: #75b183; text-decoration: none; font-weight: 600; }
      #rd-settings-link:hover { text-decoration: underline; }

      #rd-resize-handle {
        position: absolute;
        right: 8px;
        bottom: 8px;
        width: 24px;
        height: 24px;
        border: 1px solid ${border};
        border-radius: 999px;
        background: ${bg3};
        color: ${fg2};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: nwse-resize;
        backdrop-filter: blur(8px);
      }
      #rd-resize-handle:hover { background: ${hover}; color: ${fg}; }

      #rd-panel-body::-webkit-scrollbar { width: 6px; }
      #rd-panel-body::-webkit-scrollbar-track { background: transparent; }
      #rd-panel-body::-webkit-scrollbar-thumb { background: ${border}; border-radius: 999px; }

      @media (max-width: 640px) {
        #rd-stats-row { grid-template-columns: repeat(2, 1fr); }
      }
    `;
    shadow.prepend(style);
  }

  function _attachEvents(scoreResult, scraped) {
    const panel = shadow.getElementById('rd-panel');
    const header = shadow.getElementById('rd-panel-header');
    const resizeHandle = shadow.getElementById('rd-resize-handle');

    shadow.getElementById('rd-panel-close').addEventListener('click', close);

    header.addEventListener('pointerdown', (event) => {
      if (event.target.closest('#rd-panel-close')) return;
      _startDrag(event);
    });

    resizeHandle.addEventListener('pointerdown', (event) => {
      _startResize(event);
    });

    shadow.querySelectorAll('.rd-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        shadow.querySelectorAll('.rd-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = parseInt(btn.dataset.period, 10);
        _drawChart(scoreResult.history, currentPeriod, scraped?.currency);
      });
    });

    shadow.getElementById('rd-settings-link').addEventListener('click', (event) => {
      event.preventDefault();
      chrome.runtime.sendMessage({ type: 'RD_OPEN_SETTINGS' });
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  function _startDrag(event) {
    if (!panelFrame) panelFrame = _getDefaultFrame();

    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = { ...panelFrame };
    const pointerTarget = event.currentTarget;

    pointerTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      panelFrame = _clampFrame({
        ...startFrame,
        left: startFrame.left + dx,
        top: startFrame.top + dy
      });
      _applyFrame();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      pointerTarget.releasePointerCapture?.(event.pointerId);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function _startResize(event) {
    if (!panelFrame) panelFrame = _getDefaultFrame();

    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = { ...panelFrame };
    const pointerTarget = event.currentTarget;

    pointerTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      panelFrame = _clampFrame({
        ...startFrame,
        width: startFrame.width + dx,
        height: startFrame.height + dy
      });
      _applyFrame();
      _scheduleChartRedraw();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      pointerTarget.releasePointerCapture?.(event.pointerId);
      _scheduleChartRedraw();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function _getDefaultFrame() {
    const margin = 16;
    const width = Math.min(420, Math.max(320, window.innerWidth - margin * 2));
    const height = Math.min(720, Math.max(360, window.innerHeight - margin * 2));
    const left = Math.max(margin, window.innerWidth - width - margin);
    const top = Math.max(margin, Math.min(24, window.innerHeight - height - margin));
    return { top, left, width, height };
  }

  function _clampFrame(frame) {
    const margin = 12;
    const minWidth = 320;
    const minHeight = 360;
    const maxWidth = Math.max(minWidth, window.innerWidth - margin * 2);
    const maxHeight = Math.max(minHeight, window.innerHeight - margin * 2);

    const width = RealDeal.Utils.clamp(frame.width || maxWidth, minWidth, maxWidth);
    const height = RealDeal.Utils.clamp(frame.height || maxHeight, minHeight, maxHeight);
    const left = RealDeal.Utils.clamp(frame.left ?? (window.innerWidth - width - margin), margin, Math.max(margin, window.innerWidth - width - margin));
    const top = RealDeal.Utils.clamp(frame.top ?? margin, margin, Math.max(margin, window.innerHeight - height - margin));

    return { top, left, width, height };
  }

  function _applyFrame() {
    const panel = shadow?.getElementById('rd-panel');
    if (!panel || !panelFrame) return;

    panel.style.top = `${panelFrame.top}px`;
    panel.style.left = `${panelFrame.left}px`;
    panel.style.width = `${panelFrame.width}px`;
    panel.style.height = `${panelFrame.height}px`;
  }

  function _scheduleChartRedraw() {
    if (redrawQueued || !isOpen || !currentScore) return;
    redrawQueued = true;
    requestAnimationFrame(() => {
      redrawQueued = false;
      if (isOpen && currentScore) {
        _drawChart(currentScore.history, currentPeriod, currentScraped?.currency);
      }
    });
  }

  function _drawChart(history, periodDays, currency) {
    const canvas = shadow?.getElementById('rd-chart');
    const emptyEl = shadow?.getElementById('rd-chart-empty');
    if (!canvas || !emptyEl) return;

    const cutoff = Date.now() - periodDays * 86400000;
    const filtered = (history || [])
      .filter(h => h.timestamp >= cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (filtered.length < 2) {
      canvas.style.display = 'none';
      emptyEl.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    emptyEl.style.display = 'none';

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const fgColor = isDark ? '#94a3b8' : '#64748b';
    const lineCol = '#75b183';
    const dotCol = '#75b183';
    const lowestCol = '#22c55e';
    const gridCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const fillCol = isDark ? 'rgba(117,177,131,0.18)' : 'rgba(117,177,131,0.12)';

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth || 380;
    const H = 160;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const PAD = { top: 16, right: 12, bottom: 28, left: 44 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const prices = filtered.map(h => h.price);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const range = rawMax - rawMin || 1;
    const minPrice = rawMin - range * 0.1;
    const maxPrice = rawMax + range * 0.1;

    const timestamps = filtered.map(h => h.timestamp);
    const tMin = timestamps[0];
    const tMax = timestamps[timestamps.length - 1];
    const tRange = tMax - tMin || 1;

    const xOf = ts => PAD.left + ((ts - tMin) / tRange) * plotW;
    const yOf = val => PAD.top + (1 - (val - minPrice) / (maxPrice - minPrice)) * plotH;

    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = gridCol;
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = PAD.top + (i / gridLines) * plotH;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();
    }

    ctx.fillStyle = fgColor;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const sym = { USD: '$', EUR: 'EUR ', GBP: 'GBP ', CAD: 'C$', AUD: 'A$' }[currency] || '';
    for (let i = 0; i <= gridLines; i++) {
      const val = minPrice + ((gridLines - i) / gridLines) * (maxPrice - minPrice);
      ctx.fillText(sym + val.toFixed(0), PAD.left - 4, PAD.top + (i / gridLines) * plotH);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xLabels = Math.min(5, filtered.length);
    for (let i = 0; i < xLabels; i++) {
      const idx = Math.round(i / Math.max(1, xLabels - 1) * (filtered.length - 1));
      const ts = filtered[idx].timestamp;
      ctx.fillText(RealDeal.Utils.formatDateShort(ts), xOf(ts), PAD.top + plotH + 6);
    }

    ctx.beginPath();
    ctx.moveTo(xOf(filtered[0].timestamp), yOf(filtered[0].price));
    for (let i = 1; i < filtered.length; i++) {
      ctx.lineTo(xOf(filtered[i].timestamp), yOf(filtered[i].price));
    }
    ctx.lineTo(xOf(filtered[filtered.length - 1].timestamp), PAD.top + plotH);
    ctx.lineTo(xOf(filtered[0].timestamp), PAD.top + plotH);
    ctx.closePath();
    ctx.fillStyle = fillCol;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xOf(filtered[0].timestamp), yOf(filtered[0].price));
    for (let i = 1; i < filtered.length; i++) {
      ctx.lineTo(xOf(filtered[i].timestamp), yOf(filtered[i].price));
    }
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    const lowestIdx = prices.indexOf(rawMin);
    const lx = xOf(filtered[lowestIdx].timestamp);
    const ly = yOf(rawMin);
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fillStyle = lowestCol;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = lowestCol;
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(sym + rawMin.toFixed(2), lx, ly - 6);

    filtered.forEach((h, i) => {
      const x = xOf(h.timestamp);
      const y = yOf(h.price);
      if (i === lowestIdx) return;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = h.isSale ? '#f59e0b' : dotCol;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { toggle, open, close };
})();
