const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');

// Well-known account codes created by seed.js
const CODES = {
  cash: '1100',
  bank: '1110',
  receivable: '1200',
  vatPayable: '2200',
  salesRevenue: '4100'
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toArray = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// Dates from <input type="date"> are stored as UTC midnight, so filter in UTC too.
function dateRange(from, to) {
  const range = {};
  const f = typeof from === 'string' && from ? new Date(from) : null;
  const t = typeof to === 'string' && to ? new Date(to + 'T23:59:59.999Z') : null;
  if (f && !isNaN(f)) range.$gte = f;
  if (t && !isNaN(t)) range.$lte = t;
  return Object.keys(range).length ? range : null;
}

// One aggregation for every account's debit/credit totals in a period.
async function getBalances(from, to) {
  const match = {};
  const range = dateRange(from, to);
  if (range) match.date = range;
  const rows = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    { $group: { _id: '$lines.account', debit: { $sum: '$lines.debit' }, credit: { $sum: '$lines.credit' } } }
  ]);
  const map = new Map();
  rows.forEach(r => map.set(r._id.toString(), { debit: round2(r.debit), credit: round2(r.credit) }));
  return map;
}

function balanceOf(balances, account) {
  const b = balances.get(account._id.toString()) || { debit: 0, credit: 0 };
  const natural = account.normalBalance === 'debit' || ['asset', 'expense'].includes(account.type)
    ? b.debit - b.credit
    : b.credit - b.debit;
  return { debit: b.debit, credit: b.credit, balance: round2(natural) };
}

async function requireAccount(code) {
  const acc = await Account.findOne({ code });
  if (!acc) throw new Error(`الحساب ${code} غير موجود في دليل الحسابات - شغّل npm run seed أو أضفه يدوياً`);
  return acc;
}

// Cash for cash payments, bank for everything else
const settlementCode = (method) => (method === 'نقداً' ? CODES.cash : CODES.bank);

async function postInvoice(invoice) {
  const ar = await requireAccount(CODES.receivable);
  const revenue = await requireAccount(CODES.salesRevenue);
  const lines = [
    { account: ar._id, debit: invoice.total, credit: 0, description: `فاتورة ${invoice.number}` },
    { account: revenue._id, debit: 0, credit: invoice.subtotal, description: `إيرادات فاتورة ${invoice.number}` }
  ];
  if (invoice.taxAmount > 0) {
    const vat = await requireAccount(CODES.vatPayable);
    lines.push({ account: vat._id, debit: 0, credit: invoice.taxAmount, description: `ضريبة فاتورة ${invoice.number}` });
  }
  return JournalEntry.create({
    date: invoice.date,
    description: `فاتورة مبيعات ${invoice.number}`,
    reference: invoice.number,
    lines,
    source: 'invoice',
    sourceId: invoice._id
  });
}

async function postPayment(invoice, payment) {
  const settle = await requireAccount(settlementCode(payment.method));
  const ar = await requireAccount(CODES.receivable);
  return JournalEntry.create({
    date: payment.date,
    description: `تحصيل فاتورة ${invoice.number}`,
    reference: payment.reference || invoice.number,
    lines: [
      { account: settle._id, debit: payment.amount, credit: 0, description: `تحصيل (${payment.method})` },
      { account: ar._id, debit: 0, credit: payment.amount, description: `تسوية فاتورة ${invoice.number}` }
    ],
    source: 'payment',
    sourceId: payment._id
  });
}

async function buildExpenseLines(expense) {
  const expenseAccount = await Account.findById(expense.account);
  if (!expenseAccount || expenseAccount.type !== 'expense') throw new Error('يجب اختيار حساب مصروف صحيح');
  const settle = await requireAccount(settlementCode(expense.paymentMethod));
  return [
    { account: expenseAccount._id, debit: expense.amount, credit: 0, description: expense.description },
    { account: settle._id, debit: 0, credit: expense.amount, description: `دفع مصروف (${expense.paymentMethod})` }
  ];
}

function postExpense(expense, lines) {
  return JournalEntry.create({
    date: expense.date,
    description: expense.description,
    reference: expense.reference,
    lines,
    source: 'expense',
    sourceId: expense._id
  });
}

const deleteEntriesFor = (source, sourceIds) =>
  JournalEntry.deleteMany({ source, sourceId: { $in: toArray(sourceIds) } });

module.exports = {
  CODES, round2, escapeRegex, toArray, dateRange,
  getBalances, balanceOf,
  postInvoice, postPayment, buildExpenseLines, postExpense, deleteEntriesFor
};
