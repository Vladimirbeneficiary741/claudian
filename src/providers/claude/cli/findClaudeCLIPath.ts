import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parsePathEntries, resolveNvmDefaultBin } from '../../../utils/path';

function getEnvValue(name: string): string | undefined {
  return process.env[name];
}

function dedupePaths(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.filter(entry => {
    const key = process.platform === 'win32' ? entry.toLowerCase() : entry;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushUnique(target: string[], candidate: string | null | undefined): void {
  if (!candidate) return;
  const normalized = process.platform === 'win32'
    ? candidate.toLowerCase()
    : candidate;
  if (target.some(entry => (process.platform === 'win32' ? entry.toLowerCase() : entry) === normalized)) {
    return;
  }
  target.push(candidate);
}

function findFirstExistingPath(entries: string[], candidates: string[]): string | null {
  for (const dir of entries) {
    if (!dir) continue;
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      if (isExistingFile(fullPath)) {
        return fullPath;
      }
    }
  }
  return null;
}

function collectExistingPaths(entries: string[], candidates: string[]): string[] {
  const found: string[] = [];
  for (const dir of entries) {
    if (!dir) continue;
    for (const candidate of candidates) {
      const fullPath = path.join(dir, candidate);
      if (isExistingFile(fullPath)) {
        pushUnique(found, fullPath);
      }
    }
  }
  return found;
}

function isExistingFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      return stat.isFile() && stat.size > 0;
    }
  } catch {
    // Inaccessible path
  }
  return false;
}

function resolveCliJsNearPathEntry(entry: string, isWindows: boolean): string | null {
  const directCandidate = path.join(entry, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
  if (isExistingFile(directCandidate)) {
    return directCandidate;
  }

  const baseName = path.basename(entry).toLowerCase();
  if (baseName === 'bin') {
    const prefix = path.dirname(entry);
    const candidate = isWindows
      ? path.join(prefix, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      : path.join(prefix, 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    if (isExistingFile(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveCliJsFromPathEntries(entries: string[], isWindows: boolean): string | null {
  for (const entry of entries) {
    const candidate = resolveCliJsNearPathEntry(entry, isWindows);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function collectCliJsFromPathEntries(entries: string[], isWindows: boolean): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    pushUnique(found, resolveCliJsNearPathEntry(entry, isWindows));
  }
  return found;
}

function resolveClaudeFromPathEntries(
  entries: string[],
  isWindows: boolean
): string | null {
  if (entries.length === 0) {
    return null;
  }

  if (!isWindows) {
    const unixCandidate = findFirstExistingPath(entries, ['claude']);
    return unixCandidate;
  }

  const exeCandidate = findFirstExistingPath(entries, ['claude.exe', 'claude']);
  if (exeCandidate) {
    return exeCandidate;
  }

  const cliJsCandidate = resolveCliJsFromPathEntries(entries, isWindows);
  if (cliJsCandidate) {
    return cliJsCandidate;
  }

  return null;
}

function collectClaudeFromPathEntries(
  entries: string[],
  isWindows: boolean,
): string[] {
  if (entries.length === 0) {
    return [];
  }

  if (!isWindows) {
    return collectExistingPaths(entries, ['claude']);
  }

  const found = collectExistingPaths(entries, ['claude.exe', 'claude']);
  for (const cliJsCandidate of collectCliJsFromPathEntries(entries, isWindows)) {
    pushUnique(found, cliJsCandidate);
  }
  return found;
}

// Find the newest versioned subdirectory containing exeName under baseDir.
// Used for installer layouts like AppData\Roaming\Claude\claude-code\<ver>\claude.exe.
function findLatestVersionedExe(baseDir: string, exeName: string): string | null {
  return findVersionedExecutables(baseDir, exeName)[0] ?? null;
}

function findVersionedExecutables(baseDir: string, exeName: string): string[] {
  const found: string[] = [];
  try {
    if (!fs.existsSync(baseDir)) return found;
    const entries = fs.readdirSync(baseDir);
    const versionDirs = entries.filter(e => {
      try { return fs.statSync(path.join(baseDir, e)).isDirectory(); } catch { return false; }
    });
    // Sort descending so newest version comes first
    versionDirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
    for (const dir of versionDirs) {
      const candidate = path.join(baseDir, dir, exeName);
      if (isExistingFile(candidate)) {
        pushUnique(found, candidate);
      }
    }
  } catch {
    // Inaccessible directory
  }
  return found;
}

function getNpmGlobalPrefix(): string | null {
  if (process.env.npm_config_prefix) {
    return process.env.npm_config_prefix;
  }

  if (process.platform === 'win32') {
    const appDataNpm = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm')
      : null;
    if (appDataNpm && fs.existsSync(appDataNpm)) {
      return appDataNpm;
    }
  }

  return null;
}

function getNpmCliJsPaths(): string[] {
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';
  const cliJsPaths: string[] = [];

  if (isWindows) {
    cliJsPaths.push(
      path.join(homeDir, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );

    const npmPrefix = getNpmGlobalPrefix();
    if (npmPrefix) {
      cliJsPaths.push(
        path.join(npmPrefix, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      );
    }

    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    cliJsPaths.push(
      path.join(programFiles, 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
      path.join(programFilesX86, 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );

    cliJsPaths.push(
      path.join('D:', 'Program Files', 'nodejs', 'node_global', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
    );
  } else {
    cliJsPaths.push(
      path.join(homeDir, '.npm-global', 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js'),
      '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
      '/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js'
    );

    if (process.env.npm_config_prefix) {
      cliJsPaths.push(
        path.join(process.env.npm_config_prefix, 'lib', 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
      );
    }
  }

  return cliJsPaths;
}

export function findClaudeCLIPath(pathValue?: string): string | null {
  return findClaudeCLICandidates(pathValue)[0] ?? null;
}

export function findClaudeCLICandidates(pathValue?: string): string[] {
  const homeDir = os.homedir();
  const isWindows = process.platform === 'win32';
  const found: string[] = [];

  const customEntries = dedupePaths(parsePathEntries(pathValue));

  if (customEntries.length > 0) {
    for (const customResolution of collectClaudeFromPathEntries(customEntries, isWindows)) {
      pushUnique(found, customResolution);
    }
  }

  // On Windows, prefer native .exe, then cli.js. Avoid .cmd fallback
  // because it requires shell: true and breaks SDK stdio streaming.
  if (isWindows) {
    const exePaths: string[] = [
      path.join(homeDir, '.claude', 'local', 'claude.exe'),
      path.join(homeDir, 'AppData', 'Local', 'Claude', 'claude.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Claude', 'claude.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Claude', 'claude.exe'),
      path.join(homeDir, '.local', 'bin', 'claude.exe'),
    ];

    for (const p of exePaths) {
      if (isExistingFile(p)) {
        pushUnique(found, p);
      }
    }

    // Scan AppData\Roaming\Claude\claude-code\<version>\claude.exe (desktop app installer)
    const roamingClaudeCodeDir = path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude-code');
    for (const roamingExe of findVersionedExecutables(roamingClaudeCodeDir, 'claude.exe')) {
      pushUnique(found, roamingExe);
    }

    const cliJsPaths = getNpmCliJsPaths();
    for (const p of cliJsPaths) {
      if (isExistingFile(p)) {
        pushUnique(found, p);
      }
    }

  }

  const commonPaths: string[] = [
    path.join(homeDir, '.claude', 'local', 'claude'),
    path.join(homeDir, '.local', 'bin', 'claude'),
    path.join(homeDir, '.volta', 'bin', 'claude'),
    path.join(homeDir, '.asdf', 'shims', 'claude'),
    path.join(homeDir, '.asdf', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path.join(homeDir, 'bin', 'claude'),
    path.join(homeDir, '.npm-global', 'bin', 'claude'),
  ];

  const npmPrefix = getNpmGlobalPrefix();
  if (npmPrefix) {
    commonPaths.push(path.join(npmPrefix, 'bin', 'claude'));
  }

  // NVM: resolve default version bin when NVM_BIN env var is not available (GUI apps)
  const nvmBin = resolveNvmDefaultBin(homeDir);
  if (nvmBin) {
    commonPaths.push(path.join(nvmBin, 'claude'));
  }

  for (const p of commonPaths) {
    if (isExistingFile(p)) {
      pushUnique(found, p);
    }
  }

  if (!isWindows) {
    const cliJsPaths = getNpmCliJsPaths();
    for (const p of cliJsPaths) {
      if (isExistingFile(p)) {
        pushUnique(found, p);
      }
    }
  }

  const envEntries = dedupePaths(parsePathEntries(getEnvValue('PATH')));
  if (envEntries.length > 0) {
    for (const envResolution of collectClaudeFromPathEntries(envEntries, isWindows)) {
      pushUnique(found, envResolution);
    }
  }

  return found;
}
