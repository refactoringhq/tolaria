import { isAiAgentInstalled } from '../lib/aiAgents'
import { useAiAgentsOnboarding } from './useAiAgentsOnboarding'
import { useAiAgentsStatus } from './useAiAgentsStatus'

interface WorkspaceAiOnboardingOptions {
  enabled: boolean
  vaultReady: boolean
  secondaryWindow: boolean
}

export function useWorkspaceAiOnboarding({ enabled, vaultReady, secondaryWindow }: WorkspaceAiOnboardingOptions) {
  const aiAgentsStatus = useAiAgentsStatus({ enabled })
  const aiAgentsOnboarding = useAiAgentsOnboarding(enabled && vaultReady && !secondaryWindow)
  const modelSelectorAvailable = isAiAgentInstalled(aiAgentsStatus, 'claude_code') || isAiAgentInstalled(aiAgentsStatus, 'codex')
  return { aiAgentsStatus, aiAgentsOnboarding, modelSelectorAvailable }
}
