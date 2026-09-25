const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Expense = require('../models/Expense');
const { getBalances, balanceOf } = require('../services/ledger');
const { withError } = require('../services/flash');

// Unchecked checkboxes are not submitted at all
const accountFields = (body) => ({
  code: body.code,
  name: body.name,
  type: body.type,
  description: body.description || '',
  isActive: body.isActive === 'true'
});

// GET all accounts
router.get('/', async (req, res) => {
  const { type } = req.query;
  const filter = typeof type === 'string' && type ? { type } : {};
  const [accounts, balances] = await Promise.all([
    Account.find(filter).sort({ code: 1 }),
    getBalances()
  ]);

  const accountsWithBalance = accounts.map(acc => ({
    ...acc.toObject({ virtuals: true }),
    balance: balanceOf(balances, acc).balance
  }));

  res.render('accounts/index', {
    title: 'دليل الحسابات',
    accounts: accountsWithBalance,
    selectedType: filter.type || ''
  });
});

// GET form
router.get('/new', (req, res) => {
  res.render('accounts/form', { title: 'حساب جديد', account: null, error: null });
});

// POST create
router.post('/', async (req, res) => {
  try {
    await Account.create(accountFields(req.body));
    res.redirect('/accounts');
  } catch (err) {
    res.render('accounts/form', {
      title: 'حساب جديد',
      account: accountFields(req.body),
      error: err.message
    });
  }
});

// GET edit
router.get('/:id/edit', async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.redirect('/accounts');
  res.render('accounts/form', { title: 'تعديل الحساب', account, error: null });
});

// PUT update (load + save so validators and normalBalance hook run)
router.put('/:id', async (req, res) => {
  const account = await Account.findById(req.params.id);
  if (!account) return res.redirect('/accounts');
  try {
    account.set(accountFields(req.body));
    await account.save();
    res.redirect('/accounts');
  } catch (err) {
    res.render('accounts/form', { title: 'تعديل الحساب', account, error: err.message });
  }
});

// DELETE (only accounts that were never used)
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const [inJournal, inExpenses] = await Promise.all([
    JournalEntry.exists({ 'lines.account': id }),
    Expense.exists({ account: id })
  ]);
  if (inJournal || inExpenses) {
    return res.redirect(withError('/accounts', 'لا يمكن حذف حساب عليه حركات - يمكنك إيقافه بدلاً من ذلك'));
  }
  await Account.findByIdAndDelete(id);
  res.redirect('/accounts');
});

module.exports = router;
