import { interpolate } from 'remotion';
import { BRAND, progress, rfIn } from '../lib/house';
import { CAPTION_FONT } from '../lib/brandLocal';

export type CaptionChunk = {
  from: number;
  to: number;
  words: string[];
  /** Index of the word to light yellow, and from which frame. */
  hot?: { index: number; at: number };
};

/** Brand caption: Inter Tight 600, white on a solid dark pill, active word yellow. */
export const Caption: React.FC<{ chunk: CaptionChunk; frame: number; fontSize?: number }> = ({ chunk, frame, fontSize = 46 }) => {
  if (frame < chunk.from || frame >= chunk.to) return null;
  const enter = progress(frame, chunk.from, 12);
  const exit = progress(frame, chunk.to - 8, 8, rfIn);
  const y = interpolate(enter, [0, 1], [18, 0]) + exit * 10;
  const opacity = Math.min(enter * 1.6, 1) * (1 - exit);
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: '0.28em',
        padding: '0.32em 0.62em 0.36em',
        borderRadius: 999,
        background: BRAND.dark,
        color: BRAND.white,
        fontFamily: CAPTION_FONT,
        fontWeight: 600,
        fontSize,
        letterSpacing: '-0.01em',
        lineHeight: 1.1,
        transform: `translateY(${y}px)`,
        opacity,
        whiteSpace: 'nowrap',
      }}
    >
      {chunk.words.map((word, i) => {
        const wordIn = progress(frame, chunk.from + i * 2, 7);
        const hot = chunk.hot && chunk.hot.index === i && frame >= chunk.hot.at;
        return (
          <span
            key={i}
            style={{
              color: hot ? BRAND.yellow : BRAND.white,
              opacity: wordIn,
              display: 'inline-block',
              transform: `translateY(${(1 - wordIn) * 10}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

/** Keycaps chip (e.g. ⌘ O): pops in, presses down on `press`. */
export const Keycaps: React.FC<{ keys: string[]; frame: number; from: number; press: number; to: number; fontSize?: number }> = ({
  keys,
  frame,
  from,
  press,
  to,
  fontSize = 40,
}) => {
  if (frame < from || frame >= to) return null;
  const enter = progress(frame, from, 10);
  const exit = progress(frame, to - 7, 7, rfIn);
  const down = frame >= press && frame < press + 5 ? 1 : frame >= press + 5 ? Math.max(0, 1 - (frame - press - 5) / 4) : 0;
  return (
    <div style={{ display: 'flex', gap: 12, opacity: enter * (1 - exit), transform: `translateY(${(1 - enter) * 16}px) scale(${1 - exit * 0.1})` }}>
      {keys.map((k) => (
        <div
          key={k}
          style={{
            minWidth: fontSize * 1.7,
            height: fontSize * 1.7,
            padding: '0 0.4em',
            boxSizing: 'border-box',
            display: 'grid',
            placeItems: 'center',
            borderRadius: fontSize * 0.36,
            background: BRAND.white,
            color: BRAND.dark,
            fontFamily: CAPTION_FONT,
            fontWeight: 700,
            fontSize,
            boxShadow: `0 ${6 - down * 4}px 0 ${BRAND.dark}`,
            transform: `translateY(${down * 4}px)`,
            border: `3px solid ${BRAND.dark}`,
          }}
        >
          {k}
        </div>
      ))}
    </div>
  );
};
