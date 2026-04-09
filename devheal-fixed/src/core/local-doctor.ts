import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import * as p from '@clack/prompts';

export async function runLocalDoctor(targetFile: string, cwd: string) {
  const filePath = path.resolve(cwd, targetFile);

  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (err: any) {
    p.log.error(`Failed to read ${targetFile}.`);
    return;
  }

  const s = p.spinner();
  s.start(`Running local deterministic analysis on ${targetFile}...`);

  const issues: string[] = [];
  const fixes: string[] = [];
  let fixedContent = content;

  // 1. Missing EOF newline
  if (fixedContent.length > 0 && !fixedContent.endsWith('\n')) {
    issues.push("[Configuration Issue] Missing End-Of-File (EOF) newline");
    fixes.push("Append an empty EOF newline to satisfy POSIX terminal standards");
    fixedContent += '\n';
  }

  // 2. Trailing whitespace
  if (/[ \\t]+$/m.test(fixedContent)) {
    issues.push("[Configuration Issue] Trailing whitespace characters padding identified");
    fixes.push("Recursively strip arbitrary trailing whitespace across all lines");
    fixedContent = fixedContent.replace(/[ \\t]+$/gm, '');
  }

  // 3. Mixed or Incorrect Indentation (Tabs vs Spaces)
  const hasTabs = /^\\t+/m.test(fixedContent);
  const hasSpaces = /^ +/m.test(fixedContent);
  if (hasTabs && hasSpaces) {
    issues.push("[Configuration Issue] Mixed indentation strategy (Both tabs & spaces detected)");
    fixes.push("Normalize indentation to uniformly standardize onto 2-spaces format");
    fixedContent = fixedContent.replace(/^\\t+/gm, (match) => '  '.repeat(match.length));
  } else if (hasTabs) {
    issues.push("[Configuration Issue] Tabs used for indentation instead of space standards");
    fixes.push("Convert all rigid tabs into conventional flexible 2-spaces padding");
    fixedContent = fixedContent.replace(/^\\t+/gm, (match) => '  '.repeat(match.length));
  }

  // 4. Deep Heuristic Scanning
  if (targetFile.endsWith('package.json')) {
    try {
       const pkg = JSON.parse(fixedContent);
       let pkgModified = false;
       
       if (!pkg.type || pkg.type !== 'module') {
          issues.push(`[Configuration Issue] Missing strict ESM structure declaration (type: module)`);
          fixes.push(`Force 'type: "module"' to modernize local package resolving`);
          pkg.type = 'module';
          pkgModified = true;
       }

       if (pkg.engines && pkg.engines.node && !pkg.engines.node.includes('20')) {
          issues.push(`[Outdated Version] Dangerous Node Engine Drift detected: ${pkg.engines.node}`);
          fixes.push(`Overwrite package.json engines.node requirement to globally lock onto >=20.0.0 LTS`);
          pkg.engines.node = '>=20.0.0';
          pkgModified = true;
       }
       
       if (pkg.devDependencies) {
          if (pkg.devDependencies['jest'] && (!pkg.devDependencies['@types/jest'] && (!pkg.dependencies || !pkg.dependencies['@types/jest']))) {
              issues.push(`[Missing Dependency] 'jest' testing framework is missing type definitions`);
              fixes.push(`Inject '@types/jest' to resolve compiler type resolution failures`);
              pkg.devDependencies['@types/jest'] = '^29.5.0';
              pkgModified = true;
          }
          if (pkg.devDependencies['tsup'] && (!pkg.devDependencies['typescript'] && (!pkg.dependencies || !pkg.dependencies['typescript']))) {
              issues.push(`[Missing Dependency] 'tsup' bundler requires 'typescript' peer dependency`);
              fixes.push(`Inject 'typescript' compiler to resolve tsup build failures`);
              pkg.devDependencies['typescript'] = '^5.2.0';
              pkgModified = true;
          }
       }
       
       if (pkg.dependencies) {
          if (pkg.dependencies['react'] && (pkg.dependencies['react'].startsWith('^16') || pkg.dependencies['react'].startsWith('^17'))) {
              issues.push(`[Outdated Version] React ${pkg.dependencies['react']} is highly outdated and restricted`);
              fixes.push(`Bump 'react' and 'react-dom' forcefully to stable ^18.2.0`);
              pkg.dependencies['react'] = '^18.2.0';
              if (pkg.dependencies['react-dom']) pkg.dependencies['react-dom'] = '^18.2.0';
              pkgModified = true;
          }
          if (pkg.dependencies['express'] && pkg.dependencies['express'].startsWith('^3')) {
              issues.push(`[Outdated Version] Express v3 is deprecated and vulnerable`);
              fixes.push(`Bump 'express' to stable ^4.18.2`);
              pkg.dependencies['express'] = '^4.18.2';
              pkgModified = true;
          }
       }

       if (pkgModified) {
          fixedContent = JSON.stringify(pkg, null, 2) + '\n';
       }
    } catch (e: any) {
       issues.push(`[Configuration Issue] Malformed or invalid JSON structure detected`);
       fixes.push(`Manual Intervention Required: JSON validation failed (${e.message})`);
    }
  }
  
  if (targetFile.endsWith('.nvmrc')) {
     if (!fixedContent.includes('20')) {
        issues.push(`[Outdated Version] Outdated .nvmrc semantic versioning target`);
        fixes.push(`Rewrite .nvmrc entirely to strictly mandate Node 20.11.0`);
        fixedContent = '20.11.0\n';
     }
  }

  await new Promise(r => setTimeout(r, 450)); 
  s.stop('Algorithmic analysis complete.');

  if (issues.length === 0) {
    p.log.success(chalk.green(`✓ No syntax anomalies or version drift found in ${targetFile}`));
    return;
  }

  p.log.warn(`Identified ${chalk.bold(issues.length)} issues locally without AI telemetry:`);
  for (const issue of issues) {
     console.log(`  ${chalk.red('✗')} ${chalk.gray(issue)}`);
  }

  console.log("");
  p.log.info(`Planned Remediation Steps:`);
  for (const fix of fixes) {
     console.log(`  ${chalk.green('✓')} ${chalk.gray(fix)}`);
  }

  console.log("");
  const apply = await p.confirm({
     message: `Apply deterministic heuristics to locally overwrite the file?`,
     initialValue: true
  });

  if (p.isCancel(apply)) {
     p.outro("Scan aborted.");
     process.exit(0);
  }

  if (apply) {
     await fs.writeFile(filePath, fixedContent, 'utf8');
     p.log.success(`Successfully localized and natively repaired ${targetFile}!`);
  } else {
     p.log.info("Fixes bypassed.");
  }
}
