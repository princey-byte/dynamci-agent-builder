'use client';

import { usePathname } from 'next/navigation';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Match /workflows/create, /workflows/[id], /workflows/[id]/edit, but NOT /workflows list or /workflows/[id]/execute
  const isWorkflowCanvasStudio =
    pathname === '/workflows/create' ||
    (pathname.startsWith('/workflows/') &&
      !pathname.endsWith('/execute') &&
      pathname !== '/workflows');

  if (isWorkflowCanvasStudio) {
    return (
      <div className="relative flex-1 w-full h-[calc(100vh-56px)] min-h-0 overflow-hidden bg-background">
        <div className="w-full h-full min-h-0">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-background p-8 text-foreground">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}