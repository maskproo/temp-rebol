const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');

// GET all accounts
router.get('/', async (req, res) => {
  const { type } = req.query;
  const filter = type ? { type } : {};
  const accounts = await Account.find(filter).sort({ code: 1 });

  // Compute balances
  const accountsWithBalance = await Promise.all(
    accounts.map(async (acc) => {
      const balance = await acc.getBalance();
      return { ...acc.toObject({ virtuals: true }), balance };
    })
  );

  res.render('accounts/index', {
    title: 'دليل الحسابات',
    accounts: accountsWithBalance,
    selectedType: type || ''
  });
});

// GET form
router.get('/new', (req, res) => {
  res.render('accounts/form', { title: 'حساب جديد', account: null, error: null });
});

// POST create
router.post('/', async (req, res) => {
  try {
    await Account.create(req.body);
    res.redirect('/accounts');
  } catch (err) {
    res.render('accounts/form', {
      title: 'حساب جديد',
      account: req.body,
      error: err.message
    });
  }
});

// GET edit
router.get('/:id/edit', async (req, res) => {
  const account = await Account.findById(req.params.id);
  res.render('accounts/form', { title: 'تعديل الحساب', account, error: null });
});

// PUT update
router.put('/:id', async (req, res) => {
  try {
    await Account.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/accounts');
  } catch (err) {
    const account = await Account.findById(req.params.id);
    res.render('accounts/form', { title: 'تعديل الحساب', account, error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  await Account.findByIdAndDelete(req.params.id);
  res.redirect('/accounts');
});

module.exports = router;
