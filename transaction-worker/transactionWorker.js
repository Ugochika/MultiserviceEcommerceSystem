// transaction-worker/transactionWorker.js

require('dotenv').config();
const mongoose = require("mongoose");
const amqp = require("amqplib");
const Transaction = require("./models/transaction");

const TRANSACTION_QUEUE = process.env.TRANSACTION_QUEUE || "payment_transactions";
const MONGO_URI = process.env.MONGO_URI;
const RABBITMQ_URL = process.env.RABBITMQ_URL;

async function runWorker() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("Transaction worker connected to MongoDB");

  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(TRANSACTION_QUEUE, { durable: true });

  ch.consume(
    TRANSACTION_QUEUE,
    async (msg) => {
      if (!msg) return;
      let data;
      try {
        data = JSON.parse(msg.content.toString());
      } catch (err) {
        console.error("Invalid JSON in transactionWorker message", err);
        ch.ack(msg);
        return;
      }

      console.log("Worker received transaction message:", data);
      try {
        await Transaction.create({
          orderId: data.orderId,
          customerId: data.customerId,
          productId: data.productId,
          amount: data.amount,
          status: data.status,
          timestamp: data.timestamp,
        });
        ch.ack(msg);
      } catch (err) {
        console.error("Error saving transaction in worker:", err);
        // Nack without requeue to avoid infinite retries (or set requeue = true if needed)
        ch.nack(msg, false, false);
      }
    },
    { noAck: false }
  );
}

runWorker().catch((err) => {
  console.error("Transaction worker error:", err);
  process.exit(1);
});
