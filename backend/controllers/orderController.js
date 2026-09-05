const { Order, Product, Sale, Customer, StockTransaction, Payment, Loan } = require('../models');
const { success, error, asyncHandler } = require('../utils/response');
const { audit } = require('../services/auditService');
const { nextNumber } = require('../utils/helpers');

exports.getAll = asyncHandler(async (req, res) => {
  const { search, status, user, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  // Non-admin users see only their own orders
  const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
  const isManager = req.user.role === 'MANAGER';
  if (!isSuperAdmin && !isManager) {
    filter.createdBy = req.user._id;
  } else if (user) {
    filter.createdBy = user;
  }

  if (search) {
    const re = new RegExp(search, 'i');
    filter.$or = [{ orderNumber: re }, { customerName: re }];
  }
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59');
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter).populate('customer', 'name phone').populate('createdBy', 'name role').sort('-createdAt').skip(skip).limit(Number(limit)),
    Order.countDocuments(filter),
  ]);

  success(res, 'Orders', { orders, total, pages: Math.ceil(total / Number(limit)) || 1, page: Number(page) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name phone email')
    .populate('items.product', 'name sku')
    .populate('createdBy', 'name role')
    .populate('cancelledBy', 'name')
    .populate('completedBy', 'name');
  if (!order) return error(res, 'Order not found', 404);
  success(res, 'Order', order);
});

exports.create = asyncHandler(async (req, res) => {
  const { customer: customerId, customerName, customerPhone, items, discount, notes, expectedDeliveryDate } = req.body;

  if (!items || !items.length) return error(res, 'At least one item is required');

  let total = 0;
  const orderItems = [];

  for (const item of items) {
    if (!item.quantity || Number(item.quantity) <= 0) return error(res, 'Each item must have a valid quantity');
    if (item.product) {
      const product = await Product.findById(item.product);
      if (!product) return error(res, `Product not found: ${item.product}`);

      const subtotal = Number(item.quantity) * Number(item.price ?? product.sellingPrice);
      total += subtotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: Number(item.quantity),
        price: Number(item.price ?? product.sellingPrice),
        subtotal,
      });
    } else {
      if (!item.name) return error(res, 'Each item must reference a product or provide a product name');
      const price = Number(item.price);
      if (!isFinite(price) || price < 0) return error(res, 'Each item requires a valid price');

      const subtotal = Number(item.quantity) * price;
      total += subtotal;

      orderItems.push({
        name: item.name,
        sku: item.sku || '',
        quantity: Number(item.quantity),
        price,
        subtotal,
      });
    }
  }

  let customer = null;
  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer) return error(res, 'Customer not found', 404);
  }

  const orderNumber = await nextNumber('ORD');
  const order = await Order.create({
    orderNumber,
    customer: customer?._id,
    customerName: customer?.name || customerName || 'Walk-in',
    customerPhone: customer?.phone || customerPhone || '',
    items: orderItems,
    subtotal: total,
    discount: Number(discount) || 0,
    total: total - (Number(discount) || 0),
    notes,
    expectedDeliveryDate: expectedDeliveryDate || undefined,
    status: 'PENDING',
    createdBy: req.user._id,
  });

  await order.populate('customer', 'name phone');
  await order.populate('createdBy', 'name role');
  await audit(req, 'ORDER_CREATED', 'Order', order._id, { orderNumber, total: order.total });
  success(res, 'Order created', order, 201);
});

exports.fulfill = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return error(res, 'Order not found', 404);
  if (order.status !== 'PENDING' && order.status !== 'PROCESSING' && order.status !== 'CONFIRMED') return error(res, 'Only pending/processing orders can be converted to sale');

  const { paymentMethod, amountPaid, paymentReference, items: lineItems } = req.body;

  const overrides = {};
  if (Array.isArray(lineItems)) {
    for (const li of lineItems) {
      if (!li.product) continue;
      overrides[String(li.product)] = {
        price: li.price !== undefined ? Number(li.price) : undefined,
        quantity: li.quantity !== undefined ? Number(li.quantity) : undefined,
      };
    }
  }

  // Check stock availability based on final quantities
  const saleItems = [];
  let subtotal = 0;
  for (const item of order.items) {
    const ov = item.product ? overrides[String(item.product)] : null;
    const quantity = ov?.quantity || item.quantity;
    const price = ov?.price !== undefined ? ov.price : item.price;
    const lineSubtotal = quantity * price;
    if (ov?.quantity !== undefined) {
      item.quantity = quantity;
      item.subtotal = lineSubtotal;
      item.price = price;
    }
    subtotal += lineSubtotal;

    if (item.product) {
      const product = await Product.findById(item.product);
      if (!product) return error(res, `Product ${item.name} not found`);
      if (product.quantity < quantity) {
        return error(res, `Insufficient stock for ${item.name}. Available: ${product.quantity}, Required: ${quantity}`);
      }
    }
    saleItems.push({
      product: item.product || undefined,
      name: item.name,
      sku: item.sku,
      quantity,
      price,
      subtotal: lineSubtotal,
      cost: 0,
    });
  }
  order.subtotal = subtotal;
  order.total = subtotal - (order.discount || 0);

  // Create the sale
  const saleNumber = await nextNumber('SAL');
  const paidAmount = Math.min(amountPaid !== undefined ? Number(amountPaid) : order.total, order.total);
  const method = paymentMethod || 'CASH';
  const outstanding = order.total - paidAmount;

  const sale = await Sale.create({
    saleNumber,
    customer: order.customer,
    customerName: order.customerName,
    cashier: req.user._id,
    items: saleItems,
    subtotal,
    discount: order.discount,
    total: order.total,
    paymentMethod: method,
    paymentStatus: outstanding <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
    amountPaid: paidAmount,
    outstanding: Math.max(0, outstanding),
    reference: paymentReference,
    status: 'COMPLETED',
  });

  // Update stock for product-linked items
  for (const item of saleItems) {
    if (!item.product) continue;
    const product = await Product.findById(item.product);
    const prevQty = product.quantity;
    product.quantity -= item.quantity;
    await product.save();

    await StockTransaction.create({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      type: 'SALE',
      quantity: item.quantity,
      prevQuantity: prevQty,
      newQuantity: product.quantity,
      reason: `Order ${order.orderNumber} fulfilled`,
      reference: order.orderNumber,
      sale: sale._id,
      performedBy: req.user._id,
    });
  }

  // Create payment record
  if (paidAmount > 0) {
    const paymentNumber = await nextNumber('PAY');
    await Payment.create({
      paymentNumber,
      sale: sale._id,
      customer: order.customer,
      method,
      amount: paidAmount,
      reference: paymentReference,
      status: 'PAID',
      receivedBy: req.user._id,
    });
  }

  // Create loan if outstanding
  if (outstanding > 0) {
    const loanNumber = await nextNumber('LOAN');
    await Loan.create({
      loanNumber,
      customer: order.customer,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      sale: sale._id,
      totalAmount: order.total,
      amountPaid: paidAmount,
      outstanding,
      status: 'ACTIVE',
      createdBy: req.user._id,
    });
  }

  order.status = 'COMPLETED';
  order.completedBy = req.user._id;
  await order.save();

  await audit(req, 'ORDER_FULFILLED', 'Order', order._id, { orderNumber: order.orderNumber, saleNumber });
  success(res, 'Order fulfilled', { sale, order });
});

exports.cancel = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return error(res, 'Order not found', 404);
  if (order.status === 'COMPLETED') return error(res, 'Cannot cancel a completed order');
  if (order.status === 'CANCELLED') return error(res, 'Order already cancelled');

  order.status = 'CANCELLED';
  order.cancelledBy = req.user._id;
  await order.save();

  await audit(req, 'ORDER_CANCELLED', 'Order', order._id, { orderNumber: order.orderNumber });
  success(res, 'Order cancelled');
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const valid = ['PENDING', 'PROCESSING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  if (!valid.includes(status)) return error(res, 'Invalid order status');
  const order = await Order.findById(req.params.id);
  if (!order) return error(res, 'Order not found', 404);
  if (order.status === 'CANCELLED') return error(res, 'Cannot update a cancelled order');
  order.status = status;
  await order.save();
  await audit(req, 'ORDER_STATUS_CHANGED', 'Order', order._id, { orderNumber: order.orderNumber, status });
  success(res, 'Order status updated', order);
});
