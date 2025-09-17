const express = require("express");
const mongoose = require("mongoose");
const customerRoutes = require("./routes/customer");

const app = express();
app.use(express.json());

app.use("/customers", customerRoutes);

// Add seeding endpoint
app.post("/seed", async (req, res) => {
  try {
    // Import the Customer model
    const Customer = require("./models/Customer");

    // Clear existing customers
    await Customer.deleteMany({});

    // Seed default customer
    await Customer.create({
      _id: "customer1",
      name: "Ugochukwu Chika",
      email: "chika@example.com",
    });

    res.json({ message: "Customer seeded successfully" });
  } catch (error) {
    console.error("Seeding error:", error);
    res.status(500).json({ error: "Failed to seed customer" });
  }
});

const port = process.env.PORT || 3001;
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Customer service connected to MongoDB");
    app.listen(port, () =>
      console.log(`Customer service listening on port ${port}`)
    );
  })
  .catch((err) => {
    console.error("Mongo connection error", err);
  });
