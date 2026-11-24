import { type AppLocale, translate } from "../../lib/i18n";
import {
	ListPropertiesPopover,
	type ListPropertiesPopoverProps,
} from "./ListPropertiesPopover";

interface NoteListPropertyActionsProps {
	propertyPicker: ListPropertiesPopoverProps | null | undefined;
	locale: AppLocale;
	triggerClassName: string;
}

export function NoteListPropertyActions({
	propertyPicker,
	locale,
	triggerClassName,
}: NoteListPropertyActionsProps) {
	if (!propertyPicker) return null;
	return (
		<ListPropertiesPopover
			{...propertyPicker}
			triggerTitle={
				propertyPicker.usePickerTitle
					? propertyPicker.triggerTitle
					: translate(locale, "noteList.tooltip.properties")
			}
			triggerClassName={triggerClassName}
			locale={locale}
		/>
	);
}
