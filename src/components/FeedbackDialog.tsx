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
import { TOLARIA_GITHUB_ISSUES_URL } from '../constants/feedback'
import { useI18n } from '../lib/i18n'
import { openExternalUrl } from '../utils/url'

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const { t } = useI18n()
  const handleOpenIssues = () => {
    void openExternalUrl(TOLARIA_GITHUB_ISSUES_URL)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[460px]"
        data-testid="feedback-dialog"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone size={18} weight="duotone" />
            {t('Share feedback')}
          </DialogTitle>
          <DialogDescription>
            {t('The best way to share product feedback is through a GitHub Issue.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            {t('Before opening a new issue, please check whether a similar one already exists.')}
            {' '}
            {t('If it does, add an upvote or comment there instead of opening a duplicate.')}
          </p>
          <p>
            {t('When you do open a new issue, include the steps to reproduce, what you expected, and what actually happened so it is easier to triage.')}
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Close')}
          </Button>
          <Button type="button" autoFocus onClick={handleOpenIssues}>
            {t('Go to Issues')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
