'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  // Senza token nell'URL la risposta è già nota: si chiede al server solo quando c'è.
  const [checked, setChecked] = useState({ token: null, valid: null });
  const tokenValid = !token ? false : checked.token === token ? checked.valid : null; // null=checking
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [error, setError] = useState('');
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (!token) return;

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setChecked({ token, valid: !!d.valid }))
      .catch(() => setChecked({ token, valid: false }));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError(t('passwordsMismatch'));
      return;
    }
    if (form.password.length < 8) {
      setError(t('passwordTooShort'));
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
        setError(data.error || t('reset.resetError'));
        setStatus('error');
      } else {
        setStatus('success');
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch {
      setError(tCommon('networkError'));
      setStatus('error');
    }
  };

  if (tokenValid === null) {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body items-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="text-sm text-base-content/60">{t('reset.checking')}</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">{'❌'}</div>
          <h2 className="text-xl font-bold">{t('reset.invalidTitle')}</h2>
          <p className="text-sm text-base-content/70">{t('reset.invalidText')}</p>
          <Link href="/forgot-password" className="btn btn-primary btn-sm">
            {t('reset.requestNew')}
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">{'✅'}</div>
          <h2 className="text-xl font-bold">{t('reset.doneTitle')}</h2>
          <p className="text-sm text-base-content/70">{t('reset.doneText')}</p>
          <Link href="/login" className="btn btn-primary btn-sm">{t('reset.goToLogin')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">{'HomeTab'}</h1>
          <p className="text-sm text-base-content/60">{t('reset.subtitle')}</p>
        </div>

        {error && (
          <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="form-control">
            <div className="label"><span className="label-text">{t('reset.newPassword')}</span></div>
            <input
              type="password"
              className="input input-bordered"
              placeholder={t('minLength')}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="new-password"
            />
          </label>

          <label className="form-control">
            <div className="label"><span className="label-text">{t('reset.confirmPassword')}</span></div>
            <input
              type="password"
              className="input input-bordered"
              placeholder={t('repeatPassword')}
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
            {status === 'loading' ? t('reset.submitting') : t('reset.submit')}
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
