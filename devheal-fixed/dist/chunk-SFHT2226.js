#!/usr/bin/env node

// src/core/engine.ts
async function runRules(scanData, cwd) {
  const issues = [];
  const addOk = (cat, name, data) => {
    if (data && !data.error) {
      issues.push({ ruleId: `${name}-ok`, category: cat, title: `${name} ${data[name + "Version"] || ""} (current)`, description: "", severity: "success", fixable: false });
    } else {
      issues.push({ ruleId: `${name}-missing`, category: cat, title: `${name} not found in PATH`, description: `If you rely on ${name}, install it.`, severity: "info", fixable: false });
    }
  };
  if (scanData.node && !scanData.node.error) {
    const isOldNode = scanData.node.nodeVersion && (scanData.node.nodeVersion.startsWith("v18") || scanData.node.nodeVersion.startsWith("v16"));
    if (isOldNode) {
      issues.push({
        ruleId: "node-outdated",
        category: "NODE.JS",
        title: `node ${scanData.node.nodeVersion} (Outdated)`,
        description: "Update to Node 20 LTS for security support.",
        severity: "warning",
        fixable: true,
        fixCommand: "nvm install 20 && nvm use 20"
      });
    } else {
      issues.push({ ruleId: "node-ok", category: "NODE.JS", title: `node ${scanData.node.nodeVersion} (current)`, description: "", severity: "success", fixable: false });
    }
    if (scanData.node.npmVersion) {
      issues.push({ ruleId: "npm-ok", category: "NODE.JS", title: `npm v${scanData.node.npmVersion} (current)`, description: "", severity: "success", fixable: false });
    }
  } else {
    issues.push({ ruleId: "node-missing", category: "NODE.JS", title: "Node.js is not installed", description: "Node is required for many web tools.", severity: "critical", fixable: false });
  }
  if (scanData.python && !scanData.python.error) {
    const isOldPy = scanData.python.pythonVersion && scanData.python.pythonVersion.startsWith("3.8");
    if (isOldPy) {
      issues.push({ ruleId: "python-outdated", category: "PYTHON", title: `python ${scanData.python.pythonVersion} (Outdated)`, description: "Python 3.8 is EOL. Update to 3.11+", severity: "warning", fixable: false });
    } else {
      issues.push({ ruleId: "python-ok", category: "PYTHON", title: `python ${scanData.python.pythonVersion} (current)`, description: "", severity: "success", fixable: false });
    }
    if (scanData.python.pipVersion) {
      issues.push({ ruleId: "pip-ok", category: "PYTHON", title: `pip ${scanData.python.pipVersion} (current)`, description: "", severity: "success", fixable: false });
    }
  } else {
    issues.push({ ruleId: "python-missing", category: "PYTHON", title: "Python3 is not installed", description: "", severity: "info", fixable: false });
  }
  if (scanData.docker && !scanData.docker.error) {
    issues.push({ ruleId: "docker-ok", category: "DOCKER", title: `${scanData.docker.dockerVersion} (current)`, description: "", severity: "success", fixable: false });
    if (scanData.docker.composeVersion !== "unknown") {
      issues.push({ ruleId: "docker-compose-ok", category: "DOCKER", title: `${scanData.docker.composeVersion} (current)`, description: "", severity: "success", fixable: false });
    }
  } else {
    issues.push({ ruleId: "docker-missing", category: "DOCKER", title: "Docker daemon not reachable", description: "Container capabilities will fail.", severity: "warning", fixable: false });
  }
  addOk("RUST", "rust", scanData.rust);
  addOk("GO", "go", scanData.go);
  addOk("RUBY", "ruby", scanData.ruby);
  addOk("JAVA", "java", scanData.java);
  addOk("PHP", "php", scanData.php);
  if (scanData.git && !scanData.git.error) {
    issues.push({ ruleId: "git-ok", category: "ENVIRONMENT", title: `${scanData.git.gitVersion} (current)`, description: "", severity: "success", fixable: false });
  } else {
    issues.push({ ruleId: "git-missing", category: "ENVIRONMENT", title: "Git is not installed", description: "Version control features will fail.", severity: "critical", fixable: false });
  }
  if (scanData.env) {
    if (scanData.env.hasEnvExample && !scanData.env.hasEnv) {
      issues.push({
        ruleId: "missing-env",
        category: "ENVIRONMENT",
        title: `MISSING .env KEY CONFIGURATION`,
        description: "Copy .env.example to .env to fix this.",
        severity: "warning",
        fixable: true,
        fixCommand: "cp .env.example .env"
      });
    }
    if (scanData.env.hasPackageJson && !scanData.env.hasNodeModules) {
      issues.push({
        ruleId: "missing-node-deps",
        category: "NODE.JS",
        title: `MISSING DEPENDENCIES: node_modules directory not found`,
        description: "Your dependencies have not been installed. Application will not run.",
        severity: "critical",
        fixable: true,
        fixCommand: "npm install"
      });
    }
    if (scanData.env.hasRequirements && !scanData.env.hasVenv) {
      issues.push({
        ruleId: "missing-py-venv",
        category: "PYTHON",
        title: `MISSING DEPENDENCIES: Virtual environment not found`,
        description: "requirements.txt detected but no .venv exists.",
        severity: "warning",
        fixable: true,
        fixCommand: "python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
      });
    }
    if (scanData.env.port5432Bound) {
      issues.push({
        ruleId: "port-conflict",
        category: "DOCKER",
        title: `CONFIG CONFLICT: Port 5432 is already bound locally`,
        description: "Docker postgres will fail to start. Stop local postgres or change compose port maps.",
        severity: "warning",
        fixable: false
      });
    }
  }
  return issues;
}

// src/utils.ts
import * as fs from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
async function checkFileExists(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}
async function readJson(filepath) {
  try {
    const raw = await fs.readFile(filepath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function detectProjectType(cwd) {
  const checks = [
    { file: "package.json", type: "node" },
    { file: "Cargo.toml", type: "rust" },
    { file: "go.mod", type: "go" },
    { file: "requirements.txt", type: "python" },
    { file: "pyproject.toml", type: "python" },
    { file: "pom.xml", type: "java" },
    { file: "build.gradle", type: "java" }
  ];
  let defaultName = path.basename(cwd);
  for (const check of checks) {
    const filePath = path.join(cwd, check.file);
    if (existsSync(filePath)) {
      if (check.file === "package.json") {
        const pkg = await readJson(filePath);
        if (pkg?.name) defaultName = pkg.name;
      }
      return { type: check.type, name: defaultName };
    }
  }
  return { type: "unknown", name: defaultName };
}

// src/core/scanner.ts
import os from "os";
async function scanSystem() {
  const { execSync } = await import("child_process");
  const osType = process.platform;
  let osName = osType;
  let shell = process.env.SHELL || "unknown";
  let brewVersion = "";
  const cpus = os.cpus();
  const isAppleSilicon = cpus.length > 0 && cpus[0].model.includes("Apple");
  const deviceName = isAppleSilicon ? "MacBook (Apple Silicon)" : "Computer";
  if (osType === "darwin") {
    try {
      const swVers = execSync("sw_vers -productVersion", { encoding: "utf8" }).trim();
      osName = `macOS ${swVers}`;
    } catch {
    }
    try {
      brewVersion = " \u2022 Homebrew " + execSync("brew --version", { encoding: "utf8" }).split("\\n")[0].replace("Homebrew ", "");
    } catch {
    }
  } else if (osType === "linux") {
    osName = "Linux";
  } else if (osType === "win32") {
    osName = "Windows";
  }
  let shellName = shell.split("/").pop() || shell;
  try {
    if (shellName !== "unknown") {
      const shellVer = execSync(`${shell} --version`, { encoding: "utf8" }).trim().split(" ")[1] || "";
      shellName = `${shellName} ${shellVer}`.trim();
    }
  } catch {
  }
  return { os: osName, arch: process.arch, nodeTotalMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024), shell: shellName, brew: brewVersion, deviceName };
}
async function scanBin(cmd, cwd, parseFn) {
  const { execSync } = await import("child_process");
  try {
    const stdout = execSync(cmd, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    return parseFn(stdout);
  } catch {
    return { error: `Not installed` };
  }
}
async function scanNode(cwd) {
  const { execSync } = await import("child_process");
  try {
    const nodeVersion = execSync("node -v", { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    const npmVersion = execSync("npm -v", { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    return { nodeVersion, npmVersion };
  } catch {
    return { error: "Node.js not installed" };
  }
}
async function scanDocker(cwd) {
  const { execSync } = await import("child_process");
  try {
    const dockerVersion = execSync("docker --version", { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    let composeVersion = "unknown";
    try {
      composeVersion = execSync("docker compose version", { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    } catch {
    }
    return { dockerVersion, composeVersion };
  } catch {
    return { error: "Docker not installed" };
  }
}
async function scanEnv(cwd) {
  const fs4 = await import("fs");
  const path4 = await import("path");
  const { execSync } = await import("child_process");
  const hasEnv = fs4.existsSync(path4.join(cwd, ".env"));
  const hasEnvExample = fs4.existsSync(path4.join(cwd, ".env.example"));
  const hasNodeModules = fs4.existsSync(path4.join(cwd, "node_modules"));
  const hasVenv = fs4.existsSync(path4.join(cwd, ".venv")) || fs4.existsSync(path4.join(cwd, "venv"));
  const hasPackageJson = fs4.existsSync(path4.join(cwd, "package.json"));
  const hasRequirements = fs4.existsSync(path4.join(cwd, "requirements.txt"));
  let port5432Bound = false;
  let boundProcess = "";
  try {
    const lsof = execSync("lsof -i :5432", { encoding: "utf8" }).trim().split("\\n");
    if (lsof.length > 1) {
      port5432Bound = true;
      boundProcess = lsof[1].split(/\\s+/)[0];
    }
  } catch {
  }
  return { hasEnv, hasEnvExample, hasNodeModules, hasVenv, hasPackageJson, hasRequirements, port5432Bound, boundProcess };
}
async function runScan({ cwd }) {
  const startTime = Date.now();
  const projectMeta = await detectProjectType(cwd);
  const [sys, env, node, py, dr, git, rust, go, rb, java, php] = await Promise.allSettled([
    scanSystem(),
    scanEnv(cwd),
    scanNode(cwd),
    scanBin("python3 --version", cwd, (out) => ({ pythonVersion: out.replace("Python ", "") })),
    scanDocker(cwd),
    scanBin("git --version", cwd, (out) => ({ gitVersion: out })),
    scanBin("rustc --version", cwd, (out) => ({ rustVersion: out.split(" ")[1] })),
    scanBin("go version", cwd, (out) => ({ goVersion: out.split(" ")[2] })),
    scanBin("ruby -v", cwd, (out) => ({ rubyVersion: out.split(" ")[1] })),
    scanBin("java -version", cwd, (out) => ({ javaVersion: out })),
    scanBin("php -v", cwd, (out) => ({ phpVersion: out.split("\\n")[0].split(" ")[1] }))
  ]);
  const p3 = (promise) => promise.status === "fulfilled" ? promise.value : { error: promise.reason?.message };
  const scanData = {
    system: p3(sys),
    env: p3(env),
    node: p3(node),
    python: p3(py),
    docker: p3(dr),
    git: p3(git),
    rust: p3(rust),
    go: p3(go),
    ruby: p3(rb),
    java: p3(java),
    php: p3(php)
  };
  const issues = await runRules(scanData, cwd);
  return {
    issues,
    summary: {
      total: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      fixable: issues.filter((i) => i.fixable).length
    },
    metadata: {
      scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
      cwd,
      elapsedMs: Date.now() - startTime,
      projectType: projectMeta.type,
      projectName: projectMeta.name
    },
    system: scanData.system
  };
}

// src/core/fixer.ts
import * as path2 from "path";
import * as fs2 from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import * as p from "@clack/prompts";
var execAsync = promisify(exec);
async function runFix(issues, { cwd, dryRun }) {
  for (const issue of issues) {
    if (!issue.fix) continue;
    const actionText = getFixDescription(issue.fix);
    if (dryRun) {
      p.log.info(chalk.yellow(`[Dry Run] Would fix '${issue.title}' by: ${actionText}`));
      continue;
    }
    const s = p.spinner();
    s.start(`Applying fix: ${issue.title}`);
    try {
      await applyFix(issue.fix, cwd);
      s.stop(chalk.green(`Fixed: ${issue.title}`));
    } catch (err) {
      s.stop(chalk.red(`Failed: ${issue.title} \u2014 ${err.message}`));
    }
  }
}
function getFixDescription(fix) {
  switch (fix.type) {
    case "shell":
      return `Running command \`${fix.cmd}\``;
    case "create-file":
      return `Creating file \`${fix.path}\``;
    case "create-env-example":
      return `Creating \`.env.example\` from \`.env\``;
    default:
      return "Unknown action";
  }
}
async function applyFix(fix, cwd) {
  switch (fix.type) {
    case "shell": {
      const execCwd = fix.cwd || cwd;
      await execAsync(fix.cmd, { cwd: execCwd });
      break;
    }
    case "create-file": {
      const filePath = path2.join(cwd, fix.path);
      await fs2.writeFile(filePath, fix.content, "utf8");
      break;
    }
    case "create-env-example": {
      const envPath = path2.join(cwd, ".env");
      const examplePath = path2.join(cwd, ".env.example");
      const content = await fs2.readFile(envPath, "utf8");
      const redacted = content.split("\n").map((line) => {
        if (!line.trim() || line.startsWith("#")) return line;
        const [key] = line.split("=");
        return `${key}=`;
      }).join("\n");
      await fs2.writeFile(examplePath, redacted, "utf8");
      break;
    }
  }
}

// src/ai/doctor.ts
import * as fs3 from "fs/promises";
import * as path3 from "path";
import chalk2 from "chalk";
import * as p2 from "@clack/prompts";
import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
async function runDoctor(query, targetFile, cwd) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    p2.log.error("ANTHROPIC_API_KEY is missing in your environment.");
    p2.note("Add it to your .env file or export it: `export ANTHROPIC_API_KEY=sk-ant-...`", "Setup Instructions");
    return;
  }
  let fileContent = "";
  let fileContext = "";
  if (targetFile) {
    const filePath = path3.resolve(cwd, targetFile);
    if (!await checkFileExists(filePath)) {
      p2.log.error(`The specified file does not exist: ${targetFile}`);
      return;
    }
    try {
      const s2 = p2.spinner();
      s2.start(`Reading ${targetFile}...`);
      fileContent = await fs3.readFile(filePath, "utf8");
      s2.stop(`Read ${targetFile} successfully.`);
      fileContext = `
Here is the content of the target file (${targetFile}):
\`\`\`
${fileContent}
\`\`\`
`;
    } catch (err) {
      p2.log.error(`Failed to read file: ${err.message}`);
      return;
    }
  }
  const s = p2.spinner();
  s.start("Asking AI to diagnose the issue...");
  try {
    const anthropicProvider = createAnthropic({ apiKey });
    const { object } = await generateObject({
      model: anthropicProvider("claude-3-5-sonnet-latest"),
      schema: z.object({
        rootCause: z.string().describe("Detailed explanation of why the error is happening."),
        suggestedFix: z.string().describe("Clear, step-by-step instructions or the exact command/code to fix the issue."),
        fixedFileContent: z.string().optional().describe("The complete, rewritten source code of the file with the fix applied. Do not truncate! Provide the full file."),
        confidenceScore: z.number().min(0).max(100).describe("Confidence score in the provided solution (0-100)."),
        isSafeToAutoFix: z.boolean().describe("Whether this fix could be run automatically without breaking other things.")
      }),
      prompt: `You are an expert Senior Software Engineer and DevOps Architect.
The user is experiencing an issue and has asked the following query:
"${query}"
${fileContext}
Analyze the ${targetFile ? "file and the " : ""}query. Provide the root cause, a suggested fix, your confidence score, and indicate if it's safe to auto-fix.`
    });
    s.stop("AI Analysis Complete.");
    p2.note(object.rootCause, "Root Cause");
    p2.note(object.suggestedFix, "Suggested Fix");
    const color = object.confidenceScore > 80 ? chalk2.green : object.confidenceScore > 50 ? chalk2.yellow : chalk2.red;
    p2.log.info(`Confidence Score: ${color(object.confidenceScore.toString() + "%")}`);
    if (targetFile && object.fixedFileContent && object.fixedFileContent.trim() !== fileContent.trim()) {
      const applyFix2 = await p2.confirm({
        message: `Do you want DevHeal to automatically apply this fix to ${targetFile}?`,
        initialValue: true
      });
      if (!p2.isCancel(applyFix2) && applyFix2) {
        const filePath = path3.resolve(cwd, targetFile);
        await fs3.writeFile(filePath, object.fixedFileContent, "utf8");
        p2.log.success(`Successfully applied fix to ${targetFile}!`);
      } else {
        p2.log.info("Fix bypassed.");
      }
    } else if (targetFile) {
      p2.log.info(`No fundamental code changes required for ${targetFile}.`);
    }
  } catch (err) {
    s.stop("AI diagnosis failed.");
    p2.log.error(`AI API Error: ${err.message}`);
  }
}

export {
  runRules,
  runScan,
  runFix,
  runDoctor
};
//# sourceMappingURL=chunk-SFHT2226.js.map