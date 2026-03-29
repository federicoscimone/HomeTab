import mongoose from 'mongoose';

const KeywordMappingSchema = new mongoose.Schema({
  keyword: { type: String, required: true, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subCategory1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  subCategory2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  caseSensitive: { type: Boolean, default: false },
  priority: { type: Number, default: 10 },
}, { timestamps: true });

export default mongoose.models.KeywordMapping || mongoose.model('KeywordMapping', KeywordMappingSchema);
