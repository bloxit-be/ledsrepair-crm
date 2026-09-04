// Keep percentage display consistent with CRM pricing semantics:
// marginPercent is an uplift on purchase price (e.g. 30 => purchase * 1.30).
// The old list calculated gross margin on sale, which showed 23.1% for a 30% uplift.
marginPct = function(purchase, sale) {
  const cost = num(purchase);
  const selling = num(sale);
  if (!cost) return 0;
  return ((selling - cost) / cost) * 100;
};

// The initial render happens before this enhancement file loads.
// Refresh the product table once so existing products immediately show the corrected percentage.
if (typeof renderProducts === 'function') renderProducts();
