import { useSyncExternalStore } from "react";
import type { Awareness } from "y-protocols/awareness";
import {
	initials,
	type PresentUser,
	presentUsers,
} from "../../packages/collab-client/src/presence";
import {
	type ActiveCollabDocument,
	getActiveCollabDocument,
	subscribeActiveCollabDocument,
} from "../lib/activeCollabDocument";
import { type AppLocale, translate } from "../lib/i18n";
import { ShareNoteButton } from "./sharing/ShareNoteButton";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

/** Avatars shown in the bar before the rest is counted, so a phone's bar keeps its room. */
const SHOWN_AVATARS = 3;

interface NotePresenceProps {
	locale?: AppLocale;
}

function useActiveCollabDocument(): ActiveCollabDocument {
	return useSyncExternalStore(
		subscribeActiveCollabDocument,
		getActiveCollabDocument,
	);
}

/** The people in the note; the list only changes when the people do, not their carets. */
function usePresentUsers(awareness: Awareness): PresentUser[] {
	const serialized = useSyncExternalStore(
		(notify) => {
			awareness.on("change", notify);
			return () => awareness.off("change", notify);
		},
		() =>
			JSON.stringify(presentUsers(awareness.getStates(), awareness.clientID)),
	);
	return JSON.parse(serialized) as PresentUser[];
}

function displayName(user: PresentUser, locale: AppLocale): string {
	return user.self
		? translate(locale, "collab.presence.you", { name: user.name })
		: user.name;
}

function Avatar({ user, locale }: { user: PresentUser; locale: AppLocale }) {
	return (
		<span
			role="img"
			aria-label={displayName(user, locale)}
			data-testid="note-presence-avatar"
			className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-text-on-fill ring-2 ring-background"
			style={{ backgroundColor: user.color }}
		>
			{initials(user.name)}
		</span>
	);
}

/** Everyone in the note by name: a tap away, because a phone has no hover. */
function PresenceList({
	users,
	locale,
}: {
	users: PresentUser[];
	locale: AppLocale;
}) {
	return (
		<ul
			className="m-0 flex list-none flex-col gap-1.5 p-0"
			data-testid="note-presence-list"
		>
			{users.map((user) => (
				<li
					key={user.clientId}
					className="flex min-w-0 items-center gap-2 text-sm"
				>
					<Avatar user={user} locale={locale} />
					<span className="truncate">{displayName(user, locale)}</span>
				</li>
			))}
		</ul>
	);
}

function PresenceStrip({
	awareness,
	locale,
}: {
	awareness: Awareness;
	locale: AppLocale;
}) {
	const users = usePresentUsers(awareness);
	const others = users.filter((user) => !user.self);
	if (others.length === 0) return null;
	const hidden = others.length - SHOWN_AVATARS;
	const label = translate(locale, "collab.presence.label");
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					aria-label={label}
					data-testid="note-presence"
					className="gap-0 -space-x-1.5 px-1"
				>
					{others.slice(0, SHOWN_AVATARS).map((user) => (
						<Avatar key={user.clientId} user={user} locale={locale} />
					))}
					{hidden > 0 && (
						<span className="pl-2.5 text-xs text-muted-foreground">
							+{hidden}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-60 p-3">
				<p className="m-0 mb-2 text-xs font-medium text-muted-foreground">
					{label}
				</p>
				<PresenceList users={users} locale={locale} />
			</PopoverContent>
		</Popover>
	);
}

/**
 * The others in the open live note, as avatars in the note's bar, and its Share button
 * (TOL-237). Nothing on the desktop, where no note is a live document; no avatars while the
 * viewer is alone.
 */
export function NotePresence({ locale = "en" }: NotePresenceProps) {
	const active = useActiveCollabDocument();
	if (active === null || active === "opening") return null;
	return (
		<>
			<PresenceStrip
				key={active.awareness.clientID}
				awareness={active.awareness}
				locale={locale}
			/>
			<ShareNoteButton notePath={active.path} locale={locale} />
		</>
	);
}
