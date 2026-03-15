const mongoose = require('mongoose');

const InvoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number }
});

InvoiceItemSchema.pre('save', function (next) {
  this.total = this.quantity * this.unitPrice;
  next();
});

const InvoiceSchema = new mongoose.Schema({
  number: { type: String, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  date: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true },
  items: [InvoiceItemSchema],
  subtotal: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
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

// Auto-generate invoice number
InvoiceSchema.pre('save', async function (next) {
  if (!this.number) {
    const count = await mongoose.model('Invoice').countDocuments();
    this.number = `INV-${String(count + 1).padStart(5, '0')}`;
  }
  // Calculate totals
  this.subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  this.taxAmount = this.subtotal * (this.taxRate / 100);
  this.total = this.subtotal + this.taxAmount;
  // Update status
  if (this.status !== 'cancelled') {
    const balance = this.total - this.paid;
    if (balance <= 0) this.status = 'paid';
    else if (this.paid > 0) this.status = 'partial';
    else if (this.dueDate < new Date() && this.status !== 'draft') this.status = 'overdue';
  }
  next();
});

InvoiceSchema.virtual('balance').get(function () {
  return this.total - this.paid;
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
