import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGithubAuth, type GithubUser } from '../hooks/useGithubAuth'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

function GitHubDisconnected({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-foreground">Connect your GitHub account</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enable repo-backed vaults and sync
        </p>
      </div>
      <Button size="sm" onClick={onConnect}>
        Connect GitHub
      </Button>
    </div>
  )
}

function GitHubLoading() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading...
    </div>
  )
}

function GitHubDeviceFlow({
  userCode,
  verificationUri,
  onCancel,
}: {
  userCode: string
  verificationUri: string
  onCancel: () => void
}) {
  const handleOpenGitHub = () => {
    window.open(verificationUri, '_blank')
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        Enter this code on GitHub:
      </p>
      <div className="flex items-center justify-center">
        <code className="text-2xl font-mono font-bold tracking-widest bg-muted px-4 py-2 rounded-lg select-all">
          {userCode}
        </code>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleOpenGitHub} className="flex-1">
          Open GitHub
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Waiting for authorization...
      </div>
    </div>
  )
}

function GitHubConnected({
  user,
  onDisconnect,
}: {
  user: GithubUser
  onDisconnect: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.login}
            className="w-8 h-8 rounded-full"
          />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {user.name || user.login}
          </p>
          {user.name && (
            <p className="text-xs text-muted-foreground">@{user.login}</p>
          )}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onDisconnect}>
        Disconnect
      </Button>
    </div>
  )
}

function GitHubError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-destructive">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  )
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const github = useGithubAuth()

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* GitHub section */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              GitHub
            </h3>
            {github.status.state === 'loading' && <GitHubLoading />}
            {github.status.state === 'disconnected' && (
              <GitHubDisconnected onConnect={github.connect} />
            )}
            {github.status.state === 'device_flow' && (
              <GitHubDeviceFlow
                userCode={github.status.userCode}
                verificationUri={github.status.verificationUri}
                onCancel={github.cancel}
              />
            )}
            {github.status.state === 'connected' && (
              <GitHubConnected
                user={github.status.user}
                onDisconnect={github.disconnect}
              />
            )}
            {github.status.state === 'error' && (
              <GitHubError
                message={github.status.message}
                onRetry={github.connect}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
