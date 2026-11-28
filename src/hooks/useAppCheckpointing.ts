import type { Settings } from '../types'
import { useAutoGit } from './useAutoGit'
import { useAutoGitWork } from './useAutoGitWork'

interface AppCheckpointOptions extends Omit<
  Parameters<typeof useAutoGit>[0], 'enabled' | 'idleThresholdSeconds' | 'inactiveThresholdSeconds' | 'hasPendingChanges'
> {
  automaticGitEnabled: boolean
  settings: Pick<Settings, 'autogit_enabled' | 'autogit_idle_threshold_seconds' | 'autogit_inactive_threshold_seconds'>
}

export function useAppCheckpointing(
  work: Parameters<typeof useAutoGitWork>[0],
  { automaticGitEnabled, settings, ...eligibility }: AppCheckpointOptions,
) {
  const { activitySignature, hasPendingWork } = useAutoGitWork(work)
  const { recordActivity } = useAutoGit({
    ...eligibility,
    enabled: automaticGitEnabled && settings.autogit_enabled === true,
    idleThresholdSeconds: settings.autogit_idle_threshold_seconds ?? 90,
    inactiveThresholdSeconds: settings.autogit_inactive_threshold_seconds ?? 30,
    hasPendingChanges: hasPendingWork,
  })
  return { activitySignature, recordActivity }
}
