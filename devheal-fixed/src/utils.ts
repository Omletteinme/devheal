import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

export async function checkFileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(filepath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filepath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function detectProjectType(cwd: string): Promise<{ type: string; name: string }> {
  const checks = [
    { file: 'package.json', type: 'node' },
    { file: 'Cargo.toml', type: 'rust' },
    { file: 'go.mod', type: 'go' },
    { file: 'requirements.txt', type: 'python' },
    { file: 'pyproject.toml', type: 'python' },
    { file: 'pom.xml', type: 'java' },
    { file: 'build.gradle', type: 'java' },
  ];

  let defaultName = path.basename(cwd);

  for (const check of checks) {
    const filePath = path.join(cwd, check.file);
    if (existsSync(filePath)) {
      if (check.file === 'package.json') {
        const pkg = await readJson<{ name?: string }>(filePath);
        if (pkg?.name) defaultName = pkg.name;
      }
      return { type: check.type, name: defaultName };
    }
  }

  return { type: 'unknown', name: defaultName };
}
