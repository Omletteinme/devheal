# 🩺 devheal — AI-Powered Dev Environment Health Monitor

> Scan → Analyze → Fix → Report. In seconds.

## Quick Start

```bash
npm install
npm link         # makes `devheal` available globally
devheal scan     # scan current directory
```

## Commands

| Command | Description |
|---|---|
| `devheal scan` | Scan for issues (current dir) |
| `devheal scan --path /my/project` | Scan a specific project |
| `devheal scan --no-ai` | Skip AI, faster scan |
| `devheal scan --plugin python` | Add Python checks |
| `devheal scan --json` | JSON output for CI/CD |
| `devheal scan --fix` | Scan + auto-fix in one step |
| `devheal fix` | Apply safe auto-fixes |
| `devheal fix --dry-run` | Preview fixes (no changes) |
| `devheal fix --rollback` | Undo last fix session |
| `devheal doctor` | AI deep diagnostic (needs API key) |
| `devheal plugins` | List available plugins |

## AI Doctor Mode

```bash
export ANTHROPIC_API_KEY=sk-ant-...
devheal doctor --path /my/project
```

## CI/CD (GitHub Actions)

```yaml
- run: npx devheal scan --json --no-ai
```

Exit code 1 when critical issues are found. Perfect for pipeline gating.

## What's Checked

- **Node.js**: version vs LTS, node_modules, lockfile, npm audit, engines field
- **Git**: initialized, .gitignore, secrets in history, dirty main
- **Environment**: .env/.env.example sync, secrets in source code
- **System**: disk space, required tools, git global config
- **Docker**: daemon status, dangling images, Dockerfile best practices
- **Plugins**: Python, Rust, Go, Java

## Stack

Node.js ESM — chosen for fast startup, npx-friendly distribution, and rich ecosystem.

## Architecture

```
Scanner Layer (parallel)  →  Rules Engine (pure)  →  AI Enrichment  →  Fix Engine  →  Output
```

Each scanner uses `Promise.allSettled` so failures are isolated. Rules are pure functions.
The AI layer degrades gracefully — if no API key or network fails, scan continues without it.

## License

MIT
