import type { Scene } from "./types";
import { quickOpenScene } from "./quickOpen";

export const scenes: Record<string, Scene> = {
	"quick-open": quickOpenScene,
};
