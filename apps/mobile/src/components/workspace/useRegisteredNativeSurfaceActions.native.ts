import { isMobileImageAttachment } from "../../workspace/mobileAttachments";
import { useRegisteredMobileEditorCommands } from "../../workspace/mobileEditorCommands";
import type {
	NativeTentapEditorSurfaceActionProps,
	NativeTentapEditorSurfaceActions,
	NativeTentapEditorSurfaceProps,
} from "./MobileNativeEditor.types";
import type { useMobileEditorFileSource } from "./mobileEditorFileSource.native";

type SurfaceProps = NativeTentapEditorSurfaceActionProps &
	Pick<NativeTentapEditorSurfaceProps, "onRegisterEditorCommands">;

type UseNativeTentapEditorSurfaceActions = (
	props: NativeTentapEditorSurfaceActionProps,
) => NativeTentapEditorSurfaceActions;

export function useRegisteredNativeSurfaceActions(
	props: SurfaceProps,
	fileSource: ReturnType<typeof useMobileEditorFileSource>,
	useNativeTentapEditorSurfaceActions: UseNativeTentapEditorSurfaceActions,
) {
	const actionProps: NativeTentapEditorSurfaceActionProps = {
		...props,
		onImportAttachment: async () => {
			const attachment = await props.onImportAttachment?.();
			if (attachment && isMobileImageAttachment(attachment))
				await fileSource.prepareAttachment?.(attachment.path);
			return attachment ?? null;
		},
	};
	const actions = useNativeTentapEditorSurfaceActions(actionProps);
	useRegisteredMobileEditorCommands(props.onRegisterEditorCommands, {
		blur: () => props.editor.blur(),
		pastePlainText: actions.handlePastePlainText,
		save: props.flushEditorDocument,
	});
	return actions;
}
