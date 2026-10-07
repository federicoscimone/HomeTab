import { notFound } from 'next/navigation';
import mongoose from 'mongoose';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import connectDB from '@/lib/mongodb';
import Movement from '@/lib/models/Movement';
import MovementForm from '@/components/movimenti/MovementForm';

export default async function ModificaSpesaPage({ params }) {
  const { id } = await params;
  // Un id malformato farebbe fallire findById con un errore di cast: è semplicemente un 404.
  if (!mongoose.isValidObjectId(id)) notFound();
  await connectDB();

  const expense = await Movement.findById(id).lean();
  if (!expense) notFound();

  const t = await getTranslations('movements');
  // Serializza per il client component
  const initial = JSON.parse(JSON.stringify(expense));

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/movimenti" className="btn btn-ghost btn-sm" aria-label={t('back')}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">{t('editTitle')}</h1>
      </div>
      <MovementForm initial={initial} expenseId={id} />
    </div>
  );
}
