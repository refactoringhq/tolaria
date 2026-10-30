import { Composition } from 'remotion';
import { WikilinkFanOut } from './clips/WikilinkFanOut';
import { QuickOpenClip, QuickOpenVerticalClip, QUICK_OPEN_DURATION } from './clips/QuickOpen';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="quick-open"
        component={QuickOpenClip}
        durationInFrames={QUICK_OPEN_DURATION}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="quick-open-vertical"
        component={QuickOpenVerticalClip}
        durationInFrames={QUICK_OPEN_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="wikilink-fan-out"
        component={WikilinkFanOut}
        durationInFrames={480}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
