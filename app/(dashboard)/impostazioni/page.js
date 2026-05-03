'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';

const THEMES = [
  { value: 'light',  label: 'Light',  bg: '#ffffff', primary: '#6366f1', text: '#1f2937' },
  { value: 'dark',   label: 'Dark',   bg: '#1d232a', primary: '#661ae6', text: '#a6adbb' },
  { value: 'forest', label: 'Forest', bg: '#171212', primary: '#1eb854', text: '#b5b5b5' },
  { value: 'aqua',   label: 'Aqua',   bg: '#345da7', primary: '#09ecf3', text: '#c3f0fb' },
  { value: 'abyss',  label: 'Abyss',  bg: '#0a0a14', primary: '#4f46e5', text: '#8b8ba8' },
];

export default function ImpostazioniPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState('light');
  const [driveStatus, setDriveStatus] = useState(null);
  const [driveSettings, setDriveSettings] = useState({ autoBackupEnabled: false, backupFrequency: 'weekly' });
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveMessage, setDriveMessage] = useState('');
  const [driveError, setDriveError] = useState('');

  useEffect(() => {
    const fromCookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith('hometab-theme='))
      ?.split('=')[1];
    const saved = fromCookie || localStorage.getItem('hometab-theme');
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
      return;
    }
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(sys);
    document.documentElement.setAttribute('data-theme', sys);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('driveConnected') === '1') {
      setDriveMessage('Google Drive collegato correttamente.');
    }

    if (params.get('driveError')) {
      setDriveError('Collegamento Google Drive non completato. Riprova.');
    }

    if (params.get('driveConnected') || params.get('driveError')) {
      params.delete('driveConnected');
      params.delete('driveError');
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
      window.history.replaceState({}, '', nextUrl);
    }

    void refreshDriveStatus();
  }, []);

  const applyTheme = (value) => {
    setTheme(value);
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('hometab-theme', value);
    document.cookie = `hometab-theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  const refreshDriveStatus = async () => {
    try {
      const res = await fetch('/api/integrations/google-drive', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore caricamento stato Google Drive');

      setDriveStatus(data);
      setDriveSettings({
        autoBackupEnabled: !!data.autoBackupEnabled,
        backupFrequency: data.backupFrequency || 'weekly',
      });
    } catch (err) {
      setDriveError(err.message || 'Errore caricamento stato Google Drive');
    }
  };

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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (form.newPassword !== form.confirm) {
      setError('Le nuove password non coincidono');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante l\'aggiornamento');
        setStatus('error');
      } else {
        setMessage('Password aggiornata con successo. Riceverai una email di conferma.');
        setForm({ currentPassword: '', newPassword: '', confirm: '' });
        setStatus('idle');
      }
    } catch {
      setError('Errore di rete. Riprova.');
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Account & Sicurezza</h1>

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

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">Account Google</p>
              <p className="text-sm text-base-content/70 mt-1">{driveStatus?.googleEmail || 'Non collegato'}</p>
            </div>
            <div className="rounded-xl border border-base-200 p-4">
              <p className="text-sm font-medium">Cartella Drive</p>
              <p className="text-sm text-base-content/70 mt-1">{driveStatus?.folderName || 'HomeBI Backups'}</p>
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
                disabled={driveBusy}
              >
                Collega Google Drive
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`btn btn-primary ${driveBusy ? 'loading' : ''}`}
                  onClick={handleRunBackup}
                  disabled={driveBusy}
                >
                  Esegui backup ora
                </button>
                <button
                  type="button"
                  className={`btn btn-outline btn-error ${driveBusy ? 'loading' : ''}`}
                  onClick={handleDisconnectDrive}
                  disabled={driveBusy}
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

      {/* Tema */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mb-4">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">Aspetto — Tema</h2>
          <div className="flex flex-wrap gap-3">
            {THEMES.map(t => (
              <button
                key={t.value}
                onClick={() => applyTheme(t.value)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${theme === t.value ? 'border-primary' : 'border-base-200 hover:border-base-300'}`}
                title={t.label}
              >
                <span
                  className="w-14 h-9 rounded-lg flex items-end p-1 gap-0.5"
                  style={{ backgroundColor: t.bg }}
                >
                  <span className="flex-1 h-3 rounded-sm opacity-80" style={{ backgroundColor: t.primary }} />
                  <span className="flex-1 h-2 rounded-sm opacity-40" style={{ backgroundColor: t.text }} />
                </span>
                <span className="text-xs font-medium">{t.label}</span>
                {theme === t.value && (
                  <span className="badge badge-primary badge-xs">attivo</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cambio password */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body gap-4">
          <h2 className="card-title text-lg">Sicurezza — Cambio Password</h2>

          {message && <div className="alert alert-success py-2 text-sm"><span>{message}</span></div>}
          {error && <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>}

          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <label className="form-control">
              <div className="label"><span className="label-text">Password attuale</span></div>
              <input
                type="password"
                className="input input-bordered"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                required
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Nuova password</span></div>
              <input
                type="password"
                className="input input-bordered"
                placeholder="Minimo 8 caratteri"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                required
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Conferma nuova password</span></div>
              <input
                type="password"
                className="input input-bordered"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </label>

            <button
              type="submit"
              className={`btn btn-primary ${status === 'loading' ? 'loading' : ''}`}
              disabled={status === 'loading'}
            >
              Aggiorna password
            </button>
          </form>
        </div>
      </div>

      {/* Logout */}
      <div className="card bg-base-100 shadow-sm border border-base-200 mt-4">
        <div className="card-body">
          <h2 className="card-title text-lg">Sessione</h2>
          <p className="text-sm text-base-content/60">Disconnettiti dall&apos;applicazione.</p>
          <button
            className="btn btn-outline btn-error btn-sm w-fit"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Disconnetti
          </button>
        </div>
      </div>
    </div>
  );
}
