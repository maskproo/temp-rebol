const mongoose = require('mongoose');

// Atomic sequences (e.g. invoice numbers)
const CounterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 }
});

CounterSchema.statics.next = async function (name, initialValue) {
  let counter = await this.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
  if (counter) return counter.seq;
  try {
    await this.create({ _id: name, seq: await initialValue() });
  } catch (err) {
    if (err.code !== 11000) throw err; // another request created it first
  }
  counter = await this.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { returnDocument: 'after' });
  return counter.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
