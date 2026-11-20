import { FunnelSimple } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GraphSettings } from "../../../collections/collectionTypes";
import { type AppLocale, translate } from "../../../lib/i18n";
import type { VaultEntry } from "../../../types";
import { getTypeColor } from "../../../utils/typeColors";
import { UNTYPED_GRAPH_KEY } from "./graphModel";

export interface GraphFilterMenuProps {
	settings: GraphSettings;
	relationshipKeys: string[];
	typeKeys: string[];
	typeEntryMap: Record<string, VaultEntry>;
	locale: AppLocale;
	triggerClassName?: string;
	onChange: (patch: Partial<GraphSettings>) => void;
}

interface FilterItemProps {
	checked: boolean;
	testId: string;
	swatch?: ReactNode;
	label: string;
	onToggle: () => void;
}

/** A checkbox row that keeps the menu open, so several filters can be flipped in one go. */
function FilterItem({
	checked,
	testId,
	swatch,
	label,
	onToggle,
}: FilterItemProps) {
	return (
		<DropdownMenuCheckboxItem
			checked={checked}
			data-testid={testId}
			onSelect={(event) => event.preventDefault()}
			onCheckedChange={onToggle}
		>
			{swatch}
			<span className="truncate">{label}</span>
		</DropdownMenuCheckboxItem>
	);
}

function EdgeSwatch({ dashed }: { dashed: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={
				dashed
					? "graph-legend-edge graph-legend-edge--dashed"
					: "graph-legend-edge"
			}
		/>
	);
}

function TypeSwatch({ color }: { color: string }) {
	return (
		<span
			aria-hidden="true"
			className="graph-legend-dot"
			style={{ background: color }}
		/>
	);
}

function toggled(list: readonly string[], value: string): string[] {
	return list.includes(value)
		? list.filter((item) => item !== value)
		: [...list, value];
}

function graphTypeLabel(typeKey: string, locale: AppLocale): string {
	return typeKey === UNTYPED_GRAPH_KEY
		? translate(locale, "graph.noType")
		: typeKey;
}

function typeSwatchColor(
	typeKey: string,
	typeEntryMap: Record<string, VaultEntry>,
): string {
	if (typeKey === UNTYPED_GRAPH_KEY) return getTypeColor(null);
	return getTypeColor(typeKey, Reflect.get(typeEntryMap, typeKey)?.color);
}

function SectionLabel({ children }: { children: ReactNode }) {
	return (
		<DropdownMenuLabel className="text-xs text-muted-foreground">
			{children}
		</DropdownMenuLabel>
	);
}

function EdgeFilters({
	settings,
	relationshipKeys,
	locale,
	onChange,
}: GraphFilterMenuProps) {
	return (
		<>
			<SectionLabel>{translate(locale, "graph.filters.edges")}</SectionLabel>
			<FilterItem
				checked={settings.showWikiLinks}
				testId="graph-filter-wikilinks"
				swatch={<EdgeSwatch dashed />}
				label={translate(locale, "graph.filters.wikiLinks")}
				onToggle={() => onChange({ showWikiLinks: !settings.showWikiLinks })}
			/>
			{relationshipKeys.map((key) => (
				<FilterItem
					key={key}
					checked={!settings.hiddenRelationships.includes(key)}
					testId={`graph-filter-relationship-${key}`}
					swatch={<EdgeSwatch dashed={false} />}
					label={key}
					onToggle={() =>
						onChange({
							hiddenRelationships: toggled(settings.hiddenRelationships, key),
						})
					}
				/>
			))}
		</>
	);
}

function TypeFilters({
	settings,
	typeKeys,
	typeEntryMap,
	locale,
	onChange,
}: GraphFilterMenuProps) {
	return (
		<>
			<SectionLabel>{translate(locale, "graph.filters.types")}</SectionLabel>
			{typeKeys.map((typeKey) => (
				<FilterItem
					key={typeKey || "untyped"}
					checked={!settings.hiddenTypes.includes(typeKey)}
					testId={`graph-filter-type-${typeKey || "untyped"}`}
					swatch={<TypeSwatch color={typeSwatchColor(typeKey, typeEntryMap)} />}
					label={graphTypeLabel(typeKey, locale)}
					onToggle={() =>
						onChange({ hiddenTypes: toggled(settings.hiddenTypes, typeKey) })
					}
				/>
			))}
		</>
	);
}

function DisplayFilters({ settings, locale, onChange }: GraphFilterMenuProps) {
	return (
		<>
			<SectionLabel>{translate(locale, "graph.filters.display")}</SectionLabel>
			<FilterItem
				checked={settings.showOrphans}
				testId="graph-filter-orphans"
				label={translate(locale, "graph.filters.orphans")}
				onToggle={() => onChange({ showOrphans: !settings.showOrphans })}
			/>
			<FilterItem
				checked={settings.showLabels}
				testId="graph-filter-labels"
				label={translate(locale, "graph.filters.labels")}
				onToggle={() => onChange({ showLabels: !settings.showLabels })}
			/>
		</>
	);
}

/** The graph's legend and filters: edge kinds, relationship keys, types, orphans and labels. */
export function GraphFilterMenu(props: GraphFilterMenuProps) {
	const label = translate(props.locale, "noteList.tooltip.graphFilters");
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
							className={props.triggerClassName}
							aria-label={label}
							data-testid="graph-filter-menu-button"
						>
							<FunnelSimple size={16} />
						</Button>
					</DropdownMenuTrigger>
				</span>
			</ActionTooltip>
			<DropdownMenuContent align="end" className="graph-filter-menu min-w-52">
				<DisplayFilters {...props} />
				<DropdownMenuSeparator />
				<EdgeFilters {...props} />
				<DropdownMenuSeparator />
				<TypeFilters {...props} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
