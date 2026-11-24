import { execFile } from 'node:child_process'

export class GitError extends Error {
  readonly code: number
  readonly stderr: string

  constructor(args: readonly string[], code: number, stderr: string) {
    super(`git ${args.join(' ')} failed (${code}): ${stderr.trim()}`)
    this.name = 'GitError'
    this.code = code
    this.stderr = stderr
  }
}

export interface GitOptions {
  /** Exit codes other than 0 that are an answer rather than a failure. */
  okCodes?: readonly number[]
  timeoutMs?: number
  env?: Record<string, string>
}

export interface GitResult {
  stdout: string
  code: number
}

// Applied to every command, so no repository or user configuration can undo them:
// - paths are data, never pathspec patterns (a note may be called ":(glob)*.md");
// - symlinks are checked out as plain files, so a hostile vault cannot point outside itself.
const FIXED_CONFIG = [
  '--literal-pathspecs',
  '-c',
  'core.symlinks=false',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'core.quotepath=false',
]
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024
// A hook or a parent git process must not redirect the vault's git commands to another repository.
const INHERITED_REPO_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']

function gitEnvironment(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', ...extra }
  for (const name of INHERITED_REPO_VARIABLES) delete env[name]
  return env
}

function exitCode(error: (Error & { code?: unknown }) | null): number {
  if (!error) return 0
  return typeof error.code === 'number' ? error.code : -1
}

/** Runs `git` with an argument vector (no shell) inside `cwd`. */
export function git(cwd: string, args: readonly string[], options: GitOptions = {}): Promise<GitResult> {
  const execOptions = {
    cwd,
    encoding: 'utf8' as const,
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    env: gitEnvironment(options.env),
  }
  return new Promise((resolve, reject) => {
    execFile('git', [...FIXED_CONFIG, ...args], execOptions, (error, stdout, stderr) => {
      const code = exitCode(error)
      if (code === 0 || options.okCodes?.includes(code)) resolve({ stdout, code })
      else reject(new GitError(args, code, stderr || String(error)))
    })
  })
}
