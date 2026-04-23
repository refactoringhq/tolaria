import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FileText, Check, Loader2 } from 'lucide-react'
import { t } from '../lib/i18n'
import type { ConflictFileState } from '../hooks/useConflictResolver'

interface ConflictResolverModalProps {
  open: boolean
  fileStates: ConflictFileState[]
  allResolved: boolean
  committing: boolean
  error: string | null
  onResolveFile: (file: string, strategy: 'ours' | 'theirs') => void
  onOpenInEditor: (file: string) => void
  onCommit: () => void
  onClose: () => void
}

function isBinaryFile(file: string): boolean {
  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.wav', '.ogg', '.woff', '.woff2', '.ttf', '.otf', '.eot']
  return binaryExts.some(ext => file.toLowerCase().endsWith(ext))
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

function ResolutionLabel({ resolution }: { resolution: ConflictFileState['resolution'] }) {
  if (!resolution) return null
  const labels = {
    ours: t('Keeping mine'),
    theirs: t('Keeping theirs'),
    manual: t('Edited manually'),
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <Check size={12} />{labels[resolution]}
    </span>
  )
}

function ConflictFileRow({
  state,
  focused,
  onResolve,
  onOpenInEditor,
  onFocus,
}: {
  state: ConflictFileState
  focused: boolean
  onResolve: (strategy: 'ours' | 'theirs') => void
  onOpenInEditor: () => void
  onFocus: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const binary = isBinaryFile(state.file)
  const resolved = state.resolution !== null

  useEffect(() => {
    if (focused) rowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  return (
    <div
      ref={rowRef}
      role="row"
      tabIndex={0}
      onFocus={onFocus}
      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors ${
        focused ? 'border-ring bg-accent/50' : 'border-border bg-background'
      } ${resolved ? 'opacity-70' : ''}`}
      data-testid={`conflict-file-${state.file}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileText size={14} className="shrink-0 text-muted-foreground" />
        <span className="text-sm truncate" title={state.file}>{fileName(state.file)}</span>
        <ResolutionLabel resolution={state.resolution} />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {state.resolving ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => onResolve('ours')}
              disabled={state.resolving}
               title={t('Keep my local version (K)')}
              data-testid={`resolve-ours-${state.file}`}
            >
              {t('Keep mine')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => onResolve('theirs')}
              disabled={state.resolving}
               title={t('Keep remote version (T)')}
              data-testid={`resolve-theirs-${state.file}`}
            >
              {t('Keep theirs')}
            </Button>
            {!binary && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={onOpenInEditor}
                 title={t('Open file in editor (O)')}
                data-testid={`resolve-open-${state.file}`}
              >
                {t('Open in editor')}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function ConflictResolverModal({
  open,
  fileStates,
  allResolved,
  committing,
  error,
  onResolveFile,
  onOpenInEditor,
  onCommit,
  onClose,
}: ConflictResolverModalProps) {
  const [focusIdx, setFocusIdx] = useState(0)
  const focusIdxRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setFocusIdx(0) // eslint-disable-line react-hooks/set-state-in-effect -- reset on dialog open
      focusIdxRef.current = 0
    }
  }, [open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }

    const idx = focusIdxRef.current
    const file = fileStates[idx]

    if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      const next = Math.min(idx + 1, fileStates.length - 1)
      setFocusIdx(next)
      focusIdxRef.current = next
      return
    }
    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      const prev = Math.max(idx - 1, 0)
      setFocusIdx(prev)
      focusIdxRef.current = prev
      return
    }

    if ((e.key === 'k' || e.key === 'K') && file && !file.resolving && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      onResolveFile(file.file, 'ours')
    } else if ((e.key === 't' || e.key === 'T') && file && !file.resolving && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      onResolveFile(file.file, 'theirs')
    } else if ((e.key === 'o' || e.key === 'O') && file && !isBinaryFile(file.file) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      onOpenInEditor(file.file)
    } else if (e.key === 'Enter' && allResolved && !committing) {
      e.preventDefault()
      onCommit()
    }
  }, [fileStates, allResolved, committing, onResolveFile, onOpenInEditor, onCommit, onClose])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[520px]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            <DialogTitle>{t('Resolve Merge Conflicts')}</DialogTitle>
          </div>
          <DialogDescription>
            {fileStates.length === 1
              ? t('1 file has merge conflicts. Choose how to resolve each file.')
              : t('{count} files have merge conflicts. Choose how to resolve each file.', { count: fileStates.length })}
          </DialogDescription>
        </DialogHeader>

        <div
          ref={listRef}
          className="flex flex-col gap-2 max-h-[300px] overflow-y-auto"
          role="grid"
          data-testid="conflict-file-list"
        >
          {fileStates.map((state, i) => (
            <ConflictFileRow
              key={state.file}
              state={state}
              focused={i === focusIdx}
              onResolve={(strategy) => onResolveFile(state.file, strategy)}
              onOpenInEditor={() => onOpenInEditor(state.file)}
              onFocus={() => {
                setFocusIdx(i)
                focusIdxRef.current = i
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-destructive" data-testid="conflict-error">{error}</p>
        )}

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            {t('K = keep mine · T = keep theirs · O = open · Enter = commit')}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
            <Button
              onClick={onCommit}
              disabled={!allResolved || committing}
              data-testid="conflict-commit-btn"
            >
              {committing ? (
                <><Loader2 size={14} className="animate-spin mr-1" />{t('Committing…')}</>
              ) : (
                t('Commit & continue')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
