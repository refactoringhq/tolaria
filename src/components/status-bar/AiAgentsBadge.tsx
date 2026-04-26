import { AlertTriangle, ChevronsUpDown } from 'lucide-react'
import { Sparkle } from '@phosphor-icons/react'
import { ActionTooltip } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import {
  AI_AGENT_DEFINITIONS,
  getAiAgentDefinition,
  hasAnyInstalledAiAgent,
  isAiAgentInstalled,
  isAiAgentsStatusChecking,
  type AiAgentId,
  type AiAgentDefinition,
  type AiAgentsStatus,
} from '../../lib/aiAgents'
import {
  getVaultAiGuidanceSummary,
  isVaultAiGuidanceStatusChecking,
  vaultAiGuidanceNeedsRestore,
  vaultAiGuidanceUsesCustomFiles,
  type VaultAiGuidanceStatus,
} from '../../lib/vaultAiGuidance'
import { openExternalUrl } from '../../utils/url'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ICON_STYLE, SEP_STYLE } from './styles'

interface AiAgentsBadgeProps {
  statuses: AiAgentsStatus
  guidanceStatus?: VaultAiGuidanceStatus
  defaultAgent: AiAgentId
  onSetDefaultAgent?: (agent: AiAgentId) => void
  onRestoreGuidance?: () => void
  compact?: boolean
}

function badgeTooltip(
  statuses: AiAgentsStatus,
  defaultAgent: AiAgentId,
  guidanceStatus?: VaultAiGuidanceStatus,
): string {
  const guidanceSummary = guidanceStatus && !isVaultAiGuidanceStatusChecking(guidanceStatus)
    ? getVaultAiGuidanceSummary(guidanceStatus)
    : null
  if (!hasAnyInstalledAiAgent(statuses)) return 'No AI agents detected — click for setup details'
  const definition = getAiAgentDefinition(defaultAgent)
  if (!isAiAgentInstalled(statuses, defaultAgent)) {
    return `${definition.label} is selected but not installed — click for setup details`
  }
  const version = statuses[defaultAgent].version
  const base = `Default AI agent: ${definition.label}${version ? ` ${version}` : ''}`
  if (!guidanceSummary) return base
  if (vaultAiGuidanceNeedsRestore(guidanceStatus!)) {
    return `${base}. ${guidanceSummary} — click for restore details`
  }
  if (vaultAiGuidanceUsesCustomFiles(guidanceStatus!)) {
    return `${base}. ${guidanceSummary}`
  }
  return base
}

function installedAgentDefinitions(statuses: AiAgentsStatus): AiAgentDefinition[] {
  return AI_AGENT_DEFINITIONS.filter((definition) => isAiAgentInstalled(statuses, definition.id))
}

function missingAgentDefinitions(statuses: AiAgentsStatus): AiAgentDefinition[] {
  return AI_AGENT_DEFINITIONS.filter((definition) => !isAiAgentInstalled(statuses, definition.id))
}

function triggerLabel(defaultAgent: AiAgentId): string {
  return getAiAgentDefinition(defaultAgent).shortLabel
}

function menuHeading(defaultAgent: AiAgentId, selectedAgentReady: boolean): string {
  return selectedAgentReady
    ? `Active AI agent: ${getAiAgentDefinition(defaultAgent).label}`
    : `Selected AI agent unavailable: ${getAiAgentDefinition(defaultAgent).label}`
}

function statusText(statuses: AiAgentsStatus, definition: AiAgentDefinition): string {
  const version = statuses[definition.id].version
  return version ? `${definition.label} ${version}` : definition.label
}

function canSwitchAgents(
  installedAgents: AiAgentDefinition[],
  defaultAgent: AiAgentId,
): boolean {
  return installedAgents.some((definition) => definition.id !== defaultAgent)
}

function hasAiAgentWarning(
  statuses: AiAgentsStatus,
  defaultAgent: AiAgentId,
  guidanceStatus?: VaultAiGuidanceStatus,
): boolean {
  return !hasAnyInstalledAiAgent(statuses)
    || !isAiAgentInstalled(statuses, defaultAgent)
    || !!(guidanceStatus && vaultAiGuidanceNeedsRestore(guidanceStatus))
}

function canShowSwitcherCue(statuses: AiAgentsStatus, defaultAgent: AiAgentId): boolean {
  return canSwitchAgents(installedAgentDefinitions(statuses), defaultAgent)
}

function triggerButtonClassName(compact: boolean): string {
  return compact
    ? 'h-6 w-6 rounded-sm p-0 text-[11px] font-medium'
    : 'h-6 px-2 text-[11px] font-medium'
}

function CompactSeparator({ compact }: { compact: boolean }) {
  if (compact) return null
  return <span style={SEP_STYLE}>|</span>
}

function TriggerLabel({ compact, defaultAgent }: { compact: boolean; defaultAgent: AiAgentId }) {
  if (compact) return null
  return triggerLabel(defaultAgent)
}

function TriggerStateIcon({
  showWarning,
  showSwitcherCue,
}: {
  showWarning: boolean
  showSwitcherCue: boolean
}) {
  if (showWarning) return <AlertTriangle size={10} style={{ marginLeft: 2 }} />
  if (showSwitcherCue) return <ChevronsUpDown size={10} style={{ marginLeft: 2 }} />
  return null
}

function GuidanceMenuSection({
  guidanceStatus,
  onRestoreGuidance,
}: Pick<AiAgentsBadgeProps, 'guidanceStatus' | 'onRestoreGuidance'>) {
  if (!guidanceStatus || isVaultAiGuidanceStatusChecking(guidanceStatus)) return null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Vault guidance</DropdownMenuLabel>
      <DropdownMenuItem disabled data-testid="status-ai-guidance-summary">
        {getVaultAiGuidanceSummary(guidanceStatus)}
      </DropdownMenuItem>
      {vaultAiGuidanceNeedsRestore(guidanceStatus) && guidanceStatus.canRestore && (
        <DropdownMenuItem
          onSelect={() => onRestoreGuidance?.()}
          data-testid="status-ai-guidance-restore"
        >
          Restore Tolaria AI Guidance
        </DropdownMenuItem>
      )}
    </>
  )
}

function AgentMenuContent({
  statuses,
  guidanceStatus,
  defaultAgent,
  selectedAgentReady,
  onSetDefaultAgent,
  onRestoreGuidance,
}: AiAgentsBadgeProps & { selectedAgentReady: boolean }) {
  const installedAgents = installedAgentDefinitions(statuses)
  const missingAgents = missingAgentDefinitions(statuses)

  return (
    <DropdownMenuContent
      align="start"
      side="top"
      className="min-w-[18rem]"
      data-testid="status-ai-agents-menu"
    >
      <DropdownMenuLabel>{menuHeading(defaultAgent, selectedAgentReady)}</DropdownMenuLabel>
      {installedAgents.length === 0 ? (
        <DropdownMenuItem disabled>No AI agents detected</DropdownMenuItem>
      ) : (
        <DropdownMenuRadioGroup
          value={selectedAgentReady ? defaultAgent : undefined}
          onValueChange={(value) => onSetDefaultAgent?.(value as AiAgentId)}
        >
          {installedAgents.map((definition) => (
            <DropdownMenuRadioItem key={definition.id} value={definition.id}>
              <span>{definition.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {statusText(statuses, definition)}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      )}
      {missingAgents.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Install</DropdownMenuLabel>
          {missingAgents.map((definition) => (
            <DropdownMenuItem
              key={definition.id}
              onSelect={() => void openExternalUrl(definition.installUrl)}
            >
              Install {definition.label}
            </DropdownMenuItem>
          ))}
        </>
      )}
      <GuidanceMenuSection
        guidanceStatus={guidanceStatus}
        onRestoreGuidance={onRestoreGuidance}
      />
    </DropdownMenuContent>
  )
}

export function AiAgentsBadge({
  statuses,
  guidanceStatus,
  defaultAgent,
  onSetDefaultAgent,
  onRestoreGuidance,
  compact = false,
}: AiAgentsBadgeProps) {
  const selectedAgentReady = isAiAgentInstalled(statuses, defaultAgent)
  const showWarning = hasAiAgentWarning(statuses, defaultAgent, guidanceStatus)
  const showSwitcherCue = !showWarning && canShowSwitcherCue(statuses, defaultAgent)

  if (isAiAgentsStatusChecking(statuses)) return null

  return (
    <>
      <CompactSeparator compact={compact} />
      <DropdownMenu>
        <ActionTooltip copy={{ label: badgeTooltip(statuses, defaultAgent, guidanceStatus) }} side="top">
          <DropdownMenuTrigger asChild={true}>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className={triggerButtonClassName(compact)}
              aria-label="Open AI agent options"
              data-testid="status-ai-agents"
            >
              <span style={{ ...ICON_STYLE, color: showWarning ? 'var(--accent-orange)' : 'var(--muted-foreground)' }}>
                <Sparkle size={13} weight="fill" />
                <TriggerLabel compact={compact} defaultAgent={defaultAgent} />
                <TriggerStateIcon showWarning={showWarning} showSwitcherCue={showSwitcherCue} />
              </span>
            </Button>
          </DropdownMenuTrigger>
        </ActionTooltip>
        <AgentMenuContent
          statuses={statuses}
          guidanceStatus={guidanceStatus}
          defaultAgent={defaultAgent}
          onSetDefaultAgent={onSetDefaultAgent}
          onRestoreGuidance={onRestoreGuidance}
          selectedAgentReady={selectedAgentReady}
        />
      </DropdownMenu>
    </>
  )
}
