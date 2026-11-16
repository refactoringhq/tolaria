import {
	type CSSProperties,
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
} from "react";
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
export function TldrawBlockView(props: TldrawBlockViewProps) {
	const placeholderRef = useRef<HTMLDivElement>(null);
	const [isNearViewport, setIsNearViewport] = useState(
		() => typeof IntersectionObserver === "undefined",
	);

	useEffect(() => {
		const placeholder = placeholderRef.current;
		if (!placeholder) return;
		if (typeof IntersectionObserver === "undefined") return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				setIsNearViewport(true);
				observer.disconnect();
			},
			{ rootMargin: "600px 0px" },
		);
		observer.observe(placeholder);
		return () => observer.disconnect();
	}, []);

	const placeholderStyle = {
		"--tldraw-whiteboard-height": `${props.block.props.height || "520"}px`,
		"--tldraw-whiteboard-width": props.block.props.width
			? `${props.block.props.width}px`
			: "100%",
	} as CSSProperties;

	return (
		<div ref={placeholderRef} style={{ width: "100%", minWidth: 0 }}>
			{isNearViewport ? (
				<Suspense
					fallback={
						<div
							className="tldraw-whiteboard tldraw-whiteboard--loading"
							style={placeholderStyle}
						/>
					}
				>
					<TldrawWhiteboard
						boardId={props.block.props.boardId}
						height={props.block.props.height}
						snapshot={props.block.props.snapshot}
						width={props.block.props.width}
						onSnapshotChange={(snapshot) => {
							updateTldrawBlockPropsSafely({
								blockId: props.block.id,
								editor: props.editor,
								nextProps: (currentProps) => ({
									...currentProps,
									snapshot,
								}),
							});
						}}
						onSizeChange={(size) => {
							updateTldrawBlockPropsSafely({
								blockId: props.block.id,
								editor: props.editor,
								nextProps: (currentProps) => ({
									...currentProps,
									height: size.height,
									width: size.width,
								}),
							});
						}}
					/>
				</Suspense>
			) : (
				<div
					className="tldraw-whiteboard tldraw-whiteboard--loading"
					style={placeholderStyle}
				/>
			)}
		</div>
	);
}
