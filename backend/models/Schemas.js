const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  box_name: { type: String, required: true },
  size_inches: { type: Number, required: true },
  price: { type: Number, required: true }
}, { timestamps: true });

const InvoiceSchema = new mongoose.Schema({
  invoice_number: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  client_name: { type: String, required: true },
  client_mobile: { type: String, required: true },
  client_address: { type: String, default: '' },
  items: [{
    box_name: String,
    size_inches: Number,
    price: Number,
    quantity: Number,
    subtotal: Number
  }],
  total_amount: { type: Number, required: true },
  notes: { type: String, default: '' },

  total_paid: { type: Number, default: 0 },
  remaining_balance: { type: Number, required: true },
  payment_status: { type: String, enum: ['Paid', 'Unpaid', 'Half Paid'], default: 'Unpaid' },

  payment_history: [{
    amount_paid: Number,
    payment_date: { type: Date, default: Date.now },
    notes: String
  }]
}, { timestamps: true });

const ClientSchema = new mongoose.Schema({
  client_name: { type: String, required: true },
  client_mobile: { type: String, required: true, unique: true }
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);
const Client = mongoose.model('Client', ClientSchema);

module.exports = { Product, Invoice, Client };
