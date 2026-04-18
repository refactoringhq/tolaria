import { ArrowUpRight, Bot, CheckCircle2, Loader2 } from 'lucide-react'
import {
  AI_AGENT_DEFINITIONS,
  getAiAgentDefinition,
  hasAnyInstalledAiAgent,
  isAiAgentsStatusChecking,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import { useDragRegion } from '../hooks/useDragRegion'
import { openExternalUrl } from '../utils/url'
import { Button } from './ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card'

interface AiAgentsOnboardingPromptProps {
  statuses: AiAgentsStatus
  onContinue: () => void
}

function getPromptCopy(statuses: AiAgentsStatus) {
  if (isAiAgentsStatusChecking(statuses)) {
    return {
      accentClassName: 'bg-slate-100 text-slate-600',
      description: 'Checking which AI agents are available on this machine.',
      icon: <Loader2 className="size-7 animate-spin" />,
      title: 'Checking AI agents',
    }
  }

  if (!hasAnyInstalledAiAgent(statuses)) {
    return {
      accentClassName: 'bg-amber-100 text-amber-700',
      description: 'Tolaria works best with a local CLI AI agent installed.',
      icon: <Bot className="size-7" />,
      title: 'No AI agents detected',
    }
  }

  return {
    accentClassName: 'bg-emerald-100 text-emerald-700',
    description: 'Your AI agents are ready to use in Tolaria.',
    icon: <CheckCircle2 className="size-7" />,
    title: 'AI agents ready',
  }
}

function AgentStatusList({ statuses }: { statuses: AiAgentsStatus }) {
  return (
    <div className="space-y-3">
      {AI_AGENT_DEFINITIONS.map((definition) => {
        const status = statuses[definition.id]
        const ready = status.status === 'installed'
        return (
          <div
            key={definition.id}
            className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
          >
            <div className="space-y-1 text-left">
              <div className="font-medium text-foreground">{definition.label}</div>
              <div className="text-xs text-muted-foreground">
                {ready
                  ? `${definition.label}${status.version ? ` ${status.version}` : ''} is ready.`
                  : `${definition.label} is not installed yet.`}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-medium ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
            >
              {ready ? 'Installed' : 'Missing'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function AiAgentsOnboardingPrompt({
  statuses,
  onContinue,
}: AiAgentsOnboardingPromptProps) {
  const copy = getPromptCopy(statuses)
  const showLegacyClaudeCompatibility = statuses.claude_code.status !== 'installed'
  const missingAgents = AI_AGENT_DEFINITIONS.filter((definition) => statuses[definition.id].status === 'missing')
  const { onMouseDown } = useDragRegion()

  return (
    <div
      className="flex h-full w-full items-center justify-center bg-sidebar px-6 py-10"
      data-testid="ai-agents-onboarding-screen"
      onMouseDown={onMouseDown}
    >
      <Card className="w-full max-w-2xl border-border bg-background shadow-sm" data-no-drag>
        <CardHeader className="items-center gap-5 text-center">
          <div className={`flex size-16 items-center justify-center rounded-2xl ${copy.accentClassName}`}>
            {copy.icon}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">
              {copy.title}
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground" data-testid="ai-agents-onboarding-description">
              {copy.description}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showLegacyClaudeCompatibility ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left"
              data-testid="claude-onboarding-screen"
            >
              <div className="text-sm font-medium text-amber-900">Claude Code not detected</div>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Install Claude Code or continue without it.
              </p>
            </div>
          ) : null}
          <AgentStatusList statuses={statuses} />
        </CardContent>

        <CardFooter className="flex-wrap justify-center gap-3">
          {missingAgents.map((definition) => (
            <Button
              key={definition.id}
              type="button"
              variant="outline"
              onClick={() => void openExternalUrl(getAiAgentDefinition(definition.id).installUrl)}
              data-testid={`ai-agents-onboarding-install-${definition.id}`}
            >
              Install {definition.label}
              <ArrowUpRight className="size-4" />
            </Button>
          ))}
          <div data-testid="ai-agents-onboarding-continue">
            <Button
              type="button"
              onClick={onContinue}
              disabled={isAiAgentsStatusChecking(statuses)}
              data-testid={showLegacyClaudeCompatibility ? 'claude-onboarding-continue' : undefined}
            >
              {hasAnyInstalledAiAgent(statuses) ? 'Continue' : 'Continue without it'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
