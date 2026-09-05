const mongoose = require('mongoose');
const { Product, Sale, Payment, Loan, StockTransaction, Customer, Purchase } = require('../models');
const { nextNumber } = require('../utils/helpers');
const { notify } = require('./notificationService');
const { audit } = require('./auditService');
const { ROLES } = require('../utils/constants');

const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
  } catch (e) {
    return fn(null);
  }
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (e) {
    await session.abortTransaction().catch(() => {});
    throw e;
  } finally {
    session.endSession();
  }
};

const opt = (session) => (session ? { session } : {});

const createSale = async (payload, user) => {
  const { items, discount = 0, paymentMethod = 'CASH', amountPaid, dueDate, reference, notes, customer: customerPayload } = payload;
  if (!items || !items.length) throw Object.assign(new Error('Sale must contain at least one product'), { status: 400 });
  if (!['CASH', 'MOMO', 'BANK', 'LOAN'].includes(paymentMethod)) {
    throw Object.assign(new Error('Invalid payment method'), { status: 400 });
  }

  return withTransaction(async (session) => {
    const saleNumber = await nextNumber('SALE', opt(session));
    const paymentNumber = await nextNumber('PAY', opt(session));
    const loanNumber = await nextNumber('LN', opt(session));
    const loanPaymentNumber = await nextNumber('PAY', opt(session));
    let customer = null;
    if (customerPayload) {
      if (customerPayload._id) {
        customer = await Customer.findById(customerPayload._id, null, opt(session));
      } else if (customerPayload.phone) {
        customer = await Customer.findOne({ phone: customerPayload.phone }, null, opt(session));
        if (!customer && (customerPayload.name || customerPayload.phone)) {
          customer = await Customer.create([{ name: customerPayload.name || customerPayload.phone, phone: customerPayload.phone, email: customerPayload.email }], opt(session));
          customer = customer[0];
        }
      }
    }

    const saleItems = [];
    const stockTxns = [];
    let subtotal = 0;
    for (const it of items) {
      const product = await Product.findById(it.productId, null, opt(session));
      if (!product) throw Object.assign(new Error(`Product not found: ${it.productId}`), { status: 404 });
      const qty = Number(it.quantity);
      const price = Number(it.price ?? product.sellingPrice);
      if (!qty || qty <= 0) throw Object.assign(new Error(`Invalid quantity for ${product.name}`), { status: 400 });
      if (qty > product.quantity) {
        throw Object.assign(new Error(`${product.name} — only ${product.quantity} available in stock`), { status: 400 });
      }
      const itemSubtotal = qty * price;
      subtotal += itemSubtotal;
      saleItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        brandName: product.brandName || '',
        modelName: product.modelName || '',
        partType: product.partType || '',
        condition: product.condition || '',
        quantity: qty,
        price,
        subtotal: itemSubtotal,
        cost: product.buyingPrice || 0,
      });
      const prevQty = product.quantity;
      product.quantity = prevQty - qty;
      await product.save({ session });
      stockTxns.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        type: 'SALE',
        quantity: qty,
        prevQuantity: prevQty,
        newQuantity: product.quantity,
        reference: 'SALE',
        performedBy: user._id,
      });
    }

    const total = subtotal - Number(discount || 0);
    const paid = Math.min(Number(amountPaid || 0), total);
    const outstanding = total - paid;

    
    const [sale] = await Sale.create([{
      saleNumber,
      customer: customer?._id,
      customerName: customer?.name || 'Walk-in Customer',
      cashier: user._id,
      items: saleItems,
      subtotal,
      discount: Number(discount || 0),
      total,
      paymentMethod,
      paymentStatus: outstanding <= 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      amountPaid: paid,
      outstanding,
      reference,
      notes,
    }], opt(session));

    for (const tx of stockTxns) {
      await StockTransaction.create([{ ...tx, sale: sale._id }], opt(session));
    }

    let payment = null;
    if (paid > 0) {
      [payment] = await Payment.create([{
        paymentNumber,
        sale: sale._id,
        customer: customer?._id,
        method: paymentMethod,
        amount: paid,
        reference: reference || '',
        status: 'PAID',
        receivedBy: user._id,
      }], opt(session));
    }

    let loan = null;
    if (outstanding > 0) {
      if (!customer) throw Object.assign(new Error('A customer is required for loan / credit sales'), { status: 400 });
      [loan] = await Loan.create([{
        loanNumber,
        customer: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        sale: sale._id,
        totalAmount: total,
        amountPaid: paid,
        outstanding,
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000),
        status: outstanding <= 0 ? 'PAID' : 'ACTIVE',
        createdBy: user._id,
      }], opt(session));
      const [sp] = await Payment.create([{
        paymentNumber: loanPaymentNumber,
        sale: sale._id,
        loan: loan._id,
        customer: customer._id,
        method: 'LOAN',
        amount: outstanding,
        status: 'UNPAID',
        receivedBy: user._id,
      }], opt(session));
      payment = payment || sp;
      await notify('NEW_LOAN', `Loan ${loanNumber} created for ${customer.name} (${customer.phone}) — outstanding ${outstanding} RWF`, `Inguzanyo ${loanNumber} ya ${customer.name} — hasigaye ${outstanding} RWF`, { sale: sale._id, loan: loan._id });
    }

    await audit({ user }, 'SALE_CREATED', 'Sale', sale._id, {
      saleNumber, total, paid, paymentMethod, loanNumber: loan?.loanNumber || null,
    });
    await notify('NEW_SALE', `Sale ${saleNumber} — ${saleItems.length} items, total ${total} RWF`, `Kugurisha ${saleNumber} — byose ${total} RWF`, { sale: sale._id, loan: loan?._id });

    return { sale, payment, loan };
  });
};

const createOnDemandSale = async (payload, user) => {
  const { items, supplier: supplierId, discount = 0, paymentMethod = 'CASH', amountPaid, dueDate, reference, notes, customer: customerPayload } = payload;
  if (!items || !items.length) throw Object.assign(new Error('Sale must contain at least one product'), { status: 400 });
  if (!supplierId) throw Object.assign(new Error('A supplier is required for on-demand sourcing'), { status: 400 });
  if (!['CASH', 'MOMO', 'BANK', 'LOAN'].includes(paymentMethod)) {
    throw Object.assign(new Error('Invalid payment method'), { status: 400 });
  }
  const { Supplier } = require('../models');
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) throw Object.assign(new Error('Supplier not found'), { status: 404 });

  return withTransaction(async (session) => {
    const saleNumber = await nextNumber('SALE', opt(session));
    const paymentNumber = await nextNumber('PAY', opt(session));
    const loanNumber = await nextNumber('LN', opt(session));
    const loanPaymentNumber = await nextNumber('PAY', opt(session));
    const purchaseNumber = await nextNumber('PUR', opt(session));
    let customer = null;
    if (customerPayload) {
      if (customerPayload._id) {
        customer = await Customer.findById(customerPayload._id, null, opt(session));
      } else if (customerPayload.phone) {
        customer = await Customer.findOne({ phone: customerPayload.phone }, null, opt(session));
        if (!customer && (customerPayload.name || customerPayload.phone)) {
          customer = await Customer.create([{ name: customerPayload.name || customerPayload.phone, phone: customerPayload.phone, email: customerPayload.email }], opt(session));
          customer = customer[0];
        }
      }
    }

    const saleItems = [];
    const purchaseItems = [];
    let subtotal = 0;
    let supplierCost = 0;
    for (const it of items) {
      const product = await Product.findById(it.productId, null, opt(session));
      if (!product) throw Object.assign(new Error(`Product not found: ${it.productId}`), { status: 404 });
      const qty = Number(it.quantity);
      const price = Number(it.price);
      const buyingPrice = Number(it.buyingPrice ?? product.buyingPrice ?? 0);
      if (!qty || qty <= 0) throw Object.assign(new Error(`Invalid quantity for ${product.name}`), { status: 400 });
      if (price < 0) throw Object.assign(new Error(`Invalid selling price for ${product.name}`), { status: 400 });
      const itemSubtotal = qty * price;
      const itemCost = qty * buyingPrice;
      subtotal += itemSubtotal;
      supplierCost += itemCost;
      saleItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        brandName: product.brandName || '',
        modelName: product.modelName || '',
        partType: product.partType || '',
        condition: product.condition || '',
        quantity: qty,
        price,
        subtotal: itemSubtotal,
        cost: buyingPrice,
      });
      purchaseItems.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: qty,
        costPrice: buyingPrice,
        subtotal: itemCost,
      });
    }

    const total = subtotal - Number(discount || 0);
    const paid = Math.min(Number(amountPaid || 0), total);
    const outstanding = total - paid;

    const [sale] = await Sale.create([{
      saleNumber,
      customer: customer?._id,
      customerName: customer?.name || 'Walk-in Customer',
      cashier: user._id,
      items: saleItems,
      subtotal,
      discount: Number(discount || 0),
      total,
      paymentMethod,
      paymentStatus: outstanding <= 0 ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      amountPaid: paid,
      outstanding,
      reference,
      source: 'ON_DEMAND',
      notes: notes || `On-demand purchase — sourced from ${supplier.name}`,
    }], opt(session));

    const [purchase] = await Purchase.create([{
      purchaseNumber,
      supplier: supplier._id,
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      items: purchaseItems,
      totalAmount: supplierCost,
      paymentMethod: 'CASH',
      paymentStatus: 'UNPAID',
      amountPaid: 0,
      remainingAmount: supplierCost,
      status: 'RECEIVED',
      type: 'ON_DEMAND',
      sale: sale._id,
      notes: notes || `On-demand sourcing for sale ${saleNumber}`,
      createdBy: user._id,
    }], opt(session));

    let payment = null;
    if (paid > 0) {
      [payment] = await Payment.create([{
        paymentNumber,
        sale: sale._id,
        customer: customer?._id,
        method: paymentMethod,
        amount: paid,
        reference: reference || '',
        status: 'PAID',
        receivedBy: user._id,
      }], opt(session));
    }

    let loan = null;
    if (outstanding > 0) {
      if (!customer) throw Object.assign(new Error('A customer is required for loan / credit sales'), { status: 400 });
      [loan] = await Loan.create([{
        loanNumber,
        customer: customer._id,
        customerName: customer.name,
        customerPhone: customer.phone,
        sale: sale._id,
        totalAmount: total,
        amountPaid: paid,
        outstanding,
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000),
        status: outstanding <= 0 ? 'PAID' : 'ACTIVE',
        createdBy: user._id,
      }], opt(session));
      const [sp] = await Payment.create([{
        paymentNumber: loanPaymentNumber,
        sale: sale._id,
        loan: loan._id,
        customer: customer._id,
        method: 'LOAN',
        amount: outstanding,
        status: 'UNPAID',
        receivedBy: user._id,
      }], opt(session));
      payment = payment || sp;
      await notify('NEW_LOAN', `Loan ${loanNumber} created for ${customer.name} (${customer.phone}) — outstanding ${outstanding} RWF`, `Inguzanyo ${loanNumber} ya ${customer.name} — hasigaye ${outstanding} RWF`, { sale: sale._id, loan: loan._id });
    }

    await audit({ user }, 'SALE_CREATED', 'Sale', sale._id, {
      saleNumber, total, paid, paymentMethod, onDemand: true, purchaseNumber,
    });
    await audit({ user }, 'PURCHASE_CREATED', 'Purchase', purchase._id, {
      purchaseNumber, supplier: supplier.name, totalAmount: supplierCost, type: 'ON_DEMAND', saleNumber,
    });
    await notify('NEW_SALE', `On-demand sale ${saleNumber} — ${saleItems.length} items, total ${total} RWF`, `Ugurisha ${saleNumber} — byose ${total} RWF`, { sale: sale._id, loan: loan?._id, purchase: purchase._id });

    return {
      sale, purchase, payment, loan,
      profit: total - supplierCost,
      customerPayment: total,
      supplierAmount: supplierCost,
    };
  });
};

const cancelSale = async (saleId, user) => {
  return withTransaction(async (session) => {
    const sale = await Sale.findById(saleId, null, opt(session)).populate('loan');
    if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
    if (sale.status === 'CANCELLED') throw Object.assign(new Error('Sale already cancelled'), { status: 400 });
    const loan = await Loan.findOne({ sale: sale._id }, null, opt(session));
    if (loan && loan.amountPaid > 0) {
      throw Object.assign(new Error('Cannot cancel a sale with a loan that has repayments'), { status: 400 });
    }
    if (loan) await Loan.updateOne({ _id: loan._id }, { status: 'CANCELLED' }, opt(session));
    for (const it of sale.items) {
      const product = await Product.findById(it.product, null, opt(session));
      if (product) {
        const prev = product.quantity;
        product.quantity += it.quantity;
        await product.save({ session });
        await StockTransaction.create([{
          product: product._id,
          productName: product.name,
          sku: product.sku,
          type: 'RETURN',
          quantity: it.quantity,
          prevQuantity: prev,
          newQuantity: product.quantity,
          reason: `Sale ${sale.saleNumber} cancelled`,
          reference: sale.saleNumber,
          sale: sale._id,
          performedBy: user._id,
        }], opt(session));
      }
    }
    sale.status = 'CANCELLED';
    await sale.save({ session });
    await audit({ user }, 'SALE_CANCELLED', 'Sale', sale._id, { saleNumber: sale.saleNumber });
    return sale;
  });
};

module.exports = { createSale, createOnDemandSale, cancelSale, withTransaction, opt };