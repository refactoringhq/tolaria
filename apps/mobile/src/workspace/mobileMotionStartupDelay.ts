const maximumDelayMs = 10_000;

export async function waitForMotionStartupDelay(signal: AbortSignal) {
	if (typeof __DEV__ === "undefined" || !__DEV__) return;
	const delay = configuredDelay();
	if (delay === 0 || signal.aborted) return;
	await new Promise<void>((resolve) => {
		const finish = () => {
			clearTimeout(timer);
			signal.removeEventListener("abort", finish);
			resolve();
		};
		const timer = setTimeout(finish, delay);
		signal.addEventListener("abort", finish, { once: true });
	});
}

function configuredDelay() {
	const value = Number(process.env.EXPO_PUBLIC_TOLARIA_MOTION_STARTUP_DELAY_MS);
	return Number.isFinite(value)
		? Math.min(Math.max(Math.floor(value), 0), maximumDelayMs)
		: 0;
}
