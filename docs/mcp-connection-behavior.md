# MCP Connection Behavior

This application supports two MCP transport styles.

## Local stdio servers

Local MCP servers launched with `npx`, `node`, `uvx`, or another executable use MCP stdio transport.

The application stores these fields separately:

- `command`: executable name or absolute path, for example `npx`
- `args`: process arguments, for example `-y`, `@modelcontextprotocol/server-filesystem`, `/mnt/agentic-app`
- `auth_config.env_vars`: environment variables passed to the subprocess
- `working_directory`: optional process working directory

The backend launches the subprocess and exchanges newline-delimited JSON-RPC over stdin/stdout:

1. `initialize`
2. `notifications/initialized`
3. `tools/list`
4. `tools/call` during workflow execution

The server may write logs to stderr. The backend includes recent stderr text in connection errors so users can diagnose missing environment variables, bad paths, missing npm packages, and permission issues.

Example stdio registration:

```text
Command: npx
Arguments:
-y
@modelcontextprotocol/server-filesystem
/mnt/agentic-app
```

Equivalent MCP Inspector check:

```bash
npx @modelcontextprotocol/inspector --cli npx -y @modelcontextprotocol/server-filesystem /mnt/agentic-app --method tools/list
```

## Streamable HTTP or HTTPS servers

Remote MCP servers use a single MCP endpoint URL, for example `https://mcp.example.com/mcp`.

The current HTTP path remains separate from the stdio module. It continues to use the existing HTTP/SSE client behavior for OAuth, bearer token, API key, and custom header authentication.

Equivalent MCP Inspector check:

```bash
npx @modelcontextprotocol/inspector --cli --server-url https://mcp.example.com/mcp --transport http --method tools/list
```

## Connection states

- `REGISTERED`: configuration was saved, but no successful tool discovery has been imported yet
- `CONNECTED`: discovery succeeded and imported at least one tool
- `ERROR`: the last connection or discovery attempt failed

Discovery can also return `empty`, meaning the MCP handshake succeeded but `tools/list` returned no tools.