// payment.js
const express = require("express");
const router = express.Router();
const amqp = require("amqplib");

let channel, connection;
const QUEUE = "payment_transactions";

async function connectRabbitMQ() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE, { durable: true });
  return { conn, ch };
}

// Initiate payment endpoint
router.post("/", async (req, res) => {
  const { customerId, orderId, productId, amount } = req.body;

  if (!customerId || !orderId || !productId || amount == null) {
    return res.status(400).json({
      status: "error",
      stage: "validation",
      message: "Missing required fields",
    });
  }

  // Simulate payment logic
  // (Replace with real payment gateway integration)
  let paymentSuccess;
  try {
    // e.g. call external payment provider here
    paymentSuccess = true; // or false based on logic
  } catch (err) {
    console.error("Payment provider error:", err);
    paymentSuccess = false;
  }

  // Ensure RabbitMQ channel is ready
  if (!channel) {
    try {
      const c = await connectRabbitMQ();
      connection = c.conn;
      channel = c.ch;
    } catch (err) {
      console.error("RabbitMQ connection error in payment service:", err);
      // If cannot publish transaction, respond accordingly
      return res.status(500).json({
        status: "error",
        stage: "publish_transaction",
        message: "Could not connect to transaction queue",
      });
    }
  }

  const transactionMsg = {
    customerId,
    orderId,
    productId,
    amount,
    status: paymentSuccess ? "success" : "failed",
    timestamp: new Date().toISOString(),
  };

  try {
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(transactionMsg)), {
      persistent: true,
    });
  } catch (err) {
    console.error("Error sending message to queue in payment service:", err);
    // Still proceed to respond, but note the failure in publishing
    return res.status(500).json({
      status: "error",
      stage: "publish_transaction",
      message: "Failed to publish transaction details",
      paymentStatus: paymentSuccess ? "success" : "failed",
    });
  }

  // Respond to order service (caller)
  res.status(200).json({
    status: "success",
    paymentStatus: paymentSuccess,
  });
});

module.exports = router;
