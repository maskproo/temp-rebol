const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');

// Helper: get account balance for a period
async function getAccountBalance(accountId, fromDate, toDate) {
  const filter = { 'lines.account': accountId };
  if (fromDate || toDate) {
    filter.date = {};
    if (fromDate) filter.date.$gte = new Date(fromDate);
    if (toDate) filter.date.$lte = new Date(toDate + 'T23:59:59');
  }
  const entries = await JournalEntry.find(filter);
  let debit = 0, credit = 0;
  entries.forEach(entry => {
    entry.lines.forEach(line => {
      if (line.account.toString() === accountId.toString()) {
        debit += line.debit || 0;
        credit += line.credit || 0;
      }
    });
  });
  return { debit, credit, net: debit - credit };
}

// Income Statement
router.get('/income', async (req, res) => {
  const { from, to } = req.query;
  const revenues = await Account.find({ type: 'revenue', isActive: true }).sort({ code: 1 });
  const expenses = await Account.find({ type: 'expense', isActive: true }).sort({ code: 1 });

  const revenueRows = await Promise.all(revenues.map(async (acc) => {
    const bal = await getAccountBalance(acc._id, from, to);
    return { ...acc.toObject({ virtuals: true }), balance: bal.credit - bal.debit };
  }));

  const expenseRows = await Promise.all(expenses.map(async (acc) => {
    const bal = await getAccountBalance(acc._id, from, to);
    return { ...acc.toObject({ virtuals: true }), balance: bal.debit - bal.credit };
  }));

  const totalRevenue = revenueRows.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expenseRows.reduce((s, a) => s + a.balance, 0);
  const netProfit = totalRevenue - totalExpenses;

  res.render('reports/income-statement', {
    title: 'قائمة الدخل',
    revenueRows,
    expenseRows,
    totalRevenue,
    totalExpenses,
    netProfit,
    query: req.query
  });
});

// Balance Sheet
router.get('/balance', async (req, res) => {
  const { asOf } = req.query;
  const toDate = asOf || new Date().toISOString().split('T')[0];

  const assets = await Account.find({ type: 'asset', isActive: true }).sort({ code: 1 });
  const liabilities = await Account.find({ type: 'liability', isActive: true }).sort({ code: 1 });
  const equities = await Account.find({ type: 'equity', isActive: true }).sort({ code: 1 });

  const assetRows = await Promise.all(assets.map(async (acc) => {
    const bal = await getAccountBalance(acc._id, null, toDate);
    return { ...acc.toObject({ virtuals: true }), balance: bal.debit - bal.credit };
  }));

  const liabilityRows = await Promise.all(liabilities.map(async (acc) => {
    const bal = await getAccountBalance(acc._id, null, toDate);
    return { ...acc.toObject({ virtuals: true }), balance: bal.credit - bal.debit };
  }));

  const equityRows = await Promise.all(equities.map(async (acc) => {
    const bal = await getAccountBalance(acc._id, null, toDate);
    return { ...acc.toObject({ virtuals: true }), balance: bal.credit - bal.debit };
  }));

  // Add net profit to equity
  const revAccounts = await Account.find({ type: 'revenue', isActive: true });
  const expAccounts = await Account.find({ type: 'expense', isActive: true });
  let totalRev = 0, totalExp = 0;
  for (const acc of revAccounts) {
    const bal = await getAccountBalance(acc._id, null, toDate);
    totalRev += bal.credit - bal.debit;
  }
  for (const acc of expAccounts) {
    const bal = await getAccountBalance(acc._id, null, toDate);
    totalExp += bal.debit - bal.credit;
  }
  const netProfit = totalRev - totalExp;

  const totalAssets = assetRows.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilityRows.reduce((s, a) => s + a.balance, 0);
  const totalEquity = equityRows.reduce((s, a) => s + a.balance, 0) + netProfit;

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
  const accounts = await Account.find({ isActive: true }).sort({ code: 1 });

  const rows = await Promise.all(accounts.map(async (acc) => {
    const bal = await getAccountBalance(acc._id, from, to);
    return { ...acc.toObject({ virtuals: true }), debit: bal.debit, credit: bal.credit };
  }));

  const filtered = rows.filter(r => r.debit > 0 || r.credit > 0);
  const totalDebit = filtered.reduce((s, r) => s + r.debit, 0);
  const totalCredit = filtered.reduce((s, r) => s + r.credit, 0);

  res.render('reports/trial-balance', {
    title: 'ميزان المراجعة',
    rows: filtered,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    query: req.query
  });
});

module.exports = router;
