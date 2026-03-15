const mongoose = require('mongoose');

const LineSchema = new mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  description: { type: String, default: '' },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 }
});

const JournalEntrySchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  reference: { type: String, trim: true },
  description: { type: String, required: true, trim: true },
  lines: [LineSchema],
  source: { type: String, enum: ['manual', 'invoice', 'expense', 'payment'], default: 'manual' },
  sourceId: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

// Validate: total debits == total credits
JournalEntrySchema.pre('save', function (next) {
  const totalDebit = this.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = this.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return next(new Error(`القيد غير متوازن: مجموع المدين ${totalDebit} ≠ مجموع الدائن ${totalCredit}`));
  }
  if (this.lines.length < 2) {
    return next(new Error('القيد يجب أن يحتوي على سطرين على الأقل'));
  }
  next();
});

JournalEntrySchema.virtual('totalDebit').get(function () {
  return this.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
});

JournalEntrySchema.virtual('totalCredit').get(function () {
  return this.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
});

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);
