const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const { round2, toArray, postInvoice, postPayment, deleteEntriesFor } = require('../services/ledger');
const { withError, withSuccess } = require('../services/flash');

const detailUrl = (id) => '/invoices/' + id;

// GET all
router.get('/', async (req, res) => {
  const { status } = req.query;
  const filter = typeof status === 'string' && status ? { status } : {};
  await Invoice.refreshOverdue();
  const invoices = await Invoice.find(filter).populate('customer').sort({ date: -1 });
  const active = invoices.filter(i => !['draft', 'cancelled'].includes(i.status));
  const totals = {
    all: active.reduce((s, i) => s + i.total, 0),
    paid: active.reduce((s, i) => s + i.paid, 0),
    pending: active.filter(i => ['sent', 'partial'].includes(i.status)).reduce((s, i) => s + i.balance, 0),
    overdue: active.filter(i => i.status === 'overdue').reduce((s, i) => s + i.balance, 0)
  };
  res.render('invoices/index', { title: 'الفواتير', invoices, totals, selectedStatus: filter.status || '' });
});

// GET form
router.get('/new', async (req, res) => {
  const customers = await Customer.find({ isActive: true }).sort({ name: 1 });
  res.render('invoices/form', {
    title: 'فاتورة جديدة',
    invoice: { customer: req.query.customer },
    customers,
    error: null
  });
});

// POST create
router.post('/', async (req, res) => {
  const { customer, date, dueDate, taxRate, notes, action } = req.body;
  const itemDesc = toArray(req.body.itemDesc);
  const itemQty = toArray(req.body.itemQty);
  const itemPrice = toArray(req.body.itemPrice);

  const items = [];
  for (let i = 0; i < itemDesc.length; i++) {
    if (!itemDesc[i]) continue;
    items.push({
      description: itemDesc[i],
      quantity: parseFloat(itemQty[i]) || 1,
      unitPrice: parseFloat(itemPrice[i]) || 0
    });
  }

  let invoice;
  try {
    invoice = await Invoice.create({
      customer, date, dueDate, taxRate: taxRate || 0, notes, items,
      status: action === 'draft' ? 'draft' : 'sent'
    });
    // Issued invoices are posted to the ledger (Accounts Receivable Dr / Revenue + VAT Cr)
    if (invoice.status !== 'draft') await postInvoice(invoice);
    res.redirect(detailUrl(invoice._id));
  } catch (err) {
    if (invoice) await Invoice.deleteOne({ _id: invoice._id });
    const customers = await Customer.find({ isActive: true }).sort({ name: 1 });
    res.render('invoices/form', { title: 'فاتورة جديدة', invoice: req.body, customers, error: err.message });
  }
});

// GET detail
router.get('/:id', async (req, res) => {
  await Invoice.refreshOverdue();
  const invoice = await Invoice.findById(req.params.id).populate('customer');
  if (!invoice) return res.redirect('/invoices');
  const payments = await Payment.find({ invoice: req.params.id }).sort({ date: 1 });
  res.render('invoices/detail', { title: 'فاتورة #' + invoice.number, invoice, payments });
});

// POST issue a draft
router.post('/:id/issue', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.redirect('/invoices');
  if (invoice.status !== 'draft') return res.redirect(withError(detailUrl(invoice._id), 'الفاتورة صادرة بالفعل'));
  try {
    invoice.status = 'sent';
    await invoice.save();
    await postInvoice(invoice);
    res.redirect(withSuccess(detailUrl(invoice._id), 'تم إصدار الفاتورة وترحيل القيد'));
  } catch (err) {
    await Invoice.updateOne({ _id: invoice._id }, { status: 'draft' });
    res.redirect(withError(detailUrl(invoice._id), err.message));
  }
});

// POST cancel (reverses the ledger posting; only for invoices without payments)
router.post('/:id/cancel', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.redirect('/invoices');
  if (invoice.paid > 0) {
    return res.redirect(withError(detailUrl(invoice._id), 'لا يمكن إلغاء فاتورة عليها دفعات'));
  }
  invoice.status = 'cancelled';
  await invoice.save();
  await deleteEntriesFor('invoice', invoice._id);
  res.redirect(withSuccess(detailUrl(invoice._id), 'تم إلغاء الفاتورة وحذف قيدها'));
});

// POST pay
router.post('/:id/pay', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.redirect('/invoices');
  const url = detailUrl(invoice._id);

  if (['draft', 'cancelled'].includes(invoice.status)) {
    return res.redirect(withError(url, 'لا يمكن تسجيل دفعة على فاتورة مسودة أو ملغية'));
  }
  const amount = round2(parseFloat(req.body.amount));
  if (!(amount > 0) || amount > invoice.balance) {
    return res.redirect(withError(url, 'مبلغ غير صحيح'));
  }

  // Reserve the amount atomically so concurrent payments cannot exceed the invoice total
  const reserved = await Invoice.updateOne(
    { _id: invoice._id, $expr: { $lte: [{ $add: ['$paid', amount] }, { $add: ['$total', 0.001] }] } },
    { $inc: { paid: amount } }
  );
  if (!reserved.modifiedCount) return res.redirect(withError(url, 'مبلغ غير صحيح'));

  let payment;
  try {
    payment = await Payment.create({
      invoice: invoice._id,
      customer: invoice.customer,
      date: req.body.date || new Date(),
      amount,
      method: req.body.method || 'نقداً',
      reference: req.body.reference,
      notes: req.body.notes
    });
    await postPayment(invoice, payment);
  } catch (err) {
    await Invoice.updateOne({ _id: invoice._id }, { $inc: { paid: -amount } });
    if (payment) {
      await Payment.deleteOne({ _id: payment._id });
      await deleteEntriesFor('payment', payment._id);
    }
    return res.redirect(withError(url, err.message));
  }

  const updated = await Invoice.findById(invoice._id);
  await updated.save(); // round paid and recompute status
  res.redirect(withSuccess(url, 'تم تسجيل الدفعة'));
});

// DELETE (with its ledger entry; invoices with payments must stay)
router.delete('/:id', async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.redirect('/invoices');
  if (invoice.paid > 0 || await Payment.exists({ invoice: invoice._id })) {
    return res.redirect(withError('/invoices', `لا يمكن حذف الفاتورة ${invoice.number} لأن عليها دفعات`));
  }
  await deleteEntriesFor('invoice', invoice._id);
  await Invoice.deleteOne({ _id: invoice._id });
  res.redirect('/invoices');
});

module.exports = router;
