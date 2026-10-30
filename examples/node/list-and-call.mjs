// List Mandate's MCP tools and call one read-only tool (get_company).
//
// Usage:
//   npm install
//   node list-and-call.mjs              # get_company DK 24256790
//   node list-and-call.mjs EE 12759581  # any country + registry code / name

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const URL_MCP = new URL("https://mandateoffice.com/mcp");
const [country = "DK", query = "24256790"] = process.argv.slice(2);

const client = new Client({ name: "mandate-example", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(URL_MCP));

try {
  const { tools } = await client.listTools();
  console.log(`${tools.length} tools:`);
  for (const tool of tools) console.log(`  - ${tool.name}`);

  const result = await client.callTool({
    name: "get_company",
    arguments: { country, query },
  });
  console.log(
    result.isError
      ? `\nget_company ${country} ${query} returned an error:`
      : `\nget_company ${country} ${query}:`,
  );
  if (result.structuredContent) {
    console.log(JSON.stringify(result.structuredContent, null, 2));
  } else {
    for (const block of result.content) console.log(block.text ?? block);
  }
} finally {
  await client.close();
}
