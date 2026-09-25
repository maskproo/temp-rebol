const mongoose = require('mongoose');
const Counter = require('./Counter');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const InvoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number }
});

InvoiceItemSchema.pre('validate', function () {
  this.total = round2(this.quantity * this.unitPrice);
});

const InvoiceSchema = new mongoose.Schema({
  number: { type: String, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  date: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true },
  items: {
    type: [InvoiceItemSchema],
    validate: { validator: (v) => v.length > 0, message: 'الفاتورة يجب أن تحتوي على بند واحد على الأقل' }
  },
  subtotal: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0, min: 0, max: 100 },
  taxAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  paid: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  notes: { type: String, default: '' }
}, { timestamps: true });

const startOfTodayUTC = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// Recompute totals and status before validation so that validators see final values
InvoiceSchema.pre('validate', function () {
  this.subtotal = round2(this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0));
  this.taxAmount = round2(this.subtotal * (this.taxRate / 100));
  this.total = round2(this.subtotal + this.taxAmount);
  this.paid = round2(this.paid);

  if (this.total <= 0) this.invalidate('total', 'إجمالي الفاتورة يجب أن يكون أكبر من صفر');

  // Drafts and cancelled invoices keep their status; issued invoices follow payments and due date
  if (!['draft', 'cancelled'].includes(this.status)) {
    const balance = round2(this.total - this.paid);
    if (balance <= 0) this.status = 'paid';
    else if (this.paid > 0) this.status = 'partial';
    else if (this.dueDate < startOfTodayUTC()) this.status = 'overdue';
    else this.status = 'sent';
  }
});

// Atomic, gap-safe invoice number (survives deletions and concurrent requests)
InvoiceSchema.pre('save', async function () {
  if (this.number) return;
  const seq = await Counter.next('invoice', async () => {
    const last = await mongoose.model('Invoice').findOne({ number: /^INV-\d+$/ }).sort({ number: -1 });
    return last ? parseInt(last.number.slice(4), 10) : 0;
  });
  this.number = `INV-${String(seq).padStart(5, '0')}`;
});

// Move issued, unpaid invoices past their due date to "overdue"
InvoiceSchema.statics.refreshOverdue = function () {
  return this.updateMany({ status: 'sent', dueDate: { $lt: startOfTodayUTC() } }, { status: 'overdue' });
};

InvoiceSchema.virtual('balance').get(function () {
  return round2(this.total - this.paid);
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
