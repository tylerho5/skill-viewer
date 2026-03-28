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

const { broadcast } = setupWebSocket(server);
setupWatcher(index, broadcast);

server.listen(PORT, () => {
  console.log(`Skill Viewer running at http://localhost:${PORT}`);
});
