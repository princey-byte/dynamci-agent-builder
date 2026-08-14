'use client';

import { usePathname } from 'next/navigation';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenWorkflowBuilder = pathname === '/workflows/create';

  if (isFullscreenWorkflowBuilder) {
    return (
      <div className="flex-1 overflow-hidden bg-background">
        <div className="h-screen min-h-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 text-foreground">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}