const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  date: { type: Date, required: true, default: Date.now },
  amount: { type: Number, required: true, min: 0.01 },
  method: {
    type: String,
    enum: ['نقداً', 'بنك', 'شيك', 'بطاقة', 'تحويل'],
    default: 'نقداً'
  },
  reference: { type: String, trim: true },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
