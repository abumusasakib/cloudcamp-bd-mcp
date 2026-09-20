// CI smoke test: actually boots the MCP server (index.js) over its real
// stdio transport, using the SDK's own Client, and checks it responds
// correctly. This is deliberately NOT a network test — it never touches
// cloudcampbd.com or any refresh script; those are human-run only (see
// README.md). It only proves the server itself starts, lists its tools,
// and can serve each local knowledge-base source without throwing.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_TOOLS = [
  "list_knowledge_sources",
  "get_knowledge_base_congress",
  "get_provenance_congress",
  "get_knowledge_base_infinity_buildfest",
  "get_provenance_infinity_buildfest",
  "get_knowledge_base_ai_builders_congress",
  "get_provenance_ai_builders_congress",
];

let failed = false;
function check(label, condition) {
  if (condition) {
    console.log(`ok   - ${label}`);
  } else {
    console.error(`FAIL - ${label}`);
    failed = true;
  }
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["index.js"],
});
const client = new Client({ name: "smoke-test", version: "0.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);
  check("client connected to server over stdio", true);

  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name);
  for (const expected of EXPECTED_TOOLS) {
    check(`tools/list includes "${expected}"`, toolNames.includes(expected));
  }

  const sourcesResult = await client.callTool({ name: "list_knowledge_sources", arguments: {} });
  const sourcesText = sourcesResult.content?.[0]?.text ?? "";
  check("list_knowledge_sources returned non-empty text", sourcesText.length > 0);
  check(
    "list_knowledge_sources mentions all three known sources",
    ["buildfest-congress", "infinity-buildfest", "ai-builders-congress"].every((id) =>
      sourcesText.includes(id)
    )
  );

  for (const toolName of [
    "get_knowledge_base_congress",
    "get_knowledge_base_infinity_buildfest",
    "get_knowledge_base_ai_builders_congress",
  ]) {
    const result = await client.callTool({ name: toolName, arguments: {} });
    const text = result.content?.[0]?.text ?? "";
    check(`${toolName} returns non-empty content`, text.length > 100);
    check(`${toolName} does not error`, !result.isError);
  }
} catch (err) {
  console.error("FAIL - unexpected error during smoke test:", err);
  failed = true;
} finally {
  await client.close().catch(() => {});
}

if (failed) {
  console.error("\nSmoke test FAILED.");
  process.exit(1);
} else {
  console.log("\nSmoke test passed.");
  process.exit(0);
}
