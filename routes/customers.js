const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

// GET all
router.get('/', async (req, res) => {
  const customers = await Customer.find().sort({ name: 1 });
  const customersWithStats = await Promise.all(
    customers.map(async (c) => {
      const invoices = await Invoice.find({ customer: c._id, status: { $ne: 'cancelled' } });
      const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
      const totalPaid = invoices.reduce((s, i) => s + i.paid, 0);
      return { ...c.toObject(), totalInvoiced, totalPaid, balance: totalInvoiced - totalPaid };
    })
  );
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
  const invoices = await Invoice.find({ customer: req.params.id }).sort({ date: -1 });
  res.render('customers/detail', { title: customer.name, customer, invoices });
});

// GET edit
router.get('/:id/edit', async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  res.render('customers/form', { title: 'تعديل العميل', customer, error: null });
});

// PUT
router.put('/:id', async (req, res) => {
  try {
    await Customer.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/customers');
  } catch (err) {
    const customer = await Customer.findById(req.params.id);
    res.render('customers/form', { title: 'تعديل العميل', customer, error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.redirect('/customers');
});

module.exports = router;
