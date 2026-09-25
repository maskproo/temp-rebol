const express = require('express');
const router = express.Router();
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const { escapeRegex, toArray, dateRange } = require('../services/ledger');
const { withError } = require('../services/flash');

// GET all entries
router.get('/', async (req, res) => {
  const { from, to, search } = req.query;
  const filter = {};
  const range = dateRange(from, to);
  if (range) filter.date = range;
  if (typeof search === 'string' && search) filter.description = { $regex: escapeRegex(search), $options: 'i' };

  const entries = await JournalEntry.find(filter)
    .populate('lines.account')
    .sort({ date: -1 })
    .limit(100);

  res.render('journal/index', {
    title: 'القيود اليومية',
    entries,
    query: req.query
  });
});

// GET form
router.get('/new', async (req, res) => {
  const accounts = await Account.find({ isActive: true }).sort({ code: 1 });
  res.render('journal/form', { title: 'قيد جديد', entry: null, accounts, error: null });
});

// POST create
router.post('/', async (req, res) => {
  const accounts = await Account.find({ isActive: true }).sort({ code: 1 });
  try {
    const { date, reference, description } = req.body;
    const accountId = toArray(req.body.accountId);
    const debit = toArray(req.body.debit);
    const credit = toArray(req.body.credit);
    const lineDesc = toArray(req.body.lineDesc);

    // Build lines array
    const lines = [];
    for (let i = 0; i < accountId.length; i++) {
      if (!accountId[i]) continue;
      lines.push({
        account: accountId[i],
        description: lineDesc[i] || '',
        debit: parseFloat(debit[i]) || 0,
        credit: parseFloat(credit[i]) || 0
      });
    }

    await JournalEntry.create({ date, reference, description, lines });
    res.redirect('/journal');
  } catch (err) {
    res.render('journal/form', {
      title: 'قيد جديد',
      entry: req.body,
      accounts,
      error: err.message
    });
  }
});

// GET detail
router.get('/:id', async (req, res) => {
  const entry = await JournalEntry.findById(req.params.id).populate('lines.account');
  if (!entry) return res.redirect('/journal');
  res.render('journal/detail', { title: 'تفاصيل القيد', entry });
});

// DELETE
router.delete('/:id', async (req, res) => {
  const entry = await JournalEntry.findById(req.params.id);
  if (entry && entry.source !== 'manual') {
    return res.redirect(withError('/journal', 'لا يمكن حذف قيود تلقائية - احذف أو ألغِ المستند المرتبط بها'));
  }
  await JournalEntry.findByIdAndDelete(req.params.id);
  res.redirect('/journal');
});

module.exports = router;
