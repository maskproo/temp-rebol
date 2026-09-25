const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const { withError } = require('../services/flash');

// GET all
router.get('/', async (req, res) => {
  const [customers, stats] = await Promise.all([
    Customer.find().sort({ name: 1 }),
    Invoice.aggregate([
      { $match: { status: { $nin: ['cancelled', 'draft'] } } },
      { $group: { _id: '$customer', totalInvoiced: { $sum: '$total' }, totalPaid: { $sum: '$paid' } } }
    ])
  ]);
  const byCustomer = new Map(stats.map(s => [s._id.toString(), s]));
  const customersWithStats = customers.map(c => {
    const s = byCustomer.get(c._id.toString()) || { totalInvoiced: 0, totalPaid: 0 };
    return { ...c.toObject(), totalInvoiced: s.totalInvoiced, totalPaid: s.totalPaid, balance: s.totalInvoiced - s.totalPaid };
  });
  res.render('customers/index', { title: 'العملاء', customers: customersWithStats });
});

// GET form
router.get('/new', (req, res) => {
  res.render('customers/form', { title: 'عميل جديد', customer: null, error: null });
});

// POST
router.post('/', async (req, res) => {
  try {
    await Customer.create(req.body);
    res.redirect('/customers');
  } catch (err) {
    res.render('customers/form', { title: 'عميل جديد', customer: req.body, error: err.message });
  }
});

// GET detail
router.get('/:id', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.redirect('/customers');
  await Invoice.refreshOverdue();
  const invoices = await Invoice.find({ customer: req.params.id }).sort({ date: -1 });
  res.render('customers/detail', { title: customer.name, customer, invoices });
});

// GET edit
router.get('/:id/edit', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.redirect('/customers');
  res.render('customers/form', { title: 'تعديل العميل', customer, error: null });
});

// PUT
router.put('/:id', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.redirect('/customers');
  try {
    customer.set(req.body);
    await customer.save();
    res.redirect('/customers');
  } catch (err) {
    res.render('customers/form', { title: 'تعديل العميل', customer, error: err.message });
  }
});

// DELETE (customers with invoices are kept for the audit trail)
router.delete('/:id', async (req, res) => {
  if (await Invoice.exists({ customer: req.params.id })) {
    return res.redirect(withError('/customers', 'لا يمكن حذف عميل لديه فواتير'));
  }
  await Customer.findByIdAndDelete(req.params.id);
  res.redirect('/customers');
});

module.exports = router;
