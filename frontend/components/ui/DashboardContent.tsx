'use client';

import { usePathname } from 'next/navigation';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenWorkflowBuilder = pathname === '/workflows/create';

  if (isFullscreenWorkflowBuilder) {
    return (
      <main className="flex-1 overflow-hidden bg-background">
        <div className="h-screen min-h-0">{children}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>
  );
}