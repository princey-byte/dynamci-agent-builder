'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, FileCode, Wrench, GitFork, Activity, Sparkles } from 'lucide-react';
import { ThemeModeToggle } from '../theme-mode-toggle';

const navItems = [
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Skills Library', href: '/skills', icon: FileCode },
  { name: 'MCP Tools', href: '/mcp-tools', icon: Wrench },
  { name: 'Workflows', href: '/workflows', icon: GitFork },
  { name: 'Sessions', href: '/sessions', icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-64 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
      <div>
        {/* Header */}
        <div className="mb-6 flex items-center gap-3 border-b border-sidebar-border px-3 py-4">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">Agentic Platform</h1>
            <p className="font-mono text-[11px] text-muted-foreground">Multi-Agent Engine</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="size-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-sidebar-border bg-background p-3 font-mono text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Engine Status</span>
            <span className="text-agent-success">Online</span>
          </div>
          <div className="mt-1 flex justify-between text-[11px]">
            <span>Protocol</span>
            <span>SSE / MCP</span>
          </div>
        </div>
        <ThemeModeToggle />
      </div>
    </aside>
  );
}
