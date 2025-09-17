const express = require('express');
const mongoose = require('mongoose');
const paymentRoutes = require('./routes/payment');

const app = express();
app.use(express.json());

app.use('/payments', paymentRoutes);

const port = process.env.PORT || 3004;
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Payment service connected to MongoDB');
    app.listen(port, () => console.log(`Payment service listening on port ${port}`));
  })
  .catch(err => {
    console.error('Mongo connection error', err);
  });
