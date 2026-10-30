export interface DirectorContext {
	$: <E extends Element = HTMLElement>(selector: string) => E | null;
	waitFor: <T>(probe: () => T | null | undefined | false, label: string, timeoutMs?: number) => Promise<T>;
	setInputValue: (input: HTMLInputElement, value: string) => void;
	pressKey: (key: string, init?: KeyboardEventInit) => void;
	/** Dispatches a real app command (same path as the menu / shortcut). */
	appCommand: (id: string) => void;
	settle: (quietMs?: number, timeoutMs?: number) => Promise<void>;
	sleep: (ms: number) => Promise<void>;
	nextPaint: () => Promise<void>;
}

export interface SceneEvent {
	frame: number;
	run: (ctx: DirectorContext) => Promise<void> | void;
}

export interface Scene {
	/** Runs once after boot, before frame 0 (e.g. open the starting note). */
	setup: (ctx: DirectorContext) => Promise<void>;
	/** Discrete UI events, sorted by frame. */
	events: SceneEvent[];
	/** Pure per-frame visual pass (entrance transforms etc.). Must not change app state. */
	style?: (frame: number, ctx: DirectorContext) => void;
	/** Named regions the Remotion overlay needs this frame (in app CSS pixels). */
	measure?: (frame: number) => Record<string, string | (() => Element | Range | null)>;
	css?: string;
}
