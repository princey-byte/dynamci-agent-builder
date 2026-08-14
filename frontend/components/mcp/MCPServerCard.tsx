'use client';

import React, { useState } from 'react';
import { MCPServer } from '../../lib/types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Server, Wrench, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface MCPServerCardProps {
  server: MCPServer;
  onDelete?: (id: string) => void;
}

export function MCPServerCard({ server, onDelete }: MCPServerCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getAuthBadge = () => {
    switch (server.auth_type) {
      case 'oauth2':
        return <Badge variant="amber">OAUTH 2.1</Badge>;
      case 'bearer':
        return <Badge variant="amber">BEARER TOKEN</Badge>;
      case 'api_key':
        return <Badge variant="amber">API KEY</Badge>;
      case 'custom_headers':
        return <Badge variant="amber">CUSTOM HEADERS</Badge>;
      case 'env_vars':
        return <Badge variant="amber">ENV VARS</Badge>;
      default:
        return <Badge variant="default">NO AUTH</Badge>;
    }
  };

  const getStatusBadge = () => {
    if (server.status === 'CONNECTED') {
      return <Badge variant="success">CONNECTED</Badge>;
    }
    if (server.status === 'ERROR') {
      return <Badge variant="amber">ERROR</Badge>;
    }
    return <Badge variant="default">REGISTERED</Badge>;
  };

  const connectionLabel = server.transport_type === 'stdio' ? 'Command:' : 'Endpoint:';
  const connectionValue = server.transport_type === 'stdio'
    ? [server.command, ...(server.args || [])].filter(Boolean).join(' ')
    : server.server_url;

  return (
    <Card className="flex h-full flex-col justify-between overflow-hidden transition-colors hover:ring-foreground/20">
      <div>
        {/* Header */}
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-agent-tool/10 text-agent-tool">
                <Server className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">{server.name}</CardTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={server.transport_type === 'sse' ? 'worker' : 'supervisor'}>
                    {server.transport_type.toUpperCase()}
                  </Badge>
                  {getAuthBadge()}
                  {getStatusBadge()}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">

        {server.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {server.description}
          </p>
        )}

        <div className="truncate rounded-lg border bg-muted/40 p-2.5 font-mono text-xs text-foreground">
          <span className="mr-2 text-muted-foreground">{connectionLabel}</span>
          {connectionValue}
        </div>

        {server.last_connection_error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
            {server.last_connection_error}
          </div>
        )}

        {/* Discovered Tools Accordion */}
        <div className="overflow-hidden rounded-lg border bg-muted/30">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between p-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex items-center gap-2">
              <Wrench className="size-3.5 text-agent-tool" />
              <span>
                Discovered Tools ({server.tools?.length || 0})
              </span>
            </div>
            {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          </button>

          {expanded && (
            <div className="divide-y divide-border p-2">
              {!server.tools || server.tools.length === 0 ? (
                <div className="p-2 text-[11px] italic text-muted-foreground">No tools imported for this server.</div>
              ) : (
                server.tools.map((tool) => (
                  <div key={tool.id} className="flex flex-col gap-1 p-2">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-agent-tool">
                      <span className="size-1.5 rounded-full bg-agent-tool"></span>
                      <span>{tool.name}</span>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">{tool.description}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        </CardContent>
      </div>

      {/* Footer */}
      <CardFooter className="justify-between gap-3 font-mono text-xs text-muted-foreground">
        <span className="truncate">
          {server.last_discovered_at ? `Discovered: ${new Date(server.last_discovered_at).toLocaleDateString()}` : `Registered: ${new Date(server.created_at).toLocaleDateString()}`}
        </span>
        {onDelete && (
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(server.id)} aria-label="Delete server and discovered tools">
            <Trash2 />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
