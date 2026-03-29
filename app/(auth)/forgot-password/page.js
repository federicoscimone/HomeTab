'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | sent | error
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Errore durante l\'invio');
        setStatus('error');
      } else {
        setStatus('sent');
      }
    } catch {
      setError('Errore di rete. Riprova.');
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">📧</div>
          <h2 className="text-xl font-bold">Email inviata</h2>
          <p className="text-sm text-base-content/70">
            Se l&apos;indirizzo è registrato, riceverai un link per reimpostare la password.
            Il link è valido per <strong>60 minuti</strong>.
          </p>
          <p className="text-xs text-base-content/50">Controlla anche la cartella spam.</p>
          <Link href="/login" className="btn btn-outline btn-sm mt-2">Torna al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">HomeBI</h1>
          <p className="text-sm text-base-content/60">Recupera la tua password</p>
        </div>

        {error && (
          <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>
        )}

        <p className="text-sm text-base-content/70">
          Inserisci la tua email e ti invieremo un link per reimpostare la password.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="form-control">
            <div className="label"><span className="label-text">Email</span></div>
            <input
              type="email"
              className="input input-bordered"
              placeholder="nome@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className={`btn btn-primary mt-1 ${status === 'loading' ? 'loading' : ''}`}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Invio in corso…' : 'Invia link di reset'}
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-xs text-base-content/50 hover:underline">
            Torna al login
          </Link>
        </div>
      </div>
    </div>
  );
}
