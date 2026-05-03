import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GoogleDriveIntegration from '@/lib/models/GoogleDriveIntegration';
import { runBackupForIntegration } from '@/lib/services/googleDriveBackup';
import logger from '@/lib/logger';

function isAuthorized(req) {
  const secret = process.env.BACKUP_CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const headerSecret = req.headers.get('x-backup-cron-secret');

  return bearer === secret || headerSecret === secret;
}

export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  await connectDB();

  const now = new Date();
  const integrations = await GoogleDriveIntegration.find({
    isConnected: true,
    autoBackupEnabled: true,
    nextBackupAt: { $lte: now },
  }).select('_id email');

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (const integration of integrations) {
    try {
      const result = await runBackupForIntegration({
        integrationId: integration._id,
        trigger: 'cron',
      });
      successCount += 1;
      results.push({
        integrationId: integration._id.toString(),
        email: integration.email,
        status: 'success',
        fileName: result.fileName,
      });
    } catch (error) {
      errorCount += 1;
      logger.error('Scheduled Google Drive backup failed', {
        integrationId: integration._id.toString(),
        email: integration.email,
        error: error.message,
      });
      results.push({
        integrationId: integration._id.toString(),
        email: integration.email,
        status: 'error',
        error: error.message,
      });
    }
  }

  return NextResponse.json({
    processed: integrations.length,
    successCount,
    errorCount,
    results,
  });
}