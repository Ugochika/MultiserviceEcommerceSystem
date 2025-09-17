const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
  customerId: { type: String, required: true },
  productId: { type: String, required: true },
  amount: { type: Number, required: true },
  orderStatus: { type: String, required: true, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
