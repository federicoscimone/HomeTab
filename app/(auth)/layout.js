import LocaleSwitcher from '@/components/layout/LocaleSwitcher';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4 relative">
      {/* Prima del login: chi arriva da un link sceglie subito la lingua. */}
      <LocaleSwitcher className="absolute top-4 right-4" />
      {children}
    </div>
  );
}
