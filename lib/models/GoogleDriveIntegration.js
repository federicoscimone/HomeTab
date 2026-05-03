import mongoose from 'mongoose';

const GoogleDriveIntegrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    googleEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
    },
    googleAccountId: {
      type: String,
      default: null,
      trim: true,
    },
    encryptedRefreshToken: {
      type: String,
      default: null,
    },
    tokenScope: {
      type: String,
      default: '',
    },
    folderId: {
      type: String,
      default: null,
      trim: true,
    },
    folderName: {
      type: String,
      default: 'HomeBI Backups',
      trim: true,
    },
    isConnected: {
      type: Boolean,
      default: false,
      index: true,
    },
    autoBackupEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    backupFrequency: {
      type: String,
      enum: ['daily', 'weekly'],
      default: 'weekly',
    },
    lastBackupAt: {
      type: Date,
      default: null,
    },
    lastBackupStatus: {
      type: String,
      enum: ['idle', 'success', 'error'],
      default: 'idle',
    },
    lastBackupFileId: {
      type: String,
      default: null,
    },
    lastBackupFileName: {
      type: String,
      default: null,
    },
    lastBackupError: {
      type: String,
      default: null,
      maxlength: 1000,
    },
    nextBackupAt: {
      type: Date,
      default: null,
      index: true,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

GoogleDriveIntegrationSchema.index({ autoBackupEnabled: 1, nextBackupAt: 1 });

export default mongoose.models.GoogleDriveIntegration || mongoose.model('GoogleDriveIntegration', GoogleDriveIntegrationSchema);