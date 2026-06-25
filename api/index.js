const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
  items: [{ box_name: String, size_inches: Number, price: Number, quantity: Number, subtotal: Number }],
  total_amount: { type: Number, required: true },
  notes: { type: String, default: '' },
  total_paid: { type: Number, default: 0 },
  remaining_balance: { type: Number, required: true },
  payment_status: { type: String, enum: ['Paid', 'Unpaid', 'Half Paid'], default: 'Unpaid' },
  payment_history: [{ amount_paid: Number, payment_date: { type: Date, default: Date.now }, notes: String }]
}, { timestamps: true });

const ClientSchema = new mongoose.Schema({
  client_name: { type: String, required: true },
  client_mobile: { type: String, required: true, unique: true }
}, { timestamps: true });

let isConnected = false;
let Product, Invoice, Client;

async function connectDB() {
  if (isConnected) return;
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error('MONGO_URI not set');
  await mongoose.connect(MONGO_URI);
  isConnected = true;
  Product = mongoose.model('Product', ProductSchema);
  Invoice = mongoose.model('Invoice', InvoiceSchema);
  Client = mongoose.model('Client', ClientSchema);
}

app.use(async (req, res, next) => {
  try { await connectDB(); next(); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api', (req, res) => res.json({ status: 'AR Box API running' }));

app.post('/api/products/add', async (req, res) => {
  try {
    const p = new Product(req.body);
    await p.save();
    res.status(201).json({ message: 'Box added', product: p });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/all', async (req, res) => {
  try { res.json(await Product.find().sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/delete/:id', async (req, res) => {
  try { await Product.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/update/:id', async (req, res) => {
  try {
    const u = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Updated', product: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clients/add', async (req, res) => {
  try {
    const exists = await Client.findOne({ client_mobile: req.body.client_mobile });
    if (exists) return res.status(400).json({ error: 'Mobile already registered!' });
    const c = new Client(req.body);
    await c.save();
    res.status(201).json({ message: 'Client registered!', newClient: c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clients/all', async (req, res) => {
  try { res.json(await Client.find().sort({ client_name: 1 })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/clients/delete/:id', async (req, res) => {
  try { await Client.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices/create', async (req, res) => {
  try {
    const { client_name, client_mobile, client_address, items, notes, initial_payment, payment_notes } = req.body;
    const invoice_count = await Invoice.countDocuments();
    const invoice_number = `INV-${String(invoice_count + 1).padStart(4, '0')}`;
    let total_amount = 0;
    const processedItems = items.map(item => {
      const subtotal = item.price * item.quantity;
      total_amount += subtotal;
      return { ...item, subtotal };
    });
    const total_paid = Number(initial_payment) || 0;
    const remaining_balance = total_amount - total_paid;
    let payment_status = 'Unpaid';
    if (total_paid > 0 && remaining_balance > 0) payment_status = 'Half Paid';
    if (total_paid >= total_amount) payment_status = 'Paid';
    const payment_history = [];
    if (total_paid > 0) payment_history.push({ amount_paid: total_paid, notes: payment_notes || 'First Payment / Advance' });
    const inv = new Invoice({ invoice_number, client_name, client_mobile, client_address, items: processedItems, total_amount, total_paid, remaining_balance, payment_status, payment_history, notes });
    await inv.save();
    res.status(201).json({ message: 'Invoice generated!', invoice: inv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/all', async (req, res) => {
  try { res.json(await Invoice.find().sort({ createdAt: -1 })); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/single/:id', async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/history', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) query = { $or: [{ client_name: { $regex: search, $options: 'i' } }, { client_mobile: { $regex: search, $options: 'i' } }] };
    res.json(await Invoice.find(query).sort({ createdAt: -1 }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices/:id/add-payment', async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found!' });
    const amt = Number(amount);
    if (amt > inv.remaining_balance) return res.status(400).json({ error: `Amount exceeds remaining RS ${inv.remaining_balance.toLocaleString()}!` });
    inv.total_paid += amt;
    inv.remaining_balance = inv.total_amount - inv.total_paid;
    inv.payment_status = inv.remaining_balance <= 0 ? 'Paid' : 'Half Paid';
    if (inv.remaining_balance < 0) inv.remaining_balance = 0;
    inv.payment_history.push({ amount_paid: amt, notes: notes || 'Installment Paid' });
    await inv.save();
    res.json({ message: 'Payment updated!', invoice: inv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/invoices/delete/:id', async (req, res) => {
  try { await Invoice.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/dashboard-analytics', async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
    const invoicesToday = await Invoice.find({ createdAt: { $gte: startOfToday } });
    let todayCash = 0;
    invoicesToday.forEach(inv => inv.payment_history.forEach(log => { if (new Date(log.payment_date) >= startOfToday) todayCash += log.amount_paid; }));
    const invoicesMonth = await Invoice.find({ createdAt: { $gte: startOfMonth } });
    let monthlyCash = 0;
    invoicesMonth.forEach(inv => inv.payment_history.forEach(log => { if (new Date(log.payment_date) >= startOfMonth) monthlyCash += log.amount_paid; }));
    const yearlyInvoices = await Invoice.find({ createdAt: { $gte: startOfYear, $lte: endOfYear } });
    let totalSales = 0, totalReceived = 0, totalDues = 0;
    yearlyInvoices.forEach(inv => { totalSales += inv.total_amount; totalReceived += inv.total_paid; totalDues += inv.remaining_balance; });
    res.json({ todayCash, monthlyCash, audit: { selectedYear: currentYear, totalSales, totalReceived, totalDues, totalInvoicesCount: yearlyInvoices.length } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/customer-ledger', async (req, res) => {
  try {
    const { mobile } = req.query;
    if (!mobile) return res.status(400).json({ error: 'Mobile required!' });
    const clientInvoices = await Invoice.find({ client_mobile: mobile }).sort({ date: 1 });
    if (clientInvoices.length === 0) return res.json({ message: 'No records found.', ledgerTimeline: [], summary: {} });
    let totalGoodsPurchased = 0, totalCashPaid = 0, ledgerTimeline = [];
    clientInvoices.forEach(inv => {
      totalGoodsPurchased += inv.total_amount;
      ledgerTimeline.push({ date: inv.date, type: 'Goods Purchased', reference: inv.invoice_number, amount: inv.total_amount, details: `${inv.items.length} types of speaker boxes purchased.` });
      inv.payment_history.forEach(pay => { totalCashPaid += pay.amount_paid; ledgerTimeline.push({ date: pay.payment_date, type: 'Cash Received', reference: inv.invoice_number, amount: pay.amount_paid, details: pay.notes || 'Installment or advance payment' }); });
    });
    ledgerTimeline.sort((a, b) => { const dA = new Date(a.date), dB = new Date(b.date); return dA.getTime() === dB.getTime() ? (a.type === 'Goods Purchased' ? -1 : 1) : dA - dB; });
    let runningBalance = 0;
    const finalTimeline = ledgerTimeline.map(entry => { if (entry.type === 'Goods Purchased') runningBalance += entry.amount; else runningBalance -= entry.amount; return { ...entry, current_balance: runningBalance }; });
    res.json({ client_name: clientInvoices[0].client_name, client_mobile: mobile, summary: { total_purchased: totalGoodsPurchased, total_paid: totalCashPaid, current_outstanding_dues: totalGoodsPurchased - totalCashPaid }, ledgerTimeline: finalTimeline });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/public-ledger/:id', async (req, res) => {
  try {
    const invoiceRef = await Invoice.findById(req.params.id);
    if (!invoiceRef) return res.status(404).json({ error: 'Not found.' });
    const clientInvoices = await Invoice.find({ client_mobile: invoiceRef.client_mobile }).sort({ date: 1 });
    let totalGoodsPurchased = 0, totalCashPaid = 0, ledgerTimeline = [];
    clientInvoices.forEach(inv => {
      totalGoodsPurchased += inv.total_amount;
      ledgerTimeline.push({ date: inv.date, type: 'Goods Purchased', reference: inv.invoice_number, amount: inv.total_amount, details: `${inv.items.length} types of speaker boxes purchased.` });
      inv.payment_history.forEach(pay => { totalCashPaid += pay.amount_paid; ledgerTimeline.push({ date: pay.payment_date, type: 'Cash Received', reference: inv.invoice_number, amount: pay.amount_paid, details: pay.notes || 'Installment or advance payment' }); });
    });
    ledgerTimeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const finalTimeline = ledgerTimeline.map(entry => { if (entry.type === 'Goods Purchased') runningBalance += entry.amount; else runningBalance -= entry.amount; return { ...entry, current_balance: runningBalance }; });
    res.json({ client_name: invoiceRef.client_name, client_mobile: invoiceRef.client_mobile, summary: { total_purchased: totalGoodsPurchased, total_paid: totalCashPaid, current_outstanding_dues: totalGoodsPurchased - totalCashPaid }, ledgerTimeline: finalTimeline });
  } catch (e) { res.status(500).json({ error: 'System error.' }); }
});

module.exports = app;
module.exports.handler = serverless(app);
