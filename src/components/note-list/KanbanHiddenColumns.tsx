import { Eye } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { type AppLocale, translate } from "../../lib/i18n";
import { columnTitle, type HiddenColumnSummary } from "./kanbanModel";

interface KanbanHiddenColumnsProps {
	hidden: HiddenColumnSummary[];
	locale: AppLocale;
	onShow: (group: string) => void;
}

function ShowColumnButton({
	column,
	locale,
	onShow,
}: Omit<KanbanHiddenColumnsProps, "hidden"> & { column: HiddenColumnSummary }) {
	const { group, count } = column;
	const title = columnTitle(group, locale);
	const label = translate(locale, "layout.showColumn", { column: title });
	return (
		<Button
			type="button"
			variant="ghost"
			className="kanban-card-slot block h-auto w-full rounded-lg p-0 text-left font-normal hover:bg-transparent"
			title={label}
			aria-label={label}
			data-testid="kanban-show-column"
			onClick={() => onShow(group)}
		>
			<span className="kanban-card flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-[13px] font-medium text-foreground">
				<span className="truncate">{title}</span>
				<span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
					{count}
					<Eye size={14} />
				</span>
			</span>
		</Button>
	);
}

export function KanbanHiddenColumns({
	hidden,
	locale,
	onShow,
}: KanbanHiddenColumnsProps) {
	if (hidden.length === 0) return null;
	const heading = translate(locale, "layout.hiddenColumns");
	return (
		<section
			className="kanban-column flex min-h-0 shrink-0 flex-col rounded-xl bg-muted"
			aria-label={heading}
			data-testid="kanban-hidden-columns"
		>
			<h4 className="m-0 flex h-11 shrink-0 items-center px-4 text-[13px] font-semibold text-foreground">
				{heading}
			</h4>
			<div className="kanban-column-cards relative min-h-0 flex-1 px-2 pb-2">
				<div className="kanban-scroll flex h-full flex-col gap-2 overflow-y-auto px-0.5 pt-2 pb-2">
					{hidden.map((column) => (
						<ShowColumnButton
							key={column.group}
							column={column}
							locale={locale}
							onShow={onShow}
						/>
					))}
				</div>
			</div>
		</section>
	);
}
