import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { invoke } from '@tauri-apps/api/core'
import { isTauri, mockInvoke } from '../mock-tauri'
import type { GithubRepo } from '../types'

function tauriCall<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return isTauri() ? invoke<T>(cmd, args) : mockInvoke<T>(cmd, args)
}

interface GitHubVaultModalProps {
  open: boolean
  githubToken: string | null
  onClose: () => void
  onVaultCloned: (path: string, label: string) => void
  onOpenSettings: () => void
}

type CloneStatus = 'idle' | 'cloning' | 'success' | 'error'

function RepoListItem({ repo, selected, onSelect }: { repo: GithubRepo; selected: boolean; onSelect: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={`flex flex-col gap-1 rounded-md px-3 py-2.5 cursor-pointer transition-colors ${
        selected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
      data-testid={`repo-item-${repo.name}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{repo.full_name}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {repo.private ? 'Private' : 'Public'}
        </Badge>
      </div>
      {repo.description && (
        <span className="text-xs text-muted-foreground line-clamp-1">{repo.description}</span>
      )}
    </div>
  )
}

function CloneTab({
  repos,
  loading,
  search,
  setSearch,
  selectedRepo,
  setSelectedRepo,
  localPath,
  setLocalPath,
  onClone,
  cloneStatus,
  cloneError,
}: {
  repos: GithubRepo[]
  loading: boolean
  search: string
  setSearch: (v: string) => void
  selectedRepo: GithubRepo | null
  setSelectedRepo: (r: GithubRepo) => void
  localPath: string
  setLocalPath: (v: string) => void
  onClone: () => void
  cloneStatus: CloneStatus
  cloneError: string | null
}) {
  const filtered = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  )

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <Input
        placeholder="Search repos or paste URL..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        data-testid="github-repo-search"
      />

      <div className="flex-1 overflow-y-auto border border-border rounded-md min-h-[180px] max-h-[240px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Loading repositories...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {search ? 'No repos match your search' : 'No repositories found'}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-1">
            {filtered.map(repo => (
              <RepoListItem
                key={repo.full_name}
                repo={repo}
                selected={selectedRepo?.full_name === repo.full_name}
                onSelect={() => setSelectedRepo(repo)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Clone to:</label>
        <Input
          value={localPath}
          onChange={e => setLocalPath(e.target.value)}
          placeholder="~/Vaults/repo-name"
          data-testid="github-clone-path"
        />
      </div>

      {cloneError && (
        <p className="text-xs text-destructive">{cloneError}</p>
      )}

      <DialogFooter className="flex-row items-center justify-between sm:justify-between">
        <span className="text-[11px] text-muted-foreground">
          {filtered.length} repo{filtered.length !== 1 ? 's' : ''} found
        </span>
        <Button
          onClick={onClone}
          disabled={!selectedRepo || !localPath.trim() || cloneStatus === 'cloning'}
          data-testid="github-clone-btn"
        >
          {cloneStatus === 'cloning' ? 'Cloning...' : 'Clone & Open'}
        </Button>
      </DialogFooter>
    </div>
  )
}

function CreateTab({
  repoName,
  setRepoName,
  isPrivate,
  setIsPrivate,
  localPath,
  setLocalPath,
  onCreate,
  cloneStatus,
  cloneError,
}: {
  repoName: string
  setRepoName: (v: string) => void
  isPrivate: boolean
  setIsPrivate: (v: boolean) => void
  localPath: string
  setLocalPath: (v: string) => void
  onCreate: () => void
  cloneStatus: CloneStatus
  cloneError: string | null
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Repository name</label>
        <Input
          value={repoName}
          onChange={e => setRepoName(e.target.value)}
          placeholder="my-vault"
          data-testid="github-repo-name"
        />
        {repoName && (
          <span className="text-[11px] text-muted-foreground">
            github.com/you/{repoName}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">Visibility</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsPrivate(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              isPrivate
                ? 'border-ring bg-accent text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
            data-testid="github-visibility-private"
          >
            Private
          </button>
          <button
            type="button"
            onClick={() => setIsPrivate(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              !isPrivate
                ? 'border-ring bg-accent text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
            data-testid="github-visibility-public"
          >
            Public
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Clone to:</label>
        <Input
          value={localPath}
          onChange={e => setLocalPath(e.target.value)}
          placeholder="~/Vaults/my-vault"
          data-testid="github-create-path"
        />
      </div>

      {cloneError && (
        <p className="text-xs text-destructive">{cloneError}</p>
      )}

      <DialogFooter className="flex-row items-center justify-end sm:justify-end">
        <Button
          onClick={onCreate}
          disabled={!repoName.trim() || !localPath.trim() || cloneStatus === 'cloning'}
          data-testid="github-create-btn"
        >
          {cloneStatus === 'cloning' ? 'Creating...' : 'Create & Clone'}
        </Button>
      </DialogFooter>
    </div>
  )
}

function CloningProgress({ repoName }: { repoName: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8" data-testid="clone-progress">
      <div className="h-10 w-10 rounded-full border-[3px] border-ring border-t-transparent animate-spin" />
      <p className="text-sm font-medium text-foreground">Cloning {repoName}...</p>
      <p className="text-xs text-muted-foreground">This may take a moment for large repositories</p>
    </div>
  )
}

export function GitHubVaultModal({ open, githubToken, onClose, onVaultCloned, onOpenSettings }: GitHubVaultModalProps) {
  const [tab, setTab] = useState('clone')
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null)
  const [clonePath, setClonePath] = useState('')
  const [repoName, setRepoName] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [createPath, setCreatePath] = useState('')
  const [cloneStatus, setCloneStatus] = useState<CloneStatus>('idle')
  const [cloneError, setCloneError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  const loadRepos = useCallback(async () => {
    if (!githubToken) return
    setLoading(true)
    try {
      const result = await tauriCall<GithubRepo[]>('github_list_repos', { token: githubToken })
      setRepos(result)
    } catch (err) {
      console.error('Failed to load GitHub repos:', err)
      setCloneError(`Failed to load repos: ${err}`)
    } finally {
      setLoading(false)
    }
  }, [githubToken])

  useEffect(() => {
    if (open && githubToken && !loadedRef.current) {
      loadedRef.current = true
      loadRepos()
    }
    if (!open) {
      loadedRef.current = false
    }
  }, [open, githubToken, loadRepos])

  // Auto-fill clone path when repo selected
  useEffect(() => {
    if (selectedRepo) {
      setClonePath(`~/Vaults/${selectedRepo.name}`)
    }
  }, [selectedRepo])

  // Auto-fill create path when name changes
  useEffect(() => {
    if (repoName) {
      setCreatePath(`~/Vaults/${repoName}`)
    }
  }, [repoName])

  const resetState = useCallback(() => {
    setTab('clone')
    setSearch('')
    setSelectedRepo(null)
    setClonePath('')
    setRepoName('')
    setIsPrivate(true)
    setCreatePath('')
    setCloneStatus('idle')
    setCloneError(null)
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [onClose, resetState])

  const handleClone = useCallback(async () => {
    if (!selectedRepo || !clonePath.trim() || !githubToken) return
    setCloneStatus('cloning')
    setCloneError(null)
    try {
      await tauriCall<string>('clone_repo', {
        url: selectedRepo.clone_url,
        token: githubToken,
        localPath: clonePath.trim(),
      })
      setCloneStatus('success')
      onVaultCloned(clonePath.trim(), selectedRepo.name)
      handleClose()
    } catch (err) {
      setCloneStatus('error')
      setCloneError(`Clone failed: ${err}`)
    }
  }, [selectedRepo, clonePath, githubToken, onVaultCloned, handleClose])

  const handleCreate = useCallback(async () => {
    if (!repoName.trim() || !createPath.trim() || !githubToken) return
    setCloneStatus('cloning')
    setCloneError(null)
    try {
      const repo = await tauriCall<GithubRepo>('github_create_repo', {
        token: githubToken,
        name: repoName.trim(),
        private: isPrivate,
      })
      await tauriCall<string>('clone_repo', {
        url: repo.clone_url,
        token: githubToken,
        localPath: createPath.trim(),
      })
      setCloneStatus('success')
      onVaultCloned(createPath.trim(), repo.name)
      handleClose()
    } catch (err) {
      setCloneStatus('error')
      setCloneError(`${err}`)
    }
  }, [repoName, createPath, githubToken, isPrivate, onVaultCloned, handleClose])

  if (!githubToken) {
    return (
      <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) handleClose() }}>
        <DialogContent className="sm:max-w-[480px]" data-testid="github-vault-modal">
          <DialogHeader>
            <DialogTitle>Connect GitHub Repo</DialogTitle>
            <DialogDescription>Connect your GitHub account to clone or create vaults backed by GitHub repos.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-muted-foreground text-center">
              You need to connect your GitHub account first. Add your GitHub token in Settings.
            </p>
            <Button
              onClick={() => { handleClose(); onOpenSettings() }}
              data-testid="github-open-settings"
            >
              Open Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const cloningRepoName = tab === 'clone' ? (selectedRepo?.full_name ?? '') : repoName

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) handleClose() }}>
      <DialogContent className="sm:max-w-[540px]" data-testid="github-vault-modal">
        <DialogHeader>
          <DialogTitle>Connect GitHub Repo</DialogTitle>
          <DialogDescription>Clone an existing repo or create a new one as a vault.</DialogDescription>
        </DialogHeader>

        {cloneStatus === 'cloning' ? (
          <CloningProgress repoName={cloningRepoName} />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line">
              <TabsTrigger value="clone" data-testid="github-tab-clone">Clone Existing</TabsTrigger>
              <TabsTrigger value="create" data-testid="github-tab-create">Create New</TabsTrigger>
            </TabsList>

            <TabsContent value="clone">
              <CloneTab
                repos={repos}
                loading={loading}
                search={search}
                setSearch={setSearch}
                selectedRepo={selectedRepo}
                setSelectedRepo={setSelectedRepo}
                localPath={clonePath}
                setLocalPath={setClonePath}
                onClone={handleClone}
                cloneStatus={cloneStatus}
                cloneError={cloneError}
              />
            </TabsContent>

            <TabsContent value="create">
              <CreateTab
                repoName={repoName}
                setRepoName={setRepoName}
                isPrivate={isPrivate}
                setIsPrivate={setIsPrivate}
                localPath={createPath}
                setLocalPath={setCreatePath}
                onCreate={handleCreate}
                cloneStatus={cloneStatus}
                cloneError={cloneError}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
