import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import GoogleDriveIntegration from '@/lib/models/GoogleDriveIntegration';
import { runBackupForIntegration } from '@/lib/services/googleDriveBackup';
import { logApiError } from '@/lib/logger';

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

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