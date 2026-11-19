import { type CSSProperties, lazy, Suspense, useRef } from "react";
import { useNearViewportOnce } from "../hooks/useNearViewportOnce";
import {
	type TldrawBlockMutationEditor,
	type TldrawBlockProps,
	updateTldrawBlockPropsSafely,
} from "./tldrawBlockProps";

const TldrawWhiteboard = lazy(() =>
	import("./TldrawWhiteboard").then((module) => ({
		default: module.TldrawWhiteboard,
	})),
);
interface TldrawBlockViewProps {
	block: { id: string; props: TldrawBlockProps };
	editor: TldrawBlockMutationEditor;
}
function LoadedTldrawWhiteboard(props: TldrawBlockViewProps) {
	const updateProps = (
		nextProps: (currentProps: TldrawBlockProps) => TldrawBlockProps,
	) =>
		updateTldrawBlockPropsSafely({
			blockId: props.block.id,
			editor: props.editor,
			nextProps,
		});

	return (
		<TldrawWhiteboard
			boardId={props.block.props.boardId}
			height={props.block.props.height}
			snapshot={props.block.props.snapshot}
			width={props.block.props.width}
			onSnapshotChange={(snapshot) => {
				updateProps((currentProps) => ({ ...currentProps, snapshot }));
			}}
			onSizeChange={(size) => {
				updateProps((currentProps) => ({
					...currentProps,
					height: size.height,
					width: size.width,
				}));
			}}
		/>
	);
}

export function TldrawBlockView(props: TldrawBlockViewProps) {
	const placeholderRef = useRef<HTMLDivElement>(null);
	const isNearViewport = useNearViewportOnce(placeholderRef);

	const placeholderStyle = {
		"--tldraw-whiteboard-height": `${props.block.props.height || "520"}px`,
		"--tldraw-whiteboard-width": props.block.props.width
			? `${props.block.props.width}px`
			: "100%",
	} as CSSProperties;
	const placeholder = (
		<div
			className="tldraw-whiteboard tldraw-whiteboard--loading"
			style={placeholderStyle}
		/>
	);

	return (
		<div ref={placeholderRef} style={{ width: "100%", minWidth: 0 }}>
			{isNearViewport ? (
				<Suspense fallback={placeholder}>
					<LoadedTldrawWhiteboard {...props} />
				</Suspense>
			) : (
				placeholder
			)}
		</div>
	);
}
