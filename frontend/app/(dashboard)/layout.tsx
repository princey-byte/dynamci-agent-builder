import { Sidebar } from '../../components/ui/Sidebar';
import { DashboardContent } from '../../components/ui/DashboardContent';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#090d16] text-slate-100">
      <Sidebar />
      <DashboardContent>{children}</DashboardContent>
    </div>
  );
}
