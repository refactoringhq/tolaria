import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { AgentTokens } from './agentTokenFile.ts'
import { loadConfig } from './config.ts'
import { assertOutsideVault } from './dataPaths.ts'
import { ChangeEmitter } from './changeEmitter.ts'
import { codeFingerprint, SnapshotSeededStore } from './indexSnapshots.ts'
import { INDEX_KEY as SEARCH_INDEX_KEY } from './searchIndex.ts'
import { closeVaultServer, createVaultServer } from './server.ts'
import { isPublicAddress } from './publicAddress.ts'
import { LocalDiskStore, R2BlobStore, type BlobStore, type R2Options } from './store.ts'
import { checkStoreEndpoints } from './storeEndpoint.ts'
import { Vault } from './vault.ts'
import { INDEX_KEY as VAULT_INDEX_KEY } from './vaultIndex.ts'

function log(message: string): void {
  process.stdout.write(`${new Date().toISOString()} ${message}\n`)
}

/** A development MinIO may be private (`TOLARIA_R2_ALLOW_PRIVATE_ENDPOINT`); otherwise every R2 connection must be public. */
function r2Options(config: ReturnType<typeof loadConfig>): R2Options {
  return { isAllowedAddress: config.allowPrivateR2Endpoint ? () => true : isPublicAddress }
}

function createBlobStore(config: ReturnType<typeof loadConfig>): BlobStore {
  if (config.blobStore.type === 'local') {
    return new LocalDiskStore(config.blobStore.stateDir)
  }
  return new R2BlobStore(config.blobStore.config, r2Options(config))
}

/** The blob store, seeded with index snapshots when they are configured; created before the clone so they download meanwhile. */
async function createStore(config: ReturnType<typeof loadConfig>): Promise<{ store: BlobStore; snapshots?: SnapshotSeededStore }> {
  const store = createBlobStore(config)
  if (!config.indexSnapshots) return { store }
  // The bundle this runs from (scripts/run.ts), so snapshots of other server code are never read.
  const code = codeFingerprint(await readFile(fileURLToPath(import.meta.url)))
  const snapshots = new SnapshotSeededStore({
    local: store,
    remote: new R2BlobStore(config.indexSnapshots.r2, r2Options(config)),
    prefix: `${config.indexSnapshots.prefix}/${code}`,
    keys: [VAULT_INDEX_KEY, SEARCH_INDEX_KEY],
    log,
  })
  return { store: snapshots, snapshots }
}

async function main(): Promise<void> {
  const config = loadConfig(process.env)
  const tokens = AgentTokens.load(config.tokensFile, { log })
  log(`agent tokens: ${tokens.size} in ${config.tokensFile}`)
  await checkStoreEndpoints(config)
  const changes = new ChangeEmitter(log)
  const { store, snapshots } = await createStore(config)
  
  log('initializing vault')
  const vault = await Vault.open({
    dir: config.vaultDir,
    remoteUrl: config.remoteUrl,
    branch: config.branch,
    fetchIntervalMs: config.fetchIntervalMs,
    log,
    onVaultEvent: (event) => {
      changes.emit(event)
    },
  })
  log('vault initialized')
  assertOutsideVault(config.tokensFile, config.vaultDir)
  const server = await createVaultServer({
    vault,
    store,
    token: config.token,
    maxBodyBytes: config.maxBodyBytes,
    rateLimit: config.rateLimit,
    collab: config.collab ?? false,
    mcp: config.mcp,
    tokens,
    log,
    changes,
    onReady: () => log('server ready'),
  })
  void snapshots?.publish()
  const stop = (): void => {
    log('shutdown signal received')
    closeVaultServer(server).then(() => snapshots?.publish()).catch((error: unknown) => {
      log(`shutdown failed: ${String(error)}`)
      process.exitCode = 1
    })
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  server.listen(config.port, config.host, () => log(`tolaria server listening on http://${config.host}:${config.port}`))
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
