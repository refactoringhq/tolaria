import type { useCreateBlockNote } from "@blocknote/react";
import { CaretDown, CaretUp, X } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AppLocale, translate } from "../lib/i18n";
import type { RawEditorFindRequest } from "./RawEditorFindBar";
import { useRichEditorFindController } from "./useRichEditorFindController";

function FindToolbar({
	controller,
	locale,
	inputRef,
}: {
	controller: ReturnType<typeof useRichEditorFindController>;
	locale: AppLocale;
	inputRef: React.RefObject<HTMLInputElement | null>;
}) {
	const replaceLabel = translate(
		locale,
		controller.replaceOpen
			? "editor.find.hideReplace"
			: "editor.find.showReplace",
	);

	return (
		<div className="flex min-w-0 items-center gap-1.5">
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label={replaceLabel}
				onClick={controller.toggleReplace}
			>
				<CaretDown className={controller.replaceOpen ? "" : "-rotate-90"} />
			</Button>
			<FindMatchControls
				controller={controller}
				locale={locale}
				inputRef={inputRef}
			/>
			<FindOptions controller={controller} locale={locale} />
		</div>
	);
}

function FindMatchControls({
	controller,
	locale,
	inputRef,
}: {
	controller: ReturnType<typeof useRichEditorFindController>;
	locale: AppLocale;
	inputRef: React.RefObject<HTMLInputElement | null>;
}) {
	const {
		changeQuery,
		handleEnter,
		hasMatches,
		moveNext,
		movePrevious,
		query,
	} = controller;
	return (
		<>
			<FindInput
				inputRef={inputRef}
				locale={locale}
				query={query}
				changeQuery={changeQuery}
				handleEnter={handleEnter}
			/>
			<FindMatchCount controller={controller} locale={locale} />
			<MatchNavigation
				locale={locale}
				hasMatches={hasMatches}
				moveNext={moveNext}
				movePrevious={movePrevious}
			/>
		</>
	);
}

function FindMatchCount({
	controller,
	locale,
}: {
	controller: ReturnType<typeof useRichEditorFindController>;
	locale: AppLocale;
}) {
	const count =
		controller.error === "Invalid regex"
			? translate(locale, "editor.find.invalidRegex")
			: controller.error
				? translate(locale, "editor.find.regexMustMatchText")
				: controller.statusCount === 0
					? translate(locale, "editor.find.noMatches")
					: translate(locale, "editor.find.matchCount", {
							current: controller.activeIndex + 1,
							total: controller.statusCount,
						});
	return (
		<span
			className="min-w-[4.75rem] text-right text-xs text-muted-foreground"
			aria-live="polite"
			data-testid="rich-editor-find-count"
		>
			{count}
		</span>
	);
}

function MatchNavigation({
	locale,
	hasMatches,
	moveNext,
	movePrevious,
}: {
	locale: AppLocale;
	hasMatches: boolean;
	moveNext: () => void;
	movePrevious: () => void;
}) {
	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label={translate(locale, "editor.find.previousMatch")}
				disabled={!hasMatches}
				onClick={movePrevious}
			>
				<CaretUp />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label={translate(locale, "editor.find.nextMatch")}
				disabled={!hasMatches}
				onClick={moveNext}
			>
				<CaretDown />
			</Button>
		</>
	);
}

function FindOptions({
	controller,
	locale,
}: {
	controller: ReturnType<typeof useRichEditorFindController>;
	locale: AppLocale;
}) {
	return (
		<>
			<Button
				type="button"
				variant={controller.regex ? "secondary" : "ghost"}
				size="xs"
				aria-label={translate(locale, "editor.find.regex")}
				aria-pressed={controller.regex}
				onClick={() => controller.setRegex((value) => !value)}
			>
				*
			</Button>
			<Button
				type="button"
				variant={controller.caseSensitive ? "secondary" : "ghost"}
				size="xs"
				aria-label={translate(locale, "editor.find.matchCase")}
				aria-pressed={controller.caseSensitive}
				onClick={() => controller.setCaseSensitive((value) => !value)}
			>
				Aa
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				aria-label={translate(locale, "editor.find.close")}
				onClick={controller.close}
			>
				<X />
			</Button>
		</>
	);
}

function FindInput({
	inputRef,
	locale,
	query,
	changeQuery,
	handleEnter,
}: {
	inputRef: React.RefObject<HTMLInputElement | null>;
	locale: AppLocale;
	query: string;
	changeQuery: (value: string) => void;
	handleEnter: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
	return (
		<Input
			ref={inputRef}
			type="search"
			aria-label={translate(locale, "editor.find.findLabel")}
			placeholder={translate(locale, "editor.find.findPlaceholder")}
			value={query}
			onChange={(event) => changeQuery(event.target.value)}
			onKeyDown={handleEnter}
			className="h-7 min-w-[12rem] flex-1 rounded px-2 text-xs"
			data-testid="rich-editor-find-input"
		/>
	);
}

function ReplaceFields({
	controller,
	locale,
}: {
	controller: ReturnType<typeof useRichEditorFindController>;
	locale: AppLocale;
}) {
	const {
		hasMatches,
		replaceAll,
		replaceCurrent,
		replacement,
		setReplacement,
	} = controller;
	return (
		<div className="ml-[1.875rem] flex min-w-0 items-center gap-1.5">
			<Input
				type="text"
				aria-label={translate(locale, "editor.find.replaceLabel")}
				placeholder={translate(locale, "editor.find.replacePlaceholder")}
				value={replacement}
				onChange={(event) => setReplacement(event.target.value)}
				className="h-7 min-w-[12rem] flex-1 rounded px-2 text-xs"
				data-testid="rich-editor-replace-input"
			/>
			<Button
				type="button"
				variant="outline"
				size="xs"
				disabled={!hasMatches}
				onClick={replaceCurrent}
			>
				{translate(locale, "editor.find.replace")}
			</Button>
			<Button
				type="button"
				variant="outline"
				size="xs"
				disabled={!hasMatches}
				onClick={replaceAll}
			>
				{translate(locale, "editor.find.replaceAll")}
			</Button>
		</div>
	);
}

export function RichEditorFindBar({
	editor,
	locale = "en",
	path,
	request,
}: {
	editor: ReturnType<typeof useCreateBlockNote>;
	locale?: AppLocale;
	path: string;
	request: RawEditorFindRequest;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const controller = useRichEditorFindController({ editor, path, request });

	useEffect(() => {
		if (!controller.open) return;
		const frame = requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
		return () => cancelAnimationFrame(frame);
	}, [controller.open, request]);

	if (!controller.open) return null;
	return (
		<div
			className="order-first flex shrink-0 flex-col gap-1.5 border-b px-3 py-2"
			data-testid="rich-editor-find-bar"
			onKeyDownCapture={controller.handleEscape}
			style={{
				background: "var(--surface-editor)",
				borderColor: "var(--border-subtle)",
			}}
		>
			<FindToolbar
				controller={controller}
				inputRef={inputRef}
				locale={locale}
			/>
			{controller.replaceOpen && (
				<ReplaceFields controller={controller} locale={locale} />
			)}
		</div>
	);
}
