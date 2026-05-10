import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-xl font-semibold mb-6 text-slate-900">NextGen CRM</h1>
        {children}
      </div>
    </div>
  );
}
