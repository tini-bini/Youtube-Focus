// RealDeal — Settings Page Script

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  // Theme toggle
  const MOON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const SUN_SVG  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

  function applyThemeIcon(theme) {
    $('theme-toggle').innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
  }
  applyThemeIcon(document.documentElement.dataset.theme || 'light');

  $('theme-toggle').addEventListener('click', () => {
    const curr = document.documentElement.dataset.theme;
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('rd_theme', next);
    applyThemeIcon(next);
  });

  const TOGGLE_IDS = [
    'showBadge',
    'showInlineLabel',
    'enableFakeWasDetection',
    'enablePriceAnchorDetection',
    'enableUrgencyDetection',
    'enableRollbackDetection',
    'enableSubscriptionDetection'
  ];

  // ── Load current settings ─────────────────────────────────────────────────

  const data     = await chrome.storage.local.get('rd_settings');
  const settings = Object.assign({
    historyDays:                    90,
    showBadge:                      true,
    showInlineLabel:                true,
    enableFakeWasDetection:         true,
    enablePriceAnchorDetection:     true,
    enableUrgencyDetection:         true,
    enableRollbackDetection:        true,
    enableSubscriptionDetection:    true
  }, data.rd_settings || {});

  // Apply to controls
  $('historyDays').value      = settings.historyDays;
  $('historyDays-val').textContent = settings.historyDays + ' days';

  for (const id of TOGGLE_IDS) {
    if ($(id)) $(id).checked = !!settings[id];
  }

  // Slider live update
  $('historyDays').addEventListener('input', () => {
    $('historyDays-val').textContent = $('historyDays').value + ' days';
  });

  // ── Storage stats ─────────────────────────────────────────────────────────

  await refreshStats();

  async function refreshStats() {
    const all      = await chrome.storage.local.get(null);
    const products = Object.values(all).filter((_, k) => Object.keys(all)[k]?.startsWith('rd_p_'));
    const productEntries = Object.entries(all).filter(([k]) => k.startsWith('rd_p_'));
    const totalObs = productEntries.reduce((acc, [, v]) => acc + (v.history?.length || 0), 0);

    $('stat-products').textContent = `${productEntries.length} product${productEntries.length !== 1 ? 's' : ''} tracked`;
    $('stat-obs').textContent      = `${totalObs} price observation${totalObs !== 1 ? 's' : ''}`;
  }

  // ── Save settings ─────────────────────────────────────────────────────────

  $('btn-save').addEventListener('click', async () => {
    const newSettings = {
      historyDays:                    parseInt($('historyDays').value, 10),
      showBadge:                      $('showBadge')?.checked ?? true,
      showInlineLabel:                $('showInlineLabel')?.checked ?? true,
      enableFakeWasDetection:         $('enableFakeWasDetection')?.checked ?? true,
      enablePriceAnchorDetection:     $('enablePriceAnchorDetection')?.checked ?? true,
      enableUrgencyDetection:         $('enableUrgencyDetection')?.checked ?? true,
      enableRollbackDetection:        $('enableRollbackDetection')?.checked ?? true,
      enableSubscriptionDetection:    $('enableSubscriptionDetection')?.checked ?? true
    };

    await chrome.storage.local.set({ rd_settings: newSettings });

    const status = $('save-status');
    status.textContent = '✓ Saved!';
    setTimeout(() => { status.textContent = ''; }, 2500);
  });

  // ── Export CSV ────────────────────────────────────────────────────────────

  $('btn-export').addEventListener('click', async () => {
    const all      = await chrome.storage.local.get(null);
    const products = Object.entries(all).filter(([k]) => k.startsWith('rd_p_'));

    if (!products.length) {
      alert('No price history to export yet.');
      return;
    }

    const rows = ['Product Name,Site,Currency,Date,Price,Original Price,Sale %,Is Sale,URL'];

    for (const [, product] of products) {
      for (const h of (product.history || [])) {
        const date = new Date(h.timestamp).toISOString().slice(0, 10);
        rows.push([
          csvCell(product.name),
          product.site || '',
          product.currency || '',
          date,
          h.price?.toFixed(2) ?? '',
          h.originalPrice?.toFixed(2) ?? '',
          h.salePercent ?? '',
          h.isSale ? 'yes' : 'no',
          csvCell(product.productUrl || '')
        ].join(','));
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `realdeal-history-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Clear history ─────────────────────────────────────────────────────────

  $('btn-clear').addEventListener('click', () => {
    $('confirm-overlay').style.display = 'flex';
  });

  $('confirm-cancel').addEventListener('click', () => {
    $('confirm-overlay').style.display = 'none';
  });

  $('confirm-ok').addEventListener('click', async () => {
    const all  = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(k => k.startsWith('rd_p_'));
    if (keys.length) await chrome.storage.local.remove(keys);

    $('confirm-overlay').style.display = 'none';
    await refreshStats();

    const status = $('save-status');
    status.textContent = '✓ History cleared';
    setTimeout(() => { status.textContent = ''; }, 2500);
  });
});

function csvCell(val) {
  const s = String(val || '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
