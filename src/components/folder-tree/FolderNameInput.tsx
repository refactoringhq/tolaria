import { useCallback, useEffect, useRef, useState } from 'react'
import { Folder } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'

interface FolderNameInputProps {
  ariaLabel: string
  initialValue: string
  placeholder: string
  leftInset?: number
  selectTextOnFocus?: boolean
  submitOnBlur?: boolean
  testId: string
  onCancel: () => void
  onSubmit: (value: string) => Promise<boolean> | boolean
}

export function FolderNameInput({
  ariaLabel,
  initialValue,
  placeholder,
  leftInset = 16,
  selectTextOnFocus = false,
  submitOnBlur = false,
  testId,
  onCancel,
  onSubmit,
}: FolderNameInputProps) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    if (selectTextOnFocus) input.select()
  }, [selectTextOnFocus])

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return false
    submittingRef.current = true
    try {
      return await onSubmit(value)
    } finally {
      submittingRef.current = false
    }
  }, [onSubmit, value])

  return (
    <div className="flex items-center gap-2 rounded" style={{ paddingTop: 6, paddingBottom: 6, paddingRight: 16, paddingLeft: leftInset, borderRadius: 4 }}>
      <Folder size={17} className="size-[17px] shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        aria-label={ariaLabel}
        className="h-auto min-h-0 flex-1 rounded-sm px-2 py-[3px] text-[13px] font-medium"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={submitOnBlur ? () => { void handleSubmit() } : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void handleSubmit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder={placeholder}
        data-testid={testId}
      />
    </div>
  )
}
