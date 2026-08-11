'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, FileCode, Wrench, GitFork, Activity, Sparkles } from 'lucide-react';

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
    <aside className="w-64 bg-[#111726] border-r border-[#1e293b] min-h-screen flex flex-col justify-between p-4">
      <div>
        {/* Header */}
        <div className="flex items-center space-x-3 px-3 py-4 mb-6 border-b border-[#1e293b]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm tracking-tight">Agentic Platform</h1>
            <p className="text-[11px] text-slate-400 font-mono">Multi-Agent Engine</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border-l-2 border-indigo-500 pl-2.5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a2236]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-3 rounded-lg bg-[#090d16] border border-[#1e293b] text-xs font-mono text-slate-400 space-y-1">
        <div className="flex justify-between">
          <span>Engine Status</span>
          <span className="text-emerald-400">● Online</span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Protocol</span>
          <span>SSE / MCP</span>
        </div>
      </div>
    </aside>
  );
}
