const mongoose = require('mongoose');
const { Purchase, Product, StockTransaction, SupplierPayment, Supplier } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { nextNumber } = require('../utils/helpers');
const { normalizeDateOnly, todayUtc } = require('../utils/date');
const {
  computeItemStatus,
  settleItem,
  recomputePurchase,
  payPurchaseItems,
  serializeItem,
  buildGroups,
  groupTotals,
} = require('../services/purchaseService');

const buildPurchaseItems = async (items) => {
  const purchaseItems = [];
  let totalAmount = 0;
  for (const item of items) {
    if (!item.product || !item.quantity || typeof item.costPrice === 'undefined') {
      throw Object.assign(new Error('Each item must have product, quantity, and costPrice'), { status: 400 });
    }
    if (Number(item.quantity) <= 0) throw Object.assign(new Error('Quantity must be greater than 0'), { status: 400 });
    if (Number(item.costPrice) < 0) throw Object.assign(new Error('Cost price cannot be negative'), { status: 400 });

    const product = await Product.findById(item.product);
    if (!product) throw Object.assign(new Error(`Product not found: ${item.product}`), { status: 404 });

    const subtotal = Number(item.quantity) * Number(item.costPrice);
    totalAmount += subtotal;

    purchaseItems.push({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: Number(item.quantity),
      costPrice: Number(item.costPrice),
      subtotal,
    });
  }
  return { purchaseItems, totalAmount };
};

const adjustStock = async (product, delta, reason, reference, user) => {
  if (!product || !delta) return;
  const prevQty = product.quantity;
  product.quantity = Math.max(0, Number(product.quantity) + delta);
  await product.save();
  await StockTransaction.create({
    product: product._id,
    productName: product.name,
    sku: product.sku,
    type: delta > 0 ? 'STOCK_IN' : 'RETURN',
    quantity: Math.abs(delta),
    prevQuantity: prevQty,
    newQuantity: product.quantity,
    reason,
    reference,
    performedBy: user._id,
  });
};

const recordSupplierPayment = async ({ purchase, item, amount, type = 'PAYMENT', paymentMethod = 'CASH', reference, note, date, user, previousRemaining, newRemaining }) => {
  const paymentNumber = await nextNumber('SUP');
  const payment = await SupplierPayment.create({
    paymentNumber,
    purchase: purchase._id,
    purchaseNumber: purchase.purchaseNumber,
    purchaseItem: item ? item._id : undefined,
    itemName: item ? item.productName : undefined,
    product: item ? item.product : undefined,
    supplier: purchase.supplier,
    supplierName: purchase.supplierName,
    amount,
    previousRemaining,
    newRemaining,
    type,
    paymentMethod,
    reference,
    note,
    receivedBy: user._id,
    date: date || Date.now(),
  });
  return payment;
};

const paymentMethodFor = (status) => (status === 'PAID' ? 'CASH' : 'CREDIT');

exports.getAll = asyncHandler(async (req, res) => {
  const { search, supplier, paymentStatus, status, type, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [
      { purchaseNumber: re },
      { supplierName: re },
      { notes: re },
      { 'items.productName': re },
      { 'items.sku': re },
    ];
  }
  if (supplier) filter.supplier = supplier;
  if (type) filter.type = type;
  if (!status) filter.status = { $ne: 'CANCELLED' };
  else if (status === 'CANCELLED') filter.status = 'CANCELLED';
  else filter.status = status;
  if (from || to) {
    filter.purchaseDate = {};
    if (from) {
      const fd = normalizeDateOnly(from);
      if (fd) filter.purchaseDate.$gte = fd;
    }
    if (to) {
      const td = normalizeDateOnly(to);
      if (td) {
        td.setUTCHours(23, 59, 59, 999);
        filter.purchaseDate.$lte = td;
      }
    }
    if (Object.keys(filter.purchaseDate).length === 0) delete filter.purchaseDate;
  }

  const purchases = await Purchase.find(filter)
    .populate('supplier', 'name phone')
    .populate('createdBy', 'name')
    .sort('-purchaseDate -createdAt')
    .lean();

  const purchaseCount = purchases.length;
  let groups = buildGroups(purchases);
  if (paymentStatus && paymentStatus !== 'ALL') {
    groups = groups.filter((g) => g.status === paymentStatus);
  }

  const total = groups.length;
  const pageN = Number(page) || 1;
  const limitN = Number(limit) || 20;
  const paged = groups.slice((pageN - 1) * limitN, pageN * limitN);

  success(res, 'Purchases', { groups: paged, total, pages: Math.ceil(total / limitN) || 1, page: pageN, purchaseCount });
});

exports.getOne = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate('supplier', 'name phone email address')
    .populate('items.product', 'name sku')
    .populate('sale', 'saleNumber total paymentMethod')
    .populate('createdBy', 'name');
  if (!purchase) return error(res, 'Purchase not found', 404);
  recomputePurchase(purchase);
  const payments = await SupplierPayment.find({ purchase: purchase._id }).populate('receivedBy', 'name').sort('-date');
  const serialized = purchase.toObject();
  serialized.items = (serialized.items || []).map((it) => serializeItem(it, serialized));
  serialized.purchaseDate = purchase.purchaseDate || purchase.createdAt;
  success(res, 'Purchase', { purchase: serialized, payments, sale: serialized.sale || null });
});

exports.getSupplierGroup = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.supplierId);
  if (!supplier) return error(res, 'Supplier not found', 404);

  const purchaseDocs = await Purchase.find({ supplier: supplier._id, status: { $ne: 'CANCELLED' } })
    .populate('createdBy', 'name')
    .sort('-purchaseDate -createdAt');

  for (const p of purchaseDocs) recomputePurchase(p);

  const purchases = purchaseDocs.map((p) => ({
    _id: p._id,
    purchaseNumber: p.purchaseNumber,
    type: p.type,
    status: p.status,
    purchaseDate: p.purchaseDate || p.createdAt,
    paymentStatus: p.paymentStatus,
    totalAmount: p.totalAmount,
    amountPaid: p.amountPaid,
    remainingAmount: p.remainingAmount,
    refundedAmount: p.refundedAmount,
    returnedQty: p.returnedQty,
    returnedValue: p.returnedValue,
    paymentMethod: p.paymentMethod,
    dueDate: p.dueDate,
    notes: p.notes,
    items: (p.items || []).map((it) => serializeItem(it, p)),
  }));

  const items = [];
  purchases.forEach((p) => items.push(...p.items));
  const totals = groupTotals(purchaseDocs);
  const payments = await SupplierPayment.find({ supplier: supplier._id }).populate('receivedBy', 'name').sort('-date');

  success(res, 'Supplier purchase group', { supplier, purchases, items, totals, payments });
});

exports.create = asyncHandler(async (req, res) => {
  const { supplier: supplierId, items, paymentMethod, amountPaid, dueDate, notes, purchaseDate } = req.body;

  if (!supplierId || !items || !items.length) {
    return error(res, 'Supplier and at least one item are required');
  }

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) return error(res, 'Supplier not found', 404);

  const { purchaseItems, totalAmount } = await buildPurchaseItems(items);
  const recordedDate = normalizeDateOnly(purchaseDate) || todayUtc();

  for (const it of purchaseItems) {
    it.originalQuantity = it.quantity;
    it.originalSubtotal = it.subtotal;
    it.amountPaid = 0;
    it.remaining = it.subtotal;
    it.paymentStatus = 'UNPAID';
    it.returned = false;
    it.returnedQty = 0;
    it.refundAmount = 0;
    it.date = recordedDate;
  }

  const paidAmount = Number(amountPaid) || 0;
  if (paidAmount > totalAmount) return error(res, 'Amount paid cannot exceed total amount');

  const purchaseNumber = await nextNumber('PUR');
  const purchase = new Purchase({
    purchaseNumber,
    supplier: supplier._id,
    supplierName: supplier.name,
    supplierPhone: supplier.phone,
    items: purchaseItems,
    totalAmount,
    purchaseDate: recordedDate,
    paymentMethod: paymentMethod || paymentMethodFor(null),
    createdBy: req.user._id,
    dueDate: dueDate || undefined,
    notes,
    status: 'RECEIVED',
  });

  if (paidAmount > 0) payPurchaseItems(purchase, paidAmount);
  purchase.paymentMethod = paymentMethod || purchase.paymentMethod || paymentMethodFor(purchase.paymentStatus);
  recomputePurchase(purchase);
  await purchase.save();

  // Update stock for each product
  for (const item of purchaseItems) {
    const product = await Product.findById(item.product);
    const prevQty = product.quantity;
    product.quantity += item.quantity;
    if (!product.supplier) product.supplier = supplier._id;
    await product.save();

    await StockTransaction.create({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      type: 'STOCK_IN',
      quantity: item.quantity,
      prevQuantity: prevQty,
      newQuantity: product.quantity,
      reason: `Purchase ${purchaseNumber}`,
      reference: purchaseNumber,
      performedBy: req.user._id,
    });
  }

  await purchase.populate('supplier', 'name phone');
  await purchase.populate('createdBy', 'name');
  await audit(req, 'PURCHASE_CREATED', 'Purchase', purchase._id, { purchaseNumber, supplier: supplier.name, totalAmount, paymentStatus: purchase.paymentStatus });
  success(res, 'Purchase created', purchase, 201);
});

const matchExistingItem = (purchase, raw, usedIds) => {
  if (raw._id && String(raw._id).match(/^[0-9a-fA-F]{24}$/)) {
    const byId = purchase.items.find((it) => String(it._id) === String(raw._id));
    if (byId) return byId;
  }
  return purchase.items.find((it) => !usedIds.has(String(it._id)) && String(it.product) === String(raw.product));
};

exports.update = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Cannot update a cancelled purchase');
  if (purchase.type === 'ON_DEMAND' || purchase.sale) {
    return error(res, 'On-demand purchases cannot be edited');
  }

  const { items, paymentMethod, dueDate, notes, purchaseDate, status } = req.body;

  if (items !== undefined) {
    if (!Array.isArray(items) || !items.length) return error(res, 'At least one item is required');
    const received = purchase.status === 'RECEIVED';
    const usedIds = new Set();
    const newItems = [];

    for (const raw of items) {
      const product = await Product.findById(raw.product);
      if (!product) return error(res, `Product not found: ${raw.product}`, 404);
      const qty = Math.floor(Number(raw.quantity));
      const price = Number(raw.costPrice);
      if (!qty || qty < 0) return error(res, 'Quantity must be greater than 0', 400);
      if (price < 0) return error(res, 'Cost price cannot be negative', 400);

      const existing = matchExistingItem(purchase, raw, usedIds);
      if (existing) {
        usedIds.add(String(existing._id));
        if (received) {
          const delta = qty - (Number(existing.quantity) || 0);
          const changedProduct = String(existing.product) !== String(product._id);
          if (changedProduct) {
            const oldProduct = await Product.findById(existing.product).catch(() => null);
            if (oldProduct) await adjustStock(oldProduct, -(Number(existing.quantity) || 0), `Purchase ${purchase.purchaseNumber} product changed`, purchase.purchaseNumber, req.user);
            await adjustStock(product, qty, `Purchase ${purchase.purchaseNumber} product changed`, purchase.purchaseNumber, req.user);
          } else if (delta !== 0) {
            await adjustStock(product, delta, `Purchase ${purchase.purchaseNumber} updated`, purchase.purchaseNumber, req.user);
          }
        }
        existing.product = product._id;
        existing.productName = product.name;
        existing.sku = product.sku;
        existing.originalQuantity = Math.max(Number(existing.originalQuantity) || 0, qty);
        existing.quantity = qty;
        existing.costPrice = price;
        if (raw.date) existing.date = normalizeDateOnly(raw.date) || existing.date;
        newItems.push(existing);
      } else {
        const subtotal = qty * price;
        const it = {
          product: product._id,
          productName: product.name,
          sku: product.sku,
          quantity: qty,
          originalQuantity: qty,
          costPrice: price,
          subtotal,
          originalSubtotal: subtotal,
          amountPaid: 0,
          remaining: subtotal,
          paymentStatus: 'UNPAID',
          returned: false,
          returnedQty: 0,
          refundAmount: 0,
          date: raw.date ? normalizeDateOnly(raw.date) : purchase.purchaseDate,
        };
        if (received) await adjustStock(product, qty, `Purchase ${purchase.purchaseNumber} item added`, purchase.purchaseNumber, req.user);
        newItems.push(it);
      }
    }

    for (const it of purchase.items) {
      if (usedIds.has(String(it._id))) continue;
      if (received) {
        const product = await Product.findById(it.product).catch(() => null);
        if (product) await adjustStock(product, -(Number(it.quantity) || 0), `Purchase ${purchase.purchaseNumber} item removed`, purchase.purchaseNumber, req.user);
      }
      const paid = Number(it.amountPaid) || 0;
      if (paid > 0) {
        await recordSupplierPayment({
          purchase, item: it, amount: paid, type: 'REFUND',
          note: `Refund — product "${it.productName}" removed while editing purchase ${purchase.purchaseNumber}`,
          user: req.user, previousRemaining: purchase.remainingAmount, newRemaining: Math.max(0, purchase.remainingAmount), // refined below after save
        });
      }
    }
    const prevItemRefunds = newItems.reduce((s, it) => s + (Number(it.refundAmount) || 0), 0);
    purchase.items = newItems;
  }

  if (purchaseDate) {
    const selectedDate = normalizeDateOnly(purchaseDate);
    if (selectedDate) {
      purchase.purchaseDate = selectedDate;
      purchase.markModified('purchaseDate');
      for (const it of (purchase.items || [])) {
        it.date = it.date || selectedDate;
      }
    }
  }
  if (paymentMethod) purchase.paymentMethod = paymentMethod;
  if (dueDate) purchase.dueDate = dueDate;
  if (notes !== undefined) purchase.notes = notes;
  if (status && status !== 'CANCELLED') purchase.status = status;
  purchase.updatedBy = req.user._id;

  recomputePurchase(purchase);

  const newRefunds = (purchase.items || []).reduce((s, it) => s + (Number(it.refundAmount) || 0), 0);
  const surplusRefund = Math.round(Math.max(0, newRefunds - prevItemRefunds) * 100) / 100;
  if (surplusRefund > 0) {
    await recordSupplierPayment({
      purchase, item: null, amount: surplusRefund, type: 'REFUND',
      note: `Refund — purchase ${purchase.purchaseNumber} items adjusted while editing`,
      user: req.user, previousRemaining: Math.max(0, Number(purchase.remainingAmount) - surplusRefund), newRemaining: purchase.remainingAmount,
    });
  }

  await purchase.save();
  await purchase.populate('supplier', 'name phone');
  await purchase.populate('createdBy', 'name');
  await audit(req, 'PURCHASE_UPDATED', 'Purchase', purchase._id, { purchaseNumber: purchase.purchaseNumber, totalAmount: purchase.totalAmount, paymentStatus: purchase.paymentStatus, purchaseDate: purchase.purchaseDate });
  success(res, 'Purchase updated successfully', purchase);
});

exports.remove = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Purchase is already cancelled');

  let refundedTotal = 0;

  for (const item of purchase.items || []) {
    if (purchase.status === 'RECEIVED') {
      const product = await Product.findById(item.product).catch(() => null);
      if (product) {
        await adjustStock(product, -(Number(item.quantity) || 0), `Purchase ${purchase.purchaseNumber} cancelled`, purchase.purchaseNumber, req.user);
      }
    }
    const paid = Number(item.amountPaid) || 0;
    if (paid > 0) {
      await recordSupplierPayment({
        purchase, item, amount: paid, type: 'REFUND',
        note: `Refund — purchase ${purchase.purchaseNumber} cancelled`,
        user: req.user, previousRemaining: purchase.remainingAmount, newRemaining: Math.max(0, Number(purchase.remainingAmount) - paid),
      });
      item.amountPaid = 0;
      item.remaining = 0;
      refundedTotal += paid;
    }
  }

  purchase.status = 'CANCELLED';
  purchase.amountPaid = 0;
  purchase.remainingAmount = 0;
  purchase.paymentStatus = 'PAID';
  purchase.refundedAmount = (Number(purchase.refundedAmount) || 0) + refundedTotal;
  purchase.updatedBy = req.user._id;
  await purchase.save();
  await audit(req, 'PURCHASE_DELETED', 'Purchase', purchase._id, { purchaseNumber: purchase.purchaseNumber, refunded: refundedTotal });
  success(res, 'Purchase cancelled');
});

exports.editItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { quantity, costPrice, date } = req.body;

  const purchase = await Purchase.findById(id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Purchase is cancelled');
  if (purchase.type === 'ON_DEMAND' || purchase.sale) return error(res, 'On-demand purchases cannot be edited');

  const item = purchase.items.id(itemId);
  if (!item) return error(res, 'Purchase item not found', 404);
  if (item.returned && (Number(item.quantity) || 0) <= 0) return error(res, 'A fully returned item cannot be edited');

  const oldQty = Number(item.quantity) || 0;
  const newQty = quantity !== undefined ? Math.floor(Number(quantity)) : oldQty;
  if (!newQty || newQty < 0) return error(res, 'Quantity must be greater than 0', 400);
  const newPrice = costPrice !== undefined ? Number(costPrice) : item.costPrice;
  if (newPrice < 0) return error(res, 'Cost price cannot be negative', 400);

  if (purchase.status === 'RECEIVED') {
    const delta = newQty - oldQty;
    if (delta !== 0) {
      const product = await Product.findById(item.product).catch(() => null);
      if (product) {
        await adjustStock(product, delta, `Purchase ${purchase.purchaseNumber} item edited`, purchase.purchaseNumber, req.user);
      }
    }
  }

  item.quantity = newQty;
  item.costPrice = newPrice;
  if (date) item.date = normalizeDateOnly(date) || item.date;

  const refund = settleItem(item);
  recomputePurchase(purchase);

  if (refund > 0) {
    await recordSupplierPayment({
      purchase, item, amount: refund, type: 'REFUND',
      note: `Refund — product "${item.productName}" adjusted on purchase ${purchase.purchaseNumber}`,
      user: req.user, previousRemaining: Math.max(0, Number(purchase.remainingAmount) - refund), newRemaining: purchase.remainingAmount,
    });
  }

  await purchase.save();
  await audit(req, 'PURCHASE_ITEM_UPDATED', 'Purchase', purchase._id, {
    purchaseNumber: purchase.purchaseNumber, itemId: String(item._id), itemName: item.productName, quantity: newQty, costPrice: newPrice, refund,
  });
  success(res, 'Purchase item updated', { purchase, item: serializeItem(item, purchase) });
});

exports.returnItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { qty, reason } = req.body;

  const purchase = await Purchase.findById(id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Purchase is cancelled');

  const item = purchase.items.id(itemId);
  if (!item) return error(res, 'Purchase item not found', 404);

  const current = Number(item.quantity) || 0;
  if (item.returned && current <= 0) return error(res, 'This item is already fully returned');
  const returnQty = qty !== undefined ? Math.floor(Number(qty)) : current;
  if (!returnQty || returnQty < 0) return error(res, 'Quantity to return must be greater than 0', 400);
  if (returnQty > current) return error(res, `Cannot return more than the remaining ${current} units`);

  if (purchase.status === 'RECEIVED') {
    const product = await Product.findById(item.product).catch(() => null);
    if (product) {
      await adjustStock(product, -returnQty, reason || `Purchase ${purchase.purchaseNumber} item returned`, purchase.purchaseNumber, req.user);
    }
  }

  item.quantity = current - returnQty;
  item.returnedQty = (Number(item.returnedQty) || 0) + returnQty;
  item.returned = item.returnedQty > 0;
  item.returnedOn = item.returned ? item.returnedOn || new Date() : item.returnedOn;
  item.returnReason = reason || item.returnReason;
  item.returnedBy = req.user._id;

  const refund = settleItem(item);
  recomputePurchase(purchase);

  if (refund > 0) {
    await recordSupplierPayment({
      purchase, item, amount: refund, type: 'REFUND',
      note: `Refund — "${item.productName}" returned on purchase ${purchase.purchaseNumber} (${returnQty} pcs)`,
      user: req.user, previousRemaining: Math.max(0, Number(purchase.remainingAmount) - refund), newRemaining: purchase.remainingAmount,
    });
  }

  await purchase.save();
  await audit(req, 'PURCHASE_ITEM_RETURNED', 'Purchase', purchase._id, {
    purchaseNumber: purchase.purchaseNumber, itemId: String(item._id), itemName: item.productName, quantity: returnQty, refund,
  });
  await notify('PRODUCT_RETURN', `"${item.productName}" (×${returnQty}) returned on purchase ${purchase.purchaseNumber}`, `"${item.productName}" (×${returnQty}) byagaruwe ku gura ${purchase.purchaseNumber}`, { product: item.product, loan: undefined, sale: undefined });
  success(res, 'Purchase item returned', { purchase, item: serializeItem(item, purchase), refund });
});

exports.removeItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  const purchase = await Purchase.findById(id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Purchase is cancelled');

  const item = purchase.items.id(itemId);
  if (!item) return error(res, 'Purchase item not found', 404);
  const paid = Number(item.amountPaid) || 0;
  const itemName = item.productName || 'Product';

  if (purchase.status === 'RECEIVED') {
    const product = await Product.findById(item.product).catch(() => null);
    if (product) {
      await adjustStock(product, -(Number(item.quantity) || 0), `Purchase ${purchase.purchaseNumber} item removed`, purchase.purchaseNumber, req.user);
    }
  }

  item.deleteOne();
  recomputePurchase(purchase);

  if (paid > 0) {
    await recordSupplierPayment({
      purchase, item: null, amount: paid, type: 'REFUND',
      note: `Refund — "${itemName}" deleted from purchase ${purchase.purchaseNumber}`,
      user: req.user, previousRemaining: Math.max(0, Number(purchase.remainingAmount) - paid), newRemaining: purchase.remainingAmount,
    });
    purchase.refundedAmount = (Number(purchase.refundedAmount) || 0) + paid;
  }

  if (!purchase.items || purchase.items.length === 0) {
    purchase.status = 'CANCELLED';
    purchase.remainingAmount = 0;
    purchase.paymentStatus = 'PAID';
  }

  await purchase.save();
  await audit(req, 'PURCHASE_ITEM_DELETED', 'Purchase', purchase._id, { purchaseNumber: purchase.purchaseNumber, itemId, itemName, refunded: paid });
  success(res, 'Purchase item removed', { purchase, refunded: paid });
});

exports.payItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { amount, method = 'CASH', reference, note, date } = req.body;
  const money = Number(amount);
  if (!money || money <= 0) return error(res, 'Enter a valid payment amount');

  const purchase = await Purchase.findById(id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Purchase is cancelled');

  const item = purchase.items.id(itemId);
  if (!item) return error(res, 'Purchase item not found', 404);
  if (item.returned && (Number(item.quantity) || 0) <= 0) return error(res, 'This item has been fully returned');

  settleItem(item);
  if (money > item.remaining) {
    return error(res, `Payment cannot exceed the remaining balance of ${item.remaining} RWF`);
  }

  const prevRemaining = Number(purchase.remainingAmount) || 0;
  item.amountPaid = (Number(item.amountPaid) || 0) + money;
  item.remaining = Math.max(0, (Number(item.subtotal) || 0) - item.amountPaid);
  item.paymentStatus = computeItemStatus(item);
  recomputePurchase(purchase);
  await purchase.save();

  await recordSupplierPayment({
    purchase, item, amount: money, type: 'PAYMENT', paymentMethod: method, reference, note, date,
    user: req.user, previousRemaining: prevRemaining, newRemaining: purchase.remainingAmount,
  });

  await purchase.populate('supplier', 'name phone');
  await purchase.populate('createdBy', 'name');
  await audit(req, 'PURCHASE_ITEM_PAYMENT', 'Purchase', purchase._id, {
    purchaseNumber: purchase.purchaseNumber, itemId: String(item._id), itemName: item.productName, amount: money, method, remaining: item.remaining,
  });
  await notify('SUPPLIER_PAYMENT', `Payment of ${money} RWF received for "${item.productName}" on purchase ${purchase.purchaseNumber}`, `Ishyurwa rya ${money} RWF kuri "${item.productName}" y'igura ${purchase.purchaseNumber}`, { product: item.product });
  success(res, 'Payment recorded', { purchase, item: serializeItem(item, purchase) });
});

const payOutstandingOnPurchase = async (purchase) => {
  const allocations = [];
  let total = 0;
  for (const it of (purchase.items || [])) {
    settleItem(it);
    if ((Number(it.remaining) || 0) > 0) {
      const amount = Math.round(Number(it.remaining) * 100) / 100;
      allocations.push({ item: it, amount });
      total += amount;
    }
  }
  if (!allocations.length) return { total: 0, allocations: [] };
  const prevRemaining = Number(purchase.remainingAmount) || 0;
  for (const { item, amount } of allocations) {
    item.amountPaid = (Number(item.amountPaid) || 0) + amount;
    item.remaining = 0;
    item.paymentStatus = computeItemStatus(item);
  }
  recomputePurchase(purchase);
  await purchase.save();
  return { total, prevRemaining, allocations, purchase };
};

exports.payAll = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const purchase = await Purchase.findById(id);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'Purchase is cancelled');

  const result = await payOutstandingOnPurchase(purchase);
  if (result.total <= 0) return error(res, 'This purchase has no outstanding balance');

  for (const { item, amount } of result.allocations) {
    await recordSupplierPayment({
      purchase, item, amount, type: 'PAYMENT', paymentMethod: 'CASH',
      note: `Pay all — purchase ${purchase.purchaseNumber}`,
      user: req.user, previousRemaining: result.prevRemaining, newRemaining: result.purchase.remainingAmount,
    });
  }

  await audit(req, 'PURCHASE_PAID', 'Purchase', purchase._id, { purchaseNumber: purchase.purchaseNumber, amount: result.total });
  success(res, 'Purchase fully paid', { purchase: result.purchase, total: result.total });
});

exports.payAllSupplier = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) return error(res, 'Supplier not found', 404);

  const purchases = await Purchase.find({ supplier: supplierId, status: { $ne: 'CANCELLED' } });
  let totalPaid = 0;
  const history = [];

  for (const purchase of purchases) {
    const result = await payOutstandingOnPurchase(purchase);
    if (result.total <= 0) continue;
    totalPaid += result.total;
    for (const { item, amount } of result.allocations) {
      await recordSupplierPayment({
        purchase, item, amount, type: 'PAYMENT', paymentMethod: 'CASH',
        note: 'Pay all remaining balances',
        user: req.user, previousRemaining: result.prevRemaining, newRemaining: result.purchase.remainingAmount,
      });
    }
    history.push({ purchase: result.purchase, total: result.total });
  }

  if (totalPaid <= 0) return error(res, 'This supplier has no outstanding balances');

  await audit(req, 'SUPPLIER_PAID', 'Supplier', supplier._id, { supplier: supplier.name, amount: totalPaid });
  await notify('SUPPLIER_PAYMENT', `All outstanding balances settled for ${supplier.name} — ${totalPaid} RWF`, `Ayo madeni yose ya ${supplier.name} yarishyuwe — ${totalPaid} RWF`, {});
  success(res, 'All supplier balances paid', { supplier, totalPaid, purchases: history });
});

exports.cancelSupplierGroup = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) return error(res, 'Supplier not found', 404);

  const purchases = await Purchase.find({ supplier: supplierId, status: { $ne: 'CANCELLED' } });
  if (purchases.length === 0) return error(res, 'This supplier has no active purchases');

  let cancelled = 0;
  let refundedTotal = 0;

  for (const purchase of purchases) {
    if (purchase.status === 'RECEIVED') {
      for (const item of purchase.items || []) {
        const product = await Product.findById(item.product).catch(() => null);
        if (product) {
          await adjustStock(product, -(Number(item.quantity) || 0), `Purchase ${purchase.purchaseNumber} cancelled (supplier group)`, purchase.purchaseNumber, req.user);
        }
      }
    }
    for (const item of purchase.items || []) {
      const paid = Number(item.amountPaid) || 0;
      if (paid > 0) {
        await recordSupplierPayment({
          purchase, item, amount: paid, type: 'REFUND',
          note: `Refund — supplier ${supplier.name} purchases cancelled`,
          user: req.user, previousRemaining: purchase.remainingAmount, newRemaining: Math.max(0, Number(purchase.remainingAmount) - paid),
        });
        item.amountPaid = 0;
        item.remaining = 0;
        refundedTotal += paid;
      }
    }
    purchase.status = 'CANCELLED';
    purchase.amountPaid = 0;
    purchase.remainingAmount = 0;
    purchase.paymentStatus = 'PAID';
    purchase.refundedAmount = (Number(purchase.refundedAmount) || 0) + refundedTotal;
    purchase.updatedBy = req.user._id;
    await purchase.save();
    cancelled += 1;
  }

  await audit(req, 'SUPPLIER_PURCHASES_CANCELLED', 'Supplier', supplier._id, { supplier: supplier.name, purchases: cancelled, refunded: refundedTotal });
  success(res, 'Supplier purchase group removed', { cancelled, refunded: refundedTotal });
});

exports.supplierDebts = asyncHandler(async (req, res) => {
  const { supplier, status, page = 1, limit = 20 } = req.query;
  const filter = { paymentStatus: { $ne: 'PAID' }, status: { $ne: 'CANCELLED' } };
  if (supplier) filter.supplier = supplier;
  if (status) filter.paymentStatus = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [purchases, total] = await Promise.all([
    Purchase.find(filter).populate('supplier', 'name phone').populate('createdBy', 'name').sort('-purchaseDate -createdAt').skip(skip).limit(Number(limit)),
    Purchase.countDocuments(filter),
  ]);

  // Summary stats
  const [allDebts] = await Promise.all([
    Purchase.aggregate([
      { $match: { paymentStatus: { $ne: 'PAID' }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, totalDebt: { $sum: '$totalAmount' }, totalPaid: { $sum: '$amountPaid' }, totalRemaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const now = new Date();
  const overduePurchases = await Purchase.countDocuments({ paymentStatus: { $ne: 'PAID' }, status: { $ne: 'CANCELLED' }, dueDate: { $lt: now } });
  const dueSoonPurchases = await Purchase.countDocuments({ paymentStatus: { $ne: 'PAID' }, status: { $ne: 'CANCELLED' }, dueDate: { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } });

  success(res, 'Supplier debts', {
    purchases,
    total,
    pages: Math.ceil(total / Number(limit)) || 1,
    summary: {
      totalDebt: allDebts[0]?.totalDebt || 0,
      totalPaid: allDebts[0]?.totalPaid || 0,
      totalRemaining: allDebts[0]?.totalRemaining || 0,
      count: allDebts[0]?.count || 0,
      overdueCount: overduePurchases,
      dueSoonCount: dueSoonPurchases,
    },
  });
});