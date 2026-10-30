import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender, useCurrentFrame } from 'remotion';

/**
 * The REAL Tolaria app (repo-root src/, backed by mock-tauri + a copy of demo-vault-v2),
 * served by `pnpm ui` (videos/real-ui/vite.config.ts) and embedded as an iframe.
 *
 * Every Remotion frame is posted to the in-app director (videos/real-ui/director.ts),
 * which moves the UI to that frame's exact state. The frame is held with delayRender
 * until the app reports it has settled, so screenshots are deterministic.
 *
 * Everything inside is live DOM: text and icons stay vector-sharp under camera zooms.
 */

export type AppRect = { x: number; y: number; width: number; height: number };
export type AppRects = Record<string, AppRect>;

/** Origin of `pnpm ui`; every message to and from the iframe is pinned to it. */
export const TOLARIA_UI_ORIGIN = new URL(process.env.REMOTION_TOLARIA_UI_ORIGIN ?? 'http://localhost:5320').origin;

interface TolariaAppProps {
  scene: string;
  width: number;
  height: number;
  /** Frame to show (defaults to the composition frame). */
  frame?: number;
  onRects?: (rects: AppRects) => void;
  style?: React.CSSProperties;
}

type DirectorMessage =
  | { type: 'tolaria-video:boot'; scene: string }
  | { type: 'tolaria-video:ready'; frame: number; rects: AppRects }
  | { type: 'tolaria-video:error'; frame: number; message: string };

export const TolariaApp: React.FC<TolariaAppProps> = ({ scene, width, height, frame: frameProp, onRects, style }) => {
  const compFrame = useCurrentFrame();
  const frame = frameProp ?? compFrame;
  const iframe = useRef<HTMLIFrameElement>(null);
  const [booted, setBooted] = useState(false);
  const [bootHandle] = useState(() =>
    delayRender(`Booting real Tolaria UI (${scene}); is \`pnpm ui\` running on ${TOLARIA_UI_ORIGIN}?`, {
      timeoutInMilliseconds: 180_000,
    }),
  );
  const pending = useRef<{ frame: number; handle: number } | null>(null);
  const onRectsRef = useRef(onRects);
  onRectsRef.current = onRects;

  const post = (f: number) => {
    iframe.current?.contentWindow?.postMessage({ type: 'tolaria-video:frame', frame: f }, TOLARIA_UI_ORIGIN);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent<DirectorMessage>) => {
      if (event.origin !== TOLARIA_UI_ORIGIN || event.source !== iframe.current?.contentWindow) return;
      const data = event.data;
      if (data?.type === 'tolaria-video:boot') {
        setBooted((was) => {
          if (!was) continueRender(bootHandle);
          return true;
        });
        // A reload (seek backwards) re-boots: replay the frame we are waiting on.
        if (pending.current) post(pending.current.frame);
      } else if (data?.type === 'tolaria-video:ready') {
        const p = pending.current;
        if (!p || p.frame !== data.frame) return;
        onRectsRef.current?.(data.rects);
        pending.current = null;
        // Let React commit overlay positions before the screenshot.
        requestAnimationFrame(() => continueRender(p.handle));
      } else if (data?.type === 'tolaria-video:error') {
        console.error(`[TolariaApp] director error at frame ${data.frame}: ${data.message}`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [bootHandle]);

  useEffect(() => {
    if (!booted) return;
    const handle = delayRender(`Tolaria UI settling at frame ${frame}`, { timeoutInMilliseconds: 60_000 });
    if (pending.current) continueRender(pending.current.handle);
    pending.current = { frame, handle };
    post(frame);
  }, [booted, frame]);

  return (
    <iframe
      ref={iframe}
      title={`tolaria-${scene}`}
      src={`${TOLARIA_UI_ORIGIN}/?scene=${encodeURIComponent(scene)}&parent=${encodeURIComponent(window.location.origin)}`}
      style={{ width, height, border: 0, display: 'block', background: '#fff', ...style }}
    />
  );
};
