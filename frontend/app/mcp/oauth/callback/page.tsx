'use client';

import React, { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function MCPOAuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Exchanging authorization code and discovering tools...');
  const exchangedRef = React.useRef(false);

  const handleExchange = async (code: string) => {
    try {
      const serverUrl = localStorage.getItem('mcp_oauth_server_url') || 'https://api.githubcopilot.com/mcp/';
      const tokenUrl = localStorage.getItem('mcp_oauth_token_url') || '';
      const codeVerifier = localStorage.getItem('mcp_oauth_code_verifier') || '';
      const clientId = localStorage.getItem('mcp_oauth_client_id') || '';
      const clientSecret = localStorage.getItem('mcp_oauth_client_secret') || '';
      const redirectUri = window.location.origin + window.location.pathname;

      const res = await api.callbackMCPOAuth({
        server_url: serverUrl,
        token_url: tokenUrl,
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });

      setStatus('success');
      setMessage(`Successfully authenticated! Discovered ${res.tools?.length || 0} tools.`);

      // Post message back to parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'MCP_OAUTH_SUCCESS',
            tokens: res.tokens,
            tools: res.tools,
          },
          '*'
        );
      }

      // Close pop-up window after 1.5 seconds
      setTimeout(() => {
        if (window.opener) {
          window.close();
        }
      }, 1500);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'OAuth token exchange failed.');
    }
  };

  useEffect(() => {
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const fail = (nextMessage: string) => {
      queueMicrotask(() => {
        setStatus('error');
        setMessage(nextMessage);
      });
    };

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const errorParam = urlParams.get('error');

    if (errorParam) {
      fail(`OAuth authorization failed: ${errorParam}`);
      return;
    }

    if (!code) {
      fail('No authorization code returned from OAuth provider.');
      return;
    }

    queueMicrotask(() => {
      void handleExchange(code);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
        {status === 'loading' && (
          <div className="space-y-4">
            <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Authenticating MCP Server...</h2>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 className="w-12 h-12 text-agent-success mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Authorization Successful!</h2>
            <p className="text-xs text-foreground">{message}</p>
            <p className="text-[11px] text-muted-foreground italic">This window will close automatically...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Authorization Failed</h2>
            <p className="text-xs text-destructive">{message}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-muted hover:bg-accent text-foreground text-xs rounded-lg transition-colors"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
