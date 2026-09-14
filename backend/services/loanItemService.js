const { Sale } = require('../models');

const computeItemStatus = (item) => {
  if (!item) return 'UNPAID';
  if (item.returned) return 'RETURNED';
  const total = Number(item.total) || 0;
  const paid = Number(item.amountPaid) || 0;
  const outstanding = Math.max(0, total - paid);
  if (outstanding <= 0) return 'PAID';
  if (paid > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

const effectiveLoanStatus = (loan) => {
  if (!loan) return 'PAID';
  if (loan.status === 'CANCELLED') return 'CANCELLED';
  if (['ACTIVE', 'PARTIALLY_PAID'].includes(loan.status) && loan.dueDate && new Date(loan.dueDate) < new Date()) {
    return 'OVERDUE';
  }
  return loan.status;
};

const computeLoanStatus = (loan, items = loan && loan.loanItems) => {
  if (!loan) return 'PAID';
  if (loan.status === 'CANCELLED') return 'CANCELLED';
  const active = (items || []).filter((it) => !it.returned);
  if (active.length === 0) return 'PAID';
  const anyOwed = active.some((it) => (it.outstanding || 0) > 0);
  if (!anyOwed) return 'PAID';
  const anyPartial = active.some((it) => (it.amountPaid || 0) > 0 && (it.outstanding || 0) > 0) || (loan.amountPaid || 0) > 0;
  return anyPartial ? 'PARTIALLY_PAID' : 'ACTIVE';
};

const recomputeLoan = (loan) => {
  if (!loan) return loan;
  const active = (loan.loanItems || []).filter((it) => !it.returned);
  loan.totalAmount = active.reduce((s, it) => s + (Number(it.total) || 0), 0);
  loan.amountPaid = active.reduce((s, it) => s + (Number(it.amountPaid) || 0), 0);
  loan.outstanding = active.reduce((s, it) => s + (Number(it.outstanding) || 0), 0);
  loan.status = computeLoanStatus(loan, loan.loanItems);
  return loan;
};

const allocateProportional = (items, amount) => {
  const sum = items.reduce((s, it) => s + (it.total || 0), 0);
  if (sum <= 0 || !amount || amount <= 0) return items;
  let allocated = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (i === items.length - 1) {
      const add = Math.min(Math.max(0, amount - allocated), it.total - it.amountPaid);
      it.amountPaid += add;
      allocated += add;
    } else {
      const share = Math.min(Math.round((it.total / sum) * amount), it.total - it.amountPaid);
      it.amountPaid += share;
      allocated += share;
    }
  }
  return items;
};

const buildLoanItems = (saleItems, { upfrontPaid = 0, itemDate = new Date(), discount = 0 } = {}) => {
  let items = (saleItems || [])
    .filter((it) => it && (it.total > 0 || (it.quantity && it.price)))
    .map((it) => ({
      product: it.product || null,
      name: it.name,
      sku: it.sku || '',
      quantity: it.quantity || 1,
      price: it.price || 0,
      total: it.subtotal != null ? Number(it.subtotal) : (Number(it.quantity) || 1) * (Number(it.price) || 0),
      amountPaid: 0,
      outstanding: 0,
      status: 'UNPAID',
      returned: false,
      date: itemDate,
    }))
    .filter((it) => it.total > 0);

  const rawSum = items.reduce((s, it) => s + it.total, 0);
  const discountAmount = Math.max(0, Number(discount) || 0);
  const targetSum = Math.max(0, rawSum - discountAmount);
  if (rawSum > 0 && targetSum !== rawSum) {
    const factor = targetSum / rawSum;
    let scaled = items.map((it) => ({ ...it, total: Math.round(it.total * factor) }));
    const diff = targetSum - scaled.reduce((s, it) => s + it.total, 0);
    if (diff !== 0 && scaled.length) {
      const largest = scaled.reduce((a, b) => (a.total >= b.total ? a : b), scaled[0]);
      largest.total += diff;
    }
    items = scaled;
  }

  allocateProportional(items, Number(upfrontPaid) || 0);
  for (const it of items) {
    it.outstanding = Math.max(0, it.total - it.amountPaid);
    it.status = computeItemStatus(it);
  }
  return items;
};

const allocateFIFO = (items, amount) => {
  const allocations = [];
  let remaining = Number(amount) || 0;
  const active = (items || []).filter((it) => !it.returned);
  for (const it of active) {
    if (remaining <= 0) break;
    const cap = Math.max(0, (it.total || 0) - (it.amountPaid || 0));
    if (cap <= 0) continue;
    const allocated = Math.min(remaining, cap);
    allocations.push({ item: it, allocated });
    remaining -= allocated;
  }
  return allocations;
};

const ensureLoanItems = async (loan) => {
  if (!loan) return null;
  if (loan.loanItems && loan.loanItems.length > 0) return loan;

  const sale = await Sale.findById(loan.sale).lean();
  const rawItems = (sale && sale.items) || [];

  let items;
  if (rawItems.length > 0 && (loan.totalAmount || 0) > 0) {
    const discount = Math.max(0, (Number(sale.subtotal) || 0) - (Number(sale.total) || 0));
    items = buildLoanItems(rawItems, {
      upfrontPaid: Number(loan.amountPaid) || 0,
      itemDate: loan.date || loan.createdAt,
      discount,
    });
  } else {
    const total = Number(loan.totalAmount) || 0;
    const upfront = Math.min(Number(loan.amountPaid) || 0, total);
    items = [{
      product: null,
      name: loan.customerName || 'Loan',
      sku: '',
      quantity: 1,
      price: total,
      total,
      amountPaid: upfront,
      outstanding: Math.max(0, total - upfront),
      status: upfront >= total ? 'PAID' : upfront > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      returned: false,
      date: loan.date || loan.createdAt,
    }];
  }

  loan.loanItems = items;
  recomputeLoan(loan);
  await loan.save();
  return loan;
};

module.exports = {
  computeItemStatus,
  effectiveLoanStatus,
  computeLoanStatus,
  recomputeLoan,
  buildLoanItems,
  allocateFIFO,
  allocateProportional,
  ensureLoanItems,
};