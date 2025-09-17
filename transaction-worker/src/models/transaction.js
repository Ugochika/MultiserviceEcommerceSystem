// transaction-worker/models/transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  customerId: { type: String, required: true },
  productId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true },
  timestamp: { type: Date, required: true },
});

module.exports = mongoose.model('Transaction', transactionSchema);
