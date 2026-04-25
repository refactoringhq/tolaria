import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Megaphone } from '@phosphor-icons/react'
import { ArrowUpRight, Bug, Check, Copy, GitPullRequest, Lightbulb, MessagesSquare, Newspaper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  REFACTORING_HOME_URL,
  TOLARIA_GITHUB_CONTRIBUTING_URL,
  TOLARIA_GITHUB_DISCUSSIONS_URL,
  TOLARIA_GITHUB_ISSUES_URL,
  TOLARIA_GITHUB_PULL_REQUESTS_URL,
  TOLARIA_PRODUCT_BOARD_URL,
} from '../constants/feedback'
import {
  buildSanitizedDiagnosticBundle,
  startFeedbackDiagnosticsCapture,
} from '../lib/feedbackDiagnostics'
import { cn } from '../lib/utils'
import { takeFeedbackDialogOpener } from '../lib/feedbackDialogOpener'
import { useBuildNumber } from '../hooks/useBuildNumber'
import { APP_COMMAND_EVENT_NAME, APP_COMMAND_IDS } from '../hooks/appCommandDispatcher'
import { openExternalUrl } from '../utils/url'

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
  buildNumber?: string
  releaseChannel?: string | null
}

interface ContributionCardProps {
  title: string
  description: string
  ctaLabel: string
  icon: typeof Lightbulb
  tone: ContributionTone
  onAction: () => void
  autoFocus?: boolean
  secondaryAction?: ReactNode
}

interface LinkFallback {
  label: string
  url: string
}

interface ContributionPath {
  title: string
  description: string
  ctaLabel: string
  label: string
  url: string
  icon: typeof Lightbulb
  tone: ContributionTone
  secondaryLink?: ContributionLink
}

interface ContributionLink {
  ctaLabel: string
  label: string
  url: string
}

const EMPTY_DIALOG_OPENER: ReturnType<typeof takeFeedbackDialogOpener> = {
  element: null,
  reopenCommandPalette: false,
}

type ContributionTone = 'blue' | 'green' | 'yellow' | 'purple' | 'red'

const CONTRIBUTION_TONE_CLASSES: Record<ContributionTone, string> = {
  blue: 'bg-[var(--accent-blue-light)] text-[var(--accent-blue)]',
  green: 'bg-[var(--accent-green-light)] text-[var(--accent-green)]',
  yellow: 'bg-[var(--accent-yellow-light)] text-[var(--accent-yellow)]',
  purple: 'bg-[var(--accent-purple-light)] text-[var(--accent-purple)]',
  red: 'bg-[var(--accent-red-light)] text-[var(--accent-red)]',
}

const CONTRIBUTION_BUTTON_CLASSES: Record<ContributionTone, string> = {
  blue: 'border-[var(--accent-blue)] hover:bg-[var(--accent-blue-light)] [&_svg]:text-[var(--accent-blue)]',
  green: 'border-[var(--accent-green)] hover:bg-[var(--accent-green-light)] [&_svg]:text-[var(--accent-green)]',
  yellow: 'border-[var(--accent-yellow)] hover:bg-[var(--accent-yellow-light)] [&_svg]:text-[var(--accent-yellow)]',
  purple: 'border-[var(--accent-purple)] hover:bg-[var(--accent-purple-light)] [&_svg]:text-[var(--accent-purple)]',
  red: 'border-[var(--accent-red)] hover:bg-[var(--accent-red-light)] [&_svg]:text-[var(--accent-red)]',
}

const SPONSOR_SUPPORT_PATH: ContributionPath = {
  title: 'Sponsor / Support',
  description: 'Luca here 👋 my full-time job is running Refactoring, a newsletter + podcast for 170K+ software engineers about how to run good engineering teams and ship good software with AI. In there I talk about my journey (also about Tolaria!), interview tech leaders (DHH, Martin Fowler, and more) and run a private paid community for 2000+ engineers with monthly live coaching, monthly AI club, and more.\n\nTolaria is FOSS and always will be. If you like it, the best way to support it is to subscribe to the newsletter.',
  ctaLabel: 'Check out Refactoring',
  label: 'Refactoring',
  url: REFACTORING_HOME_URL,
  icon: Newspaper,
  tone: 'blue',
}

const CONTRIBUTION_PATHS: ContributionPath[] = [
  {
    title: 'Feature requests',
    description: 'Search on the product board first, upvote an existing idea if already there, and only create a new post when genuinely new!',
    ctaLabel: 'Open Product Board',
    label: 'Product Board',
    url: TOLARIA_PRODUCT_BOARD_URL,
    icon: Lightbulb,
    tone: 'green',
  },
  {
    title: 'Discussions',
    description: 'Use GitHub Discussions for questions, broader conversations, idea sharing, and community context that is not a concrete bug report.',
    ctaLabel: 'Open Discussions',
    label: 'GitHub Discussions',
    url: TOLARIA_GITHUB_DISCUSSIONS_URL,
    icon: MessagesSquare,
    tone: 'purple',
  },
  {
    title: 'Contribute code',
    description: 'Small, focused pull requests are welcome. Check planned or in-progress work first so you are building in the right place.',
    ctaLabel: 'Open Pull Requests',
    label: 'GitHub Pull Requests',
    url: TOLARIA_GITHUB_PULL_REQUESTS_URL,
    icon: GitPullRequest,
    tone: 'yellow',
    secondaryLink: {
      ctaLabel: 'Open Contributing Guide',
      label: 'the contributing guide',
      url: TOLARIA_GITHUB_CONTRIBUTING_URL,
    },
  },
]

function ContributionLinkButton({
  label,
  tone,
  onAction,
  autoFocus = false,
  accented = true,
}: {
  label: string
  tone: ContributionTone
  onAction: () => void
  autoFocus?: boolean
  accented?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'w-full justify-between',
        accented && 'bg-background text-foreground hover:text-foreground',
        accented && CONTRIBUTION_BUTTON_CLASSES[tone],
      )}
      autoFocus={autoFocus}
      onClick={onAction}
    >
      {label}
      <ArrowUpRight size={14} />
    </Button>
  )
}

function ContributionCard({
  title,
  description,
  ctaLabel,
  icon: Icon,
  tone,
  onAction,
  autoFocus = false,
  secondaryAction,
}: ContributionCardProps) {
  return (
    <Card className="gap-4 border-border/70 py-4 shadow-none">
      <CardHeader className="gap-3 px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className={cn('rounded-md p-2', CONTRIBUTION_TONE_CLASSES[tone])}>
            <Icon size={16} />
          </span>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        <CardDescription className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <ContributionLinkButton label={ctaLabel} tone={tone} autoFocus={autoFocus} onAction={onAction} />
      </CardContent>
      {secondaryAction ? <CardFooter className="px-4 pt-0">{secondaryAction}</CardFooter> : null}
    </Card>
  )
}

function LinkFallbackBanner({ linkFallback }: { linkFallback: LinkFallback | null }) {
  if (!linkFallback) return null

  return (
    <div
      className="rounded-lg border px-4 py-3 text-sm"
      style={{
        background: 'var(--feedback-warning-bg)',
        borderColor: 'var(--feedback-warning-border)',
        color: 'var(--feedback-warning-text)',
      }}
    >
      <p className="font-medium">Couldn’t open {linkFallback.label} automatically.</p>
      <p className="mt-1">Open this URL manually instead:</p>
      <p className="mt-2 break-all rounded-md bg-popover px-3 py-2 font-mono text-xs text-foreground">
        {linkFallback.url}
      </p>
    </div>
  )
}

function getCopyDiagnosticsLabel(copyState: 'idle' | 'copied' | 'failed') {
  return copyState === 'copied' ? 'Diagnostics copied' : 'Copy sanitized diagnostics'
}

function BugReportActions({
  copyState,
  canCopyDiagnostics,
  onCopyDiagnostics,
}: {
  copyState: 'idle' | 'copied' | 'failed'
  canCopyDiagnostics: boolean
  onCopyDiagnostics: () => void
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={onCopyDiagnostics}
        disabled={!canCopyDiagnostics}
      >
        {getCopyDiagnosticsLabel(copyState)}
        {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
      </Button>
      {copyState === 'copied' ? (
        <p className="text-xs font-medium text-foreground">Diagnostics copied.</p>
      ) : null}
      {copyState === 'failed' ? (
        <p className="text-xs font-medium text-[var(--feedback-warning-text)]">
          Clipboard access is unavailable right now. You can still open GitHub Issues directly.
        </p>
      ) : null}
    </div>
  )
}

function useDialogReturnFocus(open: boolean, onClose: () => void) {
  const openerRef = useRef(EMPTY_DIALOG_OPENER)

  useLayoutEffect(() => {
    if (open) {
      openerRef.current = takeFeedbackDialogOpener()
    }
  }, [open])

  return () => {
    const { element: opener, reopenCommandPalette } = openerRef.current
    openerRef.current = takeFeedbackDialogOpener()

    onClose()
    window.setTimeout(() => {
      if (reopenCommandPalette) {
        window.dispatchEvent(new CustomEvent(APP_COMMAND_EVENT_NAME, {
          detail: APP_COMMAND_IDS.viewCommandPalette,
        }))
        return
      }

      if (opener?.isConnected) {
        opener.focus()
      }
    }, 80)
  }
}

function useFeedbackDialogActions(diagnosticsBundle: string) {
  const [linkFallback, setLinkFallback] = useState<LinkFallback | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const canCopyDiagnostics = typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'

  const handleOpenLink = (label: string, url: string) => {
    void openExternalUrl(url)
      .then(() => {
        setLinkFallback(null)
      })
      .catch(() => {
        setLinkFallback({ label, url })
      })
  }

  const handleCopyDiagnostics = () => {
    if (!canCopyDiagnostics) {
      setCopyState('failed')
      return
    }

    void navigator.clipboard.writeText(diagnosticsBundle)
      .then(() => {
        setCopyState('copied')
      })
      .catch(() => {
        setCopyState('failed')
      })
  }

  const reset = () => {
    setLinkFallback(null)
    setCopyState('idle')
  }

  return {
    linkFallback,
    copyState,
    canCopyDiagnostics,
    handleOpenLink,
    handleCopyDiagnostics,
    reset,
  }
}

function ContributionGrid({
  onOpenLink,
  copyState,
  canCopyDiagnostics,
  onCopyDiagnostics,
}: {
  onOpenLink: (label: string, url: string) => void
  copyState: 'idle' | 'copied' | 'failed'
  canCopyDiagnostics: boolean
  onCopyDiagnostics: () => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ContributionCard
          title={SPONSOR_SUPPORT_PATH.title}
          description={SPONSOR_SUPPORT_PATH.description}
          ctaLabel={SPONSOR_SUPPORT_PATH.ctaLabel}
          icon={SPONSOR_SUPPORT_PATH.icon}
          tone={SPONSOR_SUPPORT_PATH.tone}
          autoFocus={true}
          onAction={() => onOpenLink(SPONSOR_SUPPORT_PATH.label, SPONSOR_SUPPORT_PATH.url)}
        />
      </div>
      {CONTRIBUTION_PATHS.map((path) => {
        const secondaryLink = path.secondaryLink

        return (
          <ContributionCard
            key={path.title}
            title={path.title}
            description={path.description}
            ctaLabel={path.ctaLabel}
            icon={path.icon}
            tone={path.tone}
            onAction={() => onOpenLink(path.label, path.url)}
            secondaryAction={secondaryLink ? (
              <ContributionLinkButton
                label={secondaryLink.ctaLabel}
                tone={path.tone}
                accented={false}
                onAction={() => onOpenLink(secondaryLink.label, secondaryLink.url)}
              />
            ) : undefined}
          />
        )
      })}
      <ContributionCard
        title="Report a bug"
        description="Explain how to reproduce, what you expected, and what actually happened. Check for duplicate bugs first. Attach the sanitized diagnostic bundle please!"
        ctaLabel="Open GitHub Issues"
        icon={Bug}
        tone="red"
        onAction={() => onOpenLink('GitHub Issues', TOLARIA_GITHUB_ISSUES_URL)}
        secondaryAction={(
          <BugReportActions
            copyState={copyState}
            canCopyDiagnostics={canCopyDiagnostics}
            onCopyDiagnostics={onCopyDiagnostics}
          />
        )}
      />
    </div>
  )
}

export function FeedbackDialog({
  open,
  onClose,
  buildNumber,
  releaseChannel,
}: FeedbackDialogProps) {
  const detectedBuildNumber = useBuildNumber()
  const resolvedBuildNumber = buildNumber ?? detectedBuildNumber
  const diagnosticsBundle = useMemo(
    () => buildSanitizedDiagnosticBundle({ buildNumber: resolvedBuildNumber, releaseChannel }),
    [releaseChannel, resolvedBuildNumber],
  )
  const handleRequestClose = useDialogReturnFocus(open, onClose)
  const {
    linkFallback,
    copyState,
    canCopyDiagnostics,
    handleOpenLink,
    handleCopyDiagnostics,
    reset,
  } = useFeedbackDialogActions(diagnosticsBundle)

  useEffect(() => startFeedbackDiagnosticsCapture(), [])

  const handleClose = () => {
    reset()
    handleRequestClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[760px]" data-testid="feedback-dialog">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={18} weight="duotone" />
            Contribute to Tolaria
          </DialogTitle>
          <DialogDescription>
            Pick the path that fits what you want to do! Any type of help is appreciated
          </DialogDescription>
        </DialogHeader>

        <LinkFallbackBanner linkFallback={linkFallback} />
        <ContributionGrid
          onOpenLink={handleOpenLink}
          copyState={copyState}
          canCopyDiagnostics={canCopyDiagnostics}
          onCopyDiagnostics={handleCopyDiagnostics}
        />
      </DialogContent>
    </Dialog>
  )
}
