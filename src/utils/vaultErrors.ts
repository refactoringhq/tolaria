export function errorMessage(error: unknown, fallback = String(error)): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error
    if (typeof message === 'string') return message
  }
  return fallback
}

export function errorMessageIncludes(error: unknown, ...needles: string[]): boolean {
  const message = errorMessage(error, '')
  return Boolean(message) && needles.every(needle => message.includes(needle))
}

export function isActiveVaultUnavailableError(error: unknown): boolean {
  return /no active vault selected|active vault is not available/i.test(errorMessage(error))
}
