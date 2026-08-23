// Deliberate, human-run refresh of the local knowledge-base.md mirror.
//
// This is NOT run automatically by the MCP server, by Claude Code, or by
// any agent — it only runs when a person types `npm run refresh` and then
// explicitly confirms the diff. That is the whole point: the MCP server
// (index.js) never talks to the network, so nothing can silently change
// what your agent reads without you seeing and approving the change first.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const kbPath = resolve(repoRoot, "knowledge-base.md");

const SOURCE_URL =
  process.env.CLOUDCAMP_SOURCE_URL ||
  "https://cloudcamp-bd-mcp.equisaas-bd.com/api/sse/cc-auth-2026";
const RESOURCE_URI = "cloudcamp://knowledge-base";

console.log("⚠️  About to contact a THIRD-PARTY, unofficial endpoint:");
console.log(`    ${SOURCE_URL}`);
console.log("    (not a cloudcampbd.com domain; auth is a static shared URL token)");
console.log("This will only READ a resource — no credentials or files are sent.");
console.log("");

const cli = createInterface({ input, output });
const proceed = await cli.question("Proceed with fetching a fresh copy? [y/N] ");
if (!/^y(es)?$/i.test(proceed.trim())) {
  console.log("Cancelled. Local knowledge-base.md left unchanged.");
  cli.close();
  process.exit(0);
}

let remoteText;
try {
  const client = new Client({ name: "cloudcamp-kb-refresh", version: "0.1.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(SOURCE_URL));
  await client.connect(transport);
  const result = await client.readResource({ uri: RESOURCE_URI });
  remoteText = result?.contents?.[0]?.text;
  await client.close();
} catch (err) {
  console.error("Fetch failed:", err?.message || err);
  cli.close();
  process.exit(1);
}

if (!remoteText) {
  console.error("Server returned no content for the resource. Aborting — local file untouched.");
  cli.close();
  process.exit(1);
}

const current = await readFile(kbPath, "utf8").catch(() => "");
console.log("");
console.log(`Fetched ${remoteText.length} chars (current local file: ${current.length} chars).`);
console.log("This script does NOT auto-overwrite. Review the fetched content yourself —");
console.log("e.g. save it to a scratch file and diff it against knowledge-base.md — before");
console.log("deciding whether to hand-merge any changes in. Raw fetched text follows:");
console.log("");
console.log("=".repeat(72));
console.log(remoteText);
console.log("=".repeat(72));
console.log("");
console.log("Nothing was written. Update knowledge-base.md by hand (with a proper");
console.log("provenance header) if, after reviewing the above, you trust the change.");

cli.close();
