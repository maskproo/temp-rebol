const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const { dateRange, buildExpenseLines, postExpense, deleteEntriesFor } = require('../services/ledger');

const categories = Expense.schema.path('category').enumValues;

const expenseFields = (body) => ({
  date: body.date,
  description: body.description,
  amount: body.amount,
  category: body.category,
  paymentMethod: body.paymentMethod,
  account: body.account || undefined,
  reference: body.reference,
  notes: body.notes || ''
});

const renderForm = async (res, title, expense, error) => {
  const accounts = await Account.find({ type: 'expense', isActive: true }).sort({ code: 1 });
  res.render('expenses/form', { title, expense, accounts, error, categories });
};

// GET all
router.get('/', async (req, res) => {
  const { category, from, to } = req.query;
  const filter = {};
  if (typeof category === 'string' && category) filter.category = category;
  const range = dateRange(from, to);
  if (range) filter.date = range;

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
    categories
  });
});

// GET form
router.get('/new', (req, res) => renderForm(res, 'مصروف جديد', null, null));

// POST: expense + journal entry (Expense Dr / Cash or Bank Cr)
router.post('/', async (req, res) => {
  const expense = new Expense(expenseFields(req.body));
  try {
    await expense.validate();
    const lines = await buildExpenseLines(expense);
    await expense.save();
    try {
      await postExpense(expense, lines);
    } catch (err) {
      await Expense.deleteOne({ _id: expense._id });
      throw err;
    }
    res.redirect('/expenses');
  } catch (err) {
    await renderForm(res, 'مصروف جديد', req.body, err.message);
  }
});

// GET edit
router.get('/:id/edit', async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.redirect('/expenses');
  await renderForm(res, 'تعديل المصروف', expense, null);
});

// PUT: update expense and replace its journal entry
router.put('/:id', async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.redirect('/expenses');
  try {
    expense.set(expenseFields(req.body));
    await expense.validate();
    const lines = await buildExpenseLines(expense);
    await expense.save();
    await deleteEntriesFor('expense', expense._id);
    await postExpense(expense, lines);
    res.redirect('/expenses');
  } catch (err) {
    await renderForm(res, 'تعديل المصروف', expense, err.message);
  }
});

// DELETE (with its journal entry)
router.delete('/:id', async (req, res) => {
  await deleteEntriesFor('expense', req.params.id);
  await Expense.findByIdAndDelete(req.params.id);
  res.redirect('/expenses');
});

module.exports = router;
