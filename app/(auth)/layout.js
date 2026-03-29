export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
