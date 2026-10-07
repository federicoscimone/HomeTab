'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError(t('passwordsMismatch'));
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
        setError(data.error || t('setup.createError'));
        setStatus('error');
      } else {
        setStatus('success');
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch {
      setError(tCommon('networkError'));
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 shadow-xl w-full max-w-sm">
          <div className="card-body gap-4 text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-bold">{t('setup.doneTitle')}</h2>
            <p className="text-sm text-base-content/70">{t('setup.doneText')}</p>
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
            <h1 className="text-2xl font-bold text-primary">HomeTab</h1>
            <p className="text-sm text-base-content/60">{t('setup.subtitle')}</p>
          </div>

          <div className="alert alert-info text-xs py-2">
            <span>{t('setup.info')}</span>
          </div>

          {error && (
            <div className="alert alert-error py-2 text-sm"><span>{error}</span></div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="form-control">
              <div className="label"><span className="label-text">{t('setup.name')}</span></div>
              <input
                type="text"
                className="input input-bordered"
                placeholder={t('setup.namePlaceholder')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">{t('email')}</span></div>
              <input
                type="email"
                className="input input-bordered"
                placeholder={tCommon('emailPlaceholder')}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <label className="form-control">
              <div className="label"><span className="label-text">{t('password')}</span></div>
              <input
                type="password"
                className="input input-bordered"
                placeholder={t('minLength')}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
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
              />
            </label>

            <button
              type="submit"
              className={`btn btn-primary mt-1 ${status === 'loading' ? 'loading' : ''}`}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t('setup.submitting') : t('setup.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
