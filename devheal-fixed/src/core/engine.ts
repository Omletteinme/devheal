import { Issue } from "../types.js";

export async function runRules(scanData: any, cwd: string): Promise<Issue[]> {
  const issues: Issue[] = [];

  const addOk = (cat: string, name: string, data: any) => {
     if (data && !data.error) {
       issues.push({ ruleId: `${name}-ok`, category: cat, title: `${name} ${data[name+'Version']||''} (current)`, description: "", severity: "success", fixable: false });
     } else {
       issues.push({ ruleId: `${name}-missing`, category: cat, title: `${name} not found in PATH`, description: `If you rely on ${name}, install it.`, severity: "info", fixable: false });
     }
  };

  // NODE.JS
  if (scanData.node && !scanData.node.error) {
    const isOldNode = scanData.node.nodeVersion && (scanData.node.nodeVersion.startsWith('v18') || scanData.node.nodeVersion.startsWith('v16'));
    if (isOldNode) {
      issues.push({
        ruleId: "node-outdated", category: "NODE.JS", title: `node ${scanData.node.nodeVersion} (Outdated)`, description: "Update to Node 20 LTS for security support.", severity: "warning", fixable: true, fixCommand: "nvm install 20 && nvm use 20"
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

  // PYTHON
  if (scanData.python && !scanData.python.error) {
    const isOldPy = scanData.python.pythonVersion && scanData.python.pythonVersion.startsWith('3.8');
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

  // DOCKER
  if (scanData.docker && !scanData.docker.error) {
    issues.push({ ruleId: "docker-ok", category: "DOCKER", title: `${scanData.docker.dockerVersion} (current)`, description: "", severity: "success", fixable: false });
    if (scanData.docker.composeVersion !== 'unknown') {
      issues.push({ ruleId: "docker-compose-ok", category: "DOCKER", title: `${scanData.docker.composeVersion} (current)`, description: "", severity: "success", fixable: false });
    }
  } else {
    issues.push({ ruleId: "docker-missing", category: "DOCKER", title: "Docker daemon not reachable", description: "Container capabilities will fail.", severity: "warning", fixable: false });
  }

  // ADDITIONAL LANGUAGES
  addOk("RUST", "rust", scanData.rust);
  addOk("GO", "go", scanData.go);
  addOk("RUBY", "ruby", scanData.ruby);
  addOk("JAVA", "java", scanData.java);
  addOk("PHP", "php", scanData.php);

  // ENVIRONMENT (Dependencies & Configurations)
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
        fixCommand: "cp .env.example .env",
        fix: { type: "shell", cmd: "node -e \"require('fs').copyFileSync('.env.example', '.env')\"" }
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
        fixCommand: "npm install",
        fix: { type: "shell", cmd: "npm install" }
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
        fixCommand: "python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt",
        fix: { type: "shell", cmd: "python3 -m venv .venv || python -m venv .venv" }
      });
      // Added secondary fix to install dependencies across unix and windows cross-platform.
      issues.push({
        ruleId: "install-py-deps",
        category: "PYTHON",
        title: `INSTALL DEPENDENCIES: Syncing requirements.txt into .venv`,
        description: "",
        severity: "info",
        fixable: true,
        fixCommand: "pip install -r requirements.txt",
        fix: { type: "shell", cmd: ".venv/bin/pip install -r requirements.txt || .venv\\Scripts\\pip install -r requirements.txt" }
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

    if (!scanData.env.hasGit) {
      issues.push({
        ruleId: "missing-git-repo",
        category: "ENVIRONMENT",
        title: `MISSING SOURCE CONTROL (.git)`,
        description: "Project is not version controlled. Code loss is highly likely.",
        severity: "warning",
        fixable: true,
        fixCommand: "git init && git add . && git commit -m \"Initial DevHeal Snapshot\"",
        fix: { type: "shell", cmd: "git init && git add . && git commit -m \"Initial DevHeal Snapshot\"" }
      });
    }
  }

  return issues;
}
