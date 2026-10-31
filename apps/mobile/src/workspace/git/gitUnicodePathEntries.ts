type PathRecord<T> = { filepath: string; entries: (T | null)[] };

export function coalesceUnicodeEquivalentEntries<T>(
	records: PathRecord<T>[],
	worktreeIndex: number,
	trackedIndexes: number[],
) {
	return [...groupByNormalizedPath(records).values()].flatMap((group) =>
		coalesceGroup(group, worktreeIndex, trackedIndexes),
	);
}

function groupByNormalizedPath<T>(records: PathRecord<T>[]) {
	const groups = new Map<string, PathRecord<T>[]>();
	for (const record of records) {
		const key = record.filepath.normalize("NFC");
		groups.set(key, [...(groups.get(key) ?? []), record]);
	}
	return groups;
}

function coalesceGroup<T>(
	group: PathRecord<T>[],
	worktreeIndex: number,
	trackedIndexes: number[],
) {
	if (group.length < 2) return group;
	const worktreeRecords = group.filter(
		(record) => record.entries[worktreeIndex],
	);
	if (!hasSinglePathForEachTree(group, worktreeRecords, trackedIndexes))
		return group;
	const entries = mergeEntries(group, worktreeRecords[0], worktreeIndex);
	const canonical =
		group.find((record) =>
			trackedIndexes.some((index) => record.entries[index]),
		) ?? worktreeRecords[0];
	return [{ filepath: canonical.filepath, entries }];
}

function hasSinglePathForEachTree<T>(
	group: PathRecord<T>[],
	worktreeRecords: PathRecord<T>[],
	trackedIndexes: number[],
) {
	return (
		worktreeRecords.length === 1 &&
		trackedIndexes.every(
			(index) => group.filter((record) => record.entries[index]).length <= 1,
		)
	);
}

function mergeEntries<T>(
	group: PathRecord<T>[],
	worktree: PathRecord<T>,
	worktreeIndex: number,
) {
	const merged = [...worktree.entries];
	for (const record of group) {
		record.entries.forEach((entry, index) => {
			if (index !== worktreeIndex && !merged[index] && entry)
				merged[index] = entry;
		});
	}
	return merged;
}
