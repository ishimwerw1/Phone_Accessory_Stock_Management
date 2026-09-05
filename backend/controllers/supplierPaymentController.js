const { SupplierPayment, Purchase } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { nextNumber } = require('../utils/helpers');

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

exports.create = asyncHandler(async (req, res) => {
  const { purchaseId, amount, paymentMethod, reference, note } = req.body;

  if (!purchaseId || !amount || Number(amount) <= 0) {
    return error(res, 'Purchase ID and valid amount are required');
  }

  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) return error(res, 'Purchase not found', 404);
  if (purchase.paymentStatus === 'PAID') return error(res, 'This purchase is already fully paid');
  if (Number(amount) > purchase.remainingAmount) return error(res, 'Payment exceeds remaining amount');

  const paymentNumber = await nextNumber('SUP');
  const previousRemaining = purchase.remainingAmount;
  const newRemaining = previousRemaining - Number(amount);

  const payment = await SupplierPayment.create({
    paymentNumber,
    purchase: purchase._id,
    purchaseNumber: purchase.purchaseNumber,
    supplier: purchase.supplier,
    supplierName: purchase.supplierName,
    amount: Number(amount),
    previousRemaining,
    newRemaining,
    paymentMethod: paymentMethod || 'CASH',
    reference,
    note,
    receivedBy: req.user._id,
  });

  // Update purchase
  purchase.amountPaid += Number(amount);
  purchase.remainingAmount = newRemaining;
  purchase.paymentStatus = newRemaining <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  await purchase.save();

  await payment.populate('receivedBy', 'name');
  await payment.populate('supplier', 'name');
  await payment.populate('purchase', 'purchaseNumber');
  await audit(req, 'SUPPLIER_PAYMENT', 'SupplierPayment', payment._id, {
    purchaseNumber: purchase.purchaseNumber, amount: Number(amount), remaining: newRemaining,
  });

  success(res, 'Payment recorded', payment, 201);
});
