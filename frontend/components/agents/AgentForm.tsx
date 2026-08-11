'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { Agent, Skill, MCPTool, RoleType } from '../../lib/types';
import { ArrowLeft, Save } from 'lucide-react';

interface AgentFormProps {
  initialData?: Agent;
  isEdit?: boolean;
}

export function AgentForm({ initialData, isEdit = false }: AgentFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [persona, setPersona] = useState(initialData?.persona || '');
  const [modelProvider, setModelProvider] = useState(initialData?.model_provider || 'openai');
  const [modelName, setModelName] = useState(initialData?.model_name || 'gpt-4o');
  const [temperature, setTemperature] = useState(initialData?.temperature ?? 0.2);
  const [roleType, setRoleType] = useState<RoleType>(initialData?.role_type || 'worker');

  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  const [selectedSkillIDs, setSelectedSkillIDs] = useState<string[]>(
    initialData?.skills?.map((s) => s.id) || []
  );
  const [selectedToolIDs, setSelectedToolIDs] = useState<string[]>(
    initialData?.mcp_tools?.map((t) => t.id) || []
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getSkills(), api.getMCPTools()])
      .then(([skills, tools]) => {
        setAvailableSkills(skills);
        setAvailableTools(tools);
      })
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEdit && initialData) {
        await api.updateAgent(initialData.id, {
          name,
          persona,
          model_provider: modelProvider,
          model_name: modelName,
          temperature: Number(temperature),
          role_type: roleType,
        });

        // Sync skills
        const currentSkillIds = initialData.skills?.map((s) => s.id) || [];
        for (const sId of selectedSkillIDs) {
          if (!currentSkillIds.includes(sId)) {
            await api.attachSkill(initialData.id, sId);
          }
        }
        for (const sId of currentSkillIds) {
          if (!selectedSkillIDs.includes(sId)) {
            await api.detachSkill(initialData.id, sId);
          }
        }

        // Sync tools
        for (const tId of selectedToolIDs) {
          await api.attachMCPTool(initialData.id, tId);
        }
      } else {
        await api.createAgent({
          name,
          persona,
          model_provider: modelProvider,
          model_name: modelName,
          temperature: Number(temperature),
          role_type: roleType,
          skill_ids: selectedSkillIDs,
          mcp_tool_ids: selectedToolIDs,
        });
      }
      router.push('/agents');
    } catch (err: any) {
      setError(err.message || 'Failed to save agent');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (id: string) => {
    setSelectedSkillIDs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleTool = (id: string) => {
    setSelectedToolIDs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Agents</span>
        </button>
        <h2 className="text-xl font-bold text-slate-100">
          {isEdit ? 'Edit Agent Profile' : 'Configure New Agent'}
        </h2>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Basic Settings */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Agent Name
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Code Review Security Auditor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Role Type
          </label>
          <select
            value={roleType}
            onChange={(e) => setRoleType(e.target.value as RoleType)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="supervisor">Supervisor (Routes and delegates subtasks)</option>
            <option value="worker">Worker (Executes specific subtasks & tools)</option>
            <option value="evaluator">Evaluator (Audits results and quality)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Persona & Core System Prompt
          </label>
          <textarea
            required
            rows={5}
            placeholder="Define instructions, identity, constraints, and behavior of the agent..."
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
          />
        </div>
      </div>

      {/* Model & Temperature */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 border-b border-[#1e293b] pb-2">
          LLM Provider & Hyperparameters
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Model Provider
            </label>
            <select
              value={modelProvider}
              onChange={(e) => setModelProvider(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="openai">OpenAI</option>
              <option value="azure_openai">Azure OpenAI (Configured Key)</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Model Name / Deployment ID
            </label>
            <input
              type="text"
              required
              placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022, gemini-1.5-pro"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
            <span className="uppercase tracking-wider">Temperature</span>
            <span className="font-mono text-indigo-400">{temperature}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Skill Ingestion */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 border-b border-[#1e293b] pb-2">
          Attach Knowledge Skills (.md / .txt SOPs)
        </h3>
        {availableSkills.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No skills available. Upload skills in the Skills Library first.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {availableSkills.map((skill) => {
              const isSelected = selectedSkillIDs.includes(skill.id);
              return (
                <button
                  type="button"
                  key={skill.id}
                  onClick={() => toggleSkill(skill.id)}
                  className={`p-3 rounded-lg border text-left flex justify-between items-center transition-all ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/60 text-indigo-300'
                      : 'bg-[#090d16] border-[#1e293b] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-xs font-medium truncate">{skill.title}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {skill.file_type}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* MCP Tools Attachment (Grouped Server-wise with Category & Universal Select All) */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Attach Model Context Protocol (MCP) Tools
            </h3>
            <p className="text-[11px] text-slate-400">
              Select specific capabilities to grant this agent. Categorized by parent MCP Server.
            </p>
          </div>

          {availableTools.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-amber-400 font-mono font-semibold bg-amber-950/50 px-2 py-1 rounded border border-amber-800/60">
                {selectedToolIDs.length} / {availableTools.length} Selected
              </span>
              <button
                type="button"
                onClick={() => {
                  const allSelected = availableTools.every((t) => selectedToolIDs.includes(t.id));
                  if (allSelected) {
                    setSelectedToolIDs([]);
                  } else {
                    setSelectedToolIDs(availableTools.map((t) => t.id));
                  }
                }}
                className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 text-xs font-semibold rounded-lg border border-indigo-700/60 transition-all"
              >
                {availableTools.every((t) => selectedToolIDs.includes(t.id))
                  ? 'Deselect All Across Servers'
                  : 'Select All Tools (All Servers)'}
              </button>
            </div>
          )}
        </div>

        {availableTools.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No MCP tools registered. Register tools in MCP Registry first.</p>
        ) : (
          <div className="space-y-5">
            {(() => {
              // Group tools by parent server name or ID
              const grouped: Record<string, { serverName: string; serverUrl: string; tools: MCPTool[] }> = {};

              availableTools.forEach((tool) => {
                const groupKey = tool.server?.name || (tool.server_id ? `Server (${tool.server_id.slice(0, 8)})` : 'Standalone Custom Tools');
                const groupUrl = tool.server?.server_url || tool.server_url || '';

                if (!grouped[groupKey]) {
                  grouped[groupKey] = {
                    serverName: groupKey,
                    serverUrl: groupUrl,
                    tools: [],
                  };
                }
                grouped[groupKey].tools.push(tool);
              });

              return Object.values(grouped).map((group, groupIdx) => {
                const categoryTools = group.tools;
                const categorySelectedCount = categoryTools.filter((t) => selectedToolIDs.includes(t.id)).length;
                const isCategoryAllSelected = categoryTools.length > 0 && categoryTools.every((t) => selectedToolIDs.includes(t.id));

                const toggleCategory = () => {
                  const categoryIds = categoryTools.map((t) => t.id);
                  if (isCategoryAllSelected) {
                    setSelectedToolIDs((prev) => prev.filter((id) => !categoryIds.includes(id)));
                  } else {
                    setSelectedToolIDs((prev) => Array.from(new Set([...prev, ...categoryIds])));
                  }
                };

                return (
                  <div key={groupIdx} className="bg-[#090d16] border border-[#1e293b] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1e293b]/80 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          {group.serverName}
                        </h4>
                        {group.serverUrl && (
                          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">
                            ({group.serverUrl})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
                          {categorySelectedCount} / {categoryTools.length}
                        </span>
                        <button
                          type="button"
                          onClick={toggleCategory}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded border border-[#1e293b] transition-colors"
                        >
                          {isCategoryAllSelected ? 'Deselect Category' : 'Select All in Category'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {categoryTools.map((tool) => {
                        const isSelected = selectedToolIDs.includes(tool.id);
                        return (
                          <button
                            type="button"
                            key={tool.id}
                            onClick={() => toggleTool(tool.id)}
                            className={`p-3 rounded-lg border text-left flex justify-between items-start transition-all ${
                              isSelected
                                ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/10'
                                : 'bg-[#111726] border-[#1e293b] text-slate-400 hover:border-slate-700 hover:text-slate-300'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono font-semibold truncate flex items-center justify-between">
                                <span>{tool.name}</span>
                                {isSelected && (
                                  <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-950 px-1 py-0.2 rounded border border-amber-800">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {tool.description || 'No description provided'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? 'Saving Agent...' : isEdit ? 'Update Agent' : 'Create Agent'}</span>
        </button>
      </div>
    </form>
  );
}
