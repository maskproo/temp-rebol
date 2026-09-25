// Sidebar toggle
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('collapsed');
});

// Confirm delete
document.querySelectorAll('[data-confirm]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    if (!confirm(btn.dataset.confirm || 'هل أنت متأكد من الحذف؟')) {
      e.preventDefault();
    }
  });
});

// Auto-dismiss alerts
setTimeout(() => {
  document.querySelectorAll('.alert-auto-dismiss').forEach(el => {
    el.style.transition = 'opacity 0.5s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  });
}, 3000);

// Invoice / Journal - dynamic rows
window.addRow = function (tableId, template) {
  const tbody = document.getElementById(tableId);
  const row = document.createElement('tr');
  row.className = 'item-row';
  row.innerHTML = template;
  tbody.appendChild(row);
  updateTotals();
};

window.removeRow = function (btn) {
  const tbody = btn.closest('tbody');
  if (tbody.rows.length > 1) {
    btn.closest('tr').remove();
    updateTotals();
  }
};

// Invoice total calculation
window.updateTotals = function () {
  let subtotal = 0;
  document.querySelectorAll('.item-row').forEach(row => {
    const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
    const total = qty * price;
    const totalCell = row.querySelector('.item-total');
    if (totalCell) totalCell.textContent = formatNumber(total);
    subtotal += total;
  });

  const taxRate = parseFloat(document.getElementById('taxRate')?.value) || 0;
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;

  if (document.getElementById('subtotalDisplay')) {
    document.getElementById('subtotalDisplay').textContent = formatNumber(subtotal);
    document.getElementById('taxDisplay').textContent = formatNumber(taxAmount);
    document.getElementById('totalDisplay').textContent = formatNumber(total);
  }
};

// Journal balance check
window.updateJournalBalance = function () {
  let totalDebit = 0, totalCredit = 0;
  document.querySelectorAll('.journal-row').forEach(row => {
    totalDebit += parseFloat(row.querySelector('.j-debit')?.value) || 0;
    totalCredit += parseFloat(row.querySelector('.j-credit')?.value) || 0;
  });
  const diff = Math.abs(totalDebit - totalCredit);
  const balEl = document.getElementById('journalBalance');
  if (balEl) {
    balEl.textContent = `مجموع المدين: ${formatNumber(totalDebit)} | مجموع الدائن: ${formatNumber(totalCredit)}`;
    balEl.className = diff < 0.01 ? 'text-success fw-bold' : 'text-danger fw-bold';
  }
};

function formatNumber(n) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2 }).format(n);
}

// Initialize
document.querySelectorAll('.item-qty, .item-price').forEach(el => {
  el.addEventListener('input', updateTotals);
});
document.getElementById('taxRate')?.addEventListener('input', updateTotals);
document.querySelectorAll('.j-debit, .j-credit').forEach(el => {
  el.addEventListener('input', updateJournalBalance);
});
