/**
 * @fileoverview Primo accesso — sostituzione obbligatoria della password provvisoria.
 *
 * Il proxy porta qui ogni pagina finché `mustChangePassword` è vero, e le API rispondono 403:
 * con la password provvisoria non si può fare nient'altro.
 */

'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ChangePasswordForm from '@/components/account/ChangePasswordForm';

export default function PrimoAccessoPage() {
  const { data: session } = useSession();
  const router = useRouter();

  return (
    <div className="card bg-base-100 shadow-xl w-full max-w-sm">
      <div className="card-body gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-primary">HomeTab</h1>
          <p className="text-sm text-base-content/60">
            {session?.user?.name ? `Ciao ${session.user.name}, ` : ''}scegli la tua password
          </p>
        </div>
        <p className="text-sm text-base-content/70">
          Stai usando una password provvisoria assegnata da un amministratore. Sostituiscila con una
          che conosci solo tu per continuare.
        </p>

        {session?.user?.email && (
          <ChangePasswordForm
            email={session.user.email}
            currentLabel="Password provvisoria"
            submitLabel="Imposta la mia password"
            onDone={() => { router.replace('/'); router.refresh(); }}
          />
        )}

        <button className="btn btn-ghost btn-sm" onClick={() => signOut({ callbackUrl: '/login' })}>
          Esci
        </button>
      </div>
    </div>
  );
}
