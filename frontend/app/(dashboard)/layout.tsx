import { Sidebar } from '../../components/ui/Sidebar';
import { DashboardContent } from '../../components/ui/DashboardContent';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <DashboardContent>{children}</DashboardContent>
    </div>
  );
}
