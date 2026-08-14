'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { MCPServer } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { MCPServerCard } from '../../../components/mcp/MCPServerCard';
import { Plus, RefreshCw, Server } from 'lucide-react';

export default function MCPToolsPage() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServers = async () => {
    setLoading(true);
    try {
      const data = await api.getMCPServers();
      setServers(data || []);
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Unregister this MCP server and its discovered tools?')) {
      await api.deleteMCPServer(id);
      loadServers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">MCP Server & Tool Registry</h1>
          <p className="text-xs text-slate-400 mt-1">
            Model Context Protocol integration. Configure authenticated MCP servers and dynamically discover exposed tools.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadServers}
            className="p-2 bg-[#111726] border border-[#1e293b] hover:border-slate-700 text-slate-300 rounded-lg transition-colors"
            title="Refresh Servers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/mcp-tools/register"
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg shadow-md shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register MCP Server</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 bg-[#111726] border border-[#1e293b] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No MCP Servers Registered"
          description="Connect to Streamable HTTP endpoints or local stdio commands such as npx with args and environment variables."
          actionHref="/mcp-tools/register"
          actionLabel="Register MCP Server & Discover Tools"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {servers.map((server) => (
            <MCPServerCard key={server.id} server={server} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
