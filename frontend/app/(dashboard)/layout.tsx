import { AppSidebar } from '../../components/app-sidebar';
import { DashboardContent } from '../../components/ui/DashboardContent';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../../components/ui/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-foreground">Agentic Console</span>
            <span className="text-xs text-muted-foreground">Build, run, and audit multi-agent workflows</span>
          </div>
        </header>
        <DashboardContent>{children}</DashboardContent>
      </SidebarInset>
    </SidebarProvider>
  );
}
