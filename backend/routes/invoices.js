const express = require('express');
const router = express.Router();
const { Invoice } = require('../models/Schemas');

router.post('/create', async (req, res) => {
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
    if (total_paid > 0) {
      payment_history.push({
        amount_paid: total_paid,
        notes: payment_notes || 'First Payment / Advance'
      });
    }

    const newInvoice = new Invoice({
      invoice_number,
      client_name,
      client_mobile,
      client_address,
      items: processedItems,
      total_amount,
      total_paid,
      remaining_balance,
      payment_status,
      payment_history,
      notes
    });

    await newInvoice.save();
    res.status(201).json({ message: 'Invoice generated!', invoice: newInvoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/single/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { client_name: { $regex: search, $options: 'i' } },
          { client_mobile: { $regex: search, $options: 'i' } }
        ]
      };
    }
    const history = await Invoice.find(query).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/add-payment', async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found!' });

    const newPaidAmount = Number(amount);
    if (newPaidAmount > invoice.remaining_balance) {
      return res.status(400).json({ error: `Amount cannot exceed remaining dues of RS ${invoice.remaining_balance.toLocaleString()}!` });
    }
    invoice.total_paid += newPaidAmount;
    invoice.remaining_balance = invoice.total_amount - invoice.total_paid;

    if (invoice.remaining_balance <= 0) {
      invoice.payment_status = 'Paid';
      invoice.remaining_balance = 0;
    } else {
      invoice.payment_status = 'Half Paid';
    }

    invoice.payment_history.push({
      amount_paid: newPaidAmount,
      notes: notes || 'Installment Paid'
    });

    await invoice.save();
    res.json({ message: 'Payment updated!', invoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard-analytics', async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const invoicesToday = await Invoice.find({ createdAt: { $gte: startOfToday } });
    let todayCashCollected = 0;
    invoicesToday.forEach(inv => {
      inv.payment_history.forEach(log => {
        if (new Date(log.payment_date) >= startOfToday) {
          todayCashCollected += log.amount_paid;
        }
      });
    });

    const invoicesMonth = await Invoice.find({ createdAt: { $gte: startOfMonth } });
    let monthlyCashCollected = 0;
    invoicesMonth.forEach(inv => {
      inv.payment_history.forEach(log => {
        if (new Date(log.payment_date) >= startOfMonth) {
          monthlyCashCollected += log.amount_paid;
        }
      });
    });

    const yearlyInvoices = await Invoice.find({
      createdAt: { $gte: startOfYear, $lte: endOfYear }
    });

    let yearlyTotalSales = 0;
    let yearlyTotalReceived = 0;
    let yearlyTotalDues = 0;

    yearlyInvoices.forEach(inv => {
      yearlyTotalSales += inv.total_amount;
      yearlyTotalReceived += inv.total_paid;
      yearlyTotalDues += inv.remaining_balance;
    });

    res.json({
      todayCash: todayCashCollected,
      monthlyCash: monthlyCashCollected,
      audit: {
        selectedYear: currentYear,
        totalSales: yearlyTotalSales,
        totalReceived: yearlyTotalReceived,
        totalDues: yearlyTotalDues,
        totalInvoicesCount: yearlyInvoices.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customer-ledger', async (req, res) => {
  try {
    const { mobile } = req.query;
    if (!mobile) return res.status(400).json({ error: 'Client mobile number is required!' });

    const clientInvoices = await Invoice.find({ client_mobile: mobile }).sort({ date: 1 });

    if (clientInvoices.length === 0) {
      return res.json({ message: 'No records found for this customer.', ledgerTimeline: [], summary: {} });
    }

    let totalGoodsPurchased = 0;
    let totalCashPaid = 0;
    let ledgerTimeline = [];

    clientInvoices.forEach(inv => {
      totalGoodsPurchased += inv.total_amount;

      ledgerTimeline.push({
        date: inv.date,
        type: 'Goods Purchased',
        reference: inv.invoice_number,
        amount: inv.total_amount,
        details: `${inv.items.length} types of speaker boxes purchased.`
      });

      inv.payment_history.forEach(pay => {
        totalCashPaid += pay.amount_paid;
        ledgerTimeline.push({
          date: pay.payment_date,
          type: 'Cash Received',
          reference: inv.invoice_number,
          amount: pay.amount_paid,
          details: pay.notes || 'Installment or advance payment'
        });
      });
    });

    ledgerTimeline.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() === dateB.getTime()) {
        return a.type === 'Goods Purchased' ? -1 : 1;
      }
      return dateA - dateB;
    });

    let runningBalance = 0;
    const finalTimeline = ledgerTimeline.map(entry => {
      if (entry.type === 'Goods Purchased') {
        runningBalance += entry.amount;
      } else if (entry.type === 'Cash Received') {
        runningBalance -= entry.amount;
      }
      return { ...entry, current_balance: runningBalance };
    });

    res.json({
      client_name: clientInvoices[0].client_name,
      client_mobile: mobile,
      summary: {
        total_purchased: totalGoodsPurchased,
        total_paid: totalCashPaid,
        current_outstanding_dues: totalGoodsPurchased - totalCashPaid
      },
      ledgerTimeline: finalTimeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/public-ledger/:id', async (req, res) => {
  try {
    const invoiceRef = await Invoice.findById(req.params.id);
    if (!invoiceRef) return res.status(404).json({ error: 'Record not found.' });

    const clientInvoices = await Invoice.find({ client_mobile: invoiceRef.client_mobile }).sort({ date: 1 });

    let totalGoodsPurchased = 0;
    let totalCashPaid = 0;
    let ledgerTimeline = [];

    clientInvoices.forEach(inv => {
      totalGoodsPurchased += inv.total_amount;
      ledgerTimeline.push({
        date: inv.date,
        type: 'Goods Purchased',
        reference: inv.invoice_number,
        amount: inv.total_amount,
        details: `${inv.items.length} types of speaker boxes purchased.`
      });

      inv.payment_history.forEach(pay => {
        totalCashPaid += pay.amount_paid;
        ledgerTimeline.push({
          date: pay.payment_date,
          type: 'Cash Received',
          reference: inv.invoice_number,
          amount: pay.amount_paid,
          details: pay.notes || 'Installment or advance payment'
        });
      });
    });

    ledgerTimeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0;
    const finalTimeline = ledgerTimeline.map(entry => {
      if (entry.type === 'Goods Purchased') runningBalance += entry.amount;
      else if (entry.type === 'Cash Received') runningBalance -= entry.amount;
      return { ...entry, current_balance: runningBalance };
    });

    res.json({
      client_name: invoiceRef.client_name,
      client_mobile: invoiceRef.client_mobile,
      summary: {
        total_purchased: totalGoodsPurchased,
        total_paid: totalCashPaid,
        current_outstanding_dues: totalGoodsPurchased - totalCashPaid
      },
      ledgerTimeline: finalTimeline
    });
  } catch (err) {
    res.status(500).json({ error: 'System error.' });
  }
});

module.exports = router;
