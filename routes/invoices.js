const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');

// GET all
router.get('/', async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const invoices = await Invoice.find(filter).populate('customer').sort({ date: -1 });
  const totals = {
    all: invoices.reduce((s, i) => s + i.total, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.paid, 0),
    pending: invoices.filter(i => ['draft', 'sent', 'partial'].includes(i.status)).reduce((s, i) => s + i.balance, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.balance, 0)
  };
  res.render('invoices/index', { title: 'الفواتير', invoices, totals, selectedStatus: status || '' });
});

// GET form
router.get('/new', async (req, res) => {
  const customers = await Customer.find({ isActive: true }).sort({ name: 1 });
  res.render('invoices/form', { title: 'فاتورة جديدة', invoice: null, customers, error: null });
});

// POST create
router.post('/', async (req, res) => {
  const customers = await Customer.find({ isActive: true }).sort({ name: 1 });
  try {
    const { customer, date, dueDate, taxRate, notes, itemDesc, itemQty, itemPrice } = req.body;

    const items = [];
    if (Array.isArray(itemDesc)) {
      for (let i = 0; i < itemDesc.length; i++) {
        if (!itemDesc[i]) continue;
        items.push({
          description: itemDesc[i],
          quantity: parseFloat(itemQty[i]) || 1,
          unitPrice: parseFloat(itemPrice[i]) || 0
        });
      }
    }

    const invoice = await Invoice.create({ customer, date, dueDate, taxRate: taxRate || 0, notes, items });

    // Auto-create journal entry (Accounts Receivable Dr / Revenue Cr)
    await createInvoiceJournalEntry(invoice);

    res.redirect('/invoices/' + invoice._id);
  } catch (err) {
    res.render('invoices/form', { title: 'فاتورة جديدة', invoice: req.body, customers, error: err.message });
  }
});

// GET detail
router.get('/:id', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('customer');
  if (!invoice) return res.redirect('/invoices');
  const payments = await Payment.find({ invoice: req.params.id });
  res.render('invoices/detail', { title: 'فاتورة #' + invoice.number, invoice, payments });
});

// POST pay
router.post('/:id/pay', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.redirect('/invoices');

    const amount = parseFloat(req.body.amount);
    if (amount <= 0 || amount > invoice.balance) {
      return res.redirect('/invoices/' + req.params.id + '?error=مبلغ غير صحيح');
    }

    const payment = await Payment.create({
      invoice: invoice._id,
      customer: invoice.customer,
      date: req.body.date || new Date(),
      amount,
      method: req.body.method || 'نقداً',
      reference: req.body.reference,
      notes: req.body.notes
    });

    invoice.paid += amount;
    await invoice.save();

    // Auto-create journal entry for payment
    await createPaymentJournalEntry(invoice, payment);

    res.redirect('/invoices/' + req.params.id);
  } catch (err) {
    res.redirect('/invoices/' + req.params.id + '?error=' + err.message);
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  await Invoice.findByIdAndDelete(req.params.id);
  res.redirect('/invoices');
});

async function createInvoiceJournalEntry(invoice) {
  try {
    const arAccount = await Account.findOne({ code: '1200' }); // Accounts Receivable
    const revenueAccount = await Account.findOne({ code: '4100' }); // Revenue
    const taxAccount = await Account.findOne({ code: '2200' }); // Tax Payable

    if (!arAccount || !revenueAccount) return;

    const lines = [
      { account: arAccount._id, debit: invoice.total, credit: 0, description: `فاتورة ${invoice.number}` }
    ];

    if (invoice.taxAmount > 0 && taxAccount) {
      lines.push({ account: revenueAccount._id, debit: 0, credit: invoice.subtotal, description: `إيرادات فاتورة ${invoice.number}` });
      lines.push({ account: taxAccount._id, debit: 0, credit: invoice.taxAmount, description: `ضريبة فاتورة ${invoice.number}` });
    } else {
      lines.push({ account: revenueAccount._id, debit: 0, credit: invoice.total, description: `إيرادات فاتورة ${invoice.number}` });
    }

    await JournalEntry.create({
      date: invoice.date,
      description: `فاتورة مبيعات ${invoice.number}`,
      reference: invoice.number,
      lines,
      source: 'invoice',
      sourceId: invoice._id
    });
  } catch (err) {
    console.error('خطأ في إنشاء قيد الفاتورة:', err.message);
  }
}

async function createPaymentJournalEntry(invoice, payment) {
  try {
    const cashAccount = await Account.findOne({ code: '1100' }); // Cash
    const arAccount = await Account.findOne({ code: '1200' }); // Accounts Receivable
    if (!cashAccount || !arAccount) return;

    await JournalEntry.create({
      date: payment.date,
      description: `تحصيل فاتورة ${invoice.number}`,
      reference: payment.reference || invoice.number,
      lines: [
        { account: cashAccount._id, debit: payment.amount, credit: 0, description: 'تحصيل نقدي' },
        { account: arAccount._id, debit: 0, credit: payment.amount, description: `تسوية فاتورة ${invoice.number}` }
      ],
      source: 'payment',
      sourceId: payment._id
    });
  } catch (err) {
    console.error('خطأ في إنشاء قيد الدفع:', err.message);
  }
}

module.exports = router;
