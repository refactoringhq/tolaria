export async function withMobileEditLocks<T>(
	pending: Map<string, Promise<void>>,
	keys: string[],
	operation: () => T | Promise<T>,
): Promise<T> {
	const uniqueKeys = [...new Set(keys)].sort();
	const predecessors = [
		...new Set(
			uniqueKeys.flatMap((key) => {
				const lock = pending.get(key);
				return lock ? [lock] : [];
			}),
		),
	];
	let release = () => {};
	const lock = new Promise<void>((resolve) => {
		release = resolve;
	});
	for (const key of uniqueKeys) pending.set(key, lock);
	try {
		await Promise.all(predecessors);
		return await operation();
	} finally {
		release();
		for (const key of uniqueKeys)
			if (pending.get(key) === lock) pending.delete(key);
	}
}
