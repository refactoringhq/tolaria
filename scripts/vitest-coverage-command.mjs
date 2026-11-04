const javascriptPackageManager = /\.[mc]?js$/i;
const npmCli = /(?:^|[/\\])npm-cli\.js$/i;

export function createVitestCommand(packageManagerExec, nodeExecutable, args) {
	if (
		!packageManagerExec ||
		!javascriptPackageManager.test(packageManagerExec)
	) {
		return { command: "pnpm", args };
	}

	return {
		command: nodeExecutable,
		args: [
			packageManagerExec,
			"exec",
			...(npmCli.test(packageManagerExec) ? ["--"] : []),
			...args,
		],
	};
}
