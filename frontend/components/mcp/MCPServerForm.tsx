'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { TransportType, AuthType, AuthConfig, DiscoveredTool } from '../../lib/types';
import { ArrowLeft, Save, Wrench, RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2, Key, Lock, Globe, Terminal } from 'lucide-react';

export function MCPServerForm() {
  const router = useRouter();

  // Step 1: Transport & Connection
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [transportType, setTransportType] = useState<TransportType>('sse');

  // Step 2: Authentication
  const [authType, setAuthType] = useState<AuthType>('none');
  const [bearerToken, setBearerToken] = useState('');
  const [apiKeyName, setApiKeyName] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');

  // Custom Headers key-value list
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);

  // Stdio Environment Variables key-value list
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);

  // Step 3: Discovery State
  const [discovering, setDiscovering] = useState(false);
  const [discoveredTools, setDiscoveredTools] = useState<DiscoveredTool[]>([]);
  const [discoverySuccess, setDiscoverySuccess] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to compile AuthConfig object
  const buildAuthConfig = (): AuthConfig => {
    const config: AuthConfig = {};

    if (authType === 'bearer') {
      config.bearer_token = bearerToken;
    } else if (authType === 'api_key') {
      config.api_key_header_name = apiKeyName;
      config.api_key_header_value = apiKeyValue;
    } else if (authType === 'custom_headers') {
      const headersObj: Record<string, string> = {};
      customHeaders.forEach((h) => {
        if (h.key.trim() && h.value.trim()) {
          headersObj[h.key.trim()] = h.value.trim();
        }
      });
      config.custom_headers = headersObj;
    } else if (authType === 'env_vars') {
      const envObj: Record<string, string> = {};
      envVars.forEach((e) => {
        if (e.key.trim() && e.value.trim()) {
          envObj[e.key.trim()] = e.value.trim();
        }
      });
      config.env_vars = envObj;
    }

    return config;
  };

  const handleDiscover = async () => {
    if (!serverUrl.trim()) {
      setError('Please enter a Server URL or Subprocess Command.');
      return;
    }

    setDiscovering(true);
    setError(null);
    setDiscoverySuccess(false);

    try {
      const res = await api.discoverMCPTools({
        server_url: serverUrl,
        transport_type: transportType,
        auth_type: authType,
        auth_config: buildAuthConfig(),
      });

      setDiscoveredTools(res.tools || []);
      setDiscoverySuccess(true);
    } catch (err: any) {
      setError(err.message || 'Connection or discovery failed. Check server endpoint and auth credentials.');
    } finally {
      setDiscovering(false);
    }
  };

  const toggleToolSelection = (index: number) => {
    setDiscoveredTools((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const selectedTools = discoveredTools.filter((t) => t.selected !== false);

    try {
      await api.createMCPServer({
        name,
        description,
        server_url: serverUrl,
        transport_type: transportType,
        auth_type: authType,
        auth_config: buildAuthConfig(),
        import_tools: selectedTools,
      });

      router.push('/mcp-tools');
    } catch (err: any) {
      setError(err.message || 'Failed to register MCP server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to MCP Tools</span>
        </button>
        <h2 className="text-xl font-bold text-slate-100">Register MCP Server & Auth</h2>
      </div>

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Server Info & Transport */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 border-b border-[#1e293b] pb-2 flex items-center space-x-2">
            <ServerIcon className="w-4 h-4 text-indigo-400" />
            <span>1. Connection & Transport Protocol</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Server Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. GitHub Enterprise MCP Server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Transport Layer
              </label>
              <select
                value={transportType}
                onChange={(e) => {
                  const val = e.target.value as TransportType;
                  setTransportType(val);
                  if (val === 'stdio' && authType !== 'env_vars' && authType !== 'none') {
                    setAuthType('env_vars');
                  }
                }}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="sse">HTTP SSE Transport Endpoint</option>
                <option value="stdio">Stdio Subprocess Command Transport</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {transportType === 'sse' ? 'Server SSE Endpoint URL' : 'Subprocess Command'}
            </label>
            <input
              type="text"
              required
              placeholder={transportType === 'sse' ? 'https://mcp.internal.company.com/sse' : 'npx -y @modelcontextprotocol/server-github'}
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of systems and capabilities exposed by this MCP server..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Section 2: Authentication */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 border-b border-[#1e293b] pb-2 flex items-center space-x-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>2. Authentication Configuration</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Authentication Type
            </label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="none">No Authentication (Public / Local)</option>
              {transportType === 'sse' && (
                <>
                  <option value="bearer">Bearer Token (Authorization: Bearer &lt;token&gt;)</option>
                  <option value="api_key">API Key Header (e.g. X-API-Key: &lt;key&gt;)</option>
                  <option value="custom_headers">Custom HTTP Headers</option>
                </>
              )}
              {transportType === 'stdio' && (
                <option value="env_vars">Process Environment Variables</option>
              )}
            </select>
          </div>

          {/* Bearer Token Form */}
          {authType === 'bearer' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Bearer Token
              </label>
              <input
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* API Key Header Form */}
          {authType === 'api_key' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Header Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="X-API-Key"
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Header Value / Secret Key
                </label>
                <input
                  type="password"
                  required
                  placeholder="secret-key-value"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Custom HTTP Headers Form */}
          {authType === 'custom_headers' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Custom Headers
              </label>
              {customHeaders.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Header-Name"
                    value={h.key}
                    onChange={(e) => {
                      const newH = [...customHeaders];
                      newH[i].key = e.target.value;
                      setCustomHeaders(newH);
                    }}
                    className="flex-1 bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                  />
                  <input
                    type="text"
                    placeholder="Header-Value"
                    value={h.value}
                    onChange={(e) => {
                      const newH = [...customHeaders];
                      newH[i].value = e.target.value;
                      setCustomHeaders(newH);
                    }}
                    className="flex-1 bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomHeaders(customHeaders.filter((_, idx) => idx !== i))}
                    className="p-2 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCustomHeaders([...customHeaders, { key: '', value: '' }])}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Header Pair</span>
              </button>
            </div>
          )}

          {/* Stdio Environment Variables Form */}
          {authType === 'env_vars' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Process Environment Variables
              </label>
              {envVars.map((env, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="GITHUB_PERSONAL_ACCESS_TOKEN"
                    value={env.key}
                    onChange={(e) => {
                      const newE = [...envVars];
                      newE[i].key = e.target.value;
                      setEnvVars(newE);
                    }}
                    className="flex-1 bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                  />
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={env.value}
                    onChange={(e) => {
                      const newE = [...envVars];
                      newE[i].value = e.target.value;
                      setEnvVars(newE);
                    }}
                    className="flex-1 bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setEnvVars(envVars.filter((_, idx) => idx !== i))}
                    className="p-2 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 pt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Variable Pair</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 3: Live Discovery & Tool Selection */}
        <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <Wrench className="w-4 h-4 text-emerald-400" />
              <span>3. Live Connection & Tool Discovery (tools/list)</span>
            </h3>

            <button
              type="button"
              onClick={handleDiscover}
              disabled={discovering}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md shadow-emerald-600/20 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
              <span>{discovering ? 'Connecting...' : 'Connect & Discover Tools'}</span>
            </button>
          </div>

          {discoverySuccess && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Successfully connected to MCP Server! Discovered {discoveredTools.length} tools.</span>
            </div>
          )}

          {discoveredTools.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Select Discovered Tools to Import:
              </div>
              <div className="divide-y divide-[#1e293b] border border-[#1e293b] rounded-lg bg-[#090d16]">
                {discoveredTools.map((tool, idx) => (
                  <div key={idx} className="p-3 flex items-start space-x-3 hover:bg-[#1a2236]/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={tool.selected !== false}
                      onChange={() => toggleToolSelection(idx)}
                      className="mt-1 accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-mono font-semibold text-indigo-300">{tool.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{tool.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Registering Server...' : 'Register MCP Server & Import Tools'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
    </svg>
  );
}
