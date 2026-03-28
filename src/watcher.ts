import { WebSocketServer, WebSocket } from "ws";
import chokidar from "chokidar";
import type { Server } from "node:http";
import { SkillIndex, PLUGINS_DIR, CUSTOM_SKILLS_DIR, COMMANDS_DIR } from "./index.js";
import fs from "node:fs";

export function setupWebSocket(server: Server): {
  broadcast: (msg: Record<string, unknown>) => void;
} {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });

  function broadcast(msg: Record<string, unknown>) {
    const data = JSON.stringify(msg);
    for (const ws of clients) {
      try { ws.send(data); } catch { clients.delete(ws); }
    }
  }

  return { broadcast };
}

export function setupWatcher(index: SkillIndex, broadcast: (msg: Record<string, unknown>) => void): void {
  const dirs = [PLUGINS_DIR, CUSTOM_SKILLS_DIR, COMMANDS_DIR].filter((d) => {
    try { return fs.statSync(d).isDirectory(); } catch { return false; }
  });

  if (dirs.length === 0) return;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const watcher = chokidar.watch(dirs, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });

  function handleChange(changedPath: string) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      index.build();
      broadcast({ type: "skill_changed", path: changedPath });
    }, 500);
  }

  watcher.on("change", handleChange);
  watcher.on("add", handleChange);
  watcher.on("unlink", handleChange);

  console.log(`Watching ${dirs.length} directories for changes`);
}
