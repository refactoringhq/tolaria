import { Info } from "@phosphor-icons/react";
import { type KeyboardEvent, useState } from "react";
import { type AppLocale, createTranslator } from "../lib/i18n";
import {
	normalizeWorkspaceSlug,
	workspaceIdentityFromVault,
} from "../utils/workspaces";
import type { VaultOption } from "./status-bar/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface WorkspaceIdentityInputsProps {
	canEdit: boolean;
	locale: AppLocale;
	onUpdateWorkspaceIdentity?: (
		path: string,
		patch: Partial<VaultOption>,
	) => void;
	vault: VaultOption;
}

function workspaceInputId(
	alias: string,
	field: "name" | "label" | "slug",
): string {
	return `settings-workspace-${alias}-${field}`;
}

function sanitizeWorkspaceShortLabel(value: string): string {
	return value.trim().toUpperCase().slice(0, 3);
}

function shouldSaveWorkspaceSlug(
	canEdit: boolean,
	normalizedSlug: string | null,
	savedSlug: string,
): normalizedSlug is string {
	return canEdit && normalizedSlug !== null && normalizedSlug !== savedSlug;
}

function WorkspaceSlugInput({
	canEdit,
	locale,
	onUpdateWorkspaceIdentity,
	vault,
	workspace,
}: WorkspaceIdentityInputsProps & {
	workspace: ReturnType<typeof workspaceIdentityFromVault>;
}) {
	const t = createTranslator(locale);
	const slugId = workspaceInputId(workspace.alias, "slug");
	const savedSlug =
		normalizeWorkspaceSlug(vault.alias || workspace.alias) ?? workspace.alias;
	const [slugDraft, setSlugDraft] = useState(savedSlug);
	const commit = () => {
		const normalizedSlug = normalizeWorkspaceSlug(slugDraft);
		if (!shouldSaveWorkspaceSlug(canEdit, normalizedSlug, savedSlug)) {
			setSlugDraft(savedSlug);
			return;
		}
		setSlugDraft(normalizedSlug);
		onUpdateWorkspaceIdentity?.(vault.path, { alias: normalizedSlug });
	};

	return (
		<div className="grid gap-1.5">
			<div className="flex min-w-0 items-center gap-1">
				<label
					className="truncate text-[11px] font-medium text-muted-foreground"
					htmlFor={slugId}
				>
					{t("settings.workspaces.slug")}
				</label>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
							aria-label={t("settings.workspaces.slugTooltip")}
						>
							<Info size={12} />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top" align="start">
						{t("settings.workspaces.slugTooltip")}
					</TooltipContent>
				</Tooltip>
			</div>
			<Input
				id={slugId}
				value={slugDraft}
				onChange={(event) => setSlugDraft(event.target.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") event.currentTarget.blur();
				}}
				aria-label={t("settings.workspaces.slugAria", {
					label: workspace.label,
				})}
				disabled={!canEdit}
				className="h-8 bg-transparent"
			/>
		</div>
	);
}

function WorkspaceNameAndLabelInputs({
	canEdit,
	locale,
	onUpdateWorkspaceIdentity,
	vault,
	workspace,
}: WorkspaceIdentityInputsProps & {
	workspace: ReturnType<typeof workspaceIdentityFromVault>;
}) {
	const t = createTranslator(locale);
	const nameId = workspaceInputId(workspace.alias, "name");
	const labelId = workspaceInputId(workspace.alias, "label");
	const savedNameDraft = vault.label ?? "";
	const savedShortLabelDraft = sanitizeWorkspaceShortLabel(
		vault.shortLabel || workspace.shortLabel,
	);
	const [nameDraft, setNameDraft] = useState(savedNameDraft);
	const [shortLabelDraft, setShortLabelDraft] = useState(savedShortLabelDraft);
	const commitNameDraft = () => {
		if (canEdit && nameDraft !== savedNameDraft)
			onUpdateWorkspaceIdentity?.(vault.path, { label: nameDraft });
	};
	const commitShortLabelDraft = () => {
		const normalizedShortLabel = sanitizeWorkspaceShortLabel(shortLabelDraft);
		if (canEdit && normalizedShortLabel !== savedShortLabelDraft) {
			onUpdateWorkspaceIdentity?.(vault.path, {
				shortLabel: normalizedShortLabel,
			});
		}
	};
	const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") event.currentTarget.blur();
	};

	return (
		<>
			<div className="grid gap-1.5">
				<div className="flex min-w-0 items-center gap-1">
					<label
						className="truncate text-[11px] font-medium text-muted-foreground"
						htmlFor={nameId}
					>
						{t("settings.workspaces.name")}
					</label>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
								aria-label={t("settings.workspaces.nameTooltip")}
							>
								<Info size={12} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" align="start">
							{t("settings.workspaces.nameTooltip")}
						</TooltipContent>
					</Tooltip>
				</div>
				<Input
					id={nameId}
					value={nameDraft}
					onChange={(event) => setNameDraft(event.target.value)}
					onBlur={commitNameDraft}
					onKeyDown={blurOnEnter}
					aria-label={t("settings.workspaces.nameAria", {
						label: workspace.label,
					})}
					disabled={!canEdit}
					className="h-8 bg-transparent"
				/>
			</div>
			<div className="grid gap-1.5">
				<div className="flex min-w-0 items-center gap-1">
					<label
						className="truncate text-[11px] font-medium text-muted-foreground"
						htmlFor={labelId}
					>
						{t("settings.workspaces.label")}
					</label>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								className="h-4 w-4 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
								aria-label={t("settings.workspaces.labelTooltip")}
							>
								<Info size={12} />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="top" align="start">
							{t("settings.workspaces.labelTooltip")}
						</TooltipContent>
					</Tooltip>
				</div>
				<Input
					id={labelId}
					value={shortLabelDraft}
					maxLength={3}
					onChange={(event) =>
						setShortLabelDraft(sanitizeWorkspaceShortLabel(event.target.value))
					}
					onBlur={commitShortLabelDraft}
					onKeyDown={blurOnEnter}
					aria-label={t("settings.workspaces.labelAria", {
						label: workspace.label,
					})}
					disabled={!canEdit}
					className="h-8 bg-transparent uppercase"
				/>
			</div>
		</>
	);
}

export function WorkspaceIdentityInputs(props: WorkspaceIdentityInputsProps) {
	const workspace = workspaceIdentityFromVault(props.vault);
	return (
		<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(80px,0.28fr)_minmax(140px,0.55fr)]">
			<WorkspaceNameAndLabelInputs {...props} workspace={workspace} />
			<WorkspaceSlugInput {...props} workspace={workspace} />
		</div>
	);
}
