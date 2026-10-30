import { useMemo } from 'react';
import { Img } from 'remotion';
import { useBrandMark } from '../lib/brandLocal';

/**
 * A Refactoring hand-drawn mark, drawn on by the brand runtime at time tMs (seek-safe).
 * The frame's SVG is shown as an <img> data URI (no innerHTML); Remotion's <Img>
 * holds the frame until it has decoded.
 */
export const BrandMark: React.FC<{
  name: string;
  tMs: number;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
}> = ({ name, tMs, color, x, y, width, height, rotate = 0 }) => {
  const mark = useBrandMark(name);
  const src = useMemo(() => {
    if (!mark || tMs <= 0) return '';
    const svg = mark.runtime
      .frameSVG(mark.spec, tMs, { color, id: `${name}-mark`, width: String(width), height: String(height) })
      .replace('<svg ', '<svg preserveAspectRatio="none" ');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [mark, tMs, color, name, width, height]);
  if (!src) return null;
  return (
    <Img
      src={src}
      alt=""
      style={{ position: 'absolute', left: x, top: y, width, height, transform: `rotate(${rotate}deg)`, pointerEvents: 'none', overflow: 'visible' }}
    />
  );
};
