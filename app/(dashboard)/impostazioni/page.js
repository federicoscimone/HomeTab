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

  useEffect(() => {
    const saved = localStorage.getItem('homebi-theme');
    if (saved) setTheme(saved);
    else {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(sys);
    }
  }, []);

  const applyTheme = (value) => {
    setTheme(value);
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('homebi-theme', value);
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
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Account & Sicurezza</h1>

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
