const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: {
    type: String,
    required: true,
    enum: ['رواتب', 'إيجار', 'مرافق', 'مشتريات', 'تسويق', 'صيانة', 'نقل', 'ضرائب', 'أخرى']
  },
  paymentMethod: {
    type: String,
    enum: ['نقداً', 'بنك', 'شيك', 'بطاقة'],
    default: 'نقداً'
  },
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  reference: { type: String, trim: true },
  notes: { type: String, default: '' },
  attachments: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Expense', ExpenseSchema);
