const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');

// GET all
router.get('/', async (req, res) => {
  const { category, from, to } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (from) filter.date = { ...filter.date, $gte: new Date(from) };
  if (to) filter.date = { ...filter.date, $lte: new Date(to + 'T23:59:59') };

  const expenses = await Expense.find(filter).populate('account').sort({ date: -1 });
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  // Category totals
  const categoryTotals = {};
  expenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  res.render('expenses/index', {
    title: 'المصاريف',
    expenses,
    total,
    categoryTotals,
    query: req.query,
    categories: ['رواتب', 'إيجار', 'مرافق', 'مشتريات', 'تسويق', 'صيانة', 'نقل', 'ضرائب', 'أخرى']
  });
});

// GET form
router.get('/new', async (req, res) => {
  const accounts = await Account.find({ type: 'expense', isActive: true }).sort({ code: 1 });
  res.render('expenses/form', {
    title: 'مصروف جديد',
    expense: null,
    accounts,
    error: null,
    categories: ['رواتب', 'إيجار', 'مرافق', 'مشتريات', 'تسويق', 'صيانة', 'نقل', 'ضرائب', 'أخرى']
  });
});

// POST
router.post('/', async (req, res) => {
  const accounts = await Account.find({ type: 'expense', isActive: true }).sort({ code: 1 });
  const categories = ['رواتب', 'إيجار', 'مرافق', 'مشتريات', 'تسويق', 'صيانة', 'نقل', 'ضرائب', 'أخرى'];
  try {
    const expense = await Expense.create(req.body);

    // Auto journal entry
    if (req.body.account) {
      const cashAccount = await Account.findOne({ code: '1100' });
      if (cashAccount) {
        await JournalEntry.create({
          date: expense.date,
          description: expense.description,
          reference: expense.reference,
          lines: [
            { account: expense.account, debit: expense.amount, credit: 0, description: expense.description },
            { account: cashAccount._id, debit: 0, credit: expense.amount, description: 'دفع مصروف' }
          ],
          source: 'expense',
          sourceId: expense._id
        });
      }
    }

    res.redirect('/expenses');
  } catch (err) {
    res.render('expenses/form', { title: 'مصروف جديد', expense: req.body, accounts, error: err.message, categories });
  }
});

// GET edit
router.get('/:id/edit', async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  const accounts = await Account.find({ type: 'expense', isActive: true }).sort({ code: 1 });
  const categories = ['رواتب', 'إيجار', 'مرافق', 'مشتريات', 'تسويق', 'صيانة', 'نقل', 'ضرائب', 'أخرى'];
  res.render('expenses/form', { title: 'تعديل المصروف', expense, accounts, error: null, categories });
});

// PUT
router.put('/:id', async (req, res) => {
  await Expense.findByIdAndUpdate(req.params.id, req.body);
  res.redirect('/expenses');
});

// DELETE
router.delete('/:id', async (req, res) => {
  await Expense.findByIdAndDelete(req.params.id);
  res.redirect('/expenses');
});

module.exports = router;
