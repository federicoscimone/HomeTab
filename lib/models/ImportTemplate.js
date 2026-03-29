import mongoose from 'mongoose';

const ImportTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  fileType: { type: String, enum: ['xlsx', 'csv', 'paste'], default: 'xlsx' },
  skipRows: { type: Number, default: 0 },
  delimiter: { type: String, default: ';' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
  // Mapping colonna (lettera A,B,C... o indice 0,1,2...) -> campo interno
  columnMapping: {
    date: { type: String, default: null },
    amount: { type: String, default: null },
    description: { type: String, default: null },
    payee: { type: String, default: null },
    place: { type: String, default: null },
    notes: { type: String, default: null },
  },
  // Colonne separate dare/avere
  amountDebit: { type: String, default: null },
  amountCredit: { type: String, default: null },
  // Per colonna singola: come interpretare il segno dell'importo
  // 'absolute'           → sempre positivo, tipo da determinare manualmente
  // 'negative_is_income' → valore negativo = entrata, positivo = uscita
  // 'negative_is_expense'→ valore negativo = uscita, positivo = entrata
  amountSign: { type: String, enum: ['absolute', 'negative_is_income', 'negative_is_expense'], default: 'absolute' },
}, { timestamps: true });

export default mongoose.models.ImportTemplate || mongoose.model('ImportTemplate', ImportTemplateSchema);
