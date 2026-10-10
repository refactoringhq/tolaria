import git from 'isomorphic-git'
import type { GitVaultContext } from './gitVault'

export const gitCheckoutJournalName = 'tolaria-checkout.json'
type CheckoutJournal = { version: 1; branch: string; before: string; target: string }

export async function checkoutGitFastForward(context: GitVaultContext, branch: string, target: string) {
  const before = await git.resolveRef({ ...context, ref: 'HEAD' })
  const journal: CheckoutJournal = { version: 1, branch, before, target }
  // Publish intent before changing files; leave it in place on any failure.
  await promises(context).writeFile(journalPath(context), JSON.stringify(journal), 'utf8')
  await finishCheckout(context, journal)
}

export async function recoverGitCheckout(context: GitVaultContext) {
  const journal = await readJournal(context)
  if (!journal) return
  await finishCheckout(context, journal)
}

async function finishCheckout(context: GitVaultContext, journal: CheckoutJournal) {
  await validateCheckoutHead(context, journal)
  // Never force: unexpected changes must stop recovery instead of being discarded.
  await git.checkout({ ...context, ref: journal.target, noUpdateHead: true, nonBlocking: true, batchSize: 20 })
  await git.merge({ ...context, ours: journal.branch, theirs: journal.target, fastForwardOnly: true })
  await promises(context).unlink(journalPath(context))
}

async function validateCheckoutHead(context: GitVaultContext, journal: CheckoutJournal) {
  const branch = await git.currentBranch(context)
  const head = await git.resolveRef({ ...context, ref: 'HEAD' })
  if (branch !== journal.branch || ![journal.before, journal.target].includes(head)) {
    throw new Error('checkoutRecoveryHeadChanged')
  }
  if (!(await git.isDescendent({ ...context, oid: journal.target, ancestor: journal.before }))) {
    throw new Error('checkoutRecoveryNotFastForward')
  }
}

async function readJournal(context: GitVaultContext): Promise<CheckoutJournal | null> {
  let content: unknown
  try {
    content = await promises(context).readFile(journalPath(context), 'utf8')
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
  const value: unknown = JSON.parse(String(content))
  if (!validJournal(value)) throw new Error('invalidCheckoutRecovery')
  return value
}

function validJournal(value: unknown): value is CheckoutJournal {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return item.version === 1 && typeof item.branch === 'string'
    && /^[a-f0-9]{40}$/u.test(String(item.before)) && /^[a-f0-9]{40}$/u.test(String(item.target))
}

function isMissing(error: unknown) {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
}

function promises({ fs }: GitVaultContext) {
  if (!('promises' in fs)) throw new Error('asyncGitFileSystemRequired')
  return fs.promises
}

function journalPath({ dir }: GitVaultContext) {
  return `${dir}/.git/${gitCheckoutJournalName}`
}
