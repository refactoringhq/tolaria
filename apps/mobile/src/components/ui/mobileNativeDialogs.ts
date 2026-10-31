import { Alert } from 'react-native'

type NativeConfirmation = {
  cancelLabel: string
  confirmLabel: string
  message: string
  onConfirm: () => void
  title: string
}

export type NativeTextPrompt = {
  cancelLabel: string
  defaultValue?: string
  message?: string
  onCancel: () => void
  onSubmit: (value: string) => void
  submitLabel: string
  title: string
  validate?: (value: string) => string | null
}

export function showNativeConfirmation({ cancelLabel, confirmLabel, message, onConfirm, title }: NativeConfirmation) {
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ])
}

export function showNativeTextPrompt(prompt: NativeTextPrompt) {
  Alert.prompt(
    prompt.title,
    prompt.message,
    [
      { text: prompt.cancelLabel, style: 'cancel', onPress: prompt.onCancel },
      {
        text: prompt.submitLabel,
        onPress: (value?: string) => {
          const input = value ?? ''
          const error = prompt.validate?.(input)
          if (error) {
            showNativeTextPrompt({ ...prompt, defaultValue: input, message: error })
            return
          }
          prompt.onSubmit(input)
        },
      },
    ],
    'plain-text',
    prompt.defaultValue,
  )
}

export function submitPromptValueAfterStateUpdate(
  value: string,
  onChangeText: (value: string) => void,
  onSubmit: () => void,
) {
  onChangeText(value)
  requestAnimationFrame(onSubmit)
}
