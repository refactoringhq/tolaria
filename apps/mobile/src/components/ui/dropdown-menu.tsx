import * as Primitive from '@rn-primitives/dropdown-menu'
import type { ComponentProps, ReactNode } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { mobileColors, mobileRadius, mobileSpace } from '../../ui/tokens'
import { cn } from './utils'

export const DropdownMenu = Primitive.Root
export const DropdownMenuTrigger = Primitive.Trigger

// RNR composition: the primitive owns positioning, dismissal, and interaction.
type ContentProps = Omit<ComponentProps<typeof Primitive.Content>, 'children' | 'style'> & { children?: ReactNode; style?: ViewStyle }
type ItemProps = Omit<ComponentProps<typeof Primitive.Item>, 'style'> & { style?: StyleProp<ViewStyle> }

export function DropdownMenuContent({ children, style, ...props }: ContentProps) {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const maxHeight = Math.min(360, height - insets.top - insets.bottom - 80)
  return (
    <Primitive.Portal>
      <Primitive.Overlay accessible={false} style={StyleSheet.absoluteFill}>
        <Primitive.Content accessible={false} align="start" side="top" sideOffset={8} insets={insets} style={StyleSheet.flatten([styles.content, { maxHeight }, style])} {...props}>
          <ScrollView keyboardShouldPersistTaps="always" bounces={false} style={{ maxHeight }}>
            {children}
          </ScrollView>
        </Primitive.Content>
      </Primitive.Overlay>
    </Primitive.Portal>
  )
}

export function DropdownMenuItem({ className, style, ...props }: ItemProps) {
  return <Primitive.Item className={cn('active:bg-accent', className)} style={[styles.item, style]} {...props} />
}

const styles = StyleSheet.create({
  content: {
    minWidth: 200,
    maxWidth: 300,
    padding: mobileSpace.xs,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  item: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: mobileSpace.sm,
    paddingHorizontal: mobileSpace.sm,
    paddingVertical: mobileSpace.sm,
    borderRadius: mobileRadius.sm,
  },
})
