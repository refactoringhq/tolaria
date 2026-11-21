import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { translate, type AppLocale } from '../../lib/i18n'
import {
  changeShareRole,
  type OutgoingShare,
  personLabel,
  revokeShare,
  ShareApiError,
} from '../../lib/sharing/sharesApi'
import { trackShareRevoked, trackShareRoleChanged } from '../../lib/sharing/sharingAnalytics'
import { forgetOutgoingShare, rememberOutgoingShare } from '../../lib/sharing/sharingStore'
import type { SharedRole } from '../../lib/sharing/vaultAccess'
import { RoleSelect } from './RoleSelect'
import { noteName, scopeKind, shareErrorKey } from './shareView'

interface SharePeopleListProps {
  vaultId: string
  shares: OutgoingShare[]
  locale: AppLocale
}

function scopeLabel(share: OutgoingShare, locale: AppLocale): string {
  return share.scope === '*' ? translate(locale, 'sharing.people.scopeVault') : noteName(share.scope)
}

interface ShareRowProps {
  share: OutgoingShare
  busy: boolean
  onRole: (share: OutgoingShare, role: SharedRole) => void
  onRevoke: (share: OutgoingShare) => void
  locale: AppLocale
}

function ShareRow({ share, busy, onRole, onRevoke, locale }: ShareRowProps) {
  const name = personLabel(share.grantee)
  return (
    <li className="flex min-w-0 items-center gap-2" data-testid="share-person">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{scopeLabel(share, locale)}</span>
      </div>
      <RoleSelect
        value={share.role}
        onChange={(role) => onRole(share, role)}
        label={translate(locale, 'sharing.people.roleLabel', { name })}
        disabled={busy}
        testId="share-person-role"
        locale={locale}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        onClick={() => onRevoke(share)}
        aria-label={translate(locale, 'sharing.people.removeLabel', { name })}
        title={translate(locale, 'sharing.people.remove')}
        data-testid="share-person-remove"
      >
        <X />
      </Button>
    </li>
  )
}

function errorKey(error: unknown) {
  return shareErrorKey(error instanceof ShareApiError ? error.code : 'failed')
}

/** Who has access, with their role and a way to take it away (TOL-237). */
export function SharePeopleList({ vaultId, shares, locale }: SharePeopleListProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(translate(locale, errorKey(failure)))
    } finally {
      setBusy(false)
    }
  }
  const onRole = (share: OutgoingShare, role: SharedRole) => void run(async () => {
    rememberOutgoingShare(await changeShareRole(vaultId, share, role))
    trackShareRoleChanged(scopeKind(share.scope), role)
  })
  const onRevoke = (share: OutgoingShare) => void run(async () => {
    await revokeShare(share.id)
    forgetOutgoingShare(share.id)
    trackShareRevoked(scopeKind(share.scope))
  })

  return (
    <section className="flex flex-col gap-2" aria-label={translate(locale, 'sharing.people.title')}>
      <h3 className="m-0 text-xs font-medium text-foreground">{translate(locale, 'sharing.people.title')}</h3>
      {shares.length === 0
        ? <p className="m-0 text-xs text-muted-foreground" data-testid="share-people-empty">{translate(locale, 'sharing.people.empty')}</p>
        : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="share-people">
              {shares.map((share) => (
                <ShareRow key={share.id} share={share} busy={busy} onRole={onRole} onRevoke={onRevoke} locale={locale} />
              ))}
            </ul>
          )}
      {error && <p role="alert" className="m-0 text-xs text-[var(--accent-red)]">{error}</p>}
    </section>
  )
}
