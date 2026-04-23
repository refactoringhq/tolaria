import { useState } from 'react'
import { GitBranch } from '@phosphor-icons/react'
import { useI18n } from '../lib/i18n'
import { OnboardingShell } from './OnboardingShell'

interface GitRequiredModalProps {
  onCreateRepo: () => Promise<void>
  onChooseVault: () => void
}

export function GitRequiredModal({ onCreateRepo, onChooseVault }: GitRequiredModalProps) {
  const { t } = useI18n()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      await onCreateRepo()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setCreating(false)
    }
  }

  return (
    <OnboardingShell
      style={{ background: 'var(--sidebar)' }}
      contentClassName="w-full max-w-sm"
      testId="git-required-shell"
    >
      <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-background p-8 shadow-lg">
        <GitBranch size={36} className="text-muted-foreground" />
        <h2 className="m-0 text-lg font-semibold text-foreground">{t('Git repository required')}</h2>
        <p className="m-0 text-center text-[13px] leading-relaxed text-muted-foreground">
          {t('Tolaria uses a git repository to track changes, detect moved files, and keep your vault safe.')}
          {' '}
          {t('We\'ll create a local repo — no remote needed.')}
        </p>
        {error && (
          <p className="m-0 rounded-md bg-destructive/10 px-3 py-2 text-center text-[12px] text-destructive">
            {error}
          </p>
        )}
        <div className="flex w-full flex-col gap-2">
          <button
            className="w-full cursor-pointer rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? t('Creating…') : t('Create repository')}
          </button>
          <button
            className="w-full cursor-pointer rounded-md border border-border bg-transparent px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onChooseVault}
            disabled={creating}
          >
            {t('Choose another vault')}
          </button>
        </div>
      </div>
    </OnboardingShell>
  )
}
