// Responsive interaction layer loaded last.
(function initResponsiveUi(){
  // Make repair cost rows self-explanatory on mobile where the desktop column header is hidden.
  if (typeof renderRepairLines === 'function') {
    renderRepairLines = function(){
      const wrap = $('#repairLines');
      const lines = repairDraft?.lines || [];
      wrap.innerHTML = lines.length ? lines.map(line => {
        const total = lineTotals(line).sale;
        const typeLabel = line.type === 'labor' ? 'Werkuren' : line.type === 'product' ? 'Product' : 'Vrij';
        return `<div class="cost-line" data-line-id="${line.id}">
          <label class="cost-desc">
            <span class="cost-field-label">Omschrijving</span>
            <input data-line-field="description" value="${esc(line.description)}" aria-label="Omschrijving">
            <div class="muted">${typeLabel}</div>
          </label>
          <label class="cost-field"><span class="cost-field-label">Aantal</span><input data-line-field="qty" type="number" min="0" step="0.01" value="${num(line.qty)}" aria-label="Aantal"></label>
          <label class="cost-field"><span class="cost-field-label">Aankoop/st. excl. btw</span><input data-line-field="purchaseUnit" type="number" min="0" step="0.01" value="${num(line.purchaseUnit)}" aria-label="Aankoop per stuk excl. btw"></label>
          <label class="cost-field"><span class="cost-field-label">Verkoop/st. excl. btw</span><input data-line-field="saleUnit" type="number" min="0" step="0.01" value="${num(line.saleUnit)}" aria-label="Verkoop per stuk excl. btw"></label>
          <div class="cost-total"><span class="cost-field-label">Totaal excl. btw</span><strong>${money(total)}</strong></div>
          <div class="cost-delete"><button type="button" class="table-btn" data-remove-line="${line.id}" aria-label="Regel verwijderen">×</button></div>
        </div>`;
      }).join('') : '<div class="empty-state compact">Nog geen kostenregels. Voeg een product, vrije regel of werkuren toe.</div>';
      updateRepairTotals();
    };
  }

  // Header actions are intentionally minimal on very narrow phones.
  const repairButton = document.getElementById('newRepairBtn');
  const narrowHeader = window.matchMedia('(max-width:420px)');
  function syncHeaderActions(){
    if (!repairButton) return;
    repairButton.textContent = narrowHeader.matches ? '+' : '+ Reparatie';
    repairButton.setAttribute('aria-label', 'Nieuwe reparatie');
    repairButton.title = 'Nieuwe reparatie';
  }
  syncHeaderActions();
  if (narrowHeader.addEventListener) narrowHeader.addEventListener('change', syncHeaderActions);
  else narrowHeader.addListener(syncHeaderActions);

  // Add a proper overlay behind the slide-in navigation on mobile.
  const sidebar = document.getElementById('sidebar');
  const menuButton = document.getElementById('menuBtn');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.appendChild(backdrop);

  function syncSidebarBackdrop(){
    const mobile = window.matchMedia('(max-width:820px)').matches;
    backdrop.classList.toggle('show', mobile && sidebar?.classList.contains('open'));
  }
  menuButton?.addEventListener('click', () => requestAnimationFrame(syncSidebarBackdrop));
  backdrop.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    syncSidebarBackdrop();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.nav-item')) requestAnimationFrame(syncSidebarBackdrop);
  });
  window.addEventListener('resize', syncSidebarBackdrop, { passive:true });

  // Escape closes the mobile navigation before it affects anything else.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar?.classList.contains('open') && window.matchMedia('(max-width:820px)').matches) {
      sidebar.classList.remove('open');
      syncSidebarBackdrop();
    }
  });
})();
