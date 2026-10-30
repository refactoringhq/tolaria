import { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

/**
 * Private Refactoring brand files are loaded at render time from videos/public/brand/
 * (gitignored; this repo is public). Missing files fall back to system fonts and no
 * drawings, so the clip still renders for anyone without the brand kit.
 *
 * Expected local files (copy from refactoringhq/brand or run `pnpm brand:sync`):
 *   public/brand/fonts/InterTight-Variable.woff2, RefactoringSans-ExtraBold.woff2
 *   public/brand/rf-drawing.js, public/brand/marks/<mark>.json
 *   public/brand/logo-reveal.mp4 (house end move render)
 */
const FONTS: Array<[family: string, file: string, weight: string]> = [
  ['Inter Tight', 'brand/fonts/InterTight-Variable.woff2', '100 900'],
  ['Refactoring Sans', 'brand/fonts/RefactoringSans-ExtraBold.woff2', '800'],
];

let fontsPromise: Promise<void> | null = null;
export function loadBrandFonts(): Promise<void> {
  fontsPromise ??= Promise.all(
    FONTS.map(async ([family, file, weight]) => {
      try {
        const face = new FontFace(family, `url(${staticFile(file)})`, { weight });
        await face.load();
        document.fonts.add(face);
      } catch {
        console.warn(`[brand] ${file} missing: using fallback font for ${family}`);
      }
    }),
  ).then(() => undefined);
  return fontsPromise;
}

export function useBrandFonts() {
  const [handle] = useState(() => delayRender('brand fonts'));
  useEffect(() => {
    loadBrandFonts().then(() => continueRender(handle), (e) => cancelRender(e));
  }, [handle]);
}

export const CAPTION_FONT = '"Inter Tight", "Inter Variable", Inter, system-ui, sans-serif';
export const DISPLAY_FONT = '"Refactoring Sans", "Inter Tight", system-ui, sans-serif';

type DrawingRuntime = {
  frameSVG: (spec: unknown, tMs: number, opts?: Record<string, unknown>) => string;
};
export type MarkSpec = { duration: number; viewBox: number[] } & Record<string, unknown>;

/** Loads the brand draw-on runtime + one mark spec; null when the brand kit isn't present. */
export function useBrandMark(name: string): { runtime: DrawingRuntime; spec: MarkSpec } | null {
  const [state, setState] = useState<{ runtime: DrawingRuntime; spec: MarkSpec } | null>(null);
  const [handle] = useState(() => delayRender(`brand mark ${name}`));
  useEffect(() => {
    (async () => {
      try {
        const runtime = (await import(/* webpackIgnore: true */ staticFile('brand/rf-drawing.js'))) as DrawingRuntime;
        const spec = (await (await fetch(staticFile(`brand/marks/${name}.json`))).json()) as MarkSpec;
        setState({ runtime, spec });
      } catch {
        console.warn(`[brand] mark ${name} not available locally; skipping drawing`);
      } finally {
        continueRender(handle);
      }
    })();
  }, [handle, name]);
  return state;
}
