# skill-viewer

Browse and inspect [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills installed in `~/.claude/`.

3-panel UI with source browsing, skill search, dependency graph, health badges, file tree exploration, and live reload.

## Quick start

```bash
npx skill-viewer
```

Then open [http://localhost:8080](http://localhost:8080).

## Install globally

```bash
npm install -g skill-viewer
skill-viewer
```

## What it scans

Defaults to Claude Code. Skills, commands, agents, and plugins are discovered from:

| Source | Path |
|--------|------|
| Plugins | `~/.claude/plugins/cache/claude-plugins-official/` |
| Custom skills | `~/.claude/skills/` |
| Commands | `~/.claude/commands/` |
| Project skills | `<project>/.claude/commands/` and `<project>/.claude/skills/` |

Project directories can be added dynamically via the UI. The viewer will scan for commands and skills inside each project's `.claude/` directory.

## Multi-agent support

While primarily built for Claude Code, the viewer can also browse skills for other AI coding agents. Switch between agents using the dropdown in the header.

| Agent | Global directory | Project directory |
|-------|-----------------|-------------------|
| Claude Code | `~/.claude/` | `.claude/` |
| Gemini CLI | `~/.gemini/` | `.gemini/` |
| OpenCode | `~/.config/opencode/` | `.opencode/` |
| Codex CLI | `~/.codex/` | `.codex/` |
| Cursor | `~/.cursor/` | `.cursor/` |
| Cline | `~/.cline/` | `.clinerules/` |

Each agent has its own set of supported file extensions and subdirectories. Switching agents re-scans the relevant directories and updates the UI.

## Options

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `8080` | Server port |
