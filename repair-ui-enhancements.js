(() => {
  const money = value => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
  const parseMoney = text => Number(String(text || '').replace(/[^0-9,.-]/g, '').replaceAll('.', '').replace(',', '.')) || 0;

  function enhanceRepairPricing() {
    const section = [...document.querySelectorAll('.form-section')].find(s => s.querySelector('h3')?.textContent.trim() === 'Kosten & verkoop');
    if (!section) return;

    const muted = section.querySelector('.section-head .muted');
    if (muted) muted.remove();

    const headCells = section.querySelectorAll('.cost-grid-head > span');
    if (headCells.length >= 5) {
      headCells[2].textContent = 'Aankoop/st. excl. btw';
      headCells[3].textContent = 'Verkoop/st. excl. btw';
      headCells[4].textContent = 'Totaal excl. btw';
    }

    const totals = section.querySelector('.repair-totals');
    if (!totals) return;

    const purchaseLabel = totals.querySelector('#repairPurchaseTotal')?.parentElement?.querySelector('span');
    const salesLabel = totals.querySelector('#repairSalesTotal')?.parentElement?.querySelector('span');
    const marginLabel = totals.querySelector('#repairMarginTotal')?.parentElement?.querySelector('span');
    if (purchaseLabel) purchaseLabel.textContent = 'Aankoop excl. btw';
    if (salesLabel) salesLabel.textContent = 'Verkoop excl. btw';
    if (marginLabel) marginLabel.textContent = 'Marge excl. btw';

    if (!document.querySelector('#repairVatTotal')) {
      const vat = document.createElement('div');
      vat.innerHTML = '<span>BTW 21%</span><strong id="repairVatTotal">€ 0,00</strong>';
      const incl = document.createElement('div');
      incl.className = 'repair-total-incl';
      incl.innerHTML = '<span>Verkoop incl. 21% btw</span><strong id="repairSalesInclTotal">€ 0,00</strong>';
      totals.append(vat, incl);
    }

    const salesEl = document.querySelector('#repairSalesTotal');
    const updateVat = () => {
      const excl = parseMoney(salesEl?.textContent);
      const vat = excl * 0.21;
      const incl = excl * 1.21;
      const vatEl = document.querySelector('#repairVatTotal');
      const inclEl = document.querySelector('#repairSalesInclTotal');
      if (vatEl) vatEl.textContent = money(vat);
      if (inclEl) inclEl.textContent = money(incl);
    };

    updateVat();
    if (salesEl && !salesEl.dataset.vatObserver) {
      salesEl.dataset.vatObserver = '1';
      new MutationObserver(updateVat).observe(salesEl, { childList: true, characterData: true, subtree: true });
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#newRepairBtn,[data-edit-repair]')) {
      requestAnimationFrame(enhanceRepairPricing);
      setTimeout(enhanceRepairPricing, 80);
    }
  });

  document.addEventListener('DOMContentLoaded', enhanceRepairPricing);
  enhanceRepairPricing();
})();
