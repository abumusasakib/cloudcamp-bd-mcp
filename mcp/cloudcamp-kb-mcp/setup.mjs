import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const installCommand = process.platform === "win32" ? "npm.cmd install" : "npm install";
const registerCommand = "claude mcp add --transport stdio cloudcamp-kb -- node index.js";
const registerArgs = ["mcp", "add", "--transport", "stdio", "cloudcamp-kb", "--", "node", "index.js"];

function claudeBinary() {
  return process.platform === "win32" ? "claude.cmd" : "claude";
}

async function shouldRegister() {
  const cli = createInterface({ input, output });
  try {
    const answer = await cli.question("Register this MCP server in Claude Code now (stdio, local-only)? [Y/n] ");
    return answer.trim() === "" || /^y(es)?$/i.test(answer.trim());
  } finally {
    cli.close();
  }
}

try {
  execSync(installCommand, { stdio: "inherit" });
  console.log("");
  console.log("This server is stdio-only and local-only: it never listens on the");
  console.log("network and never makes outbound requests on its own. It just reads");
  console.log("../../knowledge-base.md, which you (or `npm run refresh`) control.");
  console.log("");
  console.log(registerCommand);
  console.log("");

  if (await shouldRegister()) {
    execSync(`${claudeBinary()} ${registerArgs.join(" ")}`, { stdio: "inherit" });
    console.log("");
    console.log("Claude Code registration complete.");
  } else {
    console.log("Skipped automatic registration. You can run the command above later.");
  }
} catch (error) {
  process.exitCode = 1;
  throw error;
}
