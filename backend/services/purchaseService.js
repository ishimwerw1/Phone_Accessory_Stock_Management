const ITEM_STATUS_RETURNED = 'RETURNED';

const computeItemStatus = (it) => {
  if (!it) return 'UNPAID';
  const qty = Number(it.quantity) || 0;
  if ((it.returned || (Number(it.returnedQty) || 0) > 0) && qty <= 0) return ITEM_STATUS_RETURNED;
  const value = Number(it.subtotal) || 0;
  const paid = Number(it.amountPaid) || 0;
  const remaining = Math.max(0, value - paid);
  if (value <= 0) return ITEM_STATUS_RETURNED;
  if (remaining <= 0) return 'PAID';
  if (paid > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

// Keeps a single item financially consistent after a quantity/cost change.
// If the paid amount exceeds the item's current value (e.g. a paid product was
// returned or had its quantity/cost reduced), the surplus becomes a refundable
// credit. Returns the refund-eligible surplus so callers can post a REFUND entry.
const settleItem = (it) => {
  const qty = Math.max(0, Number(it.quantity) || 0);
  const price = Number(it.costPrice) || 0;
  const value = qty * price;
  const origQty = Math.max(Number(it.originalQuantity) || 0, qty);
  it.originalQuantity = origQty;
  it.subtotal = value;
  if (!it.originalSubtotal || Number(it.originalSubtotal) <= 0) {
    it.originalSubtotal = origQty * price;
  }
  const paid = Math.max(0, Number(it.amountPaid) || 0);
  const over = paid - value;
  let refund = 0;
  if (over > 0) {
    refund = over;
    it.refundAmount = (Number(it.refundAmount) || 0) + over;
    it.amountPaid = value;
    it.remaining = 0;
  } else {
    it.remaining = Math.max(0, value - paid);
  }
  it.paymentStatus = computeItemStatus(it);
  return refund;
};

const isActiveItem = (it) => !((it && it.returned) && (Number(it.quantity) || 0) <= 0);

const recomputePurchase = (purchase) => {
  const items = purchase.items || [];
  let total = 0;
  let paid = 0;
  let remaining = 0;
  let refunded = 0;
  let returnedQty = 0;
  let returnedValue = 0;
  const actives = [];
  for (const it of items) {
    settleItem(it);
    paid += Number(it.amountPaid) || 0;
    refunded += Number(it.refundAmount) || 0;
    returnedQty += Number(it.returnedQty) || 0;
    returnedValue += (Number(it.returnedQty) || 0) * (Number(it.costPrice) || 0);
    if (isActiveItem(it)) actives.push(it);
  }
  total = actives.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  remaining = actives.reduce((s, it) => s + (Number(it.remaining) || 0), 0);
  purchase.totalAmount = total;
  purchase.amountPaid = paid;
  purchase.remainingAmount = remaining;
  purchase.refundedAmount = refunded;
  purchase.returnedQty = returnedQty;
  purchase.returnedValue = returnedValue;
  if (actives.length === 0) purchase.paymentStatus = 'PAID';
  else if (remaining <= 0) purchase.paymentStatus = 'PAID';
  else if (paid > 0) purchase.paymentStatus = 'PARTIALLY_PAID';
  else purchase.paymentStatus = 'UNPAID';
  return purchase;
};

// Allocates a payment across active items first-in-first-out (like the loan
// system does) and mutates the purchase items.
const allocateFIFO = (items, amount) => {
  const allocations = [];
  let remaining = Number(amount) || 0;
  const active = (items || []).filter(isActiveItem);
  for (const it of active) {
    if (remaining <= 0) break;
    const cap = Math.max(0, (Number(it.subtotal) || 0) - (Number(it.amountPaid) || 0));
    if (cap <= 0) continue;
    const allocated = Math.min(remaining, cap);
    allocations.push({ item: it, allocated, purchaseItemId: it._id });
    remaining -= allocated;
  }
  return allocations;
};

const payPurchaseItems = (purchase, amount) => {
  const allocations = allocateFIFO(purchase.items, amount);
  let totalPaid = 0;
  for (const { item, allocated } of allocations) {
    item.amountPaid = (Number(item.amountPaid) || 0) + allocated;
    totalPaid += allocated;
  }
  if (totalPaid <= 0) return [];
  recomputePurchase(purchase);
  return allocations.map((a) => ({ item: a.item, amount: a.allocated }));
};

// Splits an existing purchase-level paid amount across its items (used by the
// data migration so legacy purchases gain per-item payment data).
const allocateProportional = (items, amountPaid) => {
  const active = (items || []).filter((it) => (Number(it.subtotal) || 0) > 0);
  const sum = active.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  if (sum <= 0 || !amountPaid || Number(amountPaid) <= 0) return items;
  let allocated = 0;
  for (let i = 0; i < active.length; i++) {
    const it = active[i];
    if (i === active.length - 1) {
      const add = Math.min(Math.max(0, Number(amountPaid) - allocated), Number(it.subtotal));
      it.amountPaid = (Number(it.amountPaid) || 0) + add;
      allocated += add;
    } else {
      const share = Math.min(Math.round((Number(it.subtotal) / sum) * Number(amountPaid)), Number(it.subtotal));
      it.amountPaid = (Number(it.amountPaid) || 0) + share;
      allocated += share;
    }
  }
  return items;
};

const serializeItem = (it, purchase) => ({
  _id: it._id,
  purchaseId: purchase._id,
  purchaseNumber: purchase.purchaseNumber,
  purchaseDate: it.date || purchase.purchaseDate || purchase.createdAt,
  product: it.product,
  productName: it.productName,
  sku: it.sku,
  quantity: it.quantity,
  originalQuantity: it.originalQuantity || it.quantity,
  returnedQty: it.returnedQty || 0,
  costPrice: it.costPrice,
  subtotal: it.subtotal,
  originalSubtotal: it.originalSubtotal || it.subtotal,
  amountPaid: it.amountPaid || 0,
  remaining: it.remaining != null ? it.remaining : Math.max(0, (it.subtotal || 0) - (it.amountPaid || 0)),
  paymentStatus: it.paymentStatus || computeItemStatus(it),
  returned: Boolean(it.returned),
  refundAmount: it.refundAmount || 0,
  returnedOn: it.returnedOn || null,
  returnReason: it.returnReason || '',
});

// Groups purchases by supplier for the Purchases screen. Recomputation happens
// in memory only — nothing here writes to the database.
const buildGroups = (purchases) => {
  const map = new Map();
  for (const p of purchases) {
    recomputePurchase(p);
    const supplierId = p.supplier && p.supplier._id ? p.supplier._id : p.supplier;
    if (!supplierId) continue;
    const key = String(supplierId);
    let g = map.get(key);
    if (!g) {
      const sup = p.supplier && p.supplier._id ? p.supplier : null;
      g = {
        supplier: key,
        supplierName: p.supplierName || (sup && sup.name) || 'Unknown',
        supplierPhone: (sup && sup.phone) || p.supplierPhone || '',
        purchaseCount: 0,
        productCount: 0,
        activeProductCount: 0,
        totalQty: 0,
        totalAmount: 0,
        totalPaid: 0,
        remainingAmount: 0,
        refundedAmount: 0,
        returnedQty: 0,
        returnedValue: 0,
        paidCount: 0,
        unpaidCount: 0,
        partialCount: 0,
        returnedCount: 0,
        status: 'PAID',
        minDate: null,
        maxDate: null,
      };
      map.set(key, g);
    }
    g.purchaseCount += 1;
    const pd = p.purchaseDate || p.createdAt;
    if (pd) {
      if (!g.minDate || pd < g.minDate) g.minDate = pd;
      if (!g.maxDate || pd > g.maxDate) g.maxDate = pd;
    }
    for (const it of (p.items || [])) {
      const active = isActiveItem(it);
      g.productCount += 1;
      if (active) {
        g.activeProductCount += 1;
        g.totalQty += Number(it.quantity) || 0;
        g.totalAmount += Number(it.subtotal) || 0;
        g.remainingAmount += Number(it.remaining) || 0;
      }
      g.totalPaid += Number(it.amountPaid) || 0;
      g.refundedAmount += Number(it.refundAmount) || 0;
      g.returnedQty += Number(it.returnedQty) || 0;
      g.returnedValue += (Number(it.returnedQty) || 0) * (Number(it.costPrice) || 0);
      if (it.paymentStatus === 'PAID') g.paidCount += 1;
      else if (it.paymentStatus === 'PARTIALLY_PAID') g.partialCount += 1;
      else if (it.paymentStatus === 'RETURNED') g.returnedCount += 1;
      else g.unpaidCount += 1;
    }
  }
  for (const g of map.values()) {
    if (g.activeProductCount === 0) g.status = 'PAID';
    else if (g.remainingAmount <= 0) g.status = 'PAID';
    else if (g.totalPaid > 0) g.status = 'PARTIALLY_PAID';
    else g.status = 'UNPAID';
  }
  return [...map.values()];
};

const groupTotals = (purchases) => {
  let productCount = 0;
  let activeProductCount = 0;
  let totalQty = 0;
  let totalAmount = 0;
  let totalPaid = 0;
  let remainingAmount = 0;
  let refundedAmount = 0;
  let returnedQty = 0;
  let returnedValue = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let partialCount = 0;
  let returnedCount = 0;
  for (const p of purchases) {
    for (const it of (p.items || [])) {
      const active = isActiveItem(it);
      productCount += 1;
      if (active) {
        activeProductCount += 1;
        totalQty += Number(it.quantity) || 0;
        totalAmount += Number(it.subtotal) || 0;
        remainingAmount += Number(it.remaining) || 0;
      }
      totalPaid += Number(it.amountPaid) || 0;
      refundedAmount += Number(it.refundAmount) || 0;
      returnedQty += Number(it.returnedQty) || 0;
      returnedValue += (Number(it.returnedQty) || 0) * (Number(it.costPrice) || 0);
      if (it.paymentStatus === 'PAID') paidCount += 1;
      else if (it.paymentStatus === 'PARTIALLY_PAID') partialCount += 1;
      else if (it.paymentStatus === 'RETURNED') returnedCount += 1;
      else unpaidCount += 1;
    }
  }
  let status = 'PAID';
  if (activeProductCount > 0) {
    if (remainingAmount <= 0) status = 'PAID';
    else if (totalPaid > 0) status = 'PARTIALLY_PAID';
    else status = 'UNPAID';
  }
  return {
    productCount,
    activeProductCount,
    totalQty,
    totalAmount,
    totalPaid,
    remainingAmount,
    refundedAmount,
    returnedQty,
    returnedValue,
    paidCount,
    unpaidCount,
    partialCount,
    returnedCount,
    status,
  };
};

// One-time, idempotent data migration:
//  - backfills purchaseDate from createdAt
//  - creates per-item payment/return fields for legacy purchases
//  - re-computes purchase totals from items
const migratePurchaseData = async () => {
  const { Purchase } = require('../models');
  const needsMigration = await Purchase.exists({
    $or: [
      { purchaseDate: { $exists: false } },
      { 'items.paymentStatus': { $exists: false } },
      { 'items.amountPaid': { $exists: false } },
      { 'items.originalQuantity': { $exists: false } },
    ],
  });
  if (!needsMigration) return { migrated: false, processed: 0 };

  const purchases = await Purchase.find({});
  let processed = 0;
  for (const p of purchases) {
    let changed = false;
    if (!p.purchaseDate) {
      const d = p.createdAt ? new Date(p.createdAt) : new Date();
      p.purchaseDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      changed = true;
    }
    const items = p.items || [];
    const needsAlloc = items.length > 0 && items.every((i) => i.amountPaid === undefined);
    const legacyPaid = Number(p.amountPaid) || 0;
    for (const it of items) {
      if (it.amountPaid === undefined) { it.amountPaid = 0; changed = true; }
      if (it.remaining === undefined) { it.remaining = Number(it.subtotal) || 0; changed = true; }
      if (it.paymentStatus === undefined) changed = true;
      if (it.returnedQty === undefined) { it.returnedQty = 0; changed = true; }
      if (it.refundAmount === undefined) { it.refundAmount = 0; changed = true; }
      if (it.returned === undefined) {
        it.returned = Boolean(it.returnedQty > 0);
      }
      if (!it.originalQuantity) { it.originalQuantity = it.quantity; changed = true; }
      if (!it.date) { it.date = p.purchaseDate; changed = true; }
    }
    if (needsAlloc && legacyPaid > 0) {
      allocateProportional(p.items, legacyPaid);
      changed = true;
    }
    if (changed) {
      recomputePurchase(p);
      await p.save();
      processed += 1;
    }
  }
  return { migrated: true, processed };
};

module.exports = {
  computeItemStatus,
  settleItem,
  isActiveItem,
  recomputePurchase,
  allocateFIFO,
  allocateProportional,
  payPurchaseItems,
  serializeItem,
  buildGroups,
  groupTotals,
  migratePurchaseData,
};