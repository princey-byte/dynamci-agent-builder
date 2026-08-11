'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { TransportType, AuthType, AuthConfig, DiscoveredTool, OAuthTokens } from '../../lib/types';
import { ArrowLeft, Save, Wrench, RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2, Lock, ExternalLink } from 'lucide-react';

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

  // OAuth 2.1 State
  const [oauthAuthorizeUrl, setOauthAuthorizeUrl] = useState('https://github.com/login/oauth/authorize');
  const [oauthTokenUrl, setOauthTokenUrl] = useState('https://github.com/login/oauth/access_token');
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthScopes, setOauthScopes] = useState('repo,read:user');
  const [oauthTokens, setOauthTokens] = useState<OAuthTokens | null>(null);
  const [oauthAuthenticating, setOauthAuthenticating] = useState(false);

  // Step 3: Discovery State
  const [discovering, setDiscovering] = useState(false);
  const [discoveredTools, setDiscoveredTools] = useState<DiscoveredTool[]>([]);
  const [discoverySuccess, setDiscoverySuccess] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for OAuth Pop-up message completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'MCP_OAUTH_SUCCESS') {
        const tokens: OAuthTokens = event.data.tokens;
        const tools: DiscoveredTool[] = event.data.tools || [];
        setOauthTokens(tokens);
        setDiscoveredTools(tools);
        setDiscoverySuccess(true);
        setOauthAuthenticating(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const selectPreset = (provider: 'github' | 'notion' | 'atlassian') => {
    setAuthType('oauth2');
    setTransportType('sse');
    if (provider === 'github') {
      setName('GitHub Enterprise MCP Server');
      setServerUrl('https://api.githubcopilot.com/mcp/');
      setOauthAuthorizeUrl('https://github.com/login/oauth/authorize');
      setOauthTokenUrl('https://github.com/login/oauth/access_token');
      setOauthScopes('repo,read:user');
    } else if (provider === 'notion') {
      setName('Notion Cloud MCP Server');
      setServerUrl('https://mcp.notion.com/mcp');
      setOauthAuthorizeUrl('https://api.notion.com/v1/oauth/authorize');
      setOauthTokenUrl('https://api.notion.com/v1/oauth/token');
      setOauthScopes('read:notion');
    } else if (provider === 'atlassian') {
      setName('Atlassian Rovo MCP Server');
      setServerUrl('https://mcp.atlassian.com/v1/mcp');
      setOauthAuthorizeUrl('https://auth.atlassian.com/authorize');
      setOauthTokenUrl('https://auth.atlassian.com/oauth/token');
      setOauthScopes('read:jira-work read:confluence-content.summary offline_access');
    }
  };

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
    } else if (authType === 'oauth2' && oauthTokens) {
      config.oauth = oauthTokens;
    }

    return config;
  };

  const handleLaunchOAuthPopup = async () => {
    if (!serverUrl.trim()) {
      setError('Please enter a Server URL before initiating OAuth authorization.');
      return;
    }

    if (authType === 'oauth2' && (serverUrl.toLowerCase().includes('github') || serverUrl.toLowerCase().includes('notion') || serverUrl.toLowerCase().includes('atlassian')) && !oauthClientId.trim()) {
      setError('OAuth authorization requires a Client ID from your Developer Settings. Please enter your OAuth Client ID below (or switch to "Bearer Token" or "Custom Headers" to use an API/Personal Token).');
      return;
    }

    setOauthAuthenticating(true);
    setError(null);

    try {
      const redirectUri = `${window.location.origin}/mcp/oauth/callback`;

      const initRes = await api.initMCPOAuth({
        server_url: serverUrl,
        authorize_url: oauthAuthorizeUrl,
        client_id: oauthClientId,
        scopes: oauthScopes,
        redirect_uri: redirectUri,
      });

      // Save parameters in localStorage for callback popup
      localStorage.setItem('mcp_oauth_server_url', serverUrl);
      localStorage.setItem('mcp_oauth_token_url', oauthTokenUrl);
      localStorage.setItem('mcp_oauth_code_verifier', initRes.code_verifier);
      localStorage.setItem('mcp_oauth_client_id', oauthClientId);
      localStorage.setItem('mcp_oauth_client_secret', oauthClientSecret);

      // Launch pop-up window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      window.open(
        initRes.authorization_url,
        'mcp_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to initiate OAuth authorization flow.');
      setOauthAuthenticating(false);
    }
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
        oauth_client_id: oauthClientId,
        oauth_client_secret: oauthClientSecret,
        oauth_scopes: oauthScopes,
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

      {/* Quick Presets Banner */}
      <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-4 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Quick Presets</h4>
          <p className="text-[11px] text-slate-400">Pre-configure endpoints & OAuth settings for cloud MCP servers</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => selectPreset('github')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-[#1e293b] transition-colors"
          >
            GitHub MCP
          </button>
          <button
            type="button"
            onClick={() => selectPreset('notion')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-[#1e293b] transition-colors"
          >
            Notion MCP
          </button>
          <button
            type="button"
            onClick={() => selectPreset('atlassian')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-[#1e293b] transition-colors"
          >
            Atlassian Rovo
          </button>
        </div>
      </div>

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
              Authentication Method
            </label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as AuthType)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="none">No Authentication (Public / Local)</option>
              {transportType === 'sse' && (
                <>
                  <option value="oauth2">OAuth 2.1 Pop-up Authorization (GitHub, Notion, Atlassian)</option>
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

          {/* OAuth 2.1 Form */}
          {authType === 'oauth2' && (
            <div className="space-y-4 bg-[#090d16] p-4 rounded-xl border border-[#1e293b]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400 flex items-center space-x-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>OAuth 2.1 PKCE Pop-up Flow Settings</span>
                </span>
                {oauthTokens && (
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-[10px] font-mono border border-emerald-800 rounded">
                    AUTHORIZED
                  </span>
                )}
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-lg text-xs text-indigo-200 space-y-1">
                <div className="font-semibold text-indigo-300">How Cloud OAuth Authorization Works (GitHub / Notion / Atlassian):</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Cloud OAuth requires an <strong>OAuth Client ID</strong> from your Developer Console (<code className="text-amber-300 font-mono">github.com/settings/developers</code>, <code className="text-amber-300 font-mono">notion.so/my-integrations</code>, or <code className="text-amber-300 font-mono">developer.atlassian.com/console/myapps</code>). Set Callback URL in your app settings to: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/mcp/oauth/callback</code>.
                </p>
                <p className="text-[11px] text-slate-400">
                  <em>Tip: If you don't have a Public OAuth App ID, switch <strong>Authentication Method</strong> above to <strong>"Bearer Token"</strong> or <strong>"Custom HTTP Headers"</strong> and paste a Personal Access Token / API Token (<code className="font-mono">ghp_...</code>, <code className="font-mono">ntn_...</code>, or <code className="font-mono">Basic base64(email:token)</code>) directly!</em>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Authorization URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://github.com/login/oauth/authorize"
                    value={oauthAuthorizeUrl}
                    onChange={(e) => setOauthAuthorizeUrl(e.target.value)}
                    className="w-full bg-[#111726] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Token Exchange URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://github.com/login/oauth/access_token"
                    value={oauthTokenUrl}
                    onChange={(e) => setOauthTokenUrl(e.target.value)}
                    className="w-full bg-[#111726] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ov23li..."
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    className="w-full bg-[#111726] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Client Secret (GitHub Apps)
                  </label>
                  <input
                    type="password"
                    placeholder="e.g. 8f9a2b3c..."
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                    className="w-full bg-[#111726] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Scopes
                  </label>
                  <input
                    type="text"
                    placeholder="repo,read:user"
                    value={oauthScopes}
                    onChange={(e) => setOauthScopes(e.target.value)}
                    className="w-full bg-[#111726] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleLaunchOAuthPopup}
                  disabled={oauthAuthenticating}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow-md transition-all"
                >
                  <ExternalLink className={`w-4 h-4 ${oauthAuthenticating ? 'animate-spin' : ''}`} />
                  <span>{oauthAuthenticating ? 'Waiting for Pop-up Consent...' : 'Launch OAuth 2.1 Pop-up Window'}</span>
                </button>
              </div>
            </div>
          )}

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
