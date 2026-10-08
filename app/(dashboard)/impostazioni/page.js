'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/useFormat';

/** @returns {Promise<object>} Stato dell'integrazione Google Drive. */
async function fetchDriveStatus() {
  const res = await fetch('/api/integrations/google-drive', { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '');
  return data;
}

/** Risposta JSON di un'azione: l'errore del server se c'è, altrimenti il messaggio di ripiego. */
async function actionResult(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallback);
  return data;
}

export default function ImpostazioniPage() {
  const t = useTranslations('settingsBackup');
  const { fmtDateTime } = useFormat();
  const [driveStatus, setDriveStatus] = useState(null);
  const [driveSettings, setDriveSettings] = useState({ autoBackupEnabled: false, backupFrequency: 'weekly' });
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);
  // L'esito del collegamento OAuth arriva nell'URL di ritorno da Google: il messaggio iniziale si
  // legge da lì al primo render, poi l'effetto ripulisce l'URL senza toccare lo stato.
  const searchParams = useSearchParams();
  const [driveMessage, setDriveMessage] = useState(
    () => (searchParams.get('driveConnected') === '1' ? t('connectedOk') : ''),
  );
  const [driveError, setDriveError] = useState(
    () => (searchParams.get('driveError') ? t('connectFailed') : ''),
  );

  const applyDriveStatus = (data) => {
    setDriveStatus(data);
    setDriveSettings({
      autoBackupEnabled: !!data.autoBackupEnabled,
      backupFrequency: data.backupFrequency || 'weekly',
    });
  };
  const showDriveStatusError = (err) => setDriveError(err.message || t('statusLoadFailed'));

  /** Ricarica lo stato dopo un'azione dell'utente (collega, scollega, salva, backup). */
  const refreshDriveStatus = () => fetchDriveStatus().then(applyDriveStatus, showDriveStatusError);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('driveConnected') || params.get('driveError')) {
      params.delete('driveConnected');
      params.delete('driveError');
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
      window.history.replaceState({}, '', nextUrl);
    }

    // Lo stato si aggiorna solo nei callback, quando la risposta arriva.
    fetchDriveStatus().then(applyDriveStatus, showDriveStatusError);
    // Solo al montaggio: rileggere lo stato a ogni cambio di lingua non serve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectDrive = async () => {
    setDriveError('');
    setDriveMessage('');
    setDriveBusy(true);

    try {
      const res = await fetch('/api/integrations/google-drive/connect', { method: 'POST' });
      const data = await actionResult(res, t('startConnectFailed'));
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setDriveError(err.message || t('startConnectFailed'));
      setDriveBusy(false);
    }
  };

  const handleDisconnectDrive = async () => {
    setDriveError('');
    setDriveMessage('');
    setDriveBusy(true);

    try {
      const res = await fetch('/api/integrations/google-drive', { method: 'DELETE' });
      await actionResult(res, t('disconnectFailed'));
      setDriveMessage(t('disconnected'));
      await refreshDriveStatus();
    } catch (err) {
      setDriveError(err.message || t('disconnectFailed'));
    } finally {
      setDriveBusy(false);
    }
  };

  const handleRunBackup = async () => {
    setDriveError('');
    setDriveMessage('');
    setDriveBusy(true);

    try {
      const res = await fetch('/api/integrations/google-drive/backup', { method: 'POST' });
      const data = await actionResult(res, t('backupFailed'));
      setDriveMessage(t('backupDone', { fileName: data.fileName }));
      await refreshDriveStatus();
    } catch (err) {
      setDriveError(err.message || t('backupFailed'));
    } finally {
      setDriveBusy(false);
    }
  };

  const handleSaveDriveSettings = async () => {
    setDriveError('');
    setDriveMessage('');
    setDriveSaving(true);

    try {
      const res = await fetch('/api/integrations/google-drive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driveSettings),
      });
      const data = await actionResult(res, t('settingsFailed'));
      setDriveMessage(t('settingsSaved'));
      setDriveStatus(data);
    } catch (err) {
      setDriveError(err.message || t('settingsFailed'));
    } finally {
      setDriveSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      {/* Google Drive Backup */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="card-title text-lg">{t('driveTitle')}</h2>
              <p className="text-sm text-base-content/60">{t('driveIntro')}</p>
            </div>
            <div className={`badge ${driveStatus?.isConnected ? 'badge-success' : 'badge-ghost'}`}>
              {driveStatus?.isConnected ? t('connected') : t('notConnected')}
            </div>
          </div>

          {driveMessage && <div className="alert alert-success py-2 text-sm"><span>{driveMessage}</span></div>}
          {driveError && <div className="alert alert-error py-2 text-sm"><span>{driveError}</span></div>}
          {driveStatus?.demo && (
            <div className="alert alert-info py-2 text-sm">
              <span>{t('demoDisabled')}</span>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">{t('account')}</p>
              <p className="text-sm text-base-content/70 mt-1">{driveStatus?.googleEmail || t('accountNone')}</p>
            </div>
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">{t('folder')}</p>
              <p className="text-sm text-base-content/70 mt-1">{driveStatus?.folderName || 'HomeTab Backups'}</p>
            </div>
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">{t('lastBackup')}</p>
              <p className="text-sm text-base-content/70 mt-1">
                {driveStatus?.lastBackupAt ? fmtDateTime(driveStatus.lastBackupAt) : t('never')}
              </p>
              {driveStatus?.lastBackupFileName && (
                <p className="text-xs text-base-content/50 mt-1">{driveStatus.lastBackupFileName}</p>
              )}
            </div>
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">{t('lastStatus')}</p>
              <p className="text-sm text-base-content/70 mt-1">
                {driveStatus?.lastBackupStatus === 'success' && t('statusSuccess')}
                {driveStatus?.lastBackupStatus === 'error' && t('statusError')}
                {(!driveStatus || driveStatus.lastBackupStatus === 'idle') && t('statusIdle')}
              </p>
              {driveStatus?.lastBackupError && (
                <p className="text-xs text-error mt-1">{driveStatus.lastBackupError}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!driveStatus?.isConnected ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConnectDrive}
                disabled={driveBusy || driveStatus?.demo}
              >
                {driveBusy && <span className="loading loading-spinner loading-sm" />}
                {t('connect')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRunBackup}
                  disabled={driveBusy || driveStatus?.demo}
                >
                  {driveBusy && <span className="loading loading-spinner loading-sm" />}
                  {t('runNow')}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-error"
                  onClick={handleDisconnectDrive}
                  disabled={driveBusy || driveStatus?.demo}
                >
                  {t('disconnect')}
                </button>
              </>
            )}
          </div>

          <div className={`rounded-xl border border-base-200 p-4 ${!driveStatus?.isConnected ? 'opacity-60' : ''}`}>
            <h3 className="font-semibold mb-3">{t('autoTitle')}</h3>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="form-control w-full md:max-w-xs">
                <div className="label"><span className="label-text">{t('frequency')}</span></div>
                <select
                  className="select select-bordered"
                  value={driveSettings.backupFrequency}
                  disabled={!driveStatus?.isConnected}
                  onChange={(e) => setDriveSettings((current) => ({ ...current, backupFrequency: e.target.value }))}
                >
                  <option value="weekly">{t('weekly')}</option>
                  <option value="daily">{t('daily')}</option>
                </select>
              </label>

              <label className="label cursor-pointer justify-start gap-3 md:pb-3">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={driveSettings.autoBackupEnabled}
                  disabled={!driveStatus?.isConnected}
                  onChange={(e) => setDriveSettings((current) => ({ ...current, autoBackupEnabled: e.target.checked }))}
                />
                <span className="label-text">{t('autoEnable')}</span>
              </label>

              <button
                type="button"
                className="btn btn-outline"
                onClick={handleSaveDriveSettings}
                disabled={!driveStatus?.isConnected || driveSaving}
              >
                {driveSaving && <span className="loading loading-spinner loading-sm" />}
                {t('saveAuto')}
              </button>
            </div>

            <p className="text-xs text-base-content/60 mt-3">{t('cronHint')}</p>
            {driveStatus?.nextBackupAt && (
              <p className="text-xs text-base-content/60 mt-1">
                {t('nextRun', { date: fmtDateTime(driveStatus.nextBackupAt) })}
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
