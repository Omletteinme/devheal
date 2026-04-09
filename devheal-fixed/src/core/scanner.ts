import { Issue, ScanResult } from "../types.js";
import { detectProjectType } from "../utils.js";
import { runRules } from "./engine.js";
import os from "os";

async function scanSystem() {
  const { execSync } = await import('child_process');
  const osType = process.platform;
  let osName: string = osType; 
  let shell = process.env.SHELL || 'unknown';
  let brewVersion = '';

  const cpus = os.cpus();
  const isAppleSilicon = cpus.length > 0 && cpus[0].model.includes('Apple');
  const deviceName = isAppleSilicon ? "MacBook (Apple Silicon)" : "Computer";

  if (osType === 'darwin') {
    try {
       const swVers = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
       osName = `macOS ${swVers}`;
    } catch {}
    try {
       brewVersion = ' • Homebrew ' + execSync('brew --version', { encoding: 'utf8' }).split('\\n')[0].replace('Homebrew ', '');
    } catch {}
  } else if (osType === 'linux') {
     osName = 'Linux';
  } else if (osType === 'win32') {
     osName = 'Windows';
  }

  let shellName = shell.split('/').pop() || shell;
  try {
     if (shellName !== 'unknown') {
       const shellVer = execSync(`${shell} --version`, { encoding: 'utf8' }).trim().split(' ')[1] || '';
       shellName = `${shellName} ${shellVer}`.trim();
     }
  } catch {}

  return { os: osName, arch: process.arch, nodeTotalMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024), shell: shellName, brew: brewVersion, deviceName };
}

async function scanBin(cmd: string, cwd: string, parseFn: (out: string) => any) {
  const { execSync } = await import('child_process');
  try {
    const stdout = execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    return parseFn(stdout);
  } catch {
    return { error: `Not installed` };
  }
}

async function scanNode(cwd: string) {
  const { execSync } = await import('child_process');
  try {
    const nodeVersion = execSync('node -v', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const npmVersion = execSync('npm -v', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    return { nodeVersion, npmVersion };
  } catch {
    return { error: "Node.js not installed" };
  }
}

async function scanDocker(cwd: string) {
  const { execSync } = await import('child_process');
  try {
    const dockerVersion = execSync('docker --version', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    let composeVersion = 'unknown';
    try { composeVersion = execSync('docker compose version', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim(); } catch {}
    return { dockerVersion, composeVersion };
  } catch {
    return { error: "Docker not installed" };
  }
}

async function scanEnv(cwd: string) {
  const fs = await import('fs');
  const path = await import('path');
  const { execSync } = await import('child_process');

  const hasEnv = fs.existsSync(path.join(cwd, '.env'));
  const hasEnvExample = fs.existsSync(path.join(cwd, '.env.example'));
  const hasNodeModules = fs.existsSync(path.join(cwd, 'node_modules'));
  const hasVenv = fs.existsSync(path.join(cwd, '.venv')) || fs.existsSync(path.join(cwd, 'venv'));
  const hasPackageJson = fs.existsSync(path.join(cwd, 'package.json'));
  const hasRequirements = fs.existsSync(path.join(cwd, 'requirements.txt'));
  const hasGit = fs.existsSync(path.join(cwd, '.git'));
  
  let port5432Bound = false;
  let boundProcess = '';
  try {
    const lsof = execSync('lsof -i :5432', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\\n');
    if (lsof.length > 1) {
      port5432Bound = true;
      boundProcess = lsof[1].split(/\\s+/)[0];
    }
  } catch {}

  return { hasEnv, hasEnvExample, hasNodeModules, hasVenv, hasPackageJson, hasRequirements, hasGit, port5432Bound, boundProcess };
}

export async function runScan({ cwd }: { cwd: string }): Promise<ScanResult> {
  const startTime = Date.now();
  const projectMeta = await detectProjectType(cwd);

  const [sys, env, node, py, dr, git, rust, go, rb, java, php] = await Promise.allSettled([
    scanSystem(), scanEnv(cwd), scanNode(cwd),
    scanBin('python3 --version', cwd, out => ({ pythonVersion: out.replace('Python ', '') })),
    scanDocker(cwd),
    scanBin('git --version', cwd, out => ({ gitVersion: out })),
    scanBin('rustc --version', cwd, out => ({ rustVersion: out.split(' ')[1] })),
    scanBin('go version', cwd, out => ({ goVersion: out.split(' ')[2] })),
    scanBin('ruby -v', cwd, out => ({ rubyVersion: out.split(' ')[1] })),
    scanBin('java -version', cwd, out => ({ javaVersion: out })),
    scanBin('php -v', cwd, out => ({ phpVersion: out.split('\\n')[0].split(' ')[1] }))
  ]);

  const p = (promise: any) => promise.status === "fulfilled" ? promise.value : { error: promise.reason?.message };

  const scanData = {
    system: p(sys), env: p(env), node: p(node), python: p(py), docker: p(dr), git: p(git),
    rust: p(rust), go: p(go), ruby: p(rb), java: p(java), php: p(php)
  };

  const issues = await runRules(scanData, cwd);

  return {
    issues,
    summary: {
      total: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      fixable: issues.filter((i) => i.fixable).length,
    },
    metadata: {
      scannedAt: new Date().toISOString(), cwd, elapsedMs: Date.now() - startTime,
      projectType: projectMeta.type, projectName: projectMeta.name,
    }, system: scanData.system
  };
}
