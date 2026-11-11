import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

type AnimationWorklet = (() => object) & {
	__closure: Record<string, unknown>;
	__initData: { code: string };
};

const require = createRequire(import.meta.url);
const babel = createRequire(require.resolve("babel-preset-expo"))(
	"@babel/core",
);

it("copies the compiled rail animation without transferring the native gesture instance", () => {
	const animation = createRailAnimationProbe();
	expect(animation.readStyle()).toEqual({ transform: [{ translateX: -304 }] });
	animation.setOffset(-694);
	expect(animation.readStyle()).toEqual({ transform: [{ translateX: -694 }] });
});

function createRailAnimationProbe() {
	let offset = -304;
	const worklets: AnimationWorklet[] = [];
	const modules = createAnimationModules(worklets);
	const code = compileTransition();
	const exports = evaluateTransition(code, modules);
	exports.PhoneWorkspaceTransition({
		children: null,
		panelRail: {
			enabled: true,
			gesture: {},
			offset: { __isSharedValue: true, get: () => offset },
		},
	});
	const worklet = worklets[0];
	if (!worklet) throw new Error("Missing compiled animation");
	const closure = copyCapture(worklet.__closure);
	const invoke = runInNewContext(`(${worklet.__initData.code})`, {
		global: { Error },
	});
	return {
		readStyle: () => invoke.call({ __closure: closure }),
		setOffset: (value: number) => (offset = value),
	};
}

function createAnimationModules(worklets: AnimationWorklet[]) {
	return {
		"@babel/runtime/helpers/interopRequireWildcard": require("@babel/runtime/helpers/interopRequireWildcard"),
		"react-native": {
			View: "View",
			StyleSheet: { create: (value: unknown) => value },
		},
		react: { useEffect: () => null },
		"../qa/mobileMotionFrameLog": { logMobileMotionEvent: () => null },
		"react-native-reanimated": {
			__esModule: true,
			default: { View: "AnimatedView" },
			useAnimatedStyle: (worklet: AnimationWorklet) => {
				worklets.push(worklet);
				return worklet();
			},
		},
		"../qa/mobileMotionFrameProbe": { useMobileMotionFrameProbe: () => null },
		"react-native-gesture-handler": { GestureDetector: "GestureDetector" },
		"./phoneWorkspaceTransitions": {
			phoneWorkspaceSidebarDrawerWidth: () => 304,
		},
		"./PhoneWorkspaceMotionContext": {
			PhoneWorkspaceMotionContext: { Provider: "MotionProvider" },
		},
		"./usePhoneViewportWidth": { usePhoneViewportWidth: () => 390 },
		"react-native-css-interop/jsx-runtime": { jsx: () => null },
	};
}

function compileTransition() {
	const compiled = babel.transformFileSync(
		new URL("./PhoneWorkspaceTransition.tsx", import.meta.url).pathname,
		{
			configFile: new URL("../../babel.config.js", import.meta.url).pathname,
			babelrc: false,
		},
	);
	return compiled.code;
}

function evaluateTransition(code: string, modules: Record<string, object>) {
	return runInNewContext(`${code}; exports`, {
		exports: {},
		global: { Error },
		require: (name: string) => {
			if (!modules[name])
				throw new Error(`Unexpected animation dependency: ${name}`);
			return modules[name];
		},
	});
}

// Shared values cross runtimes by reference; native gesture instances cannot be copied.
function copyCapture(value: unknown): unknown {
	if (value === null || typeof value !== "object") return value;
	if ("__isSharedValue" in value) return value;
	if (Object.getPrototypeOf(value)?.constructor?.name !== "Object") {
		throw new Error(`Cannot copy value of type ${value.constructor.name}`);
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [key, copyCapture(entry)]),
	);
}
