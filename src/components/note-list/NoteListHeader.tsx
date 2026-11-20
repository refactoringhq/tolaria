import {
	CircleNotch as Loader2,
	MagnifyingGlass,
	Plus,
	SidebarSimple,
	X,
} from "@phosphor-icons/react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAppCommandShortcutDisplay } from "../../hooks/appCommandCatalog";
import {
	APP_COMMAND_EVENT_NAME,
	APP_COMMAND_IDS,
} from "../../hooks/appCommandDispatcher";
import { useDragRegion } from "../../hooks/useDragRegion";
import { type AppLocale, translate } from "../../lib/i18n";
import { trackEvent } from "../../lib/telemetry";
import { TOUCH_TARGET_CLASSNAME } from "../../lib/touchInput";
import type { VaultEntry } from "../../types";
import type { GitRepositoryOption } from "../../utils/gitRepositories";
import type { SortDirection, SortOption } from "../../utils/noteListHelpers";
import { isMac, MACOS_TRAFFIC_LIGHT_SAFE_PADDING } from "../../utils/platform";
import { GitRepositorySelect } from "../GitRepositorySelect";
import { SortDropdown } from "../SortDropdown";
import type { ListPropertiesPopoverProps } from "./ListPropertiesPopover";
import { NoteListPropertyActions } from "./NoteListPropertyActions";

/** One treatment for every note-list header icon button: a 24px ghost square with the same hover, open and focus fill. */
export const NOTE_LIST_ACTION_BUTTON_CLASSNAME = `${TOUCH_TARGET_CLASSNAME} !h-6 !w-6 !min-w-0 !rounded-md !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent focus-visible:!text-foreground data-[state=open]:!bg-accent data-[state=open]:!text-foreground aria-expanded:!bg-accent aria-expanded:!text-foreground [&_svg]:!size-4`;
const NOTE_LIST_SEARCH_DEBOUNCE_MS = 180;
interface NoteListHeaderProps {
	title: string;
	typeDocument: VaultEntry | null;
	isEntityView: boolean;
	isChangesView?: boolean;
	listSort: SortOption;
	listDirection: SortDirection;
	customProperties: string[];
	sidebarCollapsed?: boolean;
	searchVisible: boolean;
	search: string;
	isSearching: boolean;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	propertyPicker?: ListPropertiesPopoverProps | null;
	propertyVisibility?: { visible: boolean; onToggle: () => void };
	/** Layout menus (List/Kanban and layout-specific settings) shown before the sort control. */
	layoutControls?: React.ReactNode;
	gitRepositories?: GitRepositoryOption[];
	selectedGitRepositoryPath?: string;
	locale?: AppLocale;
	onSortChange: (
		groupLabel: string,
		option: SortOption,
		direction: SortDirection,
	) => void;
	onCreateNote: () => void;
	onOpenType: (entry: VaultEntry) => void;
	onToggleSearch: () => void;
	onSearchChange: (value: string) => void;
	onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
	onGitRepositoryChange?: (path: string) => void;
}

function dispatchExpandSidebarFromHeader() {
	trackEvent("sidebar_expanded_from_note_list_header");
	window.dispatchEvent(
		new CustomEvent(APP_COMMAND_EVENT_NAME, {
			detail: APP_COMMAND_IDS.viewAll,
		}),
	);
}

function ExpandSidebarButton({ locale }: { locale: AppLocale }) {
	const expandSidebarLabel = translate(locale, "sidebar.action.expand");

	return (
		<ActionTooltip copy={{ label: expandSidebarLabel }}>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
				onClick={dispatchExpandSidebarFromHeader}
				aria-label={expandSidebarLabel}
				data-no-drag
			>
				<SidebarSimple size={16} weight="regular" />
			</Button>
		</ActionTooltip>
	);
}

function HeaderTitle({
	title,
	typeDocument,
	onOpenType,
}: Pick<NoteListHeaderProps, "title" | "typeDocument" | "onOpenType">) {
	const handleClick = typeDocument ? () => onOpenType(typeDocument) : undefined;

	if (typeDocument && handleClick) {
		return (
			<button
				type="button"
				className="m-0 min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left text-[14px] font-semibold"
				onClick={handleClick}
				data-testid="type-header-link"
			>
				{title}
			</button>
		);
	}

	return (
		<h3 className="m-0 min-w-0 flex-1 truncate text-[14px] font-semibold">
			{title}
		</h3>
	);
}

function HeaderLeading({
	title,
	typeDocument,
	sidebarCollapsed,
	locale,
	onOpenType,
}: Pick<
	NoteListHeaderProps,
	"title" | "typeDocument" | "sidebarCollapsed" | "locale" | "onOpenType"
> & { locale: AppLocale }) {
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2 [html[data-touch-input]_&]:!basis-full">
			{sidebarCollapsed && <ExpandSidebarButton locale={locale} />}
			<HeaderTitle
				title={title}
				typeDocument={typeDocument}
				onOpenType={onOpenType}
			/>
		</div>
	);
}

function shouldShowRepositorySelector(
	isChangesView: boolean | undefined,
	onChange: NoteListHeaderProps["onGitRepositoryChange"],
	repositories: GitRepositoryOption[],
) {
	return Boolean(isChangesView && onChange && repositories.length > 1);
}

function RepositorySelectorRow({
	isChangesView,
	gitRepositories = [],
	selectedGitRepositoryPath = "",
	locale = "en",
	onGitRepositoryChange,
}: Pick<
	NoteListHeaderProps,
	| "isChangesView"
	| "gitRepositories"
	| "selectedGitRepositoryPath"
	| "locale"
	| "onGitRepositoryChange"
>) {
	if (
		!shouldShowRepositorySelector(
			isChangesView,
			onGitRepositoryChange,
			gitRepositories,
		)
	)
		return null;
	if (!onGitRepositoryChange) return null;

	return (
		<div
			className="flex h-11 shrink-0 items-center border-b border-border px-4"
			style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
		>
			<GitRepositorySelect
				label={translate(locale, "git.repository.select")}
				repositories={gitRepositories}
				selectedPath={selectedGitRepositoryPath}
				onChange={onGitRepositoryChange}
				testId="changes-repository-select"
			/>
		</div>
	);
}

function LayoutSortActions({ options }: { options: NoteListHeaderProps }) {
	const {
		isEntityView,
		listSort,
		listDirection,
		customProperties,
		layoutControls,
		locale,
		onSortChange,
	} = options;
	return (
		<>
			{layoutControls}
			{!isEntityView && (
				<SortDropdown
					groupLabel="__list__"
					current={listSort}
					direction={listDirection}
					customProperties={customProperties}
					locale={locale}
					iconButtonClassName={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
					onChange={onSortChange}
				/>
			)}
		</>
	);
}

function SearchAction({ options }: { options: NoteListHeaderProps }) {
	const { locale = "en", onToggleSearch } = options;
	return (
		<ActionTooltip
			copy={{
				label: translate(locale, "noteList.tooltip.search"),
				shortcut: isMac() ? "⌘F" : "Ctrl+F",
			}}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
				onClick={onToggleSearch}
				aria-label={translate(locale, "noteList.tooltip.search")}
			>
				<MagnifyingGlass size={16} />
			</Button>
		</ActionTooltip>
	);
}

function CreateNoteAction({ options }: { options: NoteListHeaderProps }) {
	const { locale = "en", onCreateNote } = options;
	const createNoteRef = useRef(onCreateNote);
	const deferCreateRef = useRef(false);
	useLayoutEffect(() => {
		createNoteRef.current = onCreateNote;
	}, [onCreateNote]);
	const captureCreateOrigin = useCallback(() => {
		const activeElement = document.activeElement;
		deferCreateRef.current =
			activeElement instanceof Element &&
			activeElement.closest(".raw-editor-codemirror") !== null;
	}, []);
	const handleCreateNote = useCallback(() => {
		if (!deferCreateRef.current) {
			createNoteRef.current();
			return;
		}
		deferCreateRef.current = false;
		window.setTimeout(() => createNoteRef.current(), 0);
	}, []);
	return (
		<ActionTooltip
			copy={{
				label: translate(locale, "noteList.createNote"),
				shortcut: getAppCommandShortcutDisplay(APP_COMMAND_IDS.fileNewNote),
			}}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
				onMouseDown={captureCreateOrigin}
				onClick={handleCreateNote}
				aria-label={translate(locale, "noteList.createNote")}
			>
				<Plus size={16} />
			</Button>
		</ActionTooltip>
	);
}

function HeaderActions(options: NoteListHeaderProps) {
	const { propertyPicker, propertyVisibility, locale = "en" } = options;
	return (
		<div
			className="ml-3 flex shrink-0 items-center justify-end gap-1 [html[data-touch-input]_&]:!ml-0 [html[data-touch-input]_&]:!w-full [html[data-touch-input]_&]:!justify-end"
			style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
		>
			<LayoutSortActions options={options} />
			<SearchAction options={options} />
			<NoteListPropertyActions
				propertyPicker={propertyPicker}
				propertyVisibility={propertyVisibility}
				locale={locale}
				triggerClassName={NOTE_LIST_ACTION_BUTTON_CLASSNAME}
			/>
			<CreateNoteAction options={options} />
		</div>
	);
}

function SearchRow({
	search,
	isSearching,
	searchInputRef,
	locale,
	onSearchChange,
	onSearchKeyDown,
}: Pick<
	NoteListHeaderProps,
	| "search"
	| "isSearching"
	| "searchInputRef"
	| "locale"
	| "onSearchChange"
	| "onSearchKeyDown"
> & {
	locale: AppLocale;
}) {
	const [draft, setDraft] = useState(search);
	const debounceRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

	const cancelDebounce = useCallback(() => {
		if (debounceRef.current === null) return;
		window.clearTimeout(debounceRef.current);
		debounceRef.current = null;
	}, []);

	useEffect(() => cancelDebounce, [cancelDebounce]);

	const hasSearch = draft.length > 0;
	const isDebouncing =
		draft.trim().toLowerCase() !== search.trim().toLowerCase();
	const clearLabel = translate(locale, "noteList.clearSearch");

	const handleClearSearch = () => {
		cancelDebounce();
		setDraft("");
		onSearchChange("");
		requestAnimationFrame(() => {
			searchInputRef.current?.focus();
		});
	};

	const handleSearchChange = (value: string) => {
		setDraft(value);
		cancelDebounce();

		if (value.trim().length === 0) {
			onSearchChange("");
			return;
		}

		debounceRef.current = window.setTimeout(() => {
			debounceRef.current = null;
			onSearchChange(value);
		}, NOTE_LIST_SEARCH_DEBOUNCE_MS);
	};

	return (
		<div className="border-b border-border px-3 py-2">
			<div className="relative flex-1" aria-live="polite">
				<Input
					ref={searchInputRef}
					placeholder={translate(locale, "noteList.searchPlaceholder")}
					value={draft}
					onChange={(event) => handleSearchChange(event.target.value)}
					onKeyDown={onSearchKeyDown}
					className="h-8 pr-16 text-[13px]"
				/>
				{hasSearch && (
					<ClearSearchButton label={clearLabel} onClear={handleClearSearch} />
				)}
				{(isDebouncing || isSearching) && (
					<span
						className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground"
						data-testid="note-list-search-loading"
					>
						<Loader2 size={12} className="animate-spin" />
					</span>
				)}
			</div>
		</div>
	);
}

function ClearSearchButton({
	label,
	onClear,
}: {
	label: string;
	onClear: () => void;
}) {
	return (
		<ActionTooltip copy={{ label }}>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="absolute inset-y-1 right-8 !h-6 !w-6 !min-w-0 !rounded !p-0 !text-muted-foreground hover:!bg-accent hover:!text-foreground focus-visible:!bg-accent [&_svg]:!size-3"
				onMouseDown={(event) => event.preventDefault()}
				onClick={onClear}
				aria-label={label}
			>
				<X size={12} />
			</Button>
		</ActionTooltip>
	);
}

function HeaderPrimaryRow({
	options,
	collapsedSidebarPadding,
}: {
	options: NoteListHeaderProps;
	collapsedSidebarPadding: string | undefined;
}) {
	const {
		title,
		typeDocument,
		sidebarCollapsed,
		locale = "en",
		onOpenType,
	} = options;
	const { dragRegionRef } = useDragRegion<HTMLDivElement>();

	return (
		<div
			ref={dragRegionRef}
			className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4 [html[data-touch-input]_&]:!h-auto [html[data-touch-input]_&]:!min-h-[92px] [html[data-touch-input]_&]:!flex-wrap [html[data-touch-input]_&]:!justify-start [html[data-touch-input]_&]:!content-center [html[data-touch-input]_&]:!gap-0 [html[data-touch-input]_&]:!px-1.5"
			style={{ cursor: "default", paddingLeft: collapsedSidebarPadding }}
		>
			<HeaderLeading
				title={title}
				typeDocument={typeDocument}
				sidebarCollapsed={sidebarCollapsed}
				locale={locale}
				onOpenType={onOpenType}
			/>
			<HeaderActions {...options} />
		</div>
	);
}

function HeaderSecondaryRows({ options }: { options: NoteListHeaderProps }) {
	const {
		isChangesView = false,
		gitRepositories = [],
		selectedGitRepositoryPath = "",
		locale = "en",
		onGitRepositoryChange,
		searchVisible,
		search,
		isSearching,
		searchInputRef,
		onSearchChange,
		onSearchKeyDown,
	} = options;

	return (
		<>
			<RepositorySelectorRow
				isChangesView={isChangesView}
				gitRepositories={gitRepositories}
				selectedGitRepositoryPath={selectedGitRepositoryPath}
				locale={locale}
				onGitRepositoryChange={onGitRepositoryChange}
			/>
			{searchVisible && (
				<SearchRow
					search={search}
					isSearching={isSearching}
					searchInputRef={searchInputRef}
					locale={locale}
					onSearchChange={onSearchChange}
					onSearchKeyDown={onSearchKeyDown}
				/>
			)}
		</>
	);
}

export function NoteListHeader(options: NoteListHeaderProps) {
	const { sidebarCollapsed } = options;
	const collapsedSidebarPadding =
		sidebarCollapsed && isMac()
			? `var(--tolaria-macos-traffic-light-padding, ${MACOS_TRAFFIC_LIGHT_SAFE_PADDING}px)`
			: undefined;

	return (
		<>
			<HeaderPrimaryRow
				options={options}
				collapsedSidebarPadding={collapsedSidebarPadding}
			/>
			<HeaderSecondaryRows options={options} />
		</>
	);
}
