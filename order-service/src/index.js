const express = require('express');
const mongoose = require('mongoose');
const orderRoutes = require('./routes/order');

const app = express();
app.use(express.json());

app.use('/orders', orderRoutes);

const port = process.env.PORT || 3003;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Order service connected to MongoDB');
    app.listen(port, () => console.log(`Order service listening on port ${port}`));
  })
  .catch(err => {
    console.error('Mongo connection error', err);
  });
