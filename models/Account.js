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
AccountSchema.pre('save', function () {
  const debitTypes = ['asset', 'expense'];
  this.normalBalance = debitTypes.includes(this.type) ? 'debit' : 'credit';
});

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
