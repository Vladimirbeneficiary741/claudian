import type { SpawnedProcess, SpawnOptions } from '@anthropic-ai/claude-agent-sdk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Notice } from 'obsidian';

import { findNodeExecutable } from '../../../utils/env';

const LOG_FILE = path.join(
  process.env.APPDATA || process.env.HOME || '.',
  'claudian-spawn-debug.log',
);

function writeLog(msg: string): void {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch { /* ignore */ }
}

function trimForLog(value: string): string {
  return value.trim().slice(0, 2000);
}

function isClaudeWindowsRuntimeError(text: string): boolean {
  return /uv_spawn\s+'?C:\\WINDOWS\\System32\\reg\.exe'?/i.test(text)
    || /EPERM:\s*operation not permitted.*reg\.exe/i.test(text);
}

/**
 * Build a tiny inline Node.js shim script that spawns the real target process
 * and transparently passes stdin/stdout through. This is used when Electron's
 * renderer-process spawn cannot directly access certain paths (e.g. AppData).
 * The shim runs as a plain OS process and has unrestricted filesystem access.
 */
function buildShimScript(command: string, args: string[], cwd: string): string {
  // JSON.stringify safely encodes backslashes and quotes
  return (
    'const {spawn}=require("child_process");' +
    `const child=spawn(${JSON.stringify(command)},${JSON.stringify(args)},{` +
    `stdio:"inherit",cwd:${JSON.stringify(cwd)},env:process.env` +
    '});' +
    'child.on("exit",function(code){process.exit(code===null?1:code)});' +
    'child.on("error",function(e){process.stderr.write(String(e.message));process.exit(1)});'
  );
}

function buildCaptureShimScript(command: string, args: string[], cwd: string): string {
  return (
    'const {spawn}=require("child_process");' +
    `const child=spawn(${JSON.stringify(command)},${JSON.stringify(args)},{` +
    `stdio:["ignore","pipe","pipe"],cwd:${JSON.stringify(cwd)},env:process.env` +
    '});' +
    'let out="";let err="";' +
    'child.stdout&&child.stdout.on("data",c=>out+=String(c));' +
    'child.stderr&&child.stderr.on("data",c=>err+=String(c));' +
    'child.on("exit",function(code){process.stdout.write(JSON.stringify({code:code===null?1:code,stdout:out,stderr:err}));process.exit(0)});' +
    'child.on("error",function(e){process.stdout.write(JSON.stringify({code:1,stdout:"",stderr:String(e&&e.message||e)}));process.exit(0)});'
  );
}

function buildDetachedShimScript(command: string, args: string[], cwd: string): string {
  return (
    'const {spawn}=require("child_process");' +
    `const child=spawn(${JSON.stringify(command)},${JSON.stringify(args)},{` +
    `stdio:"ignore",cwd:${JSON.stringify(cwd)},env:process.env,detached:true,windowsHide:false` +
    '});' +
    'child.unref();process.exit(0);'
  );
}

/**
 * Env vars that Claude Desktop / the host-app injects when launching a subprocess
 * in "host-managed auth" mode. If these leak into Obsidian (because Obsidian was
 * started from inside a Claude Desktop session), every Claude CLI spawn we do
 * inherits them and the CLI will authenticate with the stale host token instead
 * of the credentials file — producing 401 "Invalid bearer token" even after the
 * user successfully re-logs in via `claude auth login`. Strip them here so the
 * CLI always falls back to its normal credentials-file flow.
 */
const HOST_MANAGED_AUTH_ENV_VARS = [
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST',
  'CLAUDE_CODE_SDK_HAS_OAUTH_REFRESH',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDECODE',
  'CLAUDE_INTERNAL_FC_OVERRIDES',
  'CLAUDE_AGENT_SDK_VERSION',
] as const;

/**
 * Env vars that the CLI treats as "use this API key" if set, even to an empty
 * string. Claude Desktop sometimes injects `ANTHROPIC_API_KEY=""` into child
 * environments; Obsidian inherits it, we pass it to the CLI, and the CLI sends
 * an empty bearer token — producing 403 "Request not allowed" instead of
 * falling back to the OAuth credentials flow. Strip the var entirely whenever
 * it's set to an empty / whitespace-only value.
 */
const EMPTY_API_KEY_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
] as const;

export function stripHostManagedAuthEnv<T extends Record<string, string | undefined>>(env: T): T {
  const cleaned = { ...env };
  for (const key of HOST_MANAGED_AUTH_ENV_VARS) {
    delete cleaned[key];
  }
  for (const key of EMPTY_API_KEY_ENV_VARS) {
    const value = cleaned[key];
    if (typeof value === 'string' && value.trim() === '') {
      delete cleaned[key];
    }
  }
  return cleaned;
}

function sanitizeEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined> | undefined): NodeJS.ProcessEnv | undefined {
  if (!env) return undefined;
  const filtered = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined),
  ) as NodeJS.ProcessEnv;
  return stripHostManagedAuthEnv(filtered as Record<string, string | undefined>) as NodeJS.ProcessEnv;
}

function resolveSpawnCommand(
  command: string,
  enhancedPath: string,
): { command: string; nodeExe: string | null } {
  let resolvedCommand = command;
  if (resolvedCommand === 'node') {
    const nodeFullPath = findNodeExecutable(enhancedPath);
    if (nodeFullPath) {
      resolvedCommand = nodeFullPath;
    }
  }
  return { command: resolvedCommand, nodeExe: findNodeExecutable(enhancedPath) };
}

export interface ClaudeCliCommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runClaudeCliCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    enhancedPath: string;
    timeoutMs?: number;
  },
): Promise<ClaudeCliCommandResult> {
  const { command: resolvedCommand, nodeExe } = resolveSpawnCommand(command, options.enhancedPath);
  const cleanEnv = sanitizeEnv(options.env);

  return await new Promise((resolve, reject) => {
    let child;

    if (nodeExe) {
      const shim = buildCaptureShimScript(resolvedCommand, args, options.cwd);
      child = spawn(nodeExe, ['-e', shim], {
        cwd: options.cwd,
        env: cleanEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
      child = spawn(resolvedCommand, args, {
        cwd: options.cwd,
        env: cleanEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', reject);

    const timeoutMs = options.timeoutMs ?? 7000;
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Claude CLI command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('exit', (code: number | null) => {
      clearTimeout(timeout);
      const stdoutText = Buffer.concat(stdoutChunks).toString('utf8');
      const stderrText = Buffer.concat(stderrChunks).toString('utf8');

      if (nodeExe) {
        try {
          const parsed = JSON.parse(stdoutText || '{}') as Partial<ClaudeCliCommandResult>;
          resolve({
            code: typeof parsed.code === 'number' ? parsed.code : (code ?? 1),
            stdout: parsed.stdout ?? '',
            stderr: parsed.stderr ?? stderrText,
          });
          return;
        } catch {
          // Fall back to raw output
        }
      }

      resolve({
        code: code ?? 1,
        stdout: stdoutText,
        stderr: stderrText,
      });
    });
  });
}

export async function launchClaudeCliDetached(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    enhancedPath: string;
  },
): Promise<void> {
  const { command: resolvedCommand, nodeExe } = resolveSpawnCommand(command, options.enhancedPath);
  const cleanEnv = sanitizeEnv(options.env);

  await new Promise<void>((resolve, reject) => {
    let child;

    if (nodeExe) {
      const shim = buildDetachedShimScript(resolvedCommand, args, options.cwd);
      child = spawn(nodeExe, ['-e', shim], {
        cwd: options.cwd,
        env: cleanEnv,
        stdio: 'ignore',
        detached: true,
        windowsHide: false,
      });
    } else {
      child = spawn(resolvedCommand, args, {
        cwd: options.cwd,
        env: cleanEnv,
        stdio: 'ignore',
        detached: true,
        windowsHide: false,
      });
    }

    child.on('error', reject);
    child.unref();
    resolve();
  });
}

function quoteForCmd(value: string): string {
  if (value.length === 0) return '""';
  if (!/[ \t"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export async function launchClaudeCliInConsoleWindow(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    enhancedPath: string;
    title?: string;
  },
): Promise<void> {
  const { command: resolvedCommand } = resolveSpawnCommand(command, options.enhancedPath);
  const cleanEnv = sanitizeEnv(options.env);
  const windowTitle = options.title ?? 'Claude Code Login';
  const commandLine = [quoteForCmd(resolvedCommand), ...args.map(quoteForCmd)].join(' ');
  writeLog(`LOGIN_WINDOW: title=${windowTitle} cmd=${resolvedCommand} args=${args.join(' ')} cwd=${options.cwd}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'cmd.exe',
      ['/d', '/c', 'start', '', 'cmd.exe', '/k', commandLine],
      {
        cwd: options.cwd,
        env: cleanEnv,
        stdio: 'ignore',
        detached: true,
        windowsHide: false,
      },
    );

    child.on('error', (error) => {
      writeLog(`LOGIN_WINDOW_ERROR: ${error instanceof Error ? error.message : String(error)}`);
      reject(error);
    });
    child.unref();
    resolve();
  });
}

export async function launchUrlInChrome(
  url: string,
  chromePath: string,
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  },
): Promise<void> {
  const cleanEnv = sanitizeEnv(options?.env);
  const cwd = options?.cwd ?? process.cwd();
  writeLog(`LOGIN_BROWSER: chrome=${chromePath} url=${url}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      chromePath,
      [url],
      {
        cwd,
        env: cleanEnv,
        stdio: 'ignore',
        detached: true,
        windowsHide: false,
      },
    );

    child.on('error', (error) => {
      writeLog(`LOGIN_BROWSER_ERROR: ${error instanceof Error ? error.message : String(error)}`);
      reject(error);
    });
    child.unref();
    resolve();
  });
}

export function createCustomSpawnFunction(
  enhancedPath: string
): (options: SpawnOptions) => SpawnedProcess {
  return (options: SpawnOptions): SpawnedProcess => {
    let { command } = options;
    const { args, cwd, env, signal } = options;

    // Resolve full path to avoid PATH lookup issues in GUI apps
    if (command === 'node') {
      const nodeFullPath = findNodeExecutable(enhancedPath);
      if (nodeFullPath) {
        command = nodeFullPath;
      }
    }

    // Diagnostic: test if we can read and execute the file
    let canRead = false, canStat = false;
    try { fs.statSync(command); canStat = true; } catch { /* ignore */ }
    try { const fd = fs.openSync(command, 'r'); fs.closeSync(fd); canRead = true; } catch { /* ignore */ }

    writeLog(`SPAWN: cmd=${command} | args=${args.join(' ')} | cwd=${cwd} | stat=${canStat} read=${canRead} APPDATA=${process.env.APPDATA}`);

    // Filter undefined values from env — Electron renderer's process.env may
    // contain undefined values that corrupt the Windows environment block.
    const cleanEnv = sanitizeEnv(env);

    // Electron renderer cannot directly spawn processes from certain paths
    // (e.g. AppData) due to libuv/Electron restrictions. Work around this by
    // spawning node.exe (in a non-restricted location) with an inline shim
    // script that re-spawns the real target as a normal OS child process.
    const nodeExe = findNodeExecutable(enhancedPath);
    let child;

    if (nodeExe && cwd) {
      writeLog(`SHIM: using node at ${nodeExe}`);
      const shim = buildShimScript(command, args, cwd);
      // Do not pass `signal` directly to spawn() — Obsidian's Electron runtime
      // uses a different realm for AbortSignal. Handle abort manually instead.
      child = spawn(nodeExe, ['-e', shim], {
        cwd,
        env: cleanEnv as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      // Fallback: direct spawn (works on platforms where Electron doesn't restrict)
      child = spawn(command, args, {
        cwd,
        env: cleanEnv as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    child.on('error', (err: NodeJS.ErrnoException) => {
      writeLog(`ERROR: ${err.message} code=${err.code}`);
      new Notice(`[ClaudeSpawn] spawn error: ${err.message} code=${err.code}`, 15000);
    });

    // Capture stderr to diagnose failures
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    if (child.stdout && typeof child.stdout.on === 'function') {
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
    }
    if (child.stderr && typeof child.stderr.on === 'function') {
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
    }

    child.on('exit', (code: number | null) => {
      const stdoutText = Buffer.concat(stdoutChunks).toString('utf8').trim();
      const stderrText = Buffer.concat(stderrChunks).toString('utf8').trim().slice(0, 2000);
      const stdoutPreview = trimForLog(stdoutText);
      writeLog(`EXIT: code=${code} stdout=${stdoutPreview || '(empty)'} stderr=${stderrText || '(empty)'}`);
      // Some Claude helper subprocesses exit with code 1 but no stderr during
      // fallback/retry paths. Those are noisy but not actionable, so only
      // surface a Notice when we have concrete stderr to show the user.
      const diagnosticText = stderrText || stdoutPreview;
      if (code !== 0 && code !== null && diagnosticText && isClaudeWindowsRuntimeError(diagnosticText)) {
        new Notice(
          'Claude Code on this Windows environment is failing before model execution starts (reg.exe EPERM). Claudian will need to fall back to another provider until Claude Code itself is repaired.',
          20000,
        );
        return;
      }
      if (code !== 0 && code !== null && stderrText) {
        new Notice(`[ClaudeSpawn] exit code=${code}\nstderr: ${stderrText.slice(0, 400) || '(empty)'}`, 20000);
      }
    });

    if (signal) {
      if (signal.aborted) {
        child.kill();
      } else {
        signal.addEventListener('abort', () => child.kill(), { once: true });
      }
    }

    if (!child.stdin || !child.stdout) {
      throw new Error('Failed to create process streams');
    }

    return child as unknown as SpawnedProcess;
  };
}
