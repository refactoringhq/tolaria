import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { type AppLocale, translate } from "../../lib/i18n";
import { HIDE_CREATED_TIME, HIDE_MODIFIED_TIME } from "./noteListMetadata";

const COMPUTED_FIELDS = [
	{ key: HIDE_CREATED_TIME, label: "noteList.sort.created" },
	{ key: HIDE_MODIFIED_TIME, label: "noteList.sort.modified" },
] as const;

export function renderComputedProperties(
	currentDisplay: string[],
	search: string,
	locale: AppLocale,
	onToggle: (key: string) => void,
): ReactNode {
	const title = translate(locale, "noteList.properties.computed");
	const fields = COMPUTED_FIELDS.map(({ key, label }) => ({
		key,
		label: translate(locale, label),
	})).filter(
		({ label }) =>
			title.toLowerCase().includes(search) ||
			label.toLowerCase().includes(search),
	);
	if (fields.length === 0) return null;

	return (
		<fieldset className="mb-1 min-w-0 border-b border-border pb-1">
			<legend className="px-1 text-xs text-muted-foreground">{title}</legend>
			{fields.map(({ key, label }) => (
				<label
					key={key}
					htmlFor={`computed-property-${key}`}
					className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-muted"
				>
					<Checkbox
						id={`computed-property-${key}`}
						aria-label={label}
						checked={!currentDisplay.includes(key)}
						onCheckedChange={() => onToggle(key)}
					/>
					{label}
				</label>
			))}
		</fieldset>
	);
}
