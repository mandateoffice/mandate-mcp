# Installing Mandate Office (for AI agents such as Cline)

Mandate Office is a hosted, remote MCP server. There is nothing to clone, build or install, and no API key.

- URL: `https://mandateoffice.com/mcp`
- Transport: Streamable HTTP (stateless, JSON responses)
- Auth: none

Add it to the MCP settings file of your client, for example Cline's `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "mandate": {
      "type": "streamableHttp",
      "url": "https://mandateoffice.com/mcp",
      "disabled": false
    }
  }
}
```

Clients that only support stdio can use the `mcp-remote` bridge (needs Node.js):

```json
{
  "mcpServers": {
    "mandate": { "command": "npx", "args": ["-y", "mcp-remote", "https://mandateoffice.com/mcp"] }
  }
}
```

Check: call `tools/list`; you should see `get_company`, `find_law`, `get_formation_guide` and the other tools. A first call to try: `get_company` with `{"country": "EE", "query": "12759581"}`.
Agent notes: https://mandateoffice.com/llms.txt
