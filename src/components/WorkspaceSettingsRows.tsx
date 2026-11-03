import { Trash as Trash2 } from "@phosphor-icons/react";
import { useState } from "react";
import { type AppLocale, createTranslator } from "../lib/i18n";
import { trackEvent } from "../lib/telemetry";
import {
	canMoveVaultPath,
	moveVaultPath,
	type VaultMoveDirection,
} from "../utils/vaultOrdering";
import { workspaceIdentityFromVault } from "../utils/workspaces";
import { AccentColorPicker } from "./AccentColorPicker";
import { SettingsGroupItem } from "./SettingsControls";
import type { VaultOption } from "./status-bar/types";
import { Button } from "./ui/button";
import { WorkspaceIdentityInputs } from "./WorkspaceIdentityInputs";
import { WorkspaceMoveButtons } from "./WorkspaceMoveButtons";

interface WorkspaceSettingsRowsProps {
	defaultWorkspacePath?: string | null;
	locale: AppLocale;
	onRemoveVault?: (path: string) => void;
	onReorderVaults?: (orderedPaths: string[]) => void;
	onSetDefaultWorkspace?: (path: string) => void;
	onUpdateWorkspaceIdentity?: (
		path: string,
		patch: Partial<VaultOption>,
	) => void;
	vaults: VaultOption[];
}

function WorkspaceRowActions(
	options: Pick<
		WorkspaceSettingsRowsProps,
		"locale" | "onSetDefaultWorkspace" | "onUpdateWorkspaceIdentity"
	> & {
		canEdit: boolean;
		canMoveDown: boolean;
		canMoveUp: boolean;
		onMoveVault?: (path: string, direction: VaultMoveDirection) => void;
		onRequestRemoveVault?: () => void;
		workspace: ReturnType<typeof workspaceIdentityFromVault>;
		vault: VaultOption;
	},
) {
	const {
		canEdit,
		canMoveDown,
		canMoveUp,
		locale,
		onMoveVault,
		onSetDefaultWorkspace,
		onUpdateWorkspaceIdentity,
		onRequestRemoveVault,
		workspace,
		vault,
	} = options;
	const t = createTranslator(locale);
	const removeLabel = t("settings.workspaces.removeAria", {
		label: workspace.label,
	});
	const setDefault = () =>
		saveDefaultWorkspace(vault.path, workspace.alias, onSetDefaultWorkspace);

	return (
		<div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
			<WorkspaceMoveButtons
				canMoveDown={canMoveDown}
				canMoveUp={canMoveUp}
				locale={locale}
				onMoveVault={onMoveVault}
				vault={vault}
				workspace={workspace}
			/>
			<AccentColorPicker
				className="gap-1.5"
				disabled={!canEdit}
				selectedColor={vault.color ?? null}
				onSelectColor={(color) =>
					onUpdateWorkspaceIdentity?.(vault.path, { color })
				}
				size={18}
			/>
			<Button
				type="button"
				variant="secondary"
				size="xs"
				onClick={setDefault}
				disabled={!onSetDefaultWorkspace || workspace.defaultForNewNotes}
				data-testid={`settings-workspace-default-${workspace.alias}`}
			>
				{workspace.defaultForNewNotes
					? t("workspace.manager.default")
					: t("workspace.manager.makeDefault")}
			</Button>
			{onRequestRemoveVault && (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onRequestRemoveVault}
					disabled={workspace.defaultForNewNotes}
					aria-label={removeLabel}
					title={removeLabel}
					data-testid={`settings-workspace-remove-${workspace.alias}`}
					className="text-muted-foreground hover:text-destructive"
				>
					<Trash2 size={15} />
				</Button>
			)}
		</div>
	);
}

function saveDefaultWorkspace(
	path: string,
	alias: string,
	onSetDefaultWorkspace: WorkspaceSettingsRowsProps["onSetDefaultWorkspace"],
) {
	onSetDefaultWorkspace?.(path);
	trackEvent("workspace_default_changed", { workspace_alias: alias });
}

function WorkspaceRemovalConfirmation({
	locale,
	onCancel,
	onConfirm,
	workspace,
}: Pick<WorkspaceSettingsRowsProps, "locale"> & {
	onCancel: () => void;
	onConfirm: () => void;
	workspace: ReturnType<typeof workspaceIdentityFromVault>;
}) {
	const t = createTranslator(locale);
	const title = t("status.vault.removeConfirmTitle");

	return (
		<fieldset
			aria-label={title}
			className="rounded-md border border-destructive/40 bg-destructive/5 p-3"
			data-testid={`settings-workspace-remove-confirm-${workspace.alias}`}
			onKeyDown={(event) => {
				if (event.key !== "Escape") return;
				event.stopPropagation();
				onCancel();
			}}
		>
			<div className="text-sm font-medium text-foreground">{title}</div>
			<div className="mt-1 text-xs leading-5 text-muted-foreground">
				{t("status.vault.removeConfirmMessage", { label: workspace.label })}
			</div>
			<div className="mt-3 flex flex-wrap justify-end gap-2">
				<Button type="button" variant="outline" size="xs" onClick={onCancel}>
					{t("common.cancel")}
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="xs"
					onClick={onConfirm}
				>
					{t("status.vault.removeConfirmAction")}
				</Button>
			</div>
		</fieldset>
	);
}

function WorkspaceSettingsRow(
	options: Pick<
		WorkspaceSettingsRowsProps,
		| "defaultWorkspacePath"
		| "locale"
		| "onSetDefaultWorkspace"
		| "onUpdateWorkspaceIdentity"
		| "vaults"
	> & {
		onCancelRemoveVault: () => void;
		onConfirmRemoveVault?: () => void;
		onMoveVault?: (path: string, direction: VaultMoveDirection) => void;
		onRequestRemoveVault?: () => void;
		pendingRemoval: boolean;
		vault: VaultOption;
	},
) {
	const {
		defaultWorkspacePath,
		locale,
		onCancelRemoveVault,
		onConfirmRemoveVault,
		onMoveVault,
		onRequestRemoveVault,
		onSetDefaultWorkspace,
		onUpdateWorkspaceIdentity,
		vaults,
		vault,
		pendingRemoval,
	} = options;
	const workspace = workspaceIdentityFromVault(vault, { defaultWorkspacePath });
	const canEdit =
		!!onUpdateWorkspaceIdentity && vault.path !== "" && !vault.managedDefault;

	return (
		<div
			className="grid gap-3 px-4 py-4"
			data-testid={`settings-workspace-row-${workspace.alias}`}
		>
			<WorkspaceRowHeading
				canEdit={canEdit}
				locale={locale}
				onMoveVault={onMoveVault}
				onRequestRemoveVault={onRequestRemoveVault}
				onSetDefaultWorkspace={onSetDefaultWorkspace}
				onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity}
				vault={vault}
				vaults={vaults}
				workspace={workspace}
			/>
			{pendingRemoval && onConfirmRemoveVault && (
				<WorkspaceRemovalConfirmation
					locale={locale}
					onCancel={onCancelRemoveVault}
					onConfirm={onConfirmRemoveVault}
					workspace={workspace}
				/>
			)}
			<WorkspaceIdentityInputs
				canEdit={canEdit}
				locale={locale}
				onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity}
				vault={vault}
			/>
		</div>
	);
}

type WorkspaceRowHeadingProps = Pick<
	WorkspaceSettingsRowsProps,
	"locale" | "onSetDefaultWorkspace" | "onUpdateWorkspaceIdentity"
> & {
	canEdit: boolean;
	onMoveVault?: (path: string, direction: VaultMoveDirection) => void;
	onRequestRemoveVault?: () => void;
	vault: VaultOption;
	vaults: VaultOption[];
	workspace: ReturnType<typeof workspaceIdentityFromVault>;
};

function WorkspaceRowHeading(options: WorkspaceRowHeadingProps) {
	const {
		canEdit,
		locale,
		onMoveVault,
		onRequestRemoveVault,
		onSetDefaultWorkspace,
		onUpdateWorkspaceIdentity,
		vault,
		vaults,
		workspace,
	} = options;
	return (
		<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
			<div className="min-w-[220px] flex-1">
				<div className="truncate text-sm font-medium text-foreground">
					{workspace.label}
				</div>
				<div className="truncate text-[11px] text-muted-foreground">
					{workspace.path}
				</div>
			</div>
			<WorkspaceRowActions
				canEdit={canEdit}
				canMoveDown={canMoveVaultPath(vaults, vault.path, "down")}
				canMoveUp={canMoveVaultPath(vaults, vault.path, "up")}
				locale={locale}
				onMoveVault={onMoveVault}
				onSetDefaultWorkspace={onSetDefaultWorkspace}
				onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity}
				onRequestRemoveVault={onRequestRemoveVault}
				workspace={workspace}
				vault={vault}
			/>
		</div>
	);
}

function moveVaultInList(
	vaults: VaultOption[],
	onReorderVaults: ((orderedPaths: string[]) => void) | undefined,
	path: string,
	direction: VaultMoveDirection,
) {
	const orderedPaths = moveVaultPath(vaults, path, direction);
	if (orderedPaths) onReorderVaults?.(orderedPaths);
}

function removeVaultAndCloseConfirmation(
	onRemoveVault: NonNullable<WorkspaceSettingsRowsProps["onRemoveVault"]>,
	path: string,
	setPendingRemovalPath: (path: string | null) => void,
) {
	onRemoveVault(path);
	setPendingRemovalPath(null);
}

type WorkspaceSettingsRowsItemProps = WorkspaceSettingsRowsProps & {
	pendingRemovalPath: string | null;
	setPendingRemovalPath: (path: string | null) => void;
	vault: VaultOption;
};

function WorkspaceSettingsRowsItem(options: WorkspaceSettingsRowsItemProps) {
	const {
		defaultWorkspacePath,
		locale,
		onRemoveVault,
		onReorderVaults,
		onSetDefaultWorkspace,
		onUpdateWorkspaceIdentity,
		pendingRemovalPath,
		setPendingRemovalPath,
		vault,
		vaults,
	} = options;
	const onConfirmRemoveVault = onRemoveVault
		? () =>
				removeVaultAndCloseConfirmation(
					onRemoveVault,
					vault.path,
					setPendingRemovalPath,
				)
		: undefined;

	return (
		<WorkspaceSettingsRow
			defaultWorkspacePath={defaultWorkspacePath}
			locale={locale}
			onCancelRemoveVault={() => setPendingRemovalPath(null)}
			onConfirmRemoveVault={onConfirmRemoveVault}
			onMoveVault={
				onReorderVaults
					? (path, direction) =>
							moveVaultInList(vaults, onReorderVaults, path, direction)
					: undefined
			}
			onRequestRemoveVault={
				onRemoveVault ? () => setPendingRemovalPath(vault.path) : undefined
			}
			onSetDefaultWorkspace={onSetDefaultWorkspace}
			onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity}
			pendingRemoval={pendingRemovalPath === vault.path}
			vaults={vaults}
			vault={vault}
		/>
	);
}

export function WorkspaceSettingsRows({
	defaultWorkspacePath,
	locale,
	onRemoveVault,
	onReorderVaults,
	onSetDefaultWorkspace,
	onUpdateWorkspaceIdentity,
	vaults,
}: WorkspaceSettingsRowsProps) {
	const [pendingRemovalPath, setPendingRemovalPath] = useState<string | null>(
		null,
	);

	return (
		<SettingsGroupItem testId="settings-workspace-list">
			<div className="-mx-4 divide-y divide-border">
				{vaults.map((vault) => (
					<WorkspaceSettingsRowsItem
						key={vault.path}
						defaultWorkspacePath={defaultWorkspacePath}
						locale={locale}
						onRemoveVault={onRemoveVault}
						onReorderVaults={onReorderVaults}
						onSetDefaultWorkspace={onSetDefaultWorkspace}
						onUpdateWorkspaceIdentity={onUpdateWorkspaceIdentity}
						pendingRemovalPath={pendingRemovalPath}
						setPendingRemovalPath={setPendingRemovalPath}
						vaults={vaults}
						vault={vault}
					/>
				))}
			</div>
		</SettingsGroupItem>
	);
}
