import { type ComponentProps, useCallback } from 'react'
import type { useAppPreferences } from '../hooks/useAppPreferences'
import type { AiWorkspaceConversationSetting, Settings } from '../types'
import { AppAiWorkspaceSurface } from './AppAiWorkspaceSurface'
import type { Tab } from './useEditorSetup'

type SurfaceProps = ComponentProps<typeof AppAiWorkspaceSurface>

interface AppSideAiWorkspaceProps extends Omit<
  SurfaceProps,
  | 'mode'
  | 'activeEntry'
  | 'activeNoteContent'
  | 'aiModelProviders'
  | 'conversationSettings'
  | 'initialActiveConversationId'
  | 'openTabs'
  | 'defaultAiAgent'
  | 'defaultAiAgentReadiness'
  | 'defaultAiAgentReady'
  | 'defaultAiTarget'
  | 'onConversationSettingsChange'
  | 'onRestoreVaultAiGuidance'
> {
  activeTab?: Pick<Tab, 'entry' | 'content'> | null
  tabs: Pick<Tab, 'entry'>[]
  settings: Settings
  saveSettings: (settings: Settings) => void | Promise<void>
  activeConversationId?: string | null
  aiFeaturesEnabled: boolean
  restoreVaultAiGuidance: () => Promise<unknown>
  preferences: ReturnType<typeof useAppPreferences>['aiAgentPreferences']
}

export function AppSideAiWorkspace({
  activeTab,
  tabs,
  settings,
  saveSettings,
  activeConversationId,
  aiFeaturesEnabled,
  restoreVaultAiGuidance,
  preferences,
  ...surface
}: AppSideAiWorkspaceProps) {
  const saveConversations = useCallback((conversations: AiWorkspaceConversationSetting[]) => {
    void saveSettings({ ...settings, ai_workspace_conversations: conversations })
  }, [saveSettings, settings])
  const restoreGuidance = aiFeaturesEnabled ? () => { void restoreVaultAiGuidance() } : undefined
  return (
    <AppAiWorkspaceSurface
      {...surface}
      mode="side"
      activeEntry={activeTab?.entry ?? null}
      activeNoteContent={activeTab?.content ?? null}
      openTabs={tabs.map((tab) => tab.entry)}
      aiModelProviders={settings.ai_model_providers ?? []}
      conversationSettings={settings.ai_workspace_conversations ?? null}
      initialActiveConversationId={activeConversationId ?? undefined}
      defaultAiAgent={preferences.defaultAiAgent}
      defaultAiTarget={preferences.defaultAiTarget}
      defaultAiAgentReadiness={preferences.defaultAiAgentReadiness}
      defaultAiAgentReady={preferences.defaultAiAgentReady}
      onConversationSettingsChange={saveConversations}
      onRestoreVaultAiGuidance={restoreGuidance}
    />
  )
}
