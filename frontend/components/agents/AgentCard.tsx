import Link from 'next/link';
import { Agent } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Bot, FileCode, Wrench, Trash2, Edit3, Cpu } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  onDelete?: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 hover:border-[#334155] transition-all flex flex-col justify-between group">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 group-hover:border-indigo-500/40 transition-colors">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                {agent.name}
              </h3>
              <div className="flex items-center space-x-2 mt-0.5">
                <Badge variant={agent.role_type}>{agent.role_type}</Badge>
                <Badge variant={agent.model_provider as any}>{agent.model_provider}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Persona preview */}
        <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed font-sans">
          {agent.persona}
        </p>

        {/* Specs */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-4 bg-[#090d16] p-2.5 rounded-lg border border-[#1e293b]">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">{agent.model_name}</span>
          </div>
          <div className="text-right text-slate-400">
            Temp: <span className="text-slate-200">{agent.temperature}</span>
          </div>
        </div>

        {/* Attached Skills & MCP Tools badges */}
        <div className="space-y-1.5 text-xs">
          {agent.skills && agent.skills.length > 0 && (
            <div className="flex items-center space-x-1 text-slate-400">
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span>{agent.skills.length} Attached Skills</span>
            </div>
          )}
          {agent.mcp_tools && agent.mcp_tools.length > 0 && (
            <div className="flex items-center space-x-1 text-slate-400">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>{agent.mcp_tools.length} Attached MCP Tools</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end space-x-2 mt-4 pt-3 border-t border-[#1e293b]">
        <Link
          href={`/agents/${agent.id}/edit`}
          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-[#1a2236] rounded-md transition-colors"
          title="Edit Agent"
        >
          <Edit3 className="w-4 h-4" />
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(agent.id)}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#1a2236] rounded-md transition-colors"
            title="Delete Agent"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
