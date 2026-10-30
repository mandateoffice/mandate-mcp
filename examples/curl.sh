#!/usr/bin/env sh
# Raw JSON-RPC calls against the Mandate MCP endpoint (stateless, JSON responses).
set -e
URL=https://mandateoffice.com/mcp
H1="Content-Type: application/json"
H2="Accept: application/json, text/event-stream"

# 1. initialize
curl -s "$URL" -H "$H1" -H "$H2" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}'
echo
# 2. tools/list
curl -s "$URL" -H "$H1" -H "$H2" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
echo
# 3. tools/call get_company (Denmark, CVR 24256790)
curl -s "$URL" -H "$H1" -H "$H2" -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_company","arguments":{"country":"DK","query":"24256790"}}}'
echo
