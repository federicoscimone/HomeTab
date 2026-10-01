/**
 * @fileoverview Utenti — creazione, ruoli, password provvisorie e disattivazione (solo admin).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ROLES, ROLE_INFO } from '@/lib/auth/permissions';

/** Senza 0/O, 1/l/I: la password provvisoria va dettata o scritta su un biglietto. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** @returns {string} Password provvisoria casuale di 12 caratteri. */
function generatePassword() {
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

/** @param {string|null} iso */
function formatLastLogin(iso) {
  if (!iso) return 'mai';
  return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

/** Campo password provvisoria con generatore. */
function TempPasswordInput({ value, onChange }) {
  return (
    <label className="form-control">
      <div className="label py-1"><span className="label-text font-medium">Password provvisoria *</span></div>
      <div className="join w-full">
        <input
          type="text" className="input input-bordered join-item w-full font-mono" required minLength={8}
          autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn join-item" onClick={() => onChange(generatePassword())}>Genera</button>
      </div>
      <p className="text-xs text-base-content/50 mt-1">
        Minimo 8 caratteri. Al primo accesso l&apos;utente dovrà sceglierne una sua.
      </p>
    </label>
  );
}

/** Credenziali appena assegnate, da comunicare all'utente: vengono mostrate una sola volta. */
function CredentialsNotice({ credentials, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = `HomeTab — ${window.location.origin}\nEmail: ${credentials.email}\nPassword provvisoria: ${credentials.password}`;
  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-md">
        <h3 className="font-bold text-lg mb-2">Credenziali per {credentials.name}</h3>
        <p className="text-sm text-base-content/70 mb-3">
          Comunicale all&apos;utente: la password non verrà più mostrata. Al primo accesso gli verrà chiesto
          di sceglierne una nuova.
        </p>
        <pre className="bg-base-200 rounded-lg p-3 text-sm whitespace-pre-wrap break-all">{text}</pre>
        <div className="modal-action">
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }}
          >
            {copied ? 'Copiato ✓' : 'Copia'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Fatto</button>
        </div>
      </div>
    </div>
  );
}

function NewUserModal({ onCreated, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'viewer', password: generatePassword() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/utenti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Errore nella creazione');
      setSaving(false);
      return;
    }
    onCreated({ name: data.name, email: data.email, password: form.password });
  };

  return (
    <div className="modal modal-open">
      <form className="modal-box w-11/12 max-w-md" onSubmit={handleSubmit}>
        <h3 className="font-bold text-lg mb-4">Nuovo utente</h3>
        {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}

        <div className="flex flex-col gap-3">
          <label className="form-control">
            <div className="label py-1"><span className="label-text font-medium">Nome *</span></div>
            <input type="text" className="input input-bordered w-full" required maxLength={100} autoFocus
              value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="form-control">
            <div className="label py-1"><span className="label-text font-medium">Email *</span></div>
            <input type="email" className="input input-bordered w-full" required autoComplete="off"
              value={form.email} onChange={(e) => set('email', e.target.value)} />
            <p className="text-xs text-base-content/50 mt-1">È il nome con cui accederà.</p>
          </label>

          <fieldset>
            <legend className="label-text font-medium py-1">Ruolo *</legend>
            <div className="flex flex-col gap-2">
              {ROLES.map((r) => (
                <label key={r}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${form.role === r ? 'border-primary bg-primary/5' : 'border-base-300'}`}>
                  <input type="radio" name="role" className="radio radio-sm radio-primary mt-0.5"
                    checked={form.role === r} onChange={() => set('role', r)} />
                  <span>
                    <span className="text-sm font-medium block">{ROLE_INFO[r].label}</span>
                    <span className="text-xs text-base-content/60">{ROLE_INFO[r].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <TempPasswordInput value={form.password} onChange={(v) => set('password', v)} />
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : 'Crea utente'}
          </button>
        </div>
      </form>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

function ResetPasswordModal({ user, onDone, onClose }) {
  const [password, setPassword] = useState(generatePassword);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch(`/api/utenti/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-password', password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Errore');
      setSaving(false);
      return;
    }
    onDone({ name: user.name, email: user.email, password });
  };

  return (
    <div className="modal modal-open">
      <form className="modal-box w-11/12 max-w-md" onSubmit={handleSubmit}>
        <h3 className="font-bold text-lg mb-2">Reimposta password di {user.name}</h3>
        <p className="text-sm text-base-content/70 mb-3">
          Le sessioni aperte di {user.name} verranno chiuse e al prossimo accesso dovrà scegliere una nuova password.
        </p>
        {error && <div className="alert alert-error text-sm py-2 mb-3"><span>{error}</span></div>}
        <TempPasswordInput value={password} onChange={setPassword} />
        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn btn-warning btn-sm" disabled={saving}>Reimposta</button>
        </div>
      </form>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

export default function UtentiPage() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'new' } | { type: 'reset', user } | { type: 'credentials', credentials }

  const load = useCallback(() => {
    return fetch('/api/utenti')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        setUsers(d);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = async (user, body) => {
    setError('');
    const res = await fetch(`/api/utenti/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Operazione non riuscita');
    await load();
  };

  const remove = async (user) => {
    setError('');
    const res = await fetch(`/api/utenti/${user.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Eliminazione non riuscita');
    await load();
  };

  const showCredentials = (credentials) => { setModal({ type: 'credentials', credentials }); load(); };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Utenti</h1>
          <p className="text-sm text-base-content/50">Accessi personali per i membri della famiglia, tutti sugli stessi dati</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>+ Nuovo utente</button>
      </div>

      {error && <div className="alert alert-error text-sm py-2 mb-4"><span>{error}</span></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-base-200 bg-base-100 p-3">
            <p className="text-sm font-semibold">{ROLE_INFO[r].label}</p>
            <p className="text-xs text-base-content/60">{ROLE_INFO[r].description}</p>
          </div>
        ))}
      </div>

      {!users && !error && (
        <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg text-primary" /></div>
      )}

      {users && (
        <div className="card bg-base-100 border border-base-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Utente</th>
                  <th>Ruolo</th>
                  <th>Stato</th>
                  <th className="hidden md:table-cell">Ultimo accesso</th>
                  <th className="text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const locked = u.isSelf || u.isProtected;
                  return (
                    <tr key={u.id} className={u.active ? '' : 'opacity-50'}>
                      <td>
                        <p className="font-medium">
                          {u.name}
                          {u.isSelf && <span className="badge badge-ghost badge-xs ml-2">tu</span>}
                          {u.isProtected && <span className="badge badge-ghost badge-xs ml-2" title="Account della demo, non modificabile">demo</span>}
                        </p>
                        <p className="text-xs text-base-content/50">{u.email}</p>
                      </td>
                      <td>
                        {locked ? (
                          <span className="text-sm">{ROLE_INFO[u.role]?.label}</span>
                        ) : (
                          <select
                            className="select select-bordered select-sm"
                            aria-label={`Ruolo di ${u.name}`}
                            value={u.role}
                            onChange={(e) => patch(u, { role: e.target.value })}
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        {!u.active
                          ? <span className="badge badge-sm badge-ghost">Disattivato</span>
                          : u.mustChangePassword
                            ? <span className="badge badge-sm badge-warning" title="Non ha ancora sostituito la password provvisoria">Password provvisoria</span>
                            : <span className="badge badge-sm badge-success">Attivo</span>}
                      </td>
                      <td className="hidden md:table-cell text-sm text-base-content/70">{formatLastLogin(u.lastLoginAt)}</td>
                      <td>
                        {!locked && (
                          <div className="flex gap-1 justify-end flex-wrap">
                            {u.active && (
                              <button className="btn btn-ghost btn-xs" onClick={() => setModal({ type: 'reset', user: u })}>
                                Reimposta password
                              </button>
                            )}
                            <button className="btn btn-ghost btn-xs" onClick={() => patch(u, { active: !u.active })}>
                              {u.active ? 'Disattiva' : 'Riattiva'}
                            </button>
                            {!u.lastLoginAt && (
                              <button className="btn btn-ghost btn-xs text-error" onClick={() => remove(u)}>Elimina</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-base-content/50 mt-3">
        Un utente che ha già fatto accessi non si elimina, si disattiva: le sue operazioni restano nell&apos;audit log.
      </p>

      {modal?.type === 'new' && (
        <NewUserModal onClose={() => setModal(null)} onCreated={showCredentials} />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal user={modal.user} onClose={() => setModal(null)} onDone={showCredentials} />
      )}
      {modal?.type === 'credentials' && (
        <CredentialsNotice credentials={modal.credentials} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
