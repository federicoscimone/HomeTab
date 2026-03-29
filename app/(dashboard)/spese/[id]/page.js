import { notFound } from 'next/navigation';
import Link from 'next/link';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import ExpenseForm from '@/components/spese/ExpenseForm';

export default async function ModificaSpesaPage({ params }) {
  const { id } = await params;
  await connectDB();

  const expense = await Expense.findById(id).lean();
  if (!expense) notFound();

  // Serializza per il client component
  const initial = JSON.parse(JSON.stringify(expense));

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/spese" className="btn btn-ghost btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">Modifica Spesa</h1>
      </div>
      <ExpenseForm initial={initial} expenseId={id} />
    </div>
  );
}
