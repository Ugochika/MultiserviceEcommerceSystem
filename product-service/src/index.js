const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://mongodb:27017/productDB', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
});

const Product = mongoose.model('Product', new mongoose.Schema({
    name: String,
    price: Number
}));

app.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: 'Product not found' });
    }
});

// Improved seeding endpoint
app.post('/seed', async (req, res) => {
    try {
        // Clear existing products first to avoid duplicates
        await Product.deleteMany({});
        
        // Seed new products
        await Product.create([
            { _id: 'product1', name: 'Laptop', price: 999 },
            { _id: 'product2', name: 'Smartphone', price: 499 }
        ]);
        
        res.json({ 
            message: 'Products seeded successfully',
            count: 2
        });
    } catch (error) {
        console.error('Seeding error:', error);
        res.status(500).json({ error: 'Failed to seed products' });
    }
});

app.listen(3002, () => console.log('Product Service running on port 3002'));

//const express = require("express");
//const mongoose = require("mongoose");
//const customerRoutes = require("./routes/customer");
//
//const app = express();
//app.use(express.json());
//
//app.use("/customers", customerRoutes);
//
//const port = process.env.PORT || 3001;
//mongoose
//  .connect(process.env.MONGO_URI, {
//    useNewUrlParser: true,
//    useUnifiedTopology: true,
//  })
//  .then(() => {
//    console.log("Customer service connected to MongoDB");
//    app.listen(port, () =>
//      console.log(`Customer service listening on port ${port}`)
//    );
//  })
//  .catch((err) => {
//    console.error("Mongo connection error", err);
//  });
