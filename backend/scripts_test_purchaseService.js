const assert = require('assert');
const svc = require('./services/purchaseService');

const mkItem = (qty, price, paid = 0, returnedQty = 0, returned = false) => ({
  quantity: qty,
  costPrice: price,
  subtotal: qty * price,
  originalQuantity: qty,
  originalSubtotal: qty * price,
  amountPaid: paid,
  remaining: Math.max(0, qty * price - paid),
  paymentStatus: 'UNPAID',
  returned,
  returnedQty,
  refundAmount: 0,
});

const mkPurchase = (items) => {
  const p = { items, totalAmount: 0, amountPaid: 0, remainingAmount: 0, refundedAmount: 0 };
  return svc.recomputePurchase(p);
};

let passed = 0;
const ok = (name, fn) => {
  fn();
  passed += 1;
  console.log('PASS', name);
};

// 1. computeItemStatus
ok('status PAID when fully paid', () => {
  assert.strictEqual(svc.computeItemStatus({ ...mkItem(2, 100), amountPaid: 200, remaining: 0, subtotal: 200 }), 'PAID');
});
ok('status PARTIALLY_PAID', () => assert.strictEqual(svc.computeItemStatus(mkItem(2, 100, 50)), 'PARTIALLY_PAID'));
ok('status UNPAID', () => assert.strictEqual(svc.computeItemStatus(mkItem(2, 100)), 'UNPAID'));
ok('status RETURNED when fully returned', () => assert.strictEqual(svc.computeItemStatus(mkItem(0, 100, 0, 2, true)), 'RETURNED'));

// 2. settleItem — reduce qty after being paid
ok('settleItem refunds surplus when qty reduced after payment', () => {
  const it = mkItem(10, 100, 1000);
  it.quantity = 5;
  const refund = svc.settleItem(it);
  assert.strictEqual(refund, 500);
  assert.strictEqual(it.amountPaid, 500);
  assert.strictEqual(it.remaining, 0);
  assert.strictEqual(it.paymentStatus, 'PAID');
  assert.strictEqual(it.refundAmount, 500);
});

// 3. settleItem — partial return
ok('settleItem partial return surplus', () => {
  const it = mkItem(10, 100, 600);
  it.quantity = 6; // 4 returned
  const refund = svc.settleItem(it);
  assert.strictEqual(refund, 0);
  assert.strictEqual(it.remaining, 0);
  assert.strictEqual(it.paymentStatus, 'PAID');
});

// 4. recomputePurchase rolls up
ok('recomputePurchase totals', () => {
  const p = mkPurchase([mkItem(3, 100, 100), mkItem(2, 50), mkItem(0, 50, 0, 4, true)]);
  assert.strictEqual(p.totalAmount, 400); // actives only: 300 + 100
  assert.strictEqual(p.remainingAmount, 300);
  assert.strictEqual(p.amountPaid, 100);
  assert.strictEqual(p.paymentStatus, 'PARTIALLY_PAID');
  assert.strictEqual(p.returnedQty, 4);
  assert.strictEqual(p.returnedValue, 200);
});

// 5. allocateFIFO
ok('allocateFIFO allocates across actives', () => {
  const items = [mkItem(2, 100), mkItem(3, 100)];
  const allocs = svc.allocateFIFO(items, 250);
  assert.deepStrictEqual(allocs.map((a) => a.allocated), [200, 50]);
});

// 6. payPurchaseItems returns per-item amounts
ok('payPurchaseItems per-item split', () => {
  const p = mkPurchase([mkItem(2, 100), mkItem(3, 100)]);
  const applied = svc.payPurchaseItems(p, 250);
  assert.strictEqual(p.items[0].amountPaid, 200);
  assert.strictEqual(p.items[1].amountPaid, 50);
  assert.strictEqual(p.remainingAmount, 250);
  assert.deepStrictEqual(applied.map((a) => a.amount), [200, 50]);
});

// 7. allocateProportional migration
ok('allocateProportional distributes purchase-level paid', () => {
  const items = [mkItem(2, 100), mkItem(3, 100)];
  svc.allocateProportional(items, 200);
  assert.strictEqual(items[0].amountPaid, 80);
  assert.strictEqual(items[1].amountPaid, 120);
});

// 8. serializeItem exposes per-item fields
ok('serializeItem shape', () => {
  const it = mkItem(2, 100, 100);
  const s = svc.serializeItem(it, { _id: 'abc', purchaseNumber: 'PUR-1', purchaseDate: new Date('2026-09-15T00:00:00.000Z') });
  assert.strictEqual(s.purchaseId, 'abc');
  assert.strictEqual(s.purchaseNumber, 'PUR-1');
  assert.strictEqual(s.remaining, 100);
  assert.strictEqual(s.amountPaid, 100);
});

// 9. buildGroups aggregates by supplier
ok('buildGroups groups purchases and computes status', () => {
  const sup = { _id: 's1', name: 'Vendor A', phone: '0788' };
  const p1 = { _id: 'p1', supplier: sup, supplierName: 'Vendor A', purchaseNumber: 'P1', items: [mkItem(2, 100)], purchaseDate: new Date('2026-09-01') };
  const p2 = { _id: 'p2', supplier: sup, supplierName: 'Vendor A', purchaseNumber: 'P2', items: [mkItem(1, 100)], purchaseDate: new Date('2026-09-02') };
  const p3 = { _id: 'p3', supplier: { _id: 's2', name: 'Vendor B' }, supplierName: 'Vendor B', items: [mkItem(1, 50)], purchaseDate: new Date('2026-09-03') };
  const groups = svc.buildGroups([p1, p2, p3]);
  assert.strictEqual(groups.length, 2);
  const a = groups.find((g) => g.supplier === 's1');
  assert.strictEqual(a.purchaseCount, 2);
  assert.strictEqual(a.totalAmount, 300);
  assert.strictEqual(a.status, 'UNPAID');
  assert.strictEqual(a.minDate.toISOString(), new Date('2026-09-01').toISOString());
});

// 10. groupTotals
ok('groupTotals counts', () => {
  const sup = { _id: 's1', name: 'Vendor A' };
  const p = [{ _id: 'p1', supplier: sup, supplierName: 'Vendor A', items: [mkItem(2, 100, 50)] }];
  const t = svc.groupTotals(p);
  assert.strictEqual(t.productCount, 1);
  assert.strictEqual(t.totalAmount, 200);
  assert.strictEqual(t.remainingAmount, 150);
  assert.strictEqual(t.status, 'PARTIALLY_PAID');
});

console.log(`\nAll ${passed} tests passed.`);