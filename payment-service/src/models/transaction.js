const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  customerId: { type: String, required: true },
  orderId: { type: String, required: true },
  productId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true, default: 'initiated' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
