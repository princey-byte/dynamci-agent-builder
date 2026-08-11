'use client';

import React, { useState } from 'react';
import { MCPServer } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Server, Wrench, Trash2, ChevronDown, ChevronRight, Lock, Terminal, Globe } from 'lucide-react';

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

  return (
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">{server.name}</h3>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant={server.transport_type === 'sse' ? 'worker' : 'supervisor'}>
                  {server.transport_type.toUpperCase()}
                </Badge>
                {getAuthBadge()}
              </div>
            </div>
          </div>
        </div>

        {server.description && (
          <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
            {server.description}
          </p>
        )}

        <div className="bg-[#090d16] p-2.5 rounded-lg border border-[#1e293b] text-xs font-mono text-slate-300 truncate mb-3">
          <span className="text-slate-500 mr-2">Endpoint/Cmd:</span>
          {server.server_url}
        </div>

        {/* Discovered Tools Accordion */}
        <div className="border border-[#1e293b] rounded-lg overflow-hidden bg-[#090d16]">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-2.5 text-xs font-semibold text-slate-300 hover:bg-[#1a2236]/40 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Discovered Tools ({server.tools?.length || 0})
              </span>
            </div>
            {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>

          {expanded && (
            <div className="divide-y divide-[#1e293b] p-2">
              {!server.tools || server.tools.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic p-2">No tools imported for this server.</div>
              ) : (
                server.tools.map((tool) => (
                  <div key={tool.id} className="p-2 space-y-1">
                    <div className="text-xs font-mono font-semibold text-amber-300 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      <span>{tool.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{tool.description}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#1e293b] bg-[#090d16]/50 text-xs font-mono text-slate-500">
        <span>Connected: {new Date(server.created_at).toLocaleDateString()}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(server.id)}
            className="text-slate-400 hover:text-red-400 p-1 rounded transition-colors"
            title="Delete Server & Discovered Tools"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
