#!/usr/bin/env node

import { spawn } from 'node:child_process'

const port = process.argv[2] ?? process.env.PORT ?? '41741'

const child = spawn(
  'pnpm',
  ['dev', '--host', '127.0.0.1', '--port', port, '--strictPort'],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
  },
)

function forwardSignal(signal) {
  if (child.killed) return
  child.kill(signal)
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
