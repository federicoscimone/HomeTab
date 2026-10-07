import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import connectDB from '@/lib/mongodb';
import GoogleDriveIntegration from '@/lib/models/GoogleDriveIntegration';
import { runBackupForIntegration } from '@/lib/services/googleDriveBackup';
import { logApiError } from '@/lib/logger';

export async function POST(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = demoBlocked();
  if (blocked) return blocked;

  try {
    await connectDB();
    const integration = await GoogleDriveIntegration.findOne({ userId: session.user.id });
    if (!integration?.isConnected) {
      return NextResponse.json({ error: 'Google Drive non collegato' }, { status: 400 });
    }

    const result = await runBackupForIntegration({
      integrationId: integration._id,
      trigger: 'manual',
      req,
    });

    return NextResponse.json(result);
  } catch (error) {
    logApiError('POST /api/integrations/google-drive/backup', error, { userId: session.user.id });
    return NextResponse.json({ error: error.message || 'Errore durante il backup su Google Drive' }, { status: 500 });
  }
}