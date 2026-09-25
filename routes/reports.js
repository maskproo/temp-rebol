const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const { getBalances, balanceOf } = require('../services/ledger');

// Inactive accounts are still reported when they carry a balance
const rowsFor = (accounts, balances) => accounts
  .map(acc => ({ ...acc.toObject({ virtuals: true }), ...balanceOf(balances, acc) }))
  .filter(r => r.isActive || r.debit !== 0 || r.credit !== 0);

const sum = (rows, key = 'balance') => rows.reduce((s, r) => s + r[key], 0);

// Income Statement
router.get('/income', async (req, res) => {
  const { from, to } = req.query;
  const [accounts, balances] = await Promise.all([
    Account.find({ type: { $in: ['revenue', 'expense'] } }).sort({ code: 1 }),
    getBalances(from, to)
  ]);

  const revenueRows = rowsFor(accounts.filter(a => a.type === 'revenue'), balances);
  const expenseRows = rowsFor(accounts.filter(a => a.type === 'expense'), balances);
  const totalRevenue = sum(revenueRows);
  const totalExpenses = sum(expenseRows);

  res.render('reports/income-statement', {
    title: 'قائمة الدخل',
    revenueRows,
    expenseRows,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    query: req.query
  });
});

// Balance Sheet
router.get('/balance', async (req, res) => {
  const asOf = typeof req.query.asOf === 'string' && req.query.asOf ? req.query.asOf : null;
  const toDate = asOf || new Date().toISOString().split('T')[0];

  const [accounts, balances] = await Promise.all([
    Account.find().sort({ code: 1 }),
    getBalances(null, toDate)
  ]);
  const ofType = (type) => accounts.filter(a => a.type === type);

  const assetRows = rowsFor(ofType('asset'), balances);
  const liabilityRows = rowsFor(ofType('liability'), balances);
  const equityRows = rowsFor(ofType('equity'), balances);

  // Current-period earnings are part of equity
  const netProfit = sum(rowsFor(ofType('revenue'), balances)) - sum(rowsFor(ofType('expense'), balances));

  const totalAssets = sum(assetRows);
  const totalLiabilities = sum(liabilityRows);
  const totalEquity = sum(equityRows) + netProfit;

  res.render('reports/balance-sheet', {
    title: 'الميزانية العمومية',
    assetRows,
    liabilityRows,
    equityRows,
    totalAssets,
    totalLiabilities,
    totalEquity,
    netProfit,
    asOf: toDate
  });
});

// Trial Balance
router.get('/trial', async (req, res) => {
  const { from, to } = req.query;
  const [accounts, balances] = await Promise.all([
    Account.find().sort({ code: 1 }),
    getBalances(from, to)
  ]);

  const rows = accounts
    .map(acc => ({ ...acc.toObject({ virtuals: true }), ...balanceOf(balances, acc) }))
    .filter(r => r.debit > 0 || r.credit > 0);
  const totalDebit = sum(rows, 'debit');
  const totalCredit = sum(rows, 'credit');

  res.render('reports/trial-balance', {
    title: 'ميزان المراجعة',
    rows,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    query: req.query
  });
});

module.exports = router;
