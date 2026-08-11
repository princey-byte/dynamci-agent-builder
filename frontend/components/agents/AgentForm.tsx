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

      {/* MCP Tools Attachment */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 border-b border-[#1e293b] pb-2">
          Attach Model Context Protocol (MCP) Tools
        </h3>
        {availableTools.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No MCP tools registered. Register tools in MCP Registry first.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {availableTools.map((tool) => {
              const isSelected = selectedToolIDs.includes(tool.id);
              return (
                <button
                  type="button"
                  key={tool.id}
                  onClick={() => toggleTool(tool.id)}
                  className={`p-3 rounded-lg border text-left flex justify-between items-center transition-all ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                      : 'bg-[#090d16] border-[#1e293b] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium truncate">{tool.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{tool.transport_type}</div>
                  </div>
                </button>
              );
            })}
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
