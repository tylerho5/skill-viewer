import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "./server.js";
import { SkillIndex, CLAUDE_DIR } from "./index.js";
import { setupWebSocket, setupWatcher } from "./watcher.js";

declare const __dirname: string;
const version: string = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf-8")).version;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`skill-viewer v${version}\n`);
  console.log(`Browse and inspect Claude Code skills installed in ~/.claude/\n`);
  console.log(`Usage: skill-viewer [options]\n`);
  console.log(`Options:`);
  console.log(`  -h, --help     Show this help message`);
  console.log(`  -v, --version  Show version number\n`);
  console.log(`Environment variables:`);
  console.log(`  PORT           Server port (default: 8080)`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(version);
  process.exit(0);
}

const PORT = parseInt(process.env.PORT || "8080", 10);

const index = new SkillIndex();
index.build();

if (!existsSync(CLAUDE_DIR)) {
  console.warn(`\nWarning: ${CLAUDE_DIR} does not exist.`);
  console.warn(`Install Claude Code and run it once to create this directory.\n`);
} else if (index.skills.length === 0) {
  console.warn(`\nNo skills found. Install a plugin or add custom skills to ~/.claude/skills/\n`);
} else {
  console.log(`Indexed ${index.skills.length} skills`);
}

const app = createApp(index);
const server = http.createServer(app);

const { broadcast } = setupWebSocket(server);
setupWatcher(index, broadcast);

server.listen(PORT, () => {
  console.log(`Skill Viewer running at http://localhost:${PORT}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nError: Port ${PORT} is already in use.\n`);
    console.error(`Try one of:`);
    console.error(`  PORT=3000 npx skill-viewer`);
    console.error(`  lsof -ti:${PORT} | xargs kill\n`);
    process.exit(1);
  }
  throw err;
});
