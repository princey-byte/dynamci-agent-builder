'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { MCPServer } from '../../../lib/types';
import { EmptyState } from '../../../components/ui/EmptyState';
import { MCPServerCard } from '../../../components/mcp/MCPServerCard';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
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
    let ignore = false;

    api.getMCPServers()
      .then((data) => {
        if (!ignore) setServers(data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Unregister this MCP server and its discovered tools?')) {
      await api.deleteMCPServer(id);
      loadServers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">MCP Server & Tool Registry</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Model Context Protocol integration. Configure authenticated MCP servers and dynamically discover exposed tools.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={loadServers}
            aria-label="Refresh servers"
          >
            <RefreshCw className={loading ? 'animate-spin' : undefined} />
          </Button>
          <Button nativeButton={false} render={<Link href="/mcp-tools/register" />}>
            <Plus />
            <span>Register MCP Server</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
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
