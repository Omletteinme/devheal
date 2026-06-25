import { Command } from "commander";
import * as dotenv from "dotenv";
import { fileURLToPath } from 'url';
import * as path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
import * as p from "@clack/prompts";
import chalk from "chalk";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { runScan } from "./core/scanner.js";
import { runFix } from "./core/fixer.js";
import { runDoctor } from "./ai/doctor.js";
import { runLocalDoctor } from "./core/local-doctor.js";
import { ScanResult } from "./types.js";

const program = new Command();

program
  .name("devheal")
  .description("DevHeal Engine - AI-powered dev environment health monitor")
  .version("2.1.0")
  .addHelpText('beforeAll', `\n${chalk.bgMagenta.white.bold(' 🤖 DevHeal Operations Framework v2.1.0 ')}\n${chalk.gray('The autonomous AI-powered environment stabilizer and fixer.')}\n`);

function renderDashboard(results: ScanResult) {
  let score = 100;
  score -= results.summary.critical * 25;
  score -= results.summary.warning * 10;
  if (score < 0) score = 0;

  const width = process.stdout.columns ? Math.min(process.stdout.columns, 80) : 70;
  
  const elapsedSeconds = (results.metadata.elapsedMs / 1000).toFixed(2);
  const headerContent = `  devheal v2.1.0 • scan completed in ${elapsedSeconds}s • Node.js core  `;
  const paddingLength = width - 4 - headerContent.length;
  const padding = paddingLength > 0 ? " ".repeat(paddingLength) : "";

  console.log("");
  console.log(chalk.gray(`╔${"═".repeat(width - 2)}╗`));
  console.log(chalk.gray(`║${chalk.bold.white(headerContent)}${padding}║`));
  console.log(chalk.gray(`╚${"═".repeat(width - 2)}╝`));
  console.log("");

  const systemStr = results.system ? `${results.system.deviceName} (${results.system.os}) • ${results.system.shell}${results.system.brew}` : `Unknown System`;
  console.log(`  ${chalk.white(systemStr)}`);
  console.log(`  Project: ${chalk.cyan(results.metadata.cwd)} (${chalk.blue(results.metadata.projectType)})`);
  console.log("");

  const scoreColor = score >= 90 ? chalk.green : score >= 60 ? chalk.yellow : chalk.red;
  console.log(`  ${chalk.bold("Health score:")} ${scoreColor(`${score}`)} / 100`);
  
  const critCount = results.issues.filter(i => i.severity === 'critical').length;
  const warnCount = results.issues.filter(i => i.severity === 'warning').length;
  const infoCount = results.issues.filter(i => i.severity === 'info').length;

  const critLabel = critCount > 0 ? chalk.red(`✗ ${critCount} critical`) : chalk.gray(`✗ 0 critical`);
  const warnLabel = warnCount > 0 ? chalk.yellow(`⚠ ${warnCount} warnings`) : chalk.gray(`⚠ 0 warnings`);
  const infoLabel = infoCount > 0 ? chalk.blue(`ℹ ${infoCount} info`) : chalk.gray(`ℹ 0 info`);
  console.log(`  ${critLabel}  ${warnLabel}  ${infoLabel}`);
  console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

  const grouped = results.issues.reduce((acc: any, issue: any) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {});

  for (const [category, items] of Object.entries(grouped)) {
    console.log(chalk.bold.white(category));
    for (const issue of items as any[]) {
      if (issue.severity === "success") {
        console.log(`✓ ${issue.title}`);
      } else {
        const icon = issue.severity === "critical" ? "✗" : issue.severity === "warning" ? "⚠" : "ℹ";
        const color = issue.severity === "critical" ? chalk.red : issue.severity === "warning" ? chalk.yellow : chalk.blue;
        
        console.log(`${color(icon)} ${color(issue.title.replace(/\\\\n/g, '\\n  '))}`);
        
        if (issue.description) {
          const prefix = issue.severity === "critical" ? chalk.red("CRITICAL: ") : issue.severity === "warning" ? chalk.yellow("WARNING: ") : "";
          console.log(`  ${prefix}${chalk.gray(issue.description.replace(/\\\\n/g, '\\n  '))}`);
        }
        
        if (issue.fixCommand) {
          if (issue.fixable) {
            console.log(`  ${chalk.green.bold("Auto-fix:")} ${chalk.green(issue.fixCommand)}`);
          } else {
            console.log(`  ${chalk.gray.bold("Fix:")} ${issue.fixCommand}`);
          }
        }
      }
    }
    console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  }

  return score;
}

program
  .command("scan")
  .description("Launch the DevHeal diagnostic dashboard")
  .option("-p, --path <dir>", "Project directory to scan", process.cwd())
  .option("--json", "Output results as JSON (for CI/CD pipeline gating)")
  .option("--fix", "Auto-fix safe issues without interactive prompt")
  .action(async (opts) => {
      const s = p.spinner();

      try {
        if (!opts.json) s.start('Analyzing architectural layer dependencies...');

        const results = await runScan({ cwd: opts.path });

        if (!opts.json) s.stop('Analysis complete.');

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        process.exit(results.summary.critical > 0 ? 1 : 0);
      } else {
        const score = renderDashboard(results);

        if (results.summary.fixable > 0) {
          if (opts.fix) {
            p.log.info("Auto-fix flag detected. Applying all safe fixes...");
            await runFix(results.issues.filter((i) => i.fixable), { cwd: opts.path, dryRun: false });
          } else {
            const apply = await p.confirm({
              message: `There are ${chalk.bold(results.summary.fixable)} auto-fixable issues. Do you want DevHeal to heal them automatically?`,
              initialValue: true,
            });

            if (p.isCancel(apply)) {
              p.outro("Scan aborted.");
              process.exit(0);
            }

            if (apply) {
              await runFix(results.issues.filter((i) => i.fixable), { cwd: opts.path, dryRun: false });
              p.log.success("Environment healed successfully.");
            } else {
              p.log.info("Fixes bypassed. You can run `devheal fix` at any time.");
            }
          }
        }

      }

      process.exit(results.summary.critical > 0 ? 1 : 0);

    } catch (err: any) {
      if (!opts.json) {
        s.stop('Diagnostic failure!');
        p.log.error(`Platform Error: ${err.message}`);
        p.outro('Disconnected.');
      } else {
        console.error(JSON.stringify({ error: err.message }));
      }
      process.exit(2);
    }
  });

program
  .command("fix [target]")
  .description("Apply safe fixes locally, or auto-fix a specific file without AI")
  .option("-p, --path <dir>", "Project directory", process.cwd())
  .option("--dry-run", "Preview fixes without applying them", false)
  .action(async (target, opts) => {
    p.intro(chalk.bgMagenta.white.bold(' 🔧 DevHeal Local Engine '));

    if (target) {
      const fsPath = await import('fs');
      if (fsPath.existsSync(target)) {
        await runLocalDoctor(target, opts.path);
        p.outro("File scan complete.");
        return;
      }
    }

    const s = p.spinner();
    s.start('Scanning for fixable state anomalies...');
    
    const results = await runScan({ cwd: opts.path });
    s.stop('Dependencies compiled.');

    const fixable = results.issues.filter((i) => i.fixable);
    if (fixable.length === 0) {
      p.log.success("No fixable issues found. Environment is stable.");
      p.outro("Done");
      return;
    }

    await runFix(fixable, { cwd: opts.path, dryRun: opts.dryRun });
    p.outro("Environment repaired flawlessly.");
  });

program
  .command("report")
  .description("Dump CI/CD compliant logs without UI interactivity")
  .option("-p, --path <dir>", "Project directory", process.cwd())
  .action(async (opts) => {
     try {
        const results = await runScan({ cwd: opts.path });
        console.log(JSON.stringify(results, null, 2));
        process.exit(results.summary.critical > 0 ? 1 : 0);
     } catch (err: any) {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(2);
     }
  });

program
  .command("init")
  .description("Instantly initialize a secure DevHeal-tracked Git repository")
  .option("-p, --path <dir>", "Project directory", process.cwd())
  .action(async (opts) => {
    p.intro(chalk.bgCyan.black.bold(' 🏗️ DevHeal Git Controller '));
    const s = p.spinner();
    s.start('Scaffolding a secure version-controlled architecture...');
    try {
      const { execSync } = await import('child_process');
      execSync('git init', { cwd: opts.path, encoding: 'utf8', stdio: 'ignore' });
      execSync('git add .', { cwd: opts.path, encoding: 'utf8', stdio: 'ignore' });
      try {
         execSync('git commit -m "Initial DevHeal Snapshot"', { cwd: opts.path, encoding: 'utf8', stdio: 'ignore' });
      } catch (e) {
         // Fails safely if tree is entirely clean and snapshot already exists actively.
      }
      s.stop(chalk.green('Repository successfully initialized and securely snapshot.'));
      p.outro("Environment is fully tracked and ready for automated healing loops!");
    } catch (err: any) {
      s.stop(chalk.red('Failed to initialize Git repository. Is Git installed?'));
      p.outro('Disconnected.');
      process.exit(1);
    }
  });

program
  .command("rollback")
  .description("Safely revert the current project repository to its last stable Git snapshot (The 'Undo' Button)")
  .option("-p, --path <dir>", "Project directory", process.cwd())
  .action(async (opts) => {
    p.intro(chalk.bgRed.white.bold(' ⏪ DevHeal Rollback Engine '));
    
    p.log.warn(chalk.yellow("WARNING: This will instantly override ALL uncommitted filesystem changes and permanently delete untracked files!"));
    const apply = await p.confirm({
      message: `Are you absolutely certain you want to rewind your project state back to the last snapshot?`,
      initialValue: false,
    });

    if (p.isCancel(apply) || !apply) {
      p.outro("Rollback aborted. Your current changes have been kept safe.");
      process.exit(0);
    }

    const s = p.spinner();
    s.start('Initiating secure system rollback sequence...');
    try {
      const { execSync } = await import('child_process');
      // Perform strict reset removing hallucinated edits entirely.
      execSync('git reset --hard HEAD && git clean -fd', { cwd: opts.path, encoding: 'utf8', stdio: 'ignore' });
      s.stop(chalk.green('Project state flawlessly completely rolled back to the last formal repository baseline snapshot!'));
      p.outro("System restored.");
    } catch (err: any) {
      s.stop(chalk.red('Failed to rewind the environment framework. Does a snapshot actually exist?'));
      p.outro('Disconnected.');
      process.exit(1);
    }
  });

program.parse(process.argv);

if (process.argv.length < 3) {
  program.help();
}
