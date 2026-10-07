/**
 * @fileoverview ChangePasswordForm — cambio della propria password, anche quella provvisoria.
 *
 * Il server incrementa la versione di sessione, quindi dopo il cambio il cookie attuale non vale
 * più: il form rifà l'accesso con la nuova password, così l'utente non si ritrova sbattuto fuori.
 */

'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

/**
 * @param {object}   props
 * @param {string}   props.email          - Email dell'utente, per rifare l'accesso.
 * @param {string}   [props.currentLabel] - Etichetta del campo password attuale.
 * @param {string}   [props.submitLabel]
 * @param {Function} props.onDone         - Chiamata dopo cambio e nuovo accesso riusciti.
 */
export default function ChangePasswordForm({
  email,
  currentLabel = 'Password attuale',
  submitLabel = 'Aggiorna password',
  onDone,
}) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) {
      setError('Le nuove password non coincidono');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Errore durante l\'aggiornamento');
        setLoading(false);
        return;
      }

      const login = await signIn('credentials', { email, password: form.newPassword, redirect: false });
      if (login?.error) {
        // Password cambiata ma nuovo accesso fallito: si torna al login a mano. Caricamento completo
        // e non router.push: la sessione vecchia è revocata, e lo stato client va buttato via.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
        return;
      }
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setLoading(false);
      onDone();
    } catch {
      setError('Errore di rete. Riprova.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>}

      <label className="form-control">
        <div className="label"><span className="label-text">{currentLabel}</span></div>
        <input
          type="password" className="input input-bordered w-full" required autoComplete="current-password"
          value={form.currentPassword} onChange={set('currentPassword')}
        />
      </label>
      <label className="form-control">
        <div className="label"><span className="label-text">Nuova password</span></div>
        <input
          type="password" className="input input-bordered w-full" required minLength={8} autoComplete="new-password"
          placeholder="Minimo 8 caratteri"
          value={form.newPassword} onChange={set('newPassword')}
        />
      </label>
      <label className="form-control">
        <div className="label"><span className="label-text">Conferma nuova password</span></div>
        <input
          type="password" className="input input-bordered w-full" required autoComplete="new-password"
          value={form.confirm} onChange={set('confirm')}
        />
      </label>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? <span className="loading loading-spinner loading-sm" /> : submitLabel}
      </button>
    </form>
  );
}
