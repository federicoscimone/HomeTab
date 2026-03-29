import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  hashedPassword: { type: String, required: true },
  role: { type: String, enum: ['admin', 'viewer'], default: 'admin' },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
