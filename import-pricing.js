// Import pricing rules for LEDsRepair CRM.
// Loaded after app-v2.js and csv-robust.js.

let pendingProductImport = null;

function ensureDefaultMarginSetting() {
  state.settings ||= {};
  if (!Number.isFinite(Number(state.settings.defaultMargin))) state.settings.defaultMargin = 30;

  const hourlyRate = document.getElementById('hourlyRate');
  if (hourlyRate && !document.getElementById('defaultMargin')) {
    const label = document.createElement('label');
    label.className = 'field top-gap';
    label.innerHTML = '<span>Standaard productmarge (%)</span><input id="defaultMargin" type="number" min="0" step="0.1">';
    hourlyRate.closest('.panel')?.querySelector('#saveSettingsBtn')?.insertAdjacentElement('beforebegin', label);
  }
  const input = document.getElementById('defaultMargin');
  if (input) input.value = Number(state.settings.defaultMargin) || 30;

  if (!document.getElementById('defaultMarginHelp')) {
    const inputLabel = input?.closest('.field');
    if (inputLabel) {
      const help = document.createElement('p');
      help.id = 'defaultMarginHelp';
      help.className = 'muted no-margin';
      help.textContent = 'Wordt gebruikt voor nieuwe producten zonder verkoopprijs of marge in de CSV. Bij bestaande marge-producten blijft de bestaande marge behouden.';
      inputLabel.insertAdjacentElement('afterend', help);
    }
  }
}

function defaultMarginValue() {
  return Math.max(0, num(state.settings?.defaultMargin ?? 30));
}

function ensureImportPricingUi() {
  if (!document.getElementById('importPricingStyles')) {
    const style = document.createElement('style');
    style.id = 'importPricingStyles';
    style.textContent = `
      .price-review-modal{width:min(860px,calc(100vw - 24px))}
      .price-review-intro{margin:-4px 0 14px;color:var(--muted);font-size:12px;line-height:1.5}
      .price-review-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;max-height:min(56vh,560px)}
      .price-review-table{width:100%;min-width:680px;border-collapse:collapse}
      .price-review-table th,.price-review-table td{padding:10px;border-bottom:1px solid var(--line);font-size:11px;vertical-align:middle}
      .price-review-table th{position:sticky;top:0;background:var(--panel);z-index:1;color:var(--muted);text-align:left}
      .price-review-table tr:last-child td{border-bottom:0}
      .price-review-table input{width:120px;background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--text);padding:8px}
      .price-arrow{color:var(--muted);padding:0 5px}
      .price-changed{color:var(--accent);font-weight:800}
      .price-review-product strong{display:block;color:var(--text)}
      .price-review-product span{display:block;color:var(--muted);font-size:10px;margin-top:3px}
      @media(max-width:600px){
        .price-review-modal{width:calc(100vw - 12px);max-height:calc(100dvh - 12px)}
        .price-review-modal form{padding:14px}
        .price-review-table{min-width:620px}
        .price-review-wrap{max-height:62vh}
      }
    `;
    document.head.appendChild(style);
  }

  if (document.getElementById('priceReviewDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'priceReviewDialog';
  dialog.className = 'modal price-review-modal';
  dialog.innerHTML = `
    <form id="priceReviewForm">
      <div class="modal-head">
        <div><p class="eyebrow">Prijscontrole</p><h2>Vaste verkoopprijzen controleren</h2></div>
        <button type="button" class="icon-btn" id="priceReviewClose">×</button>
      </div>
      <p class="price-review-intro">Deze bestaande producten gebruiken een vaste verkoopprijs. Controleer de nieuwe aankoopprijs en pas de verkoopprijs aan indien nodig. Alle bedragen zijn excl. btw.</p>
      <div class="price-review-wrap">
        <table class="price-review-table">
          <thead><tr><th>Product</th><th>Huidige aankoop</th><th>Nieuwe aankoop</th><th>Huidige verkoop</th><th>Verkoop na import</th></tr></thead>
          <tbody id="priceReviewRows"></tbody>
        </table>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="priceReviewCancel">Annuleren</button><button type="submit" class="btn primary">Import uitvoeren</button></div>
    </form>`;
  document.body.appendChild(dialog);

  const cancel = () => {
    pendingProductImport = null;
    closeDialog('priceReviewDialog');
  };
  document.getElementById('priceReviewClose').addEventListener('click', cancel);
  document.getElementById('priceReviewCancel').addEventListener('click', cancel);
  document.getElementById('priceReviewForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!pendingProductImport) return cancel();
    const saleOverrides = {};
    document.querySelectorAll('[data-fixed-sale-input]').forEach(input => {
      saleOverrides[input.dataset.fixedSaleInput] = Math.max(0, num(input.value));
    });
    const plan = pendingProductImport;
    pendingProductImport = null;
    closeDialog('priceReviewDialog');
    executeProductImportPlan(plan, saleOverrides);
  });
}

function findExistingProductForImport(sku, name, supplier) {
  let product = sku ? state.products.find(p => normalize(p.sku) === normalize(sku)) : null;
  if (!product && name) product = state.products.find(p => normalize(p.name) === normalize(name) && normalize(p.supplier) === normalize(supplier));
  return product || null;
}

function getImportSelections() {
  const selections = $$('[data-map-index]').map(el => ({ header: el.dataset.header, field: el.value }));
  const fieldMap = Object.fromEntries(selections.filter(item => item.field).map(item => [item.field, item.header]));
  return { selections, fieldMap, get: (row, field) => fieldMap[field] ? String(row[fieldMap[field]] ?? '') : '' };
}

function rememberImportMappings(selections, supplierProfile) {
  selections.forEach(({ header, field }) => {
    const key = mappingKey(header);
    state.globalMappings[key] = field;
    if (supplierProfile) {
      state.supplierMappings[supplierProfile] ||= {};
      state.supplierMappings[supplierProfile][key] = field;
    }
  });
}

function buildProductImportPlan() {
  const supplierProfile = resolvedSupplier();
  const { selections, get } = getImportSelections();
  const defaultMargin = defaultMarginValue();
  const entries = [];

  for (const row of csvContext.rows) {
    const supplier = get(row, 'supplier').trim() || supplierProfile;
    const sku = get(row, 'sku').trim();
    const name = get(row, 'name').trim() || sku;
    if (!name) continue;

    const existing = findExistingProductForImport(sku, name, supplier);
    const purchaseRaw = get(row, 'purchasePrice').trim();
    const marginRaw = get(row, 'marginPercent').trim();
    const saleRaw = get(row, 'salePrice').trim();
    const pricingModeRaw = normalize(get(row, 'pricingMode'));
    const importedPurchase = purchaseRaw === '' ? null : cleanPrice(purchaseRaw);
    const importedMargin = marginRaw === '' ? null : cleanPrice(marginRaw);
    const importedSale = saleRaw === '' ? null : cleanPrice(saleRaw);

    let pricingMode = 'margin';
    let marginPercent = importedMargin ?? defaultMargin;
    let salePrice = 0;

    if (importedSale !== null || pricingModeRaw.includes('fix')) {
      if (importedSale !== null) {
        pricingMode = 'fixed';
        salePrice = importedSale;
      }
    }

    entries.push({
      row,
      existing,
      supplier,
      sku,
      name,
      description: get(row, 'description'),
      category: get(row, 'category'),
      notes: get(row, 'notes'),
      importedPurchase,
      importedMargin,
      importedSale,
      newProductPricing: { pricingMode, marginPercent, salePrice }
    });
  }

  return { supplierProfile, selections, entries };
}

function fixedPriceReviewEntries(plan) {
  return plan.entries.filter(entry => entry.existing?.pricingMode === 'fixed');
}

function showFixedPriceReview(plan, entries) {
  ensureImportPricingUi();
  pendingProductImport = plan;
  document.getElementById('priceReviewRows').innerHTML = entries.map(entry => {
    const p = entry.existing;
    const oldPurchase = num(p.purchasePrice);
    const newPurchase = entry.importedPurchase === null ? oldPurchase : entry.importedPurchase;
    const currentSale = num(p.salePrice);
    const changed = Math.abs(newPurchase - oldPurchase) > 0.0001;
    return `<tr>
      <td class="price-review-product"><strong>${esc(p.name)}</strong><span>${esc(p.sku || entry.supplier || 'Bestaand product')}</span></td>
      <td>${money(oldPurchase)}</td>
      <td class="${changed ? 'price-changed' : ''}">${money(newPurchase)}</td>
      <td>${money(currentSale)}</td>
      <td><input data-fixed-sale-input="${esc(p.id)}" type="number" min="0" step="0.01" value="${currentSale.toFixed(2)}" aria-label="Verkoopprijs voor ${esc(p.name)}"></td>
    </tr>`;
  }).join('');
  openDialog('priceReviewDialog');
}

function executeProductImportPlan(plan, saleOverrides = {}) {
  const supplierProfile = plan.supplierProfile;
  if (supplierProfile) ensureSupplier(supplierProfile);
  rememberImportMappings(plan.selections, supplierProfile);

  let created = 0;
  let updated = 0;
  const defaultMargin = defaultMarginValue();

  for (const entry of plan.entries) {
    ensureSupplier(entry.supplier);
    const p = entry.existing;

    if (p) {
      const preservedPricingMode = p.pricingMode || 'margin';
      const preservedMargin = num(p.marginPercent);
      const preservedSale = num(p.salePrice);
      const purchasePrice = entry.importedPurchase === null ? num(p.purchasePrice) : entry.importedPurchase;

      // Metadata and purchase price may be refreshed from the supplier CSV.
      // Pricing logic remains untouched for already imported products.
      p.sku = entry.sku || p.sku || '';
      p.name = entry.name || p.name;
      p.description = entry.description || p.description || '';
      p.category = entry.category || p.category || '';
      p.supplier = entry.supplier || p.supplier || '';
      p.notes = entry.notes || p.notes || '';
      p.purchasePrice = purchasePrice;
      p.pricingMode = preservedPricingMode;

      if (preservedPricingMode === 'fixed') {
        p.marginPercent = preservedMargin;
        p.salePrice = saleOverrides[p.id] !== undefined ? saleOverrides[p.id] : preservedSale;
      } else {
        // Explicitly preserve the existing percentage even if the CSV contains a different one.
        p.marginPercent = Number.isFinite(Number(p.marginPercent)) ? preservedMargin : defaultMargin;
        p.salePrice = preservedSale;
      }
      p.updatedAt = new Date().toISOString();
      updated++;
    } else {
      const pricing = entry.newProductPricing;
      state.products.push({
        id: uid('prd'),
        photo: '',
        createdAt: localToday(),
        sku: entry.sku,
        name: entry.name,
        description: entry.description,
        category: entry.category,
        supplier: entry.supplier,
        purchasePrice: entry.importedPurchase ?? 0,
        pricingMode: pricing.pricingMode,
        marginPercent: pricing.pricingMode === 'margin' ? (pricing.marginPercent ?? defaultMargin) : (entry.importedMargin ?? defaultMargin),
        salePrice: pricing.pricingMode === 'fixed' ? pricing.salePrice : 0,
        notes: entry.notes
      });
      created++;
    }
  }

  if (saveState()) {
    renderAll();
    toast(`${created} toegevoegd${updated ? `, ${updated} bijgewerkt` : ''}.`);
    setView('products');
  }
}

function startPricingAwareProductImport(event) {
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  if (!csvContext || document.getElementById('importType').value !== 'products') {
    // Repairs keep using the existing import implementation.
    runImport();
    return;
  }
  const plan = buildProductImportPlan();
  if (!plan.entries.length) return toast('Geen geldige producten gevonden om te importeren.', true);
  const fixedEntries = fixedPriceReviewEntries(plan);
  if (fixedEntries.length) showFixedPriceReview(plan, fixedEntries);
  else executeProductImportPlan(plan);
}

// Capture phase ensures the pricing-aware importer runs before the original click handler.
document.getElementById('runImportBtn')?.addEventListener('click', startPricingAwareProductImport, true);

document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
  const input = document.getElementById('defaultMargin');
  if (!input) return;
  state.settings.defaultMargin = Math.max(0, num(input.value));
  saveState();
}, false);

// New manually-created products use the configured default margin too.
const originalOpenProductWithDefaultMargin = openProduct;
openProduct = function(id = null) {
  originalOpenProductWithDefaultMargin(id);
  if (!id) {
    const marginInput = document.getElementById('productMargin');
    if (marginInput) marginInput.value = defaultMarginValue();
    updateProductPricePreview();
  }
};

ensureDefaultMarginSetting();
ensureImportPricingUi();
