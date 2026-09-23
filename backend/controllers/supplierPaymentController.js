const { SupplierPayment, Purchase } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { nextNumber } = require('../utils/helpers');
const { allocateFIFO, payPurchaseItems, recomputePurchase } = require('../services/purchaseService');

exports.getAll = asyncHandler(async (req, res) => {
  const { purchase, supplier, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (purchase) filter.purchase = purchase;
  if (supplier) filter.supplier = supplier;

  const skip = (Number(page) - 1) * Number(limit);
  const [payments, total] = await Promise.all([
    SupplierPayment.find(filter)
      .populate('purchase', 'purchaseNumber type sale')
      .populate({
        path: 'purchase.sale',
        select: 'saleNumber total paymentMethod createdBy',
        populate: { path: 'customer', select: 'name phone' },
      })
      .populate('supplier', 'name')
      .populate('receivedBy', 'name')
      .sort('-date').skip(skip).limit(Number(limit)),
    SupplierPayment.countDocuments(filter),
  ]);

  success(res, 'Supplier payments', { payments, total, pages: Math.ceil(total / Number(limit)) || 1 });
});

const recordPayment = async ({ purchase, item, amount, paymentMethod, reference, note, user, previousRemaining, newRemaining }) => {
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
    type: 'PAYMENT',
    paymentMethod: paymentMethod || 'CASH',
    reference,
    note,
    receivedBy: user._id,
  });
  await payment.populate('receivedBy', 'name');
  await payment.populate('supplier', 'name');
  await payment.populate('purchase', 'purchaseNumber');
  return payment;
};

exports.create = asyncHandler(async (req, res) => {
  const { purchaseId, amount, paymentMethod, reference, note } = req.body;

  if (!purchaseId || !amount || Number(amount) <= 0) {
    return error(res, 'Purchase ID and valid amount are required');
  }

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.status === 'CANCELLED') return error(res, 'This purchase is cancelled');
  const allocations = allocateFIFO(purchase.items, Number(amount));
  const allocatable = allocations.reduce((s, a) => s + Number(a.allocated), 0);
  if (allocatable <= 0) return error(res, 'This purchase has no outstanding balance');
  if (Number(amount) > allocatable) return error(res, 'Payment exceeds remaining amount');

  const previousRemaining = Number(purchase.remainingAmount) || 0;
  const paid = payPurchaseItems(purchase, Number(amount));
  const newRemaining = Number(purchase.remainingAmount) || 0;
  await purchase.save();

  const created = [];
  for (const { item, amount: itemAmount } of paid) {
    const payment = await recordPayment({
      purchase, item, amount: itemAmount, paymentMethod, reference, note,
      user: req.user, previousRemaining: newRemaining + itemAmount, newRemaining,
    });
    created.push(payment);
    await audit(req, 'SUPPLIER_PAYMENT', 'SupplierPayment', payment._id, {
      purchaseNumber: purchase.purchaseNumber, itemName: item.productName, amount: itemAmount, remaining: newRemaining,
    });
  }

  success(res, 'Payment recorded', { payment: created[0], payments: created, purchase }, 201);
});