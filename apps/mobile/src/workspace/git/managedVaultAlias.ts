export function parseOptionalManagedVaultAlias(value: unknown, errorCode: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) throw new Error(errorCode)
  return value
}
