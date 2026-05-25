#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const ignoredDirNames = new Set([
  '.git',
  'node_modules',
  'coverage',
  'test-results',
  'dist',
  'build',
]);

const skippedBinaryExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.zip',
  '.tgz',
  '.pdf',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

const forbiddenPatterns = [
  { label: 'Local workspace path', regex: /d:\\dachen\\dachen wiki/i },
  { label: 'Specific Windows user path', regex: /c:\\users\\86188/i },
  { label: 'Private key-like literal', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { label: 'User profile secrets path', regex: /c:\\users\\[^\\\r\n]+\\\.(claudian|codex|claude)\\/i },
];

const runtimeArtifacts = ['.claudian', '.obsidian', '.env.local', 'CLAUDE.md', 'AGENTS.md'];

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirNames.has(entry.name)) continue;
      yield* walk(fullPath);
      continue;
    }
    yield fullPath;
  }
}

const findings = [];

for (const artifact of runtimeArtifacts) {
  if (fs.existsSync(path.join(root, artifact))) {
    findings.push(`Runtime or internal artifact present: ${artifact}`);
  }
}

const packageJsonPath = path.join(root, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readUtf8(packageJsonPath));
  if (packageJson.author) {
    findings.push('package.json author must be blank for the public release copy.');
  }
}

const manifestPath = path.join(root, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(readUtf8(manifestPath));
  if (manifest.author) {
    findings.push('manifest.json author must be blank for the public release copy.');
  }
}

for (const filePath of walk(root)) {
  if (skippedBinaryExtensions.has(path.extname(filePath).toLowerCase())) continue;
  const relativePath = path.relative(root, filePath);
  let text = '';
  try {
    text = readUtf8(filePath);
  } catch {
    continue;
  }
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(text)) {
      findings.push(`${relativePath}: ${pattern.label}`);
    }
  }
}

if (findings.length) {
  console.error('Public release audit failed:\n');
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`Public release audit passed for ${root}`);
