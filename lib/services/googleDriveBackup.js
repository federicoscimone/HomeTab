import connectDB from '@/lib/mongodb';
import GoogleDriveIntegration from '@/lib/models/GoogleDriveIntegration';
import logger from '@/lib/logger';
import { writeAuditRecord } from '@/lib/utils/audit';
import { buildApplicationBackupFile } from '@/lib/services/appBackup';
import {
  findOrCreateBackupFolder,
  refreshGoogleAccessToken,
  uploadBackupFile,
} from '@/lib/services/googleDrive';

export function computeNextBackupAt(frequency, fromDate = new Date()) {
  const next = new Date(fromDate);
  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
  } else {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

export async function runBackupForIntegration({ integrationId, trigger = 'manual', req = null }) {
  await connectDB();

  const integration = await GoogleDriveIntegration.findById(integrationId);
  if (!integration || !integration.isConnected || !integration.encryptedRefreshToken) {
    throw new Error('Integrazione Google Drive non configurata');
  }

  try {
    const tokenData = await refreshGoogleAccessToken(integration.encryptedRefreshToken);
    const accessToken = tokenData.access_token;
    const folder = await findOrCreateBackupFolder(accessToken, integration.folderName || 'HomeTab Backups');
    const backup = await buildApplicationBackupFile();
    const uploadedFile = await uploadBackupFile(accessToken, {
      folderId: folder.id,
      fileName: backup.fileName,
      mimeType: backup.mimeType,
      buffer: backup.buffer,
    });

    integration.folderId = folder.id;
    integration.isConnected = true;
    integration.lastBackupAt = new Date();
    integration.lastBackupStatus = 'success';
    integration.lastBackupFileId = uploadedFile.id;
    integration.lastBackupFileName = uploadedFile.name;
    integration.lastBackupError = null;
    integration.nextBackupAt = integration.autoBackupEnabled
      ? computeNextBackupAt(integration.backupFrequency, integration.lastBackupAt)
      : null;
    await integration.save();

    await writeAuditRecord({
      userId: integration.userId,
      userEmail: integration.email,
      req,
      action: 'BACKUP_RUN',
      resource: 'backup',
      resourceId: integration._id,
      description: `Backup Google Drive eseguito (${trigger})`,
      meta: {
        trigger,
        fileId: uploadedFile.id,
        fileName: uploadedFile.name,
        folderId: folder.id,
      },
    });

    return {
      fileId: uploadedFile.id,
      fileName: uploadedFile.name,
      folderId: folder.id,
      metadata: backup.metadata,
      webViewLink: uploadedFile.webViewLink || null,
    };
  } catch (error) {
    integration.lastBackupAt = new Date();
    integration.lastBackupStatus = 'error';
    integration.lastBackupError = error.message;
    await integration.save();

    await writeAuditRecord({
      userId: integration.userId,
      userEmail: integration.email,
      req,
      action: 'BACKUP_FAIL',
      resource: 'backup',
      resourceId: integration._id,
      description: `Backup Google Drive fallito (${trigger})`,
      meta: {
        trigger,
        error: error.message,
      },
    });

    logger.error('Google Drive backup failed', {
      integrationId: integration._id.toString(),
      trigger,
      error: error.message,
    });

    throw error;
  }
}