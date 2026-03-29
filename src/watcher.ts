import { WebSocketServer, WebSocket } from "ws";
import chokidar from "chokidar";
import type { Server } from "node:http";
import { SkillIndex, getWatchDirs } from "./index.js";

export interface SkillWatcher {
  add: (dir: string) => void;
  unwatch: (dir: string) => void;
  close: () => Promise<void>;
  switchAgent: () => void;
}

export function setupWebSocket(server: Server): {
  broadcast: (msg: Record<string, unknown>) => void;
  wss: WebSocketServer;
} {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Set<WebSocket>();

  wss.on("error", (err) => {
    console.error("WebSocket server error:", err.message);
  });

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

  return { broadcast, wss };
}

export function setupWatcher(
  index: SkillIndex,
  broadcast: (msg: Record<string, unknown>) => void,
): SkillWatcher {
  let watchedDirs = getWatchDirs();

  const watcher = chokidar.watch(watchedDirs, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleChange() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      index.build();
      broadcast({ type: "skill_changed" });
    }, 500);
  }

  watcher.on("change", handleChange);
  watcher.on("add", handleChange);
  watcher.on("unlink", handleChange);
  watcher.on("error", (err) => console.error("Watcher error:", err));

  if (watchedDirs.length > 0) {
    console.log(`Watching ${watchedDirs.length} directories for changes`);
  }

  return {
    add: (dir: string) => watcher.add(dir),
    unwatch: (dir: string) => watcher.unwatch(dir),
    close: () => watcher.close(),
    switchAgent: () => {
      if (watchedDirs.length > 0) watcher.unwatch(watchedDirs);
      watchedDirs = getWatchDirs();
      if (watchedDirs.length > 0) {
        watcher.add(watchedDirs);
        console.log(`Watching ${watchedDirs.length} directories for changes`);
      }
    },
  };
}
