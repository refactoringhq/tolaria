import { SlidersHorizontal } from "@phosphor-icons/react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { GraphSettings } from "../../../collections/collectionTypes";
import {
	defaultGraphForces,
	GRAPH_DISPLAY_SETTINGS,
	GRAPH_FORCE_SETTINGS,
	type GraphNumberSetting,
	graphNumberRange,
} from "../../../collections/graphSettings";
import {
	type AppLocale,
	type TranslationKey,
	translate,
} from "../../../lib/i18n";
import { SettingsSection } from "./GraphSettingsSection";

export interface GraphSettingsMenuProps {
	settings: GraphSettings;
	locale: AppLocale;
	triggerClassName?: string;
	/** Saves settings with the view. */
	onChange: (patch: Partial<GraphSettings>) => void;
	/** Shows settings live without saving (while a slider moves). */
	onPreview: (patch: Partial<GraphSettings>) => void;
}

const SETTING_LABELS = new Map<GraphNumberSetting, TranslationKey>(
	Object.entries({
		textFadeThreshold: "graph.settings.textFadeThreshold",
		nodeSizeScale: "graph.settings.nodeSizeScale",
		linkThickness: "graph.settings.linkThickness",
		centerForce: "graph.settings.centerForce",
		repelForce: "graph.settings.repelForce",
		linkForce: "graph.settings.linkForce",
		linkDistance: "graph.settings.linkDistance",
	}) as Array<[GraphNumberSetting, TranslationKey]>,
);

function formatValue(value: number, step: number): string {
	return step >= 1
		? String(Math.round(value))
		: value.toFixed(step >= 0.1 ? 1 : 2);
}

function SettingSlider({
	setting,
	settings,
	locale,
	onChange,
	onPreview,
}: Omit<GraphSettingsMenuProps, "triggerClassName"> & {
	setting: GraphNumberSetting;
}) {
	const { min, max, step } = graphNumberRange(setting);
	const label = translate(
		locale,
		SETTING_LABELS.get(setting) ?? "graph.settings.label",
	);
	const value = Number(Reflect.get(settings, setting));
	return (
		<div
			className="flex flex-col gap-1"
			data-testid={`graph-setting-${setting}`}
		>
			<div className="flex items-center justify-between text-xs text-foreground">
				<span>{label}</span>
				<span className="tabular-nums text-xs text-muted-foreground">
					{formatValue(value, step)}
				</span>
			</div>
			<Slider
				aria-label={label}
				min={min}
				max={max}
				step={step}
				value={[value]}
				onValueChange={([next]) => onPreview({ [setting]: next })}
				onValueCommit={([next]) => onChange({ [setting]: next })}
			/>
		</div>
	);
}

function DisplaySection(
	props: Omit<GraphSettingsMenuProps, "triggerClassName">,
) {
	const { settings, locale, onChange } = props;
	return (
		<SettingsSection title={translate(locale, "graph.settings.display")}>
			{GRAPH_DISPLAY_SETTINGS.map((setting) => (
				<SettingSlider key={setting} setting={setting} {...props} />
			))}
			<div className="flex items-center justify-between text-xs text-foreground">
				<span id="graph-setting-arrows-label">
					{translate(locale, "graph.settings.showArrows")}
				</span>
				<Switch
					checked={settings.showArrows}
					aria-labelledby="graph-setting-arrows-label"
					data-testid="graph-setting-arrows"
					onCheckedChange={(showArrows) => onChange({ showArrows })}
				/>
			</div>
		</SettingsSection>
	);
}

function ForcesSection(
	props: Omit<GraphSettingsMenuProps, "triggerClassName">,
) {
	const { locale, onChange } = props;
	const restore = (
		<Button
			type="button"
			variant="ghost"
			size="xs"
			data-testid="graph-forces-restore"
			onClick={() => onChange(defaultGraphForces())}
		>
			{translate(locale, "graph.settings.restoreDefaults")}
		</Button>
	);
	return (
		<SettingsSection
			title={translate(locale, "graph.settings.forces")}
			action={restore}
		>
			{GRAPH_FORCE_SETTINGS.map((setting) => (
				<SettingSlider key={setting} setting={setting} {...props} />
			))}
		</SettingsSection>
	);
}

/** Obsidian-style graph settings: display and live forces, saved with the view. */
export function GraphSettingsMenu({
	triggerClassName,
	...props
}: GraphSettingsMenuProps) {
	const label = translate(props.locale, "graph.settings.label");
	return (
		// Non-modal like the other header menus: the modal scroll lock shifts the whole WebKitGTK window while open.
		<Popover modal={false}>
			<ActionTooltip copy={{ label }}>
				<span className="inline-flex">
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className={triggerClassName}
							aria-label={label}
							data-testid="graph-settings-button"
						>
							<SlidersHorizontal size={16} />
						</Button>
					</PopoverTrigger>
				</span>
			</ActionTooltip>
			<PopoverContent
				align="end"
				className="graph-settings-menu flex max-h-[min(75vh,640px)] w-72 flex-col gap-2 overflow-y-auto p-2 text-xs"
				data-testid="graph-settings-menu"
			>
				<DisplaySection {...props} />
				<Separator />
				<ForcesSection {...props} />
			</PopoverContent>
		</Popover>
	);
}
