'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Le password non coincidono');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante la creazione');
        setStatus('error');
      } else {
        setStatus('success');
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch {
      setError('Errore di rete. Riprova.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-sm">
          <div className="card-body gap-4 text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-bold">Account creato!</h2>
            <p className="text-sm text-base-content/70">Reindirizzamento al login…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold text-primary">HomeBI</h1>
            <p className="text-sm text-base-content/60">Configurazione iniziale — Crea l&apos;account admin</p>
          </div>

          <div className="alert alert-info text-xs py-2">
            <span>Questo form è disponibile solo al primo avvio, quando non esiste ancora nessun utente.</span>
          </div>

          {error && (
            <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="form-control">
              <div className="label"><span className="label-text">Nome</span></div>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Il tuo nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Email</span></div>
              <input
                type="email"
                className="input input-bordered"
                placeholder="nome@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Password</span></div>
              <input
                type="password"
                className="input input-bordered"
                placeholder="Minimo 8 caratteri"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">Conferma password</span></div>
              <input
                type="password"
                className="input input-bordered"
                placeholder="Ripeti la password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </label>

            <button
              type="submit"
              className={`btn btn-primary mt-1 ${status === 'loading' ? 'loading' : ''}`}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Creazione…' : 'Crea account admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
