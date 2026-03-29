'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [tokenValid, setTokenValid] = useState(null); // null=checking, true, false
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }

    fetch(`/api/auth/reset-password?token=${token}`)
      .then((r) => r.json())
      .then((d) => setTokenValid(d.valid))
      .catch(() => setTokenValid(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Le password non coincidono');
      return;
    }
    if (form.password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante il reset');
        setStatus('error');
      } else {
        setStatus('success');
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch {
      setError('Errore di rete. Riprova.');
      setStatus('error');
    }
  };

  if (tokenValid === null) {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body items-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-sm text-base-content/60">Verifica link in corso…</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">❌</div>
          <h2 className="text-xl font-bold">Link non valido</h2>
          <p className="text-sm text-base-content/70">
            Il link è scaduto o è già stato utilizzato. Richiedine uno nuovo.
          </p>
          <Link href="/forgot-password" className="btn btn-primary btn-sm">
            Richiedi nuovo link
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold">Password aggiornata</h2>
          <p className="text-sm text-base-content/70">
            Reindirizzamento al login tra pochi secondi…
          </p>
          <Link href="/login" className="btn btn-primary btn-sm">Vai al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">HomeBI</h1>
          <p className="text-sm text-base-content/60">Imposta nuova password</p>
        </div>

        {error && (
          <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="form-control">
            <div className="label"><span className="label-text">Nuova password</span></div>
            <input
              type="password"
              className="input input-bordered"
              placeholder="Minimo 8 caratteri"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="new-password"
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
              autoComplete="new-password"
            />
          </label>

          <button
            type="submit"
            className={`btn btn-primary mt-1 ${status === 'loading' ? 'loading' : ''}`}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Aggiornamento…' : 'Aggiorna password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body items-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
