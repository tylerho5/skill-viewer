import http from "node:http";
import { createApp } from "./server.js";
import { SkillIndex } from "./index.js";
import { setupWebSocket, setupWatcher } from "./watcher.js";

const PORT = parseInt(process.env.PORT || "8080", 10);

const index = new SkillIndex();
index.build();
console.log(`Indexed ${index.skills.length} skills`);

const app = createApp(index);
const server = http.createServer(app);

const { broadcast, wss } = setupWebSocket(server);
const watcher = setupWatcher(index, broadcast);

// Keep project dir watches in sync with watcher when projects are added/removed via API.
// Patch index methods to call watcher.add/unwatch after the originals complete.
const originalAdd = index.addProjectDir.bind(index);
const originalRemove = index.removeProjectDir.bind(index);
index.addProjectDir = (dir: string): boolean => {
  const ok = originalAdd(dir);
  if (ok && watcher) watcher.add(dir);
  return ok;
};
index.removeProjectDir = (dir: string): void => {
  originalRemove(dir);
  if (watcher) watcher.unwatch(dir);
};

server.listen(PORT, () => {
  console.log(`Skill Viewer running at http://localhost:${PORT}`);
});

function shutdown() {
  console.log("Shutting down...");
  server.close(() => {
    wss.close(() => {
      if (watcher) {
        watcher.close().then(() => process.exit(0)).catch(() => process.exit(1));
      } else {
        process.exit(0);
      }
    });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
