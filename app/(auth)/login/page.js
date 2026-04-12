'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError('Email o password non corretti');
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">HomeTab</h1>
          <p className="text-sm text-base-content/60">Accedi al tuo account</p>
        </div>

        {error && (
          <div className="alert alert-error py-2 text-sm">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="form-control">
            <div className="label"><span className="label-text">Email</span></div>
            <input
              type="email"
              className="input input-bordered"
              placeholder="nome@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </label>

          <label className="form-control">
            <div className="label"><span className="label-text">Password</span></div>
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
              Password dimenticata?
            </Link>
          </div>

          <button type="submit" className={`btn btn-primary mt-1 ${loading ? 'loading' : ''}`} disabled={loading}>
            {loading ? 'Accesso in corso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
