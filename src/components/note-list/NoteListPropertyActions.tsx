import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { type AppLocale, translate } from "../../lib/i18n";
import {
	ListPropertiesPopover,
	type ListPropertiesPopoverProps,
} from "./ListPropertiesPopover";

interface NoteListPropertyActionsProps {
	propertyPicker: ListPropertiesPopoverProps | null | undefined;
	propertyVisibility: { visible: boolean; onToggle: () => void } | undefined;
	locale: AppLocale;
	triggerClassName: string;
}

export function NoteListPropertyActions({
	propertyPicker,
	propertyVisibility,
	locale,
	triggerClassName,
}: NoteListPropertyActionsProps) {
	return (
		<>
			{propertyVisibility && (
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className={triggerClassName}
					onClick={propertyVisibility.onToggle}
					aria-label={translate(locale, "noteList.tooltip.properties")}
					aria-pressed={propertyVisibility.visible}
					title={translate(locale, "noteList.tooltip.properties")}
				>
					{propertyVisibility.visible ? (
						<Eye size={16} />
					) : (
						<EyeSlash size={16} />
					)}
				</Button>
			)}
			{propertyPicker && (
				<ListPropertiesPopover
					{...propertyPicker}
					triggerTitle={
						propertyVisibility
							? propertyPicker.triggerTitle
							: translate(locale, "noteList.tooltip.properties")
					}
					triggerClassName={triggerClassName}
					locale={locale}
				/>
			)}
		</>
	);
}
