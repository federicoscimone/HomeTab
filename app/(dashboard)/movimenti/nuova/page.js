import MovementForm from '@/components/movimenti/MovementForm';
import Link from 'next/link';

export default function NuovaSpesaPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/movimenti" className="btn btn-ghost btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">Nuovo Movimento</h1>
      </div>
      <MovementForm />
    </div>
  );
}
