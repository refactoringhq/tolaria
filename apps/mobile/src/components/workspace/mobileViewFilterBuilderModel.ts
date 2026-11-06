import { mobileText } from "../../i18n/mobileText";
import type {
	MobileNote,
	MobileTypeDefinitions,
	MobileViewFilterCondition,
	MobileViewFilterGroup,
	MobileViewFilterNode,
	MobileViewFilterOp,
} from "../../workspace/mobileWorkspaceModel";
import { mobileViewFieldSuggestions } from "../../workspace/mobileWorkspaceSuggestions";

export type FilterPath = string;
export type FilterMode = "all" | "any";

const emptyPath = "root";
const defaultField = "type";

export function defaultCondition(
	notes: MobileNote[],
	typeDefinitions?: MobileTypeDefinitions,
): MobileViewFilterCondition {
	return {
		field:
			mobileViewFieldSuggestions(notes, "", typeDefinitions)[0] ?? defaultField,
		op: "equals",
		value: "",
	};
}

export function groupMode(group: MobileViewFilterGroup): FilterMode {
	return "any" in group ? "any" : "all";
}

export function groupNodes(
	group: MobileViewFilterGroup,
): MobileViewFilterNode[] {
	return "any" in group ? group.any : group.all;
}

export function groupWithNodes(
	mode: FilterMode,
	nodes: MobileViewFilterNode[],
): MobileViewFilterGroup {
	return mode === "any" ? { any: nodes } : { all: nodes };
}

export function addNode(
	group: MobileViewFilterGroup,
	node: MobileViewFilterNode,
): MobileViewFilterGroup {
	return groupWithNodes(groupMode(group), [...groupNodes(group), node]);
}

export function updateNode(
	group: MobileViewFilterGroup,
	index: number,
	node: MobileViewFilterNode,
): MobileViewFilterGroup {
	return groupWithNodes(
		groupMode(group),
		groupNodes(group).map((candidate, candidateIndex) =>
			candidateIndex === index ? node : candidate,
		),
	);
}

export function removeNode(
	group: MobileViewFilterGroup,
	index: number,
): MobileViewFilterGroup {
	return groupWithNodes(
		groupMode(group),
		groupNodes(group).filter((_node, nodeIndex) => nodeIndex !== index),
	);
}

export function nextMode(mode: FilterMode): FilterMode {
	return mode === "all" ? "any" : "all";
}

export function isFilterGroup(
	node: MobileViewFilterNode,
): node is MobileViewFilterGroup {
	return "all" in node || "any" in node;
}

export function childPath(parent: FilterPath, index: number) {
	return parent ? `${parent}-${index}` : String(index);
}

export function testPath(path: FilterPath) {
	return path || emptyPath;
}

export function operatorLabel(operator: MobileViewFilterOp) {
	return mobileText(`viewDialog.filter.operator.${operator}`);
}
