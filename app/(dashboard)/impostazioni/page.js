'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export default function ImpostazioniPage() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Impostazioni</h1>

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
