'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** @returns {Promise<object>} Stato dell'integrazione Google Drive. */
async function fetchDriveStatus() {
  const res = await fetch('/api/integrations/google-drive', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Errore caricamento stato Google Drive');
  return data;
}

export default function ImpostazioniPage() {
  const [driveStatus, setDriveStatus] = useState(null);
  const [driveSettings, setDriveSettings] = useState({ autoBackupEnabled: false, backupFrequency: 'weekly' });
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);
  // L'esito del collegamento OAuth arriva nell'URL di ritorno da Google: il messaggio iniziale si
  // legge da lì al primo render, poi l'effetto ripulisce l'URL senza toccare lo stato.
  const searchParams = useSearchParams();
  const [driveMessage, setDriveMessage] = useState(
    () => (searchParams.get('driveConnected') === '1' ? 'Google Drive collegato correttamente.' : ''),
  );
  const [driveError, setDriveError] = useState(
    () => (searchParams.get('driveError') ? 'Collegamento Google Drive non completato. Riprova.' : ''),
  );

  const applyDriveStatus = (data) => {
    setDriveStatus(data);
    setDriveSettings({
      autoBackupEnabled: !!data.autoBackupEnabled,
      backupFrequency: data.backupFrequency || 'weekly',
    });
  };
  const showDriveStatusError = (err) => setDriveError(err.message || 'Errore caricamento stato Google Drive');

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
  }, []);

  const handleConnectDrive = async () => {
    setDriveError('');
    setDriveMessage('');
    setDriveBusy(true);

    try {
      const res = await fetch('/api/integrations/google-drive/connect', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Impossibile avviare il collegamento Google Drive');

      window.location.href = data.authorizationUrl;
    } catch (err) {
      setDriveError(err.message || 'Impossibile avviare il collegamento Google Drive');
      setDriveBusy(false);
    }
  };

  const handleDisconnectDrive = async () => {
    setDriveError('');
    setDriveMessage('');
    setDriveBusy(true);

    try {
      const res = await fetch('/api/integrations/google-drive', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore scollegamento Google Drive');

      setDriveMessage('Google Drive scollegato.');
      await refreshDriveStatus();
    } catch (err) {
      setDriveError(err.message || 'Errore scollegamento Google Drive');
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backup Google Drive fallito');

      setDriveMessage(`Backup completato: ${data.fileName}`);
      await refreshDriveStatus();
    } catch (err) {
      setDriveError(err.message || 'Backup Google Drive fallito');
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio configurazione backup');

      setDriveMessage('Configurazione backup aggiornata.');
      setDriveStatus(data);
    } catch (err) {
      setDriveError(err.message || 'Errore salvataggio configurazione backup');
    } finally {
      setDriveSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Backup</h1>

      {/* Google Drive Backup */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="card-title text-lg">Backup Google Drive</h2>
              <p className="text-sm text-base-content/60">
                Collega il tuo Google Drive personale e salva un backup JSON dei dati applicativi.
              </p>
            </div>
            <div className={`badge ${driveStatus?.isConnected ? 'badge-success' : 'badge-ghost'}`}>
              {driveStatus?.isConnected ? 'collegato' : 'non collegato'}
            </div>
          </div>

          {driveMessage && <div className="alert alert-success py-2 text-sm"><span>{driveMessage}</span></div>}
          {driveError && <div className="alert alert-error py-2 text-sm"><span>{driveError}</span></div>}
          {driveStatus?.demo && (
            <div className="alert alert-info py-2 text-sm">
              <span>Nella demo il backup su Google Drive è disattivato: richiede di collegare un account Google personale.</span>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">Account Google</p>
              <p className="text-sm text-base-content/70 mt-1">{driveStatus?.googleEmail || 'Non collegato'}</p>
            </div>
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">Cartella Drive</p>
              <p className="text-sm text-base-content/70 mt-1">{driveStatus?.folderName || 'HomeTab Backups'}</p>
            </div>
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">Ultimo backup</p>
              <p className="text-sm text-base-content/70 mt-1">
                {driveStatus?.lastBackupAt ? new Date(driveStatus.lastBackupAt).toLocaleString('it-IT') : 'Mai eseguito'}
              </p>
              {driveStatus?.lastBackupFileName && (
                <p className="text-xs text-base-content/50 mt-1">{driveStatus.lastBackupFileName}</p>
              )}
            </div>
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">Stato ultimo esito</p>
              <p className="text-sm text-base-content/70 mt-1">
                {driveStatus?.lastBackupStatus === 'success' && 'Completato'}
                {driveStatus?.lastBackupStatus === 'error' && 'Errore'}
                {(!driveStatus || driveStatus.lastBackupStatus === 'idle') && 'In attesa'}
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
                className={`btn btn-primary ${driveBusy ? 'loading' : ''}`}
                onClick={handleConnectDrive}
                disabled={driveBusy || driveStatus?.demo}
              >
                Collega Google Drive
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`btn btn-primary ${driveBusy ? 'loading' : ''}`}
                  onClick={handleRunBackup}
                  disabled={driveBusy || driveStatus?.demo}
                >
                  Esegui backup ora
                </button>
                <button
                  type="button"
                  className={`btn btn-outline btn-error ${driveBusy ? 'loading' : ''}`}
                  onClick={handleDisconnectDrive}
                  disabled={driveBusy || driveStatus?.demo}
                >
                  Scollega Drive
                </button>
              </>
            )}
          </div>

          <div className={`rounded-xl border border-base-200 p-4 ${!driveStatus?.isConnected ? 'opacity-60' : ''}`}>
            <h3 className="font-semibold mb-3">Backup automatico</h3>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <label className="form-control w-full md:max-w-xs">
                <div className="label"><span className="label-text">Frequenza</span></div>
                <select
                  className="select select-bordered"
                  value={driveSettings.backupFrequency}
                  disabled={!driveStatus?.isConnected}
                  onChange={(e) => setDriveSettings((current) => ({ ...current, backupFrequency: e.target.value }))}
                >
                  <option value="weekly">Settimanale</option>
                  <option value="daily">Giornaliero</option>
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
                <span className="label-text">Attiva backup automatico</span>
              </label>

              <button
                type="button"
                className={`btn btn-outline ${driveSaving ? 'loading' : ''}`}
                onClick={handleSaveDriveSettings}
                disabled={!driveStatus?.isConnected || driveSaving}
              >
                Salva automazione
              </button>
            </div>

            <p className="text-xs text-base-content/60 mt-3">
              L&apos;esecuzione automatica richiede un cron esterno che chiami la route protetta del server.
            </p>
            {driveStatus?.nextBackupAt && (
              <p className="text-xs text-base-content/60 mt-1">
                Prossima esecuzione prevista: {new Date(driveStatus.nextBackupAt).toLocaleString('it-IT')}
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
