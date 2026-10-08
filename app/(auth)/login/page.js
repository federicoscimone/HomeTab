'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** Errore lanciato da authorize() quando l'IP ha superato il limite di tentativi (vedi auth.js). */
const RATE_LIMITED = 'RateLimited';

/**
 * Login in due passi. Il primo verifica la password su /api/auth/login/start: senza verifica in
 * due passaggi si completa subito con NextAuth, altrimenti arriva un codice e il secondo passo lo
 * invia insieme al ticket ricevuto.
 */
export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', code: '' });
  const [challenge, setChallenge] = useState(null); // { ticket, channel } dopo la password
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  const finish = async (credentials) => {
    const res = await signIn('credentials', { ...credentials, redirect: false });
    if (res?.error) {
      setError(res.error === RATE_LIMITED ? t('login.tooMany') : challenge ? t('login.invalidCode') : t('login.invalid'));
      return;
    }
    router.push('/');
    router.refresh();
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || t('login.invalid'));
      else if (data.step === 'code') setChallenge({ ticket: data.ticket, channel: data.channel });
      else await finish({ email: form.email, password: form.password });
    } catch {
      setError(tCommon('networkError'));
    }
    setLoading(false);
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await finish({ ticket: challenge.ticket, code: form.code });
    setLoading(false);
  };

  const back = () => {
    setChallenge(null);
    setError('');
    setForm((f) => ({ ...f, code: '' }));
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">{'HomeTab'}</h1>
          <p className="text-sm text-base-content/60">{challenge ? t('login.codeSubtitle') : t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="alert alert-error py-2 text-sm" role="alert">
            <span>{error}</span>
          </div>
        )}

        {challenge ? (
          <form onSubmit={handleCode} className="flex flex-col gap-3">
            <p className="text-sm text-base-content/70">{t(`login.codeSent.${challenge.channel}`)}</p>
            <label className="form-control">
              <div className="label"><span className="label-text">{t('login.code')}</span></div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="input input-bordered font-mono tracking-widest text-center text-lg"
                placeholder="123456"
                maxLength={7}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
                autoFocus
              />
            </label>
            <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              {loading ? t('login.submitting') : t('login.verify')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={back}>{t('login.back')}</button>
          </form>
        ) : (
          <form onSubmit={handlePassword} className="flex flex-col gap-3">
            <label className="form-control">
              <div className="label"><span className="label-text">{t('email')}</span></div>
              <input
                type="email"
                className="input input-bordered"
                placeholder={tCommon('emailPlaceholder')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">{t('password')}</span></div>
              <input
                type="password"
                className="input input-bordered"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
            </label>

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                {t('login.forgot')}
              </Link>
            </div>

            <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
              {loading && <span className="loading loading-spinner loading-sm" />}
              {loading ? t('login.submitting') : t('login.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
