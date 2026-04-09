import * as path from 'path';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import * as p from '@clack/prompts';
import { Issue, FixAction } from '../types.js';

const execAsync = promisify(exec);

export async function runFix(issues: Issue[], { cwd, dryRun }: { cwd: string; dryRun: boolean }) {
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
    } catch (err: any) {
      s.stop(chalk.red(`Failed: ${issue.title} — ${err.message}`));
    }
  }
}

function getFixDescription(fix: FixAction): string {
  switch (fix.type) {
    case 'shell': return `Running command \`${fix.cmd}\``;
    case 'create-file': return `Creating file \`${fix.path}\``;
    case 'create-env-example': return `Creating \`.env.example\` from \`.env\``;
    default: return 'Unknown action';
  }
}

async function applyFix(fix: FixAction, cwd: string) {
  switch (fix.type) {
    case 'shell': {
      const execCwd = fix.cwd || cwd;
      await execAsync(fix.cmd, { cwd: execCwd });
      break;
    }
    case 'create-file': {
      const filePath = path.join(cwd, fix.path);
      await fs.writeFile(filePath, fix.content, 'utf8');
      break;
    }
    case 'create-env-example': {
      const envPath = path.join(cwd, '.env');
      const examplePath = path.join(cwd, '.env.example');
      const content = await fs.readFile(envPath, 'utf8');
      
      const redacted = content
        .split('\n')
        .map(line => {
          if (!line.trim() || line.startsWith('#')) return line;
          const [key] = line.split('=');
          return `${key}=`;
        })
        .join('\n');
        
      await fs.writeFile(examplePath, redacted, 'utf8');
      break;
    }
  }
}
