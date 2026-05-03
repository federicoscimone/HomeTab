import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/mongodb';
import GoogleDriveIntegration from '@/lib/models/GoogleDriveIntegration';
import { writeAudit } from '@/lib/utils/audit';
import { computeNextBackupAt } from '@/lib/services/googleDriveBackup';
import { logApiError } from '@/lib/logger';

function serializeIntegration(integration) {
  if (!integration) {
    return {
      isConfigured: false,
      isConnected: false,
      autoBackupEnabled: false,
      backupFrequency: 'weekly',
      folderName: 'HomeBI Backups',
      lastBackupAt: null,
      lastBackupStatus: 'idle',
      lastBackupFileName: null,
      lastBackupError: null,
      nextBackupAt: null,
      googleEmail: null,
    };
  }

  return {
    isConfigured: true,
    isConnected: integration.isConnected,
    autoBackupEnabled: integration.autoBackupEnabled,
    backupFrequency: integration.backupFrequency,
    folderName: integration.folderName,
    lastBackupAt: integration.lastBackupAt,
    lastBackupStatus: integration.lastBackupStatus,
    lastBackupFileName: integration.lastBackupFileName,
    lastBackupError: integration.lastBackupError,
    nextBackupAt: integration.nextBackupAt,
    googleEmail: integration.googleEmail,
    connectedAt: integration.connectedAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  await connectDB();
  const integration = await GoogleDriveIntegration.findOne({ userId: session.user.id }).lean();

  return NextResponse.json(serializeIntegration(integration));
}

export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  try {
    const { autoBackupEnabled, backupFrequency } = await req.json();
    if (![true, false].includes(autoBackupEnabled) || !['daily', 'weekly'].includes(backupFrequency)) {
      return NextResponse.json({ error: 'Configurazione backup non valida' }, { status: 400 });
    }

    await connectDB();
    const integration = await GoogleDriveIntegration.findOne({ userId: session.user.id });
    if (!integration?.isConnected) {
      return NextResponse.json({ error: 'Google Drive non collegato' }, { status: 400 });
    }

    integration.autoBackupEnabled = autoBackupEnabled;
    integration.backupFrequency = backupFrequency;
    integration.nextBackupAt = autoBackupEnabled ? computeNextBackupAt(backupFrequency) : null;
    await integration.save();

    await writeAudit(session, req, {
      action: 'UPDATE',
      resource: 'backup',
      resourceId: integration._id,
      description: autoBackupEnabled
        ? `Backup automatico Google Drive attivato (${backupFrequency})`
        : 'Backup automatico Google Drive disattivato',
      meta: {
        autoBackupEnabled,
        backupFrequency,
        nextBackupAt: integration.nextBackupAt,
      },
    });

    return NextResponse.json(serializeIntegration(integration));
  } catch (error) {
    logApiError('PATCH /api/integrations/google-drive', error, { userId: session.user.id });
    return NextResponse.json({ error: 'Errore aggiornamento configurazione backup' }, { status: 500 });
  }
}

export async function DELETE(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  try {
    await connectDB();
    const integration = await GoogleDriveIntegration.findOne({ userId: session.user.id });
    if (!integration) {
      return NextResponse.json({ message: 'Nessuna integrazione da scollegare' });
    }

    integration.googleEmail = null;
    integration.googleAccountId = null;
    integration.encryptedRefreshToken = null;
    integration.tokenScope = '';
    integration.folderId = null;
    integration.isConnected = false;
    integration.autoBackupEnabled = false;
    integration.nextBackupAt = null;
    integration.lastBackupStatus = 'idle';
    await integration.save();

    await writeAudit(session, req, {
      action: 'BACKUP_DISCONNECT',
      resource: 'backup',
      resourceId: integration._id,
      description: 'Google Drive scollegato',
    });

    return NextResponse.json({ message: 'Google Drive scollegato' });
  } catch (error) {
    logApiError('DELETE /api/integrations/google-drive', error, { userId: session.user.id });
    return NextResponse.json({ error: 'Errore durante lo scollegamento di Google Drive' }, { status: 500 });
  }
}