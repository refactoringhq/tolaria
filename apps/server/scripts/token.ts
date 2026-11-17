// Manages the agent tokens of a Tolaria remote (docs/web/agent-tokens-plan.md):
//
//   pnpm run server:token add --name phone --role viewer [--note <path>]... [--expires-in 30d]
//                             [--author-name <name> --author-email <email>]
//   pnpm run server:token list
//   pnpm run server:token revoke <name or id>
//
// It edits the token file (TOLARIA_SERVER_TOKENS_FILE, or tokens.json in TOLARIA_SERVER_DATA_DIR)
// directly; a running server picks the change up within about a second. Runs under plain
// `node --experimental-strip-types`, so it works in the server's container image as it is.
import { parseArgs } from 'node:util'
import { addAgentToken, formatTokenList, listAgentTokens, revokeAgentToken } from '../src/agentTokenAdmin.ts'
import { dataDirOf, tokensFileOf } from '../src/dataPaths.ts'

const USAGE = 'usage: server:token add --name <name> --role viewer|editor [--note <path>]... [--expires-in <n>m|h|d] | list | revoke <name or id>'

function add(file: string, args: string[]): string {
  const { values } = parseArgs({
    args,
    options: {
      name: { type: 'string' },
      role: { type: 'string' },
      note: { type: 'string', multiple: true },
      'expires-in': { type: 'string' },
      'author-name': { type: 'string' },
      'author-email': { type: 'string' },
    },
  })
  if (values.name === undefined || values.role === undefined) throw new Error('add needs --name and --role')
  const { credential, token } = addAgentToken(file, {
    name: values.name,
    role: values.role,
    notes: values.note,
    expiresIn: values['expires-in'],
    authorName: values['author-name'],
    authorEmail: values['author-email'],
  })
  return [
    `Added token ${token.name} (${token.id}): ${token.role} on the ${token.scope}.`,
    '',
    `  ${credential}`,
    '',
    'Copy it now: it will not be shown again. Send it as "Authorization: Bearer <token>".',
  ].join('\n')
}

function revoke(file: string, args: string[]): string {
  const { positionals } = parseArgs({ args, allowPositionals: true })
  if (positionals.length !== 1) throw new Error('revoke needs one name or id')
  const token = revokeAgentToken(file, positionals[0])
  return `Revoked token ${token.name} (${token.id}).`
}

function main(argv: string[]): string {
  const [command, ...args] = argv
  const file = tokensFileOf(process.env, dataDirOf(process.env))
  if (command === 'add') return add(file, args)
  if (command === 'list') return formatTokenList(listAgentTokens(file))
  if (command === 'revoke') return revoke(file, args)
  throw new Error(USAGE)
}

try {
  process.stdout.write(`${main(process.argv.slice(2))}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
