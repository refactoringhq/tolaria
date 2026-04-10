import { Megaphone } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LAPUTA_GITHUB_ISSUES_URL } from '../constants/feedback'
import { openExternalUrl } from '../utils/url'

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const handleOpenIssues = () => {
    void openExternalUrl(LAPUTA_GITHUB_ISSUES_URL)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent showCloseButton={false} className="sm:max-w-[460px]" data-testid="feedback-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={18} weight="duotone" />
            Share feedback
          </DialogTitle>
          <DialogDescription>
            The best way to share product feedback is through a GitHub Issue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            Before opening a new issue, please check whether a similar one already exists.
            If it does, add an upvote or comment there instead of opening a duplicate.
          </p>
          <p>
            When you do open a new issue, include the steps to reproduce, what you expected,
            and what actually happened so it is easier to triage.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" autoFocus onClick={handleOpenIssues}>
            Go to Issues
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
