import { GithubLogo } from "phosphor-react-native";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	StyleSheet,
	View,
} from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import {
	MobilePanel,
	MobileToolbar,
	MobileToolbarSpacer,
	MobileToolbarTitle,
} from "../../ui/MobilePanel";
import { MobileTextInput } from "../../ui/MobileTextInput";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import { mobileSheetPresentation } from "../../ui/mobileSheetPresentation";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { GitHubRepository } from "../../workspace/git/githubAuth";
import { filterGitHubRepositories } from "../../workspace/git/githubRepositorySearch";
import type { useGitHubAccount } from "../../workspace/git/useGitHubAccount";
import { useMobileModalDismiss } from "../../workspace/useMobileModalDismiss";
import { Button } from "../ui/button";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

type Props = {
	account: ReturnType<typeof useGitHubAccount>;
	disabled: boolean;
	clone: (url: string) => Promise<void>;
};

export function MobileGitHubRepositories({ account, clone, disabled }: Props) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	const [open, setOpen] = useState(false);
	useMobileModalDismiss(() => setOpen(false), open);
	const [query, setQuery] = useState("");
	const repositories = useMemo(
		() => filterGitHubRepositories(account.repositories, query),
		[account.repositories, query],
	);
	const choose = (repository: GitHubRepository) => {
		setOpen(false);
		void clone(repository.clone_url);
	};
	return (
		<>
			<MobileButton
				disabled={disabled}
				label={mobileText("mobile.vaults.loadRepositories")}
				icon={<GithubLogo size={16} color={mobileColors.text} />}
				onPress={() => {
					setOpen(true);
					void account.loadRepositories();
				}}
			/>
			<RepositoryPickerModal
				account={account}
				disabled={disabled}
				onClose={() => setOpen(false)}
				onSelect={choose}
				open={open}
				query={query}
				repositories={repositories}
				setQuery={setQuery}
			/>
		</>
	);
}

function RepositoryPickerModal(props: {
	account: Props["account"];
	disabled: boolean;
	onClose: () => void;
	onSelect: (repository: GitHubRepository) => void;
	open: boolean;
	query: string;
	repositories: GitHubRepository[];
	setQuery: (query: string) => void;
}) {
	const {
		account,
		disabled,
		onClose,
		onSelect,
		open,
		query,
		repositories,
		setQuery,
	} = props;
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<Modal
			visible={open}
			{...mobileSheetPresentation(Platform.OS)}
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : undefined}
				style={Platform.OS === "ios" ? styles.sheetRoot : styles.backdrop}
			>
				<MobilePanel
					style={Platform.OS === "ios" ? styles.sheetPanel : styles.panel}
					accessibilityViewIsModal
					testID="github-repository-picker"
				>
					<RepositoryPickerToolbar onClose={onClose} />
					<RepositoryPickerResults
						account={account}
						disabled={disabled}
						onSelect={onSelect}
						query={query}
						repositories={repositories}
						setQuery={setQuery}
					/>
				</MobilePanel>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function RepositoryPickerToolbar({ onClose }: { onClose: () => void }) {
	return (
		<MobileToolbar>
			<MobileToolbarTitle title={mobileText("mobile.vaults.repositories")} />
			<MobileToolbarSpacer />
			<MobileButton
				density="compact"
				label={mobileText("common.done")}
				onPress={onClose}
				testID="repositories-done"
				variant="ghost"
			/>
		</MobileToolbar>
	);
}

function RepositoryPickerResults({
	account,
	disabled,
	onSelect,
	query,
	repositories,
	setQuery,
}: Omit<Parameters<typeof RepositoryPickerModal>[0], "open" | "onClose">) {
	const { mobileColors, styles } = useMobileStyles(createThemeStyles);
	return (
		<>
			<RepositorySearchField
				query={query}
				setQuery={setQuery}
				style={styles.search}
			/>
			<RepositoryPickerError account={account} />
			<RepositoryList
				account={account}
				disabled={disabled}
				onSelect={onSelect}
				repositories={repositories}
				styles={styles}
				primaryColor={mobileColors.primary}
			/>
		</>
	);
}

function RepositorySearchField({
	query,
	setQuery,
	style,
}: {
	query: string;
	setQuery: (query: string) => void;
	style: ReturnType<typeof createThemeStyles>["styles"]["search"];
}) {
	return (
		<View style={style}>
			<MobileTextInput
				label={mobileText("mobile.vaults.searchRepositories")}
				value={query}
				onChangeText={setQuery}
				autoCorrect={false}
				autoCapitalize="none"
				testID="github-repository-search"
			/>
		</View>
	);
}

function RepositoryPickerError({ account }: { account: Props["account"] }) {
	const { styles } = useMobileStyles(createThemeStyles);
	if (!account.error) return null;
	return (
		<Text accessibilityRole="alert" style={styles.error}>
			{mobileText(account.error)}
		</Text>
	);
}

function RepositoryList({
	account,
	disabled,
	onSelect,
	repositories,
	styles,
	primaryColor,
}: {
	account: Props["account"];
	disabled: boolean;
	onSelect: (repository: GitHubRepository) => void;
	repositories: GitHubRepository[];
	styles: ReturnType<typeof createThemeStyles>["styles"];
	primaryColor: string;
}) {
	return (
		<FlatList
			data={repositories}
			keyExtractor={(repository) => `${repository.id}`}
			keyboardShouldPersistTaps="handled"
			style={styles.list}
			initialNumToRender={12}
			maxToRenderPerBatch={12}
			windowSize={5}
			renderItem={({ item }) => (
				<RepositoryRow
					repository={item}
					disabled={disabled}
					onPress={() => onSelect(item)}
				/>
			)}
			ListEmptyComponent={
				account.busy ? (
					<ActivityIndicator color={primaryColor} />
				) : (
					<Text style={styles.empty}>{mobileText("command.noMatches")}</Text>
				)
			}
			ListFooterComponent={<RepositoryMoreAction account={account} />}
		/>
	);
}

function RepositoryMoreAction({ account }: { account: Props["account"] }) {
	if (!account.hasMore) return null;
	return (
		<MobileButton
			disabled={account.busy}
			label={mobileText("mobile.vaults.more")}
			onPress={() => {
				void account.loadRepositories(true);
			}}
		/>
	);
}

function RepositoryRow({
	repository,
	disabled,
	onPress,
}: {
	repository: GitHubRepository;
	disabled: boolean;
	onPress: () => void;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const visibilitySymbol = repository.private ? "lock" : "globe";
	const visibilityLabel = mobileText(
		repository.private
			? "mobile.vaults.privateRepository"
			: "mobile.vaults.publicRepository",
	);
	const [owner, name] = repository.full_name.split("/");
	return (
		<Button
			variant="ghost"
			disabled={disabled}
			accessibilityLabel={`${repository.full_name}, ${visibilityLabel}`}
			style={styles.repository}
			onPress={onPress}
			testID={`github-repository-${repository.id}`}
		>
			<ChromeSymbol name="gitBranch" size={20} color={mobileColors.textMuted} />
			<View style={styles.identity}>
				<Text numberOfLines={1} style={styles.name}>
					{name ?? owner}
				</Text>
				<Text numberOfLines={1} style={styles.owner}>
					{owner}
				</Text>
			</View>
			<ChromeSymbol
				name={visibilitySymbol}
				size={16}
				color={mobileColors.textMuted}
			/>
		</Button>
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const styles = StyleSheet.create({
		backdrop: {
			flex: 1,
			padding: metrics.size(24),
			backgroundColor: mobileColors.overlay,
			alignItems: "center",
			justifyContent: "center",
		},
		panel: {
			width: "100%",
			maxWidth: 560,
			height: "85%",
			maxHeight: 640,
			borderRadius: 8,
			overflow: "hidden",
		},
		sheetRoot: { flex: 1 },
		sheetPanel: {
			flex: 1,
			width: "100%",
			maxWidth: "100%",
			maxHeight: "100%",
			borderRadius: 0,
			overflow: "hidden",
		},
		search: { padding: metrics.size(16) },
		list: { flex: 1 },
		repository: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "flex-start",
			gap: metrics.size(12),
			minHeight: 64,
			height: "auto",
			paddingHorizontal: metrics.size(16),
			paddingVertical: metrics.size(10),
			borderRadius: 0,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: mobileColors.border,
		},
		identity: { flex: 1, minWidth: 0, gap: metrics.size(4) },
		name: {
			color: mobileColors.text,
			fontSize: metrics.size(15),
			fontWeight: "500",
		},
		owner: { color: mobileColors.textMuted, fontSize: metrics.size(12) },
		empty: {
			color: mobileColors.textMuted,
			textAlign: "center",
			padding: metrics.size(24),
		},
		error: {
			color: mobileColors.danger,
			paddingHorizontal: metrics.size(16),
			paddingBottom: metrics.size(12),
		},
	});
	return { mobileColors, styles };
}
