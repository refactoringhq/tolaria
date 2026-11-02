import { useMobileColors } from '../../ui/theme/useMobileTheme'
import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { runOnJS, useSharedValue } from 'react-native-reanimated'

import type { MobileNote } from '../../workspace/mobileWorkspaceModel'
import { MobileNoteSwipeActions } from './MobileNoteSwipeActions'
import { fullSwipeNoteAction, type MobileNoteSwipeAction } from './mobileNoteSwipe'
import { useMobileAnalytics } from '../../analytics/useMobileAnalytics'

export type MobileNoteRowActions = {
  onArchive: (noteIds: string[], archived: boolean) => void
  onDelete: (noteIds: string[]) => void
  onToggleFavorite: (noteId: string) => void
}

type Props = {
  actions?: MobileNoteRowActions
  children: ReactNode
  disabled?: boolean
  note: MobileNote
}

export function MobileSwipeableNoteRow(props: Props) {
  if (!props.actions || props.disabled) return props.children
  return <SwipeableNoteRow {...props} actions={props.actions} />
}

function useSwipeableNoteActions(actions: MobileNoteRowActions, note: MobileNote) {
  const analytics = useMobileAnalytics()
  const swipeable = useRef<SwipeableMethods>(null)
  const perform = useCallback((action: MobileNoteSwipeAction | 'delete') => {
    swipeable.current?.close()
    if (action === 'favorite') actions.onToggleFavorite(note.id)
    if (action === 'archive') actions.onArchive([note.id], !note.archived)
    if (action === 'delete') actions.onDelete([note.id])
    analytics.capture({ name: 'mobile_note_swipe_used', action })
  }, [actions, analytics, note.id, note.archived])
  return { perform, swipeable }
}

function SwipeableNoteRow({ actions, children, note }: Props & { actions: MobileNoteRowActions }) {
  const mobileColors = useMobileColors()
  const { perform, swipeable } = useSwipeableNoteActions(actions, note)
  const width = useSharedValue(0)
  // Swipeable owns dragging/snapping. This simultaneous observer only commits a full swipe on release.
  const fullSwipe = useMemo(() => Gesture.Pan()
    .activeOffsetX(-16)
    .failOffsetX(16)
    .failOffsetY([-12, 12])
    .onEnd((event) => {
      const action = fullSwipeNoteAction(event.translationX, width.get())
      if (action) runOnJS(perform)(action)
    }), [perform, width])
  const actionProps = {
    archived: note.archived,
    favorite: note.favorite,
    noteId: note.id,
    onArchive: () => perform('archive'),
    onDelete: () => perform('delete'),
    onFavorite: () => perform('favorite'),
    width,
  }
  return (
    <GestureDetector gesture={fullSwipe}>
      <View onLayout={(event) => width.set(event.nativeEvent.layout.width)}>
        <Swipeable
          ref={swipeable}
          childrenContainerStyle={{ backgroundColor: mobileColors.card }}
          enableTrackpadTwoFingerGesture={false}
          friction={1}
          overshootFriction={1}
          dragOffsetFromLeftEdge={Number.MAX_SAFE_INTEGER}
          overshootLeft={false}
          simultaneousWithExternalGesture={fullSwipe}
          renderRightActions={(_, translation) => <MobileNoteSwipeActions {...actionProps} translation={translation} />}
        >
          {children}
        </Swipeable>
      </View>
    </GestureDetector>
  )
}
