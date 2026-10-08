'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | sent | error
  const [error, setError] = useState('');
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

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
        setError(data.error || t('forgot.sendError'));
        setStatus('error');
      } else {
        setStatus('sent');
      }
    } catch {
      setError(tCommon('networkError'));
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body gap-4 text-center">
          <div className="text-5xl">{'📧'}</div>
          <h2 className="text-xl font-bold">{t('forgot.sentTitle')}</h2>
          <p className="text-sm text-base-content/70">
            {t.rich('forgot.sentText', { b: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <p className="text-xs text-base-content/50">{t('forgot.spam')}</p>
          <Link href="/login" className="btn btn-outline btn-sm mt-2">{t('backToLogin')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">{'HomeTab'}</h1>
          <p className="text-sm text-base-content/60">{t('forgot.subtitle')}</p>
        </div>

        {error && (
          <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>
        )}

        <p className="text-sm text-base-content/70">{t('forgot.intro')}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="form-control">
            <div className="label"><span className="label-text">{t('email')}</span></div>
            <input
              type="email"
              className="input input-bordered"
              placeholder={tCommon('emailPlaceholder')}
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
            {status === 'loading' ? t('forgot.submitting') : t('forgot.submit')}
          </button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-xs text-base-content/50 hover:underline">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
