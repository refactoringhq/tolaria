import { Directory, File, Paths } from 'expo-file-system'
import type { ManagedLocalVault } from './managedLocalVaults'
import { withWorkspaceOperation } from './workspaceOperationQueue'

type StarterTemplate = {
  label: string
  revision: string
  populate: (directory: Directory) => Promise<void>
}
type Preparation = { version: 1; label: string; revision: string }

const directoryName = 'Local Vaults/getting-started'
const configDirectory = '.tolaria-mobile-config'
const stagingDirectory = () => new Directory(Paths.document, configDirectory, 'starter-vault-staging')
const markerFile = (suffix = '') => new File(Paths.document, configDirectory, `starter-vault.json${suffix}`)

export function prepareStarterVault(template: StarterTemplate): Promise<ManagedLocalVault | null> {
  return withWorkspaceOperation('starter-vault-preparation', () => prepare(template))
}

async function prepare(template: StarterTemplate): Promise<ManagedLocalVault | null> {
  const record = await preparationRecord(template)
  if (!record) return null
  const destination = new Directory(Paths.document, directoryName)
  const staging = stagingDirectory()
  assertNoOtherVaults(destination)
  if (destination.exists) {
    if (staging.exists) throw new Error('starterVaultRecoveryRequired')
    return vaultRecord(record)
  }
  if (record.revision !== template.revision) throw new Error('starterVaultRecoveryRequired')
  await publishPreparedDirectory(template, staging, destination)
  return vaultRecord(record)
}

async function publishPreparedDirectory(template: StarterTemplate, staging: Directory, destination: Directory) {
  staging.create({ intermediates: true, idempotent: true })
  await template.populate(staging)
  destination.parentDirectory.create({ intermediates: true, idempotent: true })
  if (destination.exists) throw new Error('starterVaultRecoveryRequired')
  // Publish the complete tree once. Catalog retries must never recopy user files.
  await staging.move(destination)
}

async function preparationRecord(template: StarterTemplate): Promise<Preparation | null> {
  const marker = markerFile()
  if (marker.exists) return parsePreparation(await marker.text())
  const pending = markerFile('.pending')
  if (pending.exists) return recoverPendingMarker(pending, marker)
  if (stagingDirectory().exists) throw new Error('starterVaultRecoveryRequired')
  if (hasPriorCatalog()) return null
  if (hasVaultDirectories()) throw new Error('starterVaultRecoveryRequired')
  const record = parsePreparation(JSON.stringify({ version: 1, label: template.label, revision: template.revision }))
  pending.parentDirectory.create({ intermediates: true, idempotent: true })
  pending.write(JSON.stringify(record))
  const verified = parsePreparation(await pending.text())
  await pending.move(marker)
  return verified
}

async function recoverPendingMarker(pending: File, marker: File) {
  if (hasPriorCatalog() || hasVaultDirectories() || stagingDirectory().exists) throw new Error('starterVaultRecoveryRequired')
  const record = parsePreparation(await pending.text())
  await pending.move(marker)
  return record
}

function hasVaultDirectories() {
  return ['Tolaria Vault', 'Local Vaults', 'Git Vaults']
    .some(path => new Directory(Paths.document, path).exists)
}

function hasPriorCatalog() {
  return ['', '.backup', '.pending']
    .some(suffix => new File(Paths.document, configDirectory, `git-vaults.json${suffix}`).exists)
}

function assertNoOtherVaults(destination: Directory) {
  const otherRootExists = ['Tolaria Vault', 'Git Vaults'].some(path => new Directory(Paths.document, path).exists)
  if (otherRootExists) throw new Error('starterVaultRecoveryRequired')
  const local = destination.parentDirectory
  if (!local.exists) return
  if (local.list().some(entry => entry.uri !== destination.uri)) throw new Error('starterVaultRecoveryRequired')
}

function parsePreparation(source: string): Preparation {
  const value: unknown = JSON.parse(source)
  if (!validPreparation(value)) throw new Error('starterVaultRecoveryRequired')
  return { version: 1, label: value.label, revision: value.revision }
}

function validPreparation(value: unknown): value is Preparation {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<Preparation>
  return record.version === 1 && validLabel(record.label) && validRevision(record.revision)
}

function validLabel(label: unknown): label is string {
  return typeof label === 'string' && label.trim().length > 0 && label.length <= 200
}

function validRevision(revision: unknown): revision is string {
  return typeof revision === 'string' && /^[a-f0-9]{40}$/u.test(revision)
}

function vaultRecord(record: Preparation): ManagedLocalVault {
  return { id: 'getting-started', label: record.label, directory: directoryName }
}
