const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['asset', 'liability', 'equity', 'revenue', 'expense']
  },
  normalBalance: { type: String, enum: ['debit', 'credit'] },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Auto-set normalBalance based on account type
AccountSchema.pre('save', function (next) {
  const debitTypes = ['asset', 'expense'];
  this.normalBalance = debitTypes.includes(this.type) ? 'debit' : 'credit';
  next();
});

// Virtual: computed balance from journal entries
AccountSchema.methods.getBalance = async function () {
  const JournalEntry = mongoose.model('JournalEntry');
  const entries = await JournalEntry.find({ 'lines.account': this._id });
  let debit = 0, credit = 0;
  entries.forEach(entry => {
    entry.lines.forEach(line => {
      if (line.account.toString() === this._id.toString()) {
        debit += line.debit || 0;
        credit += line.credit || 0;
      }
    });
  });
  if (this.normalBalance === 'debit') return debit - credit;
  return credit - debit;
};

const typeLabels = {
  asset: 'أصول',
  liability: 'التزامات',
  equity: 'حقوق الملكية',
  revenue: 'إيرادات',
  expense: 'مصاريف'
};

AccountSchema.virtual('typeLabel').get(function () {
  return typeLabels[this.type] || this.type;
});

module.exports = mongoose.model('Account', AccountSchema);
