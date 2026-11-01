import git from "isomorphic-git";
import { scanChangedPaths } from "./gitSelectiveStagingScan";
import type { GitVaultContext } from "./gitVault";

/** Fresh-byte verification; true only when working tree, index and HEAD all match. */
export async function stageVerifiedGitChanges(context: GitVaultContext) {
	const scan = await scanChangedPaths(context);
	if (!scan) {
		await git.add({ ...context, filepath: ".", parallel: false });
		return false;
	}
	// Arrays passed to git.add run concurrently even with parallel:false.
	for (const filepath of scan.files)
		await git.add({ ...context, filepath, parallel: false });
	return scan.clean;
}
