import {
	type KeyboardEvent as ReactKeyboardEvent,
	type RefObject,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { VaultEntry } from "../types";
import type { NoteReference } from "../utils/ai-context";
import {
	readSelectionRange,
	serializeInlineNode,
	type InlineSelectionRange,
} from "./inlineWikilinkDom";
import { isWindowsRuntime } from "./inlineWikilinkInputEvents";
import {
	containsUnsupportedInlineContent,
	submitInlineValue,
} from "./inlineWikilinkInputOperations";
import { extractInlineWikilinkReferences } from "./inlineWikilinkText";
import { normalizeInlineWikilinkValue } from "./inlineWikilinkTokens";

const POST_COMPOSITION_TEXT_INPUT_SETTLE_MS = 120;

// Windows IMEs such as Sogou Pinyin drive WebView2 without ever surfacing
// DOM composition events: every keystroke arrives as a bare insertText with
// isComposing=false, a helper injected into the WebView2 renderer cancels
// that beforeinput after the app handler returns, and any remount of the
// editor destroys the hidden TSF composition (GitHub #1329 field log). Keep
// the native pipeline alive there: the beforeinput is shielded from later
// cancelers, the browser inserts the text, and every input event publishes
// the serialized value NON-destructively — the editor node and its rendered
// segments stay untouched while the IME might still be composing, so a
// value sync can never land mid-composition and swallow input. Canonical
// remounts (segment rebuilds from state) happen only once the IME is
// guaranteed idle: the composition-end settle, blur, or user-driven edits.

export function usePostCompositionTextInputSettle() {
	const isSettlingCompositionRef = useRef(false);
	const compositionSettleTimerRef = useRef<number | null>(null);
	const clearCompositionSettleWindow = useCallback(() => {
		isSettlingCompositionRef.current = false;
		if (compositionSettleTimerRef.current === null) return;

		window.clearTimeout(compositionSettleTimerRef.current);
		compositionSettleTimerRef.current = null;
	}, []);
	const startCompositionSettleWindow = useCallback(
		(onSettled: () => void) => {
			clearCompositionSettleWindow();
			isSettlingCompositionRef.current = true;
			compositionSettleTimerRef.current = window.setTimeout(() => {
				compositionSettleTimerRef.current = null;
				onSettled();
			}, POST_COMPOSITION_TEXT_INPUT_SETTLE_MS);
		},
		[clearCompositionSettleWindow],
	);

	useLayoutEffect(
		() => () => clearCompositionSettleWindow(),
		[clearCompositionSettleWindow],
	);

	return {
		clearCompositionSettleWindow,
		hasPendingCompositionFlush: () =>
			compositionSettleTimerRef.current !== null,
		isSettlingCompositionRef,
		startCompositionSettleWindow,
	};
}

// A helper injected into WebView2 renderers (Sogou Pinyin compatibility
// layer) cancels native beforeinput events after the app handler returns,
// which makes the IME roll the just-inserted text back (GitHub #1329). When
// we deliberately keep an insertion native, cut the propagation so no later
// listener can cancel it. Only needed on Windows runtimes.
export function shieldNativeBeforeInput(nativeEvent: InputEvent): void {
	if (!isWindowsRuntime()) return;

	nativeEvent.stopImmediatePropagation();
}

// The shield must fire before any later listener the injected helper could
// have registered, so the native handler is attached in the capture phase
// and re-attached whenever the editor remounts (key = renderVersion).
export function useShieldedBeforeInput(
	editorRef: RefObject<HTMLDivElement | null>,
	handleBeforeInput: (nativeEvent: InputEvent) => void,
	renderVersion: number,
): void {
	useLayoutEffect(() => {
		void renderVersion;
		const editor = editorRef.current;
		if (!editor) return;

		editor.setAttribute("data-ime-shield", "capture");
		editor.addEventListener("beforeinput", handleBeforeInput as EventListener, {
			capture: true,
		});
		return () =>
			editor.removeEventListener(
				"beforeinput",
				handleBeforeInput as EventListener,
				{ capture: true },
			);
	}, [editorRef, handleBeforeInput, renderVersion]);
}

export interface EditorValuePublishOptions {
	currentValue: string
	editor: HTMLDivElement | null
	hadPendingInput: boolean
	onChange: (nextValue: string) => void
	onUnsupportedMutation: () => void
	remount: (nextValue: string) => void
	setPendingFocusAfterRemount: (selection: InlineSelectionRange | null) => void
	setSelectionRange: (selection: InlineSelectionRange) => void
}

// Serializes the live editor DOM and publishes the value. `remount` is a
// no-op for the non-destructive Windows IME sync; a real remount rebuilds
// the canonical segment DOM once the IME is guaranteed idle (#1329).
export function publishEditorValue(options: EditorValuePublishOptions): void {
	const { editor } = options;
	if (editor === null) return;
	if (containsUnsupportedInlineContent(editor)) {
		options.onUnsupportedMutation();
		return;
	}

	const nextValue = normalizeInlineWikilinkValue(serializeInlineNode(editor));
	if (!options.hadPendingInput && nextValue === options.currentValue) return;

	const nextSelection = readSelectionRange(editor);
	const clampedSelection: InlineSelectionRange = {
		start: Math.min(nextSelection.start, nextValue.length),
		end: Math.min(nextSelection.end, nextValue.length),
	};
	const shouldRestoreFocus = document.activeElement === editor;
	options.setPendingFocusAfterRemount(
		shouldRestoreFocus ? clampedSelection : null,
	);
	options.onChange(nextValue);
	options.setSelectionRange(clampedSelection);
	options.remount(nextValue);
}

export interface RenderedEditorValue {
	lastPublishedValueRef: { current: string }
	pendingCompositionInputRef: { current: boolean }
	publishValue: (nextValue: string) => void
	renderState: { value: string; version: number }
	remountWith: (nextValue: string) => void
	suppressEchoRemountRef: { current: boolean }
}

// The rendered segments stay frozen at the last canonical remount: between
// remounts the editor DOM belongs to the browser/IME, so React must never
// reconcile its children against natively mutated content (#1329).
export function useRenderedEditorValue(
	value: string,
	onChange: (nextValue: string) => void,
): RenderedEditorValue {
	const [renderState, setRenderState] = useState({ value, version: 0 });
	const lastPublishedValueRef = useRef(value);
	const suppressEchoRemountRef = useRef(false);
	// True while the live editor DOM holds input that no canonical remount
	// has absorbed yet. Every remount rebuilds the DOM from state, so it
	// always resolves the pending state.
	const pendingCompositionInputRef = useRef(false);
	const publishValue = useCallback(
		(nextValue: string) => {
			lastPublishedValueRef.current = nextValue;
			onChange(nextValue);
		},
		[onChange],
	);
	const remountWith = useCallback((nextValue: string) => {
		suppressEchoRemountRef.current = false;
		pendingCompositionInputRef.current = false;
		setRenderState((current) => ({
			value: nextValue,
			version: current.version + 1,
		}));
	}, []);
	return {
		lastPublishedValueRef,
		pendingCompositionInputRef,
		publishValue,
		renderState,
		remountWith,
		suppressEchoRemountRef,
	};
}

export function useCanonicalRemountGuard(args: {
	editorRef: RefObject<HTMLDivElement | null>
	isComposingRef: { current: boolean }
	lastPublishedValueRef: { current: string }
	remountWith: (nextValue: string) => void
	renderedValue: string
	selectionRange: InlineSelectionRange
	pendingFocusAfterRemountRef: { current: InlineSelectionRange | null }
	suppressEchoRemountRef: { current: boolean }
	value: string
}): void {
	const {
		editorRef,
		isComposingRef,
		lastPublishedValueRef,
		pendingFocusAfterRemountRef,
		remountWith,
		renderedValue,
		selectionRange,
		suppressEchoRemountRef,
		value,
	} = args;
	// External or hook-driven value changes (parent clears the draft,
	// suggestion picks) must rebuild the canonical segment DOM, except:
	// 1. Never during a live composition — the editor DOM belongs to the IME
	//    and rebuilding it destroys the TSF anchor (#1329). Deferred value
	//    changes are absorbed after the composition-end settle.
	// 2. Never while the props merely equal the frozen render: right after an
	//    IME commit (compositionend fired, settle flush still pending) the
	//    live DOM holds the just-committed text that no publish has carried
	//    yet, and the keyup/click that follows every IME commit re-renders
	//    the component. Remounting from those stale props wiped the committed
	//    Chinese from the composer (Microsoft Pinyin, #1329 v6 regression).
	//    The settle flush publishes the DOM truth; explicit actions (send,
	//    paste, pick) commit canonically on their own.
	// 3. Echoes of the non-destructive Windows IME publish are exempt:
	//    remounting mid-session would kill the hidden TSF composition.
	useLayoutEffect(() => {
		if (isComposingRef.current) return;
		if (value === renderedValue) return;
		if (
			suppressEchoRemountRef.current &&
			value === lastPublishedValueRef.current
		)
			return;

		const editor = editorRef.current;
		const shouldRestoreFocus =
			editor !== null && document.activeElement === editor;
		pendingFocusAfterRemountRef.current = shouldRestoreFocus
			? selectionRange
			: null;
		remountWith(value);
	}, [
		editorRef,
		isComposingRef,
		lastPublishedValueRef,
		pendingFocusAfterRemountRef,
		remountWith,
		renderedValue,
		selectionRange,
		suppressEchoRemountRef,
		value,
	]);
}

export interface CommitEditorValueBeforeSubmitOptions {
	clearSettleWindow: () => void
	editor: HTMLDivElement | null
	fallbackValue: string
	pendingCompositionInputRef: { current: boolean }
	pendingFocusAfterRemountRef: { current: InlineSelectionRange | null }
	publishValue: (nextValue: string) => void
	remountWith: (nextValue: string) => void
	renderedValue: string
	setSelectionRange: (selection: InlineSelectionRange) => void
}

// Sends are explicit user actions, so the live DOM value is committed
// canonically BEFORE the submit fires. A whole composition can commit inside
// the IME without a single publish reaching React (Microsoft Pinyin); the
// parent's clear-after-send is then a prop no-op ('' -> '') that no value
// change could ever signal. Canonicalizing here gives the clear a render to
// diff against, and cancelling the settle flush keeps it from resurrecting
// the sent text (#1329).
export function commitEditorValueBeforeSubmit(
	options: CommitEditorValueBeforeSubmitOptions,
): string {
	const liveValue = options.editor
		? normalizeInlineWikilinkValue(serializeInlineNode(options.editor))
		: options.fallbackValue;
	options.clearSettleWindow();
	if (liveValue === options.renderedValue && !options.pendingCompositionInputRef.current)
		return liveValue;

	const endSelection = { start: liveValue.length, end: liveValue.length };
	options.pendingCompositionInputRef.current = false;
	options.publishValue(liveValue);
	options.setSelectionRange(endSelection);
	options.pendingFocusAfterRemountRef.current =
		document.activeElement === options.editor ? endSelection : null;
	options.remountWith(liveValue);
	return liveValue;
}

export interface SubmitEditorValueOptions {
	editor: HTMLDivElement | null
	entries: VaultEntry[]
	onSubmit?: (text: string, references: NoteReference[]) => void
	references: NoteReference[]
	submitOnEmpty: boolean
	value: string
}

// Submits the live DOM value, not the React state: the non-destructive
// Windows sync keeps state fresh, but the DOM stays the source of truth.
export function submitEditorValue(options: SubmitEditorValueOptions): void {
	const currentValue = options.editor
		? normalizeInlineWikilinkValue(serializeInlineNode(options.editor))
		: options.value;
	const currentReferences =
		currentValue === options.value
			? options.references
			: extractInlineWikilinkReferences(currentValue, options.entries);

	submitInlineValue({
		onSubmit: options.onSubmit,
		submitOnEmpty: options.submitOnEmpty,
		value: currentValue,
		references: currentReferences,
	});
}

// event.timeStamp is only comparable with other event timeStamps, not with
// performance.now(), so the perf-clock twin is recorded beside it (#1329).
export function recordImeKeyDownSignal(
	event: ReactKeyboardEvent<HTMLDivElement>,
	lastImeKeyDownAtRef: { current: number | null },
	lastImeKeyDownPerfAtRef: { current: number | null },
): void {
	if (
		event.keyCode !== 229 &&
		!event.nativeEvent.isComposing &&
		event.key !== "Process"
	)
		return;

	const imeKeyDownAt = event.nativeEvent.timeStamp;
	if (typeof imeKeyDownAt === "number")
		lastImeKeyDownAtRef.current = imeKeyDownAt;
	lastImeKeyDownPerfAtRef.current = performance.now();
}
