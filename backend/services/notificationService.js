const { Notification } = require('../models');

const notify = async (type, message, messageRw, refs = {}) => {
  try {
    await Notification.create({
      type,
      message,
      messageRw: messageRw || message,
      product: refs.product,
      sale: refs.sale,
      loan: refs.loan,
    });
    } catch (e) {
    console.error('Notification failed:', e.message);
  }
};

const checkLowStock = async () => {
  try {
    const { Product } = require('../models');
    const products = await Product.find({ status: 'ACTIVE' });
    for (const p of products) {
      if (p.quantity <= 0 && !(await Notification.exists({ type: 'OUT_OF_STOCK', product: p._id, read: false }))) {
        await notify('OUT_OF_STOCK', `${p.name} is out of stock`, `${p.name} nta stock`, { product: p._id });
      } else if (p.quantity <= p.minStock && p.quantity > 0) {
        if (!(await Notification.exists({ type: 'LOW_STOCK', product: p._id, read: false }))) {
          await notify('LOW_STOCK', `${p.name} is low on stock (${p.quantity} left)`, `${p.name} ibuze stock (birasigaye ${p.quantity})`, { product: p._id });
        }
      }
    }
  } catch (e) {
    console.error('checkLowStock failed:', e.message);
  }
};

module.exports = { notify, checkLowStock };