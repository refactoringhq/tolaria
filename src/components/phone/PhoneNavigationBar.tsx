import { CaretLeft, List } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { usePhoneNoteStackControls } from "../../hooks/phoneNoteStackStore";
import { type AppLocale, translate } from "../../lib/i18n";
import { trackEvent } from "../../lib/telemetry";

type PhoneNavigationBarProps = {
	locale: AppLocale;
	placement: "navigation" | "list";
};

/** Switches between the phone's navigation drawer and its matching note list. */
export function PhoneNavigationBar({
	locale,
	placement,
}: PhoneNavigationBarProps) {
	const controls = usePhoneNoteStackControls();
	if (!controls.active || controls.pane !== placement) return null;

	const isNavigation = placement === "navigation";
	return (
		<div className="app__phone-navigation-bar">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={() => {
					if (!isNavigation) trackEvent("phone_navigation_opened");
					if (isNavigation) controls.showList();
					else controls.showNavigation();
				}}
				aria-label={translate(
					locale,
					isNavigation ? "phone.action.notes" : "command.group.navigation",
				)}
				data-testid={
					isNavigation ? "phone-back-to-list" : "phone-open-navigation"
				}
			>
				{isNavigation ? (
					<CaretLeft size={16} weight="regular" />
				) : (
					<List size={16} weight="regular" />
				)}
				{translate(
					locale,
					isNavigation ? "phone.action.notes" : "command.group.navigation",
				)}
			</Button>
		</div>
	);
}
