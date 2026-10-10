const pending = new Map<string, Promise<unknown>>()

/** Serializes editor writes and Git mutations that share a working copy. */
export async function withWorkspaceOperation<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const previous = pending.get(root) ?? Promise.resolve()
  const current = previous.catch(() => undefined).then(operation)
  pending.set(root, current)
  try {
    return await current
  } finally {
    if (pending.get(root) === current) pending.delete(root)
  }
}
