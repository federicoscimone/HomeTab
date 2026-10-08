import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guard';
import { demoBlocked } from '@/lib/demoGuard';
import connectDB from '@/lib/mongodb';
import GoogleDriveIntegration from '@/lib/models/GoogleDriveIntegration';
import { runBackupForIntegration } from '@/lib/services/googleDriveBackup';
import { logApiError } from '@/lib/logger';
import { serverTranslator } from '@/lib/i18n/server';

export async function POST(req) {
  const { session, denied } = await requirePermission('settings:manage');
  if (denied) return denied;
  const blocked = await demoBlocked();
  if (blocked) return blocked;

  try {
    await connectDB();
    const integration = await GoogleDriveIntegration.findOne({ userId: session.user.id });
    if (!integration?.isConnected) {
      return NextResponse.json({ error: (await serverTranslator('errors'))('driveNotConnected') }, { status: 400 });
    }

    const result = await runBackupForIntegration({
      integrationId: integration._id,
      trigger: 'manual',
      req,
    });

    return NextResponse.json(result);
  } catch (error) {
    logApiError('POST /api/integrations/google-drive/backup', error, { userId: session.user.id });
    // Il messaggio di Google, se c'è, è più utile di uno generico: resta com'è.
    return NextResponse.json({ error: error.message || (await serverTranslator('errors'))('driveBackupFailed') }, { status: 500 });
  }
}