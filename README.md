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

| Source | Path |
|--------|------|
| Plugins | `~/.claude/plugins/cache/claude-plugins-official/` |
| Custom skills | `~/.claude/skills/` |
| Commands | `~/.claude/commands/` |
| Project skills | `<project>/.claude/commands/` and `<project>/.claude/skills/` |

Project directories can be added dynamically via the UI or the `POST /api/projects` endpoint. The viewer will scan for commands and skills inside each project's `.claude/` directory.

## Options

| Env var | Default | Description |
|---------|---------|-------------|
| `PORT` | `8080` | Server port |
