import { useId, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { translate, type AppLocale } from '../../lib/i18n'
import { RoleSelect } from './RoleSelect'
import type { ShareFeedback, ShareInvite, ShareScopeChoice } from './useShareInvite'

interface ShareInviteFormProps {
  form: ShareInvite
  /** Offer the choice between the note and the whole vault; without a note it is the vault. */
  canShareNote: boolean
  locale: AppLocale
}

function ScopeSelect({ form, locale }: Pick<ShareInviteFormProps, 'form' | 'locale'>) {
  const id = useId()
  return (
    <Select value={form.scope} onValueChange={(next) => form.setScope(next as ShareScopeChoice)}>
      <SelectTrigger id={id} aria-label={translate(locale, 'sharing.scope.label')} className="h-9 w-full" data-testid="share-scope">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="note">{translate(locale, 'sharing.scope.note')}</SelectItem>
        <SelectItem value="vault">{translate(locale, 'sharing.scope.vault')}</SelectItem>
      </SelectContent>
    </Select>
  )
}

function FeedbackLine({ feedback }: { feedback: ShareFeedback | null }) {
  if (!feedback) return null
  const error = feedback.kind === 'error'
  return (
    <p
      role={error ? 'alert' : 'status'}
      data-testid={error ? 'share-error' : 'share-success'}
      className={error ? 'm-0 text-xs text-[var(--accent-red)]' : 'm-0 text-xs text-muted-foreground'}
    >
      {feedback.text}
    </p>
  )
}

/** Who to invite, with which role, to the note or the whole vault (TOL-237). */
export function ShareInviteForm({ form, canShareNote, locale }: ShareInviteFormProps) {
  const inputId = useId()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void form.invite()
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={submit} data-testid="share-invite-form">
      {canShareNote && <ScopeSelect form={form} locale={locale} />}
      <label htmlFor={inputId} className="text-xs font-medium text-foreground">
        {translate(locale, 'sharing.invitee.label')}
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={inputId}
          className="h-9 min-w-[12rem] flex-1"
          value={form.invitee}
          onChange={(event) => form.editInvitee(event.target.value)}
          placeholder={translate(locale, 'sharing.invitee.placeholder')}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          data-testid="share-invitee"
        />
        <RoleSelect
          value={form.role}
          onChange={form.setRole}
          label={translate(locale, 'sharing.role.label')}
          testId="share-role"
          locale={locale}
        />
        <Button type="submit" className="h-9" disabled={form.pending || form.invitee.trim() === ''} data-testid="share-invite">
          {translate(locale, 'sharing.invite.submit')}
        </Button>
      </div>
      <FeedbackLine feedback={form.feedback} />
    </form>
  )
}
