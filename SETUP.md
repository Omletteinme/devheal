# 🩺 DevHeal V2 — Setup & Deployment Guide

Welcome to the newly reconstructed, TypeScript-powered DevHeal CLI!

## Prerequisites
- Node.js >= 18.0.0
- npm, pnpm, or yarn

## Installation

1. **Clone the repository or navigate to the source directory:**
   ```bash
   cd path/to/devheal
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the CLI binary:**
   DevHeal V2 is written in TypeScript and requires compilation.
   ```bash
   npm run build
   ```
   This will bundle the source into `dist/`.

4. **Link the CLI globally (Optional but recommended):**
   ```bash
   npm link
   ```
   *Now you can run `devheal` from anywhere on your system!*

## Configuration (AI Doctor)

To use the deep-dive AI features (the `doctor` command), you need to configure your API key.

1. **Create a `.env` file** in the project root of the project you are analyzing (or globally in your shell):
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

## Example Usage Commands

### Scanning for Issues
```bash
devheal scan
```
Outputs a beautiful UI in your terminal listing warnings and critical errors.

### Auto-Fixing
```bash
devheal scan --fix    # Scans and applies safe fixes immediately
devheal fix           # Alternatively, run purely the fix engine
devheal fix --dry-run # Preview the exact shell commands it will run without changes
```

### AI Diagnosis target
Got a weird error in a specific file? Have the AI diagnose it precisely:
```bash
devheal doctor "Why is React failing to mount here?" --file src/App.tsx
```

### CI/CD Integration
To run DevHeal in GitHub Actions without terminal UI colors spoiling the output:
```bash
devheal scan --json
```
If critical errors are found, the process automatically exits with status code `1`, gating your pipeline successfully.
