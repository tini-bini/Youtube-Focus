/* global RealDeal */
RealDeal.SidePanel = (function () {
  "use strict";

  let host = null;
  let shadow = null;
  let isOpen = false;
  let currentPeriod = 90;
  let currentScore = null;
  let currentScraped = null;
  let panelFrame = null;
  let resizeHandler = null;
  let redrawQueued = false;

  function toggle(scoreResult, scraped) {
    if (isOpen) {
      close();
      return;
    }
    open(scoreResult, scraped);
  }

  function open(scoreResult, scraped) {
    close();
    currentScore = scoreResult;
    currentScraped = scraped;
    panelFrame = clampFrame(panelFrame || getDefaultFrame());

    host = document.createElement("div");
    shadow = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);

    shadow.innerHTML = buildHtml(scoreResult, scraped);
    attachStyles();
    attachEvents(scoreResult, scraped);
    applyFrame();
    drawChart(scoreResult.history, currentPeriod, scraped?.currency);

    resizeHandler = RealDeal.Utils.debounce(() => {
      panelFrame = clampFrame(panelFrame || getDefaultFrame());
      applyFrame();
      scheduleChartRedraw();
    }, 60);

    window.addEventListener("resize", resizeHandler);
    isOpen = true;
  }

  function close() {
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    host?.remove();
    host = null;
    shadow = null;
    isOpen = false;
  }

  function buildHtml(scoreResult, scraped) {
    const currency = scraped?.currency || "USD";
    const labels = { green: "Verified deal", yellow: "Needs context", red: "High risk" };
    const metrics = [
      ["Current", RealDeal.Utils.formatPrice(scraped?.currentPrice, currency), scraped?.isOnSale ? "Sale detected" : "Live listing"],
      ["Lowest tracked", RealDeal.Utils.formatPrice(scoreResult.lowestEverPrice, currency), "Best local observation"],
      ["Days tracked", scoreResult.daysTracked > 0 ? `${scoreResult.daysTracked}d` : "New", "History retention dependent"],
      ["True discount", scoreResult.trueDiscountPct != null ? `${scoreResult.trueDiscountPct}%` : "--", "Measured from tracked peak"]
    ];

    const tricks = scoreResult.tricks.length ? scoreResult.tricks.map((trick) => `
      <article class="rd-signal rd-signal--${trick.severity}">
        <div class="rd-signal-top">
          <strong>${escapeHtml(trick.label)}</strong>
          <span class="rd-pill rd-pill--signal">${escapeHtml(trick.severity)}</span>
        </div>
        <p>${escapeHtml(trick.description)}</p>
      </article>
    `).join("") : `
      <article class="rd-signal rd-signal--clean">
        <div class="rd-signal-top">
          <strong>No manipulative signals detected</strong>
          <span class="rd-pill rd-pill--signal">Clean</span>
        </div>
        <p>This page is not currently showing the main pricing tricks RealDeal checks for.</p>
      </article>
    `;

    const breakdown = scoreResult.deductions?.length ? scoreResult.deductions.map((deduction) => `
      <div class="rd-breakdown-row">
        <span>${escapeHtml(deduction.reason)}</span>
        <strong>${deduction.points}</strong>
      </div>
    `).join("") : '<p class="rd-breakdown-empty">No score deductions recorded yet.</p>';

    const warning = scoreResult.claimedDiscountPct != null &&
      scoreResult.trueDiscountPct != null &&
      scoreResult.claimedDiscountPct - scoreResult.trueDiscountPct > 10
      ? `
        <section class="rd-section rd-warning">
          <strong>Claimed sale vs reality</strong>
          <p>The page claims ${scoreResult.claimedDiscountPct}% off, but tracked history suggests the real discount is closer to ${scoreResult.trueDiscountPct}%.</p>
        </section>
      `
      : "";

    return `
      <section id="rd-panel" tabindex="0">
        <header id="rd-panel-header">
          <div class="rd-brand">
            <div class="rd-brand-mark">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="#0f172a"></rect>
                <path d="M6.8 14.1L10.2 17.2L17.2 10.2" stroke="#75b183" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M13.8 10.2H17.2V13.6" stroke="#dfeee3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </div>
            <div>
              <span class="rd-overline">Live analysis</span>
              <strong>RealDeal</strong>
            </div>
          </div>
          <div class="rd-header-actions">
            <div class="rd-score-chip rd-score-chip--${scoreResult.category}">
              <span class="rd-score-value">${scoreResult.score}</span>
              <span>${labels[scoreResult.category] || "Unknown"}</span>
            </div>
            <button id="rd-panel-close" type="button" aria-label="Close analysis panel">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>
        </header>

        <div id="rd-panel-body">
          <section class="rd-section rd-hero">
            <div class="rd-hero-copy">
              <div class="rd-header-pills">
                <span class="rd-pill">${escapeHtml(scraped?.site || "Store")}</span>
                <span class="rd-pill">${escapeHtml(buildConfidenceText(scraped))}</span>
              </div>
              <h2 title="${escapeHtml(scraped?.name || "Current product")}">${escapeHtml(scraped?.name || "Current product")}</h2>
              <p>${escapeHtml(scoreResult.verdict)}</p>
            </div>
            <div class="rd-shortcut">Shortcut: Alt+Shift+D</div>
          </section>

          <section class="rd-section rd-metrics">
            ${metrics.map((metric) => `
              <article class="rd-metric">
                <span class="rd-metric-label">${metric[0]}</span>
                <strong class="rd-metric-value">${metric[1]}</strong>
                <span class="rd-metric-note">${metric[2]}</span>
              </article>
            `).join("")}
          </section>

          ${warning}

          <section class="rd-section">
            <div class="rd-section-head">
              <div>
                <span class="rd-overline">History</span>
                <h3>Price movement</h3>
              </div>
              <div class="rd-tabs">
                <button class="rd-tab ${currentPeriod === 30 ? "active" : ""}" data-period="30" type="button">30d</button>
                <button class="rd-tab ${currentPeriod === 60 ? "active" : ""}" data-period="60" type="button">60d</button>
                <button class="rd-tab ${currentPeriod === 90 ? "active" : ""}" data-period="90" type="button">90d</button>
              </div>
            </div>
            <div id="rd-chart-wrap">
              <canvas id="rd-chart" width="400" height="180"></canvas>
              <div id="rd-chart-empty">Not enough data yet. Revisit this product page to build a richer history.</div>
            </div>
          </section>

          <section class="rd-section">
            <div class="rd-section-head">
              <div>
                <span class="rd-overline">Signals</span>
                <h3>Retailer patterns</h3>
              </div>
              <span class="rd-pill">${scoreResult.tricks.length} flag${scoreResult.tricks.length === 1 ? "" : "s"}</span>
            </div>
            <div class="rd-signal-list">${tricks}</div>
          </section>

          <details id="rd-breakdown" class="rd-section">
            <summary>
              <span>
                <span class="rd-overline">Score</span>
                <strong>Why the trust score moved</strong>
              </span>
              <span class="rd-pill">Breakdown</span>
            </summary>
            <div class="rd-breakdown-list">${breakdown}</div>
          </details>
        </div>

        <footer id="rd-panel-footer">
          <span>All price history stays local on this device.</span>
          <a id="rd-settings-link" href="#">Settings</a>
        </footer>

        <button id="rd-resize-handle" type="button" aria-label="Resize panel">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M4 10L10 4"></path>
            <path d="M7 10L10 7"></path>
          </svg>
        </button>
      </section>
    `;
  }

  function attachStyles() {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const fg = dark ? "#f4f8f5" : "#152018";
    const muted = dark ? "#c1d0c7" : "#526259";
    const tertiary = dark ? "#8fa197" : "#74857c";
    const panel = dark ? "rgba(20, 31, 25, 0.9)" : "rgba(255, 255, 255, 0.9)";
    const panelSoft = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.22)";
    const border = dark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)";

    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      #rd-panel {
        position: fixed; width: 440px; height: 760px; min-width: 320px; min-height: 420px;
        max-width: calc(100vw - 24px); max-height: calc(100vh - 24px);
        display: flex; flex-direction: column; overflow: hidden; z-index: 2147483646;
        color: ${fg}; border-radius: 24px; border: 1px solid ${border};
        background: linear-gradient(180deg, ${panel}, ${dark ? "rgba(18, 27, 22, 0.82)" : "rgba(255,255,255,0.78)"});
        box-shadow: ${dark ? "0 30px 64px rgba(0,0,0,0.42)" : "0 30px 64px rgba(24,38,29,0.2)"};
        backdrop-filter: blur(22px) saturate(1.18); -webkit-backdrop-filter: blur(22px) saturate(1.18);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #rd-panel::before { content: ""; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent 38%); pointer-events: none; }
      #rd-panel-header, #rd-panel-footer { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; background: ${dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.2)"}; }
      #rd-panel-header { cursor: grab; user-select: none; border-bottom: 1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)"}; }
      #rd-panel-header:active { cursor: grabbing; }
      .rd-brand, .rd-header-actions, .rd-brand-mark, .rd-score-chip, #rd-panel-close, .rd-pill, #rd-resize-handle, .rd-header-pills { display: inline-flex; align-items: center; }
      .rd-brand { gap: 10px; }
      .rd-brand-mark { width: 40px; height: 40px; justify-content: center; border-radius: 14px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.18); }
      .rd-brand-mark svg { width: 22px; height: 22px; }
      .rd-overline { display: block; margin-bottom: 4px; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: ${tertiary}; }
      .rd-header-actions { gap: 10px; }
      .rd-score-chip { gap: 8px; min-height: 38px; padding: 0 12px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid rgba(255,255,255,0.14); }
      .rd-score-value { font-size: 15px; font-weight: 800; letter-spacing: -0.04em; }
      .rd-score-chip--green { background: rgba(63,149,96,0.18); color: ${dark ? "#bfe6ca" : "#2f7f49"}; }
      .rd-score-chip--yellow { background: rgba(209,140,47,0.18); color: ${dark ? "#ffd08a" : "#8b5f1f"}; }
      .rd-score-chip--red { background: rgba(214,95,95,0.18); color: ${dark ? "#ffb9b9" : "#9f4747"}; }
      #rd-panel-close, #rd-resize-handle { justify-content: center; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.08); color: inherit; }
      #rd-panel-close { width: 36px; height: 36px; }
      #rd-panel-close svg, #rd-resize-handle svg { width: 16px; height: 16px; }
      #rd-panel-body { position: relative; z-index: 1; flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
      .rd-section { padding: 16px; border-radius: 20px; background: ${panelSoft}; border: 1px solid ${border}; box-shadow: inset 0 1px 0 rgba(255,255,255,0.14); }
      .rd-hero, .rd-section-head, #rd-panel-footer, summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .rd-hero-copy { display: grid; gap: 10px; min-width: 0; }
      .rd-hero-copy h2 { font-size: 20px; line-height: 1.2; letter-spacing: -0.03em; overflow-wrap: anywhere; }
      .rd-hero-copy p, .rd-signal p, .rd-breakdown-empty { font-size: 13px; line-height: 1.55; color: ${muted}; }
      .rd-shortcut, .rd-metric-label, .rd-metric-note { color: ${tertiary}; }
      .rd-shortcut { font-size: 11px; white-space: nowrap; }
      .rd-pill { min-height: 28px; padding: 0 10px; border-radius: 999px; background: rgba(117,177,131,0.12); border: 1px solid rgba(117,177,131,0.22); color: ${dark ? "#d5eadd" : "#2f7f49"}; font-size: 11px; font-weight: 700; }
      .rd-header-pills { gap: 8px; flex-wrap: wrap; }
      .rd-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .rd-metric { padding: 14px; border-radius: 16px; background: ${dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.18)"}; border: 1px solid ${border}; display: grid; gap: 6px; }
      .rd-metric-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
      .rd-metric-value { font-size: 18px; font-weight: 800; letter-spacing: -0.03em; overflow-wrap: anywhere; }
      .rd-metric-note { font-size: 12px; }
      .rd-warning { background: rgba(209,140,47,0.16); border-color: rgba(209,140,47,0.26); }
      .rd-warning strong { display: block; margin-bottom: 6px; color: ${dark ? "#ffd08a" : "#8b5f1f"}; }
      .rd-section-head h3, summary strong { font-size: 16px; }
      .rd-tabs { display: inline-flex; gap: 6px; }
      .rd-tab { min-height: 32px; padding: 0 12px; border-radius: 10px; border: 1px solid ${border}; background: ${dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)"}; color: ${muted}; font-size: 12px; font-weight: 700; }
      .rd-tab.active, .rd-tab:hover { background: linear-gradient(180deg, rgba(117,177,131,0.96), rgba(101,159,114,0.96)); border-color: rgba(117,177,131,0.7); color: #f7fcf8; }
      #rd-chart-wrap { position: relative; margin-top: 14px; overflow: hidden; border-radius: 18px; background: ${dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.2)"}; border: 1px solid ${border}; }
      #rd-chart { display: block; width: 100% !important; }
      #rd-chart-empty { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; padding: 20px; text-align: center; font-size: 13px; color: ${muted}; }
      .rd-signal-list, .rd-breakdown-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
      .rd-signal { padding: 14px; border-radius: 16px; border-left: 3px solid transparent; background: ${dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.18)"}; border: 1px solid ${border}; }
      .rd-signal--high { border-left-color: #d65f5f; }
      .rd-signal--medium { border-left-color: #d18c2f; }
      .rd-signal--low, .rd-signal--clean { border-left-color: #75b183; }
      .rd-signal-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
      .rd-signal-top strong { font-size: 14px; }
      .rd-pill--signal { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.12); color: inherit; text-transform: capitalize; }
      summary { list-style: none; cursor: pointer; }
      summary::-webkit-details-marker { display: none; }
      .rd-breakdown-row { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; }
      .rd-breakdown-row strong { color: ${dark ? "#ffb9b9" : "#9f4747"}; }
      #rd-panel-footer { font-size: 12px; color: ${tertiary}; border-top: 1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(17,24,39,0.08)"}; }
      #rd-settings-link { color: ${dark ? "#d5eadd" : "#2f7f49"}; font-weight: 700; text-decoration: none; }
      #rd-resize-handle { position: absolute; right: 10px; bottom: 10px; width: 28px; height: 28px; cursor: nwse-resize; }
      #rd-panel-body::-webkit-scrollbar { width: 7px; }
      #rd-panel-body::-webkit-scrollbar-thumb { background: ${dark ? "rgba(255,255,255,0.14)" : "rgba(17,24,39,0.12)"}; border-radius: 999px; }
      @media (max-width: 640px) { .rd-hero, .rd-section-head, #rd-panel-footer, summary { flex-direction: column; align-items: flex-start; } .rd-metrics { grid-template-columns: 1fr; } }
    `;
    shadow.prepend(style);
  }

  function attachEvents(scoreResult, scraped) {
    const panel = shadow.getElementById("rd-panel");
    const header = shadow.getElementById("rd-panel-header");
    const resizeHandle = shadow.getElementById("rd-resize-handle");

    shadow.getElementById("rd-panel-close").addEventListener("click", close);
    header.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("#rd-panel-close")) {
        startDrag(event);
      }
    });
    resizeHandle.addEventListener("pointerdown", startResize);
    shadow.querySelectorAll(".rd-tab").forEach((button) => {
      button.addEventListener("click", () => {
        shadow.querySelectorAll(".rd-tab").forEach((tab) => tab.classList.remove("active"));
        button.classList.add("active");
        currentPeriod = Number.parseInt(button.dataset.period, 10);
        drawChart(scoreResult.history, currentPeriod, scraped?.currency);
      });
    });
    shadow.getElementById("rd-settings-link").addEventListener("click", (event) => {
      event.preventDefault();
      chrome.runtime.sendMessage({ type: "RD_OPEN_SETTINGS" });
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
      }
    });
    panel.focus();
  }

  function startDrag(event) {
    if (!panelFrame) {
      panelFrame = getDefaultFrame();
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = { ...panelFrame };
    const pointerTarget = event.currentTarget;
    pointerTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    const onMove = (moveEvent) => {
      panelFrame = clampFrame({
        ...startFrame,
        left: startFrame.left + moveEvent.clientX - startX,
        top: startFrame.top + moveEvent.clientY - startY
      });
      applyFrame();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      pointerTarget.releasePointerCapture?.(event.pointerId);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResize(event) {
    if (!panelFrame) {
      panelFrame = getDefaultFrame();
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = { ...panelFrame };
    const pointerTarget = event.currentTarget;
    pointerTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    const onMove = (moveEvent) => {
      panelFrame = clampFrame({
        ...startFrame,
        width: startFrame.width + moveEvent.clientX - startX,
        height: startFrame.height + moveEvent.clientY - startY
      });
      applyFrame();
      scheduleChartRedraw();
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      pointerTarget.releasePointerCapture?.(event.pointerId);
      scheduleChartRedraw();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function getDefaultFrame() {
    const margin = 16;
    const width = Math.min(440, Math.max(320, window.innerWidth - margin * 2));
    const height = Math.min(760, Math.max(420, window.innerHeight - margin * 2));
    return {
      left: Math.max(margin, window.innerWidth - width - margin),
      top: Math.max(margin, Math.min(24, window.innerHeight - height - margin)),
      width,
      height
    };
  }

  function clampFrame(frame) {
    const margin = 12;
    const minWidth = 320;
    const minHeight = 420;
    const maxWidth = Math.max(minWidth, window.innerWidth - margin * 2);
    const maxHeight = Math.max(minHeight, window.innerHeight - margin * 2);
    const width = RealDeal.Utils.clamp(frame.width || maxWidth, minWidth, maxWidth);
    const height = RealDeal.Utils.clamp(frame.height || maxHeight, minHeight, maxHeight);
    const left = RealDeal.Utils.clamp(frame.left ?? margin, margin, Math.max(margin, window.innerWidth - width - margin));
    const top = RealDeal.Utils.clamp(frame.top ?? margin, margin, Math.max(margin, window.innerHeight - height - margin));
    return { top, left, width, height };
  }

  function applyFrame() {
    const panel = shadow?.getElementById("rd-panel");
    if (!panel || !panelFrame) {
      return;
    }
    panel.style.top = `${panelFrame.top}px`;
    panel.style.left = `${panelFrame.left}px`;
    panel.style.width = `${panelFrame.width}px`;
    panel.style.height = `${panelFrame.height}px`;
  }

  function scheduleChartRedraw() {
    if (redrawQueued || !isOpen || !currentScore) {
      return;
    }
    redrawQueued = true;
    requestAnimationFrame(() => {
      redrawQueued = false;
      if (isOpen && currentScore) {
        drawChart(currentScore.history, currentPeriod, currentScraped?.currency);
      }
    });
  }

  function drawChart(history, periodDays, currency) {
    const canvas = shadow?.getElementById("rd-chart");
    const emptyEl = shadow?.getElementById("rd-chart-empty");
    if (!canvas || !emptyEl) {
      return;
    }

    const cutoff = Date.now() - periodDays * 86400000;
    const filtered = (history || []).filter((entry) => entry.timestamp >= cutoff).sort((a, b) => a.timestamp - b.timestamp);
    if (filtered.length < 2) {
      canvas.style.display = "none";
      emptyEl.style.display = "flex";
      return;
    }

    canvas.style.display = "block";
    emptyEl.style.display = "none";

    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const fgColor = dark ? "#8fa197" : "#74857c";
    const gridColor = dark ? "rgba(255,255,255,0.06)" : "rgba(17,24,39,0.06)";
    const lineColor = "#75b183";
    const fillColor = dark ? "rgba(117,177,131,0.18)" : "rgba(117,177,131,0.12)";
    const lowestColor = "#3f9560";

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth || 400;
    const height = 180;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { top: 18, right: 12, bottom: 30, left: 48 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const prices = filtered.map((entry) => entry.price);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const range = rawMax - rawMin || 1;
    const minPrice = rawMin - range * 0.1;
    const maxPrice = rawMax + range * 0.1;
    const timestamps = filtered.map((entry) => entry.timestamp);
    const tMin = timestamps[0];
    const tMax = timestamps[timestamps.length - 1];
    const tRange = tMax - tMin || 1;

    const xOf = (timestamp) => pad.left + ((timestamp - tMin) / tRange) * plotWidth;
    const yOf = (price) => pad.top + (1 - (price - minPrice) / (maxPrice - minPrice)) * plotHeight;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let index = 0; index <= 4; index += 1) {
      const y = pad.top + (index / 4) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotWidth, y);
      ctx.stroke();
    }

    ctx.fillStyle = fgColor;
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const value = minPrice + ((4 - index) / 4) * (maxPrice - minPrice);
      ctx.fillText(RealDeal.Utils.formatPrice(value, currency).replace(/\.00$/, ""), pad.left - 6, pad.top + (index / 4) * plotHeight);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const labelCount = Math.min(5, filtered.length);
    for (let index = 0; index < labelCount; index += 1) {
      const pointIndex = Math.round((index / Math.max(1, labelCount - 1)) * (filtered.length - 1));
      const timestamp = filtered[pointIndex].timestamp;
      ctx.fillText(RealDeal.Utils.formatDateShort(timestamp), xOf(timestamp), pad.top + plotHeight + 8);
    }

    ctx.beginPath();
    ctx.moveTo(xOf(filtered[0].timestamp), yOf(filtered[0].price));
    for (let index = 1; index < filtered.length; index += 1) {
      ctx.lineTo(xOf(filtered[index].timestamp), yOf(filtered[index].price));
    }
    ctx.lineTo(xOf(filtered[filtered.length - 1].timestamp), pad.top + plotHeight);
    ctx.lineTo(xOf(filtered[0].timestamp), pad.top + plotHeight);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xOf(filtered[0].timestamp), yOf(filtered[0].price));
    for (let index = 1; index < filtered.length; index += 1) {
      ctx.lineTo(xOf(filtered[index].timestamp), yOf(filtered[index].price));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    const lowestIndex = prices.indexOf(rawMin);
    filtered.forEach((entry, index) => {
      const x = xOf(entry.timestamp);
      const y = yOf(entry.price);
      ctx.beginPath();
      ctx.arc(x, y, index === lowestIndex ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = index === lowestIndex ? lowestColor : (entry.isSale ? "#d18c2f" : lineColor);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = index === lowestIndex ? 1.5 : 1;
      ctx.stroke();
    });

    ctx.fillStyle = lowestColor;
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(RealDeal.Utils.formatPrice(rawMin, currency), xOf(filtered[lowestIndex].timestamp), yOf(filtered[lowestIndex].price) - 8);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildConfidenceText(scraped) {
    if (!scraped?.scraperConfidence || scraped.scraperConfidence === "high") {
      return "Dedicated parser";
    }

    return `${scraped.scraperSource || "Fallback"} (${scraped.scraperConfidence})`;
  }

  return { toggle, open, close };
})();
