import { CalendarDots } from "@phosphor-icons/react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CalendarSettings } from "../../../collections/collectionTypes";
import { type AppLocale, translate } from "../../../lib/i18n";
import { trackEvent } from "../../../lib/telemetry";
import { CREATED_DATE_PROPERTY, MODIFIED_DATE_PROPERTY } from "./calendarModel";

const NO_END_DATE = "__none__";

export interface CalendarDateMenuProps {
	settings: CalendarSettings;
	dateProperty: string | null;
	dateOptions: string[];
	locale: AppLocale;
	triggerClassName?: string;
	onChange: (patch: Partial<CalendarSettings>) => void;
}

/** Shows read-only timestamp sources with a readable name; frontmatter properties keep their key. */
function datePropertyLabel(property: string, locale: AppLocale): string {
	if (property === CREATED_DATE_PROPERTY)
		return translate(locale, "calendar.created");
	if (property === MODIFIED_DATE_PROPERTY)
		return translate(locale, "calendar.modified");
	return property;
}

function startOptions(
	dateProperty: string | null,
	dateOptions: string[],
): string[] {
	const options =
		dateProperty && !dateOptions.includes(dateProperty)
			? [dateProperty, ...dateOptions]
			: dateOptions;
	return [
		...options.filter(
			(option) =>
				option !== CREATED_DATE_PROPERTY && option !== MODIFIED_DATE_PROPERTY,
		),
		CREATED_DATE_PROPERTY,
		MODIFIED_DATE_PROPERTY,
	];
}

function changeSetting(
	onChange: CalendarDateMenuProps["onChange"],
	patch: Partial<CalendarSettings>,
) {
	trackEvent("calendar_settings_changed", {
		setting: Object.keys(patch).join(","),
	});
	onChange(patch);
}

function EndDateItems({
	dateProperty,
	dateOptions,
	settings,
	locale,
	onChange,
}: Omit<CalendarDateMenuProps, "triggerClassName">) {
	const options = dateOptions.filter((option) => option !== dateProperty);
	return (
		<>
			<DropdownMenuLabel className="text-xs text-muted-foreground">
				{translate(locale, "calendar.endDate")}
			</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				value={settings.endDateProperty ?? NO_END_DATE}
				onValueChange={(value) =>
					changeSetting(onChange, {
						endDateProperty: value === NO_END_DATE ? null : value,
					})
				}
			>
				<DropdownMenuRadioItem
					value={NO_END_DATE}
					data-testid="calendar-end-option-none"
				>
					{translate(locale, "calendar.noEndDate")}
				</DropdownMenuRadioItem>
				{options.map((property) => (
					<DropdownMenuRadioItem
						key={property}
						value={property}
						data-testid={`calendar-end-option-${property}`}
					>
						{property}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
		</>
	);
}

/** The calendar's header control, next to the layout menu like Kanban's group-by. */
export function CalendarDateMenu(props: CalendarDateMenuProps) {
	const {
		settings,
		dateProperty,
		dateOptions,
		locale,
		triggerClassName,
		onChange,
	} = props;
	const label = dateProperty
		? translate(locale, "calendar.dateMenu", {
				property: datePropertyLabel(dateProperty, locale),
			})
		: translate(locale, "calendar.dateProperty");
	return (
		// Non-modal like the other header menus: the modal scroll lock shifts the whole WebKitGTK window while open.
		<DropdownMenu modal={false}>
			<ActionTooltip copy={{ label }}>
				<span className="inline-flex">
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className={triggerClassName}
							aria-label={label}
							data-testid="calendar-date-menu-button"
						>
							<CalendarDots size={16} />
						</Button>
					</DropdownMenuTrigger>
				</span>
			</ActionTooltip>
			<DropdownMenuContent align="end" className="min-w-48">
				<DropdownMenuLabel className="text-xs text-muted-foreground">
					{translate(locale, "calendar.dateProperty")}
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={dateProperty ?? ""}
					onValueChange={(value) =>
						changeSetting(onChange, {
							dateProperty: value,
							endDateProperty: null,
						})
					}
				>
					{startOptions(dateProperty, dateOptions).map((property) => (
						<DropdownMenuRadioItem
							key={property}
							value={property}
							data-testid={`calendar-date-option-${property}`}
						>
							{datePropertyLabel(property, locale)}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuSeparator />
				<EndDateItems {...props} />
				<DropdownMenuSeparator />
				<DropdownMenuCheckboxItem
					checked={settings.showWeekends}
					onCheckedChange={(checked) =>
						changeSetting(onChange, { showWeekends: checked === true })
					}
					data-testid="calendar-show-weekends"
				>
					{translate(locale, "calendar.showWeekends")}
				</DropdownMenuCheckboxItem>
				<DropdownMenuCheckboxItem
					checked={settings.showIcons}
					onCheckedChange={(checked) =>
						changeSetting(onChange, { showIcons: checked === true })
					}
					data-testid="calendar-show-icons"
				>
					{translate(locale, "calendar.showIcons")}
				</DropdownMenuCheckboxItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
