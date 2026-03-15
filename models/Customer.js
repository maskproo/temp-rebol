const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  taxNumber: { type: String, trim: true },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Virtual: total invoiced and total paid
CustomerSchema.virtual('totalDue').get(async function () {
  const Invoice = mongoose.model('Invoice');
  const invoices = await Invoice.find({ customer: this._id, status: { $ne: 'cancelled' } });
  return invoices.reduce((sum, inv) => sum + (inv.total - inv.paid), 0);
});

module.exports = mongoose.model('Customer', CustomerSchema);
