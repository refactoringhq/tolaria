import type { ReactNode } from "react";
import type { MobileLayoutProbe } from "../../qa/mobileLayoutProbe";
import type { MobileNeighborhoodGroup } from "../../workspace/mobileNeighborhood";
import type {
	MobileNote,
	MobilePropertyDisplayMode,
	MobilePropertyValue,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";

export type MobilePropertiesPanelProps = {
	compact: boolean;
	fullWidth?: boolean;
	showToolbar?: boolean;
	hideTypeRow?: boolean;
	nativeValueControl?: (property: {
		key: string;
		label: string;
		value: MobilePropertyValue;
	}) => ReactNode;
	layoutProbe?: boolean;
	note: MobileNote | null;
	onAddProperty: (key?: string) => void;
	onAddRelationship: (key?: string) => void;
	onDeleteProperty: (noteId: string, key: string) => void;
	onEditProperty: (
		noteId: string,
		key: string,
		value: MobilePropertyValue,
	) => void;
	onEnterNeighborhood?: (noteId: string) => void;
	onFixInvalidFrontmatter?: () => void;
	onInitializeProperties: (noteId: string) => void;
	onCreateMissingType: (typeName: string) => void;
	onOpenChangeNoteType: () => void;
	onRemoveRelationship: (noteId: string, key: string, ref: string) => void;
	onSelectNote: (noteId: string) => void;
	propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null;
	referenceGroups?: MobileNeighborhoodGroup[];
	typeDefinitions?: MobileTypeDefinitions;
};

export type NotePropertiesProps = {
	layoutProbe: MobileLayoutProbe;
	note: MobileNote;
	onAddProperty: (key?: string) => void;
	onAddRelationship: (key?: string) => void;
	onEditProperty: (
		noteId: string,
		key: string,
		value: MobilePropertyValue,
	) => void;
	onEnterNeighborhood?: (noteId: string) => void;
	onFixInvalidFrontmatter?: () => void;
	onInitializeProperties: (noteId: string) => void;
	onCreateMissingType: (typeName: string) => void;
	onOpenChangeNoteType: () => void;
	onRemoveRelationship: (noteId: string, key: string, ref: string) => void;
	onSelectNote: (noteId: string) => void;
	propertyDisplayModes?: Record<string, MobilePropertyDisplayMode> | null;
	referenceGroups: MobileNeighborhoodGroup[];
	typeDefinitions?: MobileTypeDefinitions;
	hideTypeRow?: boolean;
	nativeValueControl?: MobilePropertiesPanelProps["nativeValueControl"];
};
