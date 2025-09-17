const express = require("express");
const router = express.Router();
const axios = require("axios");
const Order = require("../models/order"); // mongoose model or similar
const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");

let channel, connection;
const TRANSACTION_QUEUE = "payment_transactions";

async function connectRabbitMQ() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue(TRANSACTION_QUEUE, { durable: true });
  return { conn, ch };
}

async function validateCustomer(customerId) {
  try {
    const resp = await axios.get(
      `${process.env.CUSTOMER_SERVICE_URL}/customers/${customerId}`
    );
    if (resp.status !== 200) {
      return { valid: false, error: "Customer not found" };
    }
    return { valid: true };
  } catch (err) {
    console.error("Customer validation error:", err);
    return { valid: false, error: "Customer validation failed" };
  }
}

async function validateProduct(productId) {
  try {
    const resp = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/products/${productId}`
    );
    if (resp.status !== 200) {
      return { valid: false, error: "Product not found" };
    }
    return { valid: true };
  } catch (err) {
    console.error("Product validation error:", err);
    return { valid: false, error: "Product validation failed" };
  }
}

async function initiatePayment(customerId, orderId, productId, amount) {
  try {
    const resp = await axios.post(
      `${process.env.PAYMENT_SERVICE_URL}/payments`,
      {
        customerId,
        orderId,
        productId,
        amount,
      }
    );
    // expecting { success: true/false }
    if (
      resp.status === 200 &&
      resp.data &&
      typeof resp.data.paymentStatus !== "undefined"
    ) {
      // adapt: assume paymentStatus is boolean or 'success'/'failed'
      return { success: resp.data.paymentStatus, raw: resp.data };
    }
    // fallback if structure different
    return { success: resp.data.success === true, raw: resp.data };
  } catch (err) {
    throw new Error("Payment service error: " + (err.message || err));
  }
}

async function postPaymentFollowUps(order) {
  try {
    // e.g., send confirmation email
    // await NotificationService.sendOrderConfirmation(order.customerId, order._id);

    // e.g., reduce inventory
    // await axios.post(`${process.env.INVENTORY_SERVICE_URL}/inventory/reduce`, { productId: order.productId, quantity: 1 });

    console.log(`Post-payment follow-ups done for order ${order._id}`);
  } catch (err) {
    console.error(
      `Error in post-payment follow-ups for order ${order._id}`,
      err
    );
    throw err;
  }
}

// listen and save transaction details
async function listenAndSaveTransactions() {
  if (!channel) {
    const c = await connectRabbitMQ();
    connection = c.conn;
    channel = c.ch;
  }
  channel.consume(
    TRANSACTION_QUEUE,
    async (msg) => {
      if (!msg) return;
      let data;
      try {
        data = JSON.parse(msg.content.toString());
      } catch (err) {
        console.error("Invalid JSON in transaction message", err);
        channel.ack(msg); // drop the bad message
        return;
      }
      console.log("Transaction message received in Order Service:", data);
      // Save into Transaction model
      try {
        // Assuming you have a Transaction mongoose model
        const Transaction = require("../models/transaction");
        await Transaction.create({
          orderId: data.orderId,
          customerId: data.customerId,
          productId: data.productId,
          amount: data.amount,
          status: data.status,
          timestamp: data.timestamp,
        });
      } catch (err) {
        console.error("Error saving transaction in Order Service", err);
        // optionally nack so message can be retried or send to dead-letter queue
        channel.nack(msg, false, false);
        return;
      }
      channel.ack(msg);
    },
    { noAck: false }
  );
}

// Start listening when service starts
listenAndSaveTransactions().catch((err) => {
  console.error("Error starting transaction listener in order service", err);
});

router.post("/", async (req, res) => {
  const { customerId, productId, amount } = req.body;

  // Step 1: Validate
  const vc = await validateCustomer(customerId);
  if (!vc.valid) {
    return res
      .status(400)
      .json({ status: "error", stage: "validation", message: vc.error });
  }
  const vp = await validateProduct(productId);
  if (!vp.valid) {
    return res
      .status(400)
      .json({ status: "error", stage: "validation", message: vp.error });
  }

  // Step 2: Create order
  let order;
  try {
    order = new Order({
      customerId,
      productId,
      amount,
      orderStatus: "pending",
    });
    await order.save();
  } catch (err) {
    console.error("Error creating order:", err);
    return res.status(500).json({
      status: "error",
      stage: "create_order",
      message: "Error creating order",
    });
  }

  // Step 3: Initiate payment
  let paymentResult;
  try {
    paymentResult = await initiatePayment(
      customerId,
      order._id,
      productId,
      amount
    );
  } catch (err) {
    console.error("Payment initiation error for order", order._id, err);

    // mark order payment_failed
    order.orderStatus = "payment_failed";
    try {
      await order.save();
    } catch (e) {
      console.error("Error saving order status payment_failed:", e);
    }

    return res.status(502).json({
      status: "error",
      stage: "initiate_payment",
      message: err.message,
      orderId: order._id,
    });
  }

  // Step 4: Handle payment response
  if (paymentResult.success) {
    order.orderStatus = "paid";
  } else {
    order.orderStatus = "failed";
  }
  try {
    await order.save();
  } catch (err) {
    console.error(
      `Error saving order status after payment response for order ${order._id}`,
      err
    );
    return res.status(500).json({
      status: "error",
      stage: "payment",
      message: "Could not update order status after payment",
      orderId: order._id,
    });
  }

  // Step 5: Publish transaction details (if needed by other services)
  // In this architecture, payment service already published the transaction message.

  // Step 6: Post‑payment follow‑ups
  try {
    if (paymentResult.success) {
      await postPaymentFollowUps(order);
    } else {
      // On failure: optionally notify user, revert reserved items, etc.
      console.log(
        `Payment failed for order ${order._id}, performing failure follow‑ups`
      );
      // e.g., NotificationService.notifyPaymentFailure(order.customerId, order._id);
    }
  } catch (err) {
    console.error("Error in post-payment follow-ups:", err);
    // You might decide to respond with warning or partial success
    return res.status(500).json({
      status: "warning",
      stage: "post_payment",
      message: "Follow-up tasks failed",
      orderId: order._id,
    });
  }

  // Step 7: Return order & payment status to actor (client)
  return res.status(201).json({
    status: "success",
    orderId: order._id,
    customerId: order.customerId,
    productId: order.productId,
    orderStatus: order.orderStatus,
  });
});

module.exports = router;
