const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const { getBalances, balanceOf, round2 } = require('../services/ledger');

router.get('/', async (req, res) => {
  await Invoice.refreshOverdue();

  // Month buckets (UTC, matching how dates are stored)
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
  }
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    totalCustomers,
    totalInvoices,
    openInvoices,
    recentJournal,
    recentInvoices,
    accounts,
    balances,
    monthly
  ] = await Promise.all([
    Customer.countDocuments({ isActive: true }),
    Invoice.countDocuments({ status: { $ne: 'cancelled' } }),
    Invoice.find({ status: { $in: ['sent', 'partial', 'overdue'] } }),
    JournalEntry.find().sort({ date: -1 }).limit(5),
    Invoice.find().sort({ date: -1 }).limit(5).populate('customer'),
    Account.find({ type: { $in: ['revenue', 'expense'] } }),
    getBalances(),
    JournalEntry.aggregate([
      { $match: { date: { $gte: months[0], $lt: nextMonth } } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: { y: { $year: '$date' }, m: { $month: '$date' }, account: '$lines.account' },
          debit: { $sum: '$lines.debit' },
          credit: { $sum: '$lines.credit' }
        }
      }
    ])
  ]);

  // Revenue / expenses come from the ledger so they match the income statement
  const typeById = new Map(accounts.map(a => [a._id.toString(), a.type]));
  let totalRevenue = 0, totalExpenses = 0;
  accounts.forEach(acc => {
    const { balance } = balanceOf(balances, acc);
    if (acc.type === 'revenue') totalRevenue += balance;
    else totalExpenses += balance;
  });

  const revenueByMonth = months.map(() => 0);
  const expensesByMonth = months.map(() => 0);
  monthly.forEach(row => {
    const idx = months.findIndex(d => d.getUTCFullYear() === row._id.y && d.getUTCMonth() + 1 === row._id.m);
    const type = typeById.get(row._id.account.toString());
    if (idx < 0 || !type) return;
    if (type === 'revenue') revenueByMonth[idx] += row.credit - row.debit;
    else expensesByMonth[idx] += row.debit - row.credit;
  });

  const totalPending = openInvoices.filter(i => i.status !== 'overdue').reduce((s, i) => s + i.balance, 0);
  const totalOverdue = openInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.balance, 0);

  res.render('dashboard', {
    title: 'لوحة التحكم',
    stats: {
      totalCustomers,
      totalRevenue: round2(totalRevenue),
      totalPending: round2(totalPending),
      totalOverdue: round2(totalOverdue),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(totalRevenue - totalExpenses),
      totalInvoices
    },
    recentJournal,
    recentInvoices,
    chartData: {
      labels: months.map(d => d.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric', timeZone: 'UTC' })),
      revenue: revenueByMonth.map(round2),
      expenses: expensesByMonth.map(round2)
    }
  });
});

module.exports = router;
