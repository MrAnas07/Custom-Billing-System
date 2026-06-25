const mongoose = require('mongoose');
require('dotenv').config();
async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ARBox');
  const Invoice = require('./models/Schemas').Invoice;
  const all = await Invoice.find({});
  all.forEach(inv => {
    console.log(`\n--- ${inv.invoice_number} ---`);
    inv.payment_history.forEach(p => {
      console.log(`  notes: "${p.notes}"`);
    });
  });
  await mongoose.disconnect();
}
check().catch(console.error);
