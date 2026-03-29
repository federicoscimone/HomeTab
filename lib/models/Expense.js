import mongoose from 'mongoose';

const ExpenseSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  paymentMethod: {
    type: String,
    required: true,
    enum: [
      'cash',
      'credit_card',
      'debit_card',
      'bank_transfer',
      'paypal',
      'satispay',
      'meal_ticket',
      'gift_voucher',
      'fuel_voucher',
      'other_voucher',
      'other',
    ],
  },
  paymentGroup: {
    type: String,
    enum: ['traditional', 'alternative'],
    required: true,
  },
  date: { type: String, required: true },  // formato YYYY-MM-DD
  time: { type: String, default: null },   // formato HH:mm
  description: { type: String, default: '' },  // causale
  place: { type: String, default: '' },
  payee: { type: String, default: '' },    // esercente
  notes: { type: String, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  subCategory1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  subCategory2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  type: { type: String, enum: ['expense', 'income'], default: 'expense' },
  source: { type: String, enum: ['manual', 'import'], default: 'manual' },
  importBatchId: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
