import { useState } from 'react';
import { AbsoluteFill, getStaticFiles, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { QUICK_OPEN as T, QUICK_OPEN_DURATION } from '../../real-ui/scenes/quickOpen.timeline';
import { BrandMark } from '../components/BrandMark';
import { Caption, Keycaps, type CaptionChunk } from '../components/Caption';
import { TolariaApp, type AppRects } from '../components/TolariaApp';
import { useBrandFonts, DISPLAY_FONT } from '../lib/brandLocal';
import { BRAND, keyed, progress, rfIn } from '../lib/house';

/**
 * Feature clip: Quick Open. 100% real Tolaria UI (no screenshots, no replicas):
 * the real app opens the real QuickOpenPalette, the query filters the real
 * NoteSearchList over demo-vault-v2, and the picked note opens in the real
 * BlockNote editor. Remotion adds only the camera, captions, keycaps, one brand
 * drawing and the end move.
 */

export { QUICK_OPEN_DURATION };
const APP = T.viewport;

type Keys = Array<[number, number]>;
export type Layout = {
  width: number;
  height: number;
  /** Region of the composition the camera shows (whole frame in 16:9, a card in 9:16). */
  view: { x: number; y: number; width: number; height: number; card: boolean };
  /** Camera: app-space focus point + scale, keyed by frame. */
  camera: { fx: Keys; fy: Keys; s: Keys };
  captionY: number;
  captionSize: number;
  keycapsY: number;
  headline?: { y: number; size: number };
};

const CAPTIONS: CaptionChunk[] = [
  { from: 8, to: 62, words: ['Find', 'any', 'note.'], hot: { index: 1, at: 18 } },
  { from: 62, to: 128, words: ['Type', 'a', 'few', 'letters.'], hot: { index: 3, at: T.typeFrames[0] + 8 } },
  { from: 128, to: T.enter + 4, words: ['Pick', 'the', 'one.'], hot: { index: 2, at: T.arrowDown[1] + 2 } },
  { from: T.enter + 4, to: 292, words: ['It', 'opens.', 'Instantly.'], hot: { index: 2, at: T.enter + 20 } },
];

const E = T.enter;
export const LANDSCAPE: Layout = {
  width: 1920,
  height: 1080,
  view: { x: 0, y: 0, width: 1920, height: 1080, card: false },
  camera: {
    fx: [[0, 800], [46, 800], [72, 800], [104, 800], [E, 800], [E + 26, 1083], [236, 1083], [262, 800]],
    fy: [[0, 470], [46, 470], [72, 305], [104, 245], [E, 248], [E + 26, 205], [236, 210], [262, 470]],
    s: [[0, 1], [46, 1.03], [72, 1.4], [104, 1.64], [E, 1.7], [E + 26, 1.5], [236, 1.55], [262, 1], [292, 1.02]],
  },
  captionY: 1080 - 96 - 70,
  captionSize: 46,
  keycapsY: 790,
};

/** 9:16, restaged: headline up top, the live app in a card, captions at ~65 % height. */
export const PORTRAIT: Layout = {
  width: 1080,
  height: 1920,
  view: { x: 64, y: 410, width: 952, height: 830, card: true },
  camera: {
    fx: [[0, 900], [46, 900], [72, 800], [104, 800], [E, 800], [E + 26, 1010], [236, 1010], [262, 900]],
    fy: [[0, 440], [46, 440], [72, 330], [104, 250], [E, 252], [E + 26, 300], [236, 302], [262, 440]],
    s: [[0, 0.8], [46, 0.83], [72, 1.4], [104, 1.6], [E, 1.66], [E + 26, 1.3], [236, 1.34], [262, 0.8], [292, 0.82]],
  },
  captionY: 1290,
  captionSize: 54,
  keycapsY: 1420,
  headline: { y: 262, size: 100 },
};

const Headline: React.FC<{ frame: number; y: number; size: number; exit: number }> = ({ frame, y, size, exit }) => {
  const words = ['Quick', 'Open'];
  return (
    <div style={{ position: 'absolute', top: y, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '0.25em', fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: size, color: BRAND.white, letterSpacing: '-0.02em', opacity: 1 - exit }}>
      {words.map((w, i) => {
        const p = progress(frame, 4 + i * 4, 14);
        return (
          <span key={w} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const QuickOpenVerticalClip: React.FC = () => <QuickOpenClip layout={PORTRAIT} />;

export const QuickOpenClip: React.FC<{ layout?: Layout }> = ({ layout = LANDSCAPE }) => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const [rects, setRects] = useState<AppRects>({});
  const L = layout;

  const s = keyed(frame, L.camera.s);
  const fx = keyed(frame, L.camera.fx);
  const fy = keyed(frame, L.camera.fy);
  const exit = progress(frame, T.uiEnd - 10, 12, rfIn);
  const V = L.view;
  // App point (fx, fy) lands on the centre of the view; the app's own origin is (0, 0).
  const camera = `translate(${V.width / 2}px, ${V.height / 2 - exit * 60}px) scale(${s * (1 - exit * 0.08)}) translate(${-fx}px, ${-fy}px)`;

  const circle = rects.selectedTitle;
  const circleStart = T.arrowDown[T.arrowDown.length - 1] + 4;
  const circleMs = ((frame - circleStart) / T.fps) * 1000 * 1.45;
  const showCircle = circle && frame >= circleStart && frame < T.enter;

  const files = getStaticFiles();
  const hasLogo = files.some((f) => f.name === 'brand/logo-reveal.mp4');
  const hasAlphaLogo = files.some((f) => f.name === 'brand/logo-reveal.webm');

  return (
    <AbsoluteFill style={{ background: BRAND.blue, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: V.x,
          top: V.y,
          width: V.width,
          height: V.height,
          overflow: 'hidden',
          ...(V.card
            ? { borderRadius: 32, background: BRAND.blue400, boxShadow: `0 0 0 3px ${BRAND.dark}`, opacity: 1 - exit, transform: `translateY(${-exit * 40}px)` }
            : {}),
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: camera, opacity: V.card ? 1 : 1 - exit }}>
          {/* Flat depth: a solid offset block, no blur. */}
          <div style={{ position: 'absolute', left: 14, top: 18, width: APP.width, height: APP.height, borderRadius: 18, background: BRAND.dark, opacity: 0.28 }} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: APP.width,
              height: APP.height,
              borderRadius: 18,
              overflow: 'hidden',
              background: BRAND.white,
              boxShadow: `0 0 0 2px ${BRAND.dark}`,
            }}
          >
            <TolariaApp scene="quick-open" width={APP.width} height={APP.height} onRects={setRects} />
            {showCircle && (
              <BrandMark
                name="circle-03"
                tMs={circleMs}
                color={BRAND.red}
                x={circle.x - 22}
                y={circle.y - 16}
                width={circle.width + 44}
                height={circle.height + 32}
                rotate={-2}
              />
            )}
          </div>
        </div>
      </div>

      {L.headline && <Headline frame={frame} y={L.headline.y} size={L.headline.size} exit={exit} />}

      <AbsoluteFill style={{ alignItems: 'center', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: L.keycapsY }}>
          <Keycaps keys={['⌘', 'O']} frame={frame} from={24} press={T.open - 4} to={T.open + 6} fontSize={L.captionSize * 0.9} />
        </div>
        <div style={{ position: 'absolute', top: L.captionY }}>
          {CAPTIONS.map((c) => (
            <Caption key={c.from} chunk={c} frame={frame} fontSize={L.captionSize} />
          ))}
        </div>
      </AbsoluteFill>

      <Sequence from={T.uiEnd} durationInFrames={T.endCard}>
        {L.width > L.height && hasLogo ? (
          <OffthreadVideo src={staticFile('brand/logo-reveal.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : hasAlphaLogo ? (
          // 9:16: the same pen-drawn logo move (alpha render) restaged on a flat blue field.
          <AbsoluteFill style={{ background: BRAND.blue, justifyContent: 'center' }}>
            <OffthreadVideo src={staticFile('brand/logo-reveal.webm')} transparent muted style={{ width: '100%' }} />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ background: BRAND.blue, color: BRAND.white, alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY_FONT, fontSize: 120 }}>
            Tolaria
          </AbsoluteFill>
        )}
      </Sequence>
    </AbsoluteFill>
  );
};
