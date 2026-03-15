const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Customer = require('../models/Customer');
const JournalEntry = require('../models/JournalEntry');

router.get('/', async (req, res) => {
  try {
    const [
      totalCustomers,
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      recentJournal,
      recentInvoices
    ] = await Promise.all([
      Customer.countDocuments({ isActive: true }),
      Invoice.countDocuments(),
      Invoice.find({ status: 'paid' }),
      Invoice.find({ status: { $in: ['draft', 'sent', 'partial'] } }),
      Invoice.find({ status: 'overdue' }),
      JournalEntry.find().sort({ date: -1 }).limit(5),
      Invoice.find().sort({ date: -1 }).limit(5).populate('customer')
    ]);

    const totalRevenue = paidInvoices.reduce((s, i) => s + i.paid, 0);
    const totalPending = pendingInvoices.reduce((s, i) => s + i.balance, 0);
    const totalOverdue = overdueInvoices.reduce((s, i) => s + i.balance, 0);

    // Monthly revenue for last 6 months
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthInvoices = await Invoice.find({ date: { $gte: d, $lte: end }, status: { $ne: 'cancelled' } });
      months.push({
        label: d.toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' }),
        revenue: monthInvoices.reduce((s, inv) => s + inv.total, 0)
      });
    }

    // Monthly expenses for last 6 months
    const expenseMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthExpenses = await Expense.find({ date: { $gte: d, $lte: end } });
      expenseMonths.push(monthExpenses.reduce((s, e) => s + e.amount, 0));
    }

    // Total expenses
    const allExpenses = await Expense.find();
    const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    res.render('dashboard', {
      title: 'لوحة التحكم',
      stats: {
        totalCustomers,
        totalRevenue,
        totalPending,
        totalOverdue,
        totalExpenses,
        netProfit,
        totalInvoices
      },
      recentJournal,
      recentInvoices,
      chartData: {
        labels: months.map(m => m.label),
        revenue: months.map(m => m.revenue),
        expenses: expenseMonths
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('خطأ في السيرفر: ' + err.message);
  }
});

module.exports = router;
