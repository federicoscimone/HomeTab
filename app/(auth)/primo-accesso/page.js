/**
 * @fileoverview Primo accesso — sostituzione obbligatoria della password provvisoria.
 *
 * Il proxy porta qui ogni pagina finché `mustChangePassword` è vero, e le API rispondono 403:
 * con la password provvisoria non si può fare nient'altro.
 */

'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ChangePasswordForm from '@/components/account/ChangePasswordForm';

export default function PrimoAccessoPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations('auth.firstAccess');

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">{'HomeTab'}</h1>
          <p className="text-sm text-base-content/60">
            {session?.user?.name ? t('subtitleNamed', { name: session.user.name }) : t('subtitle')}
          </p>
        </div>
        <p className="text-sm text-base-content/70">{t('intro')}</p>

        {session?.user?.email && (
          <ChangePasswordForm
            email={session.user.email}
            currentLabel={t('currentLabel')}
            submitLabel={t('submit')}
            onDone={() => { router.replace('/'); router.refresh(); }}
          />
        )}

        <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/login' })}>
          {t('signOut')}
        </button>
      </div>
    </div>
  );
}
