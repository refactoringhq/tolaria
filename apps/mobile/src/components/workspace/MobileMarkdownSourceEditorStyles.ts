import { StyleSheet } from 'react-native'
import { desktopEditorParity } from '../../ui/desktopParity'
import { mobileColors, mobileRadius, mobileSpace, mobileType } from '../../ui/tokens'

const inputStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: mobileColors.editor,
  },
  editorBody: {
    minHeight: 0,
    flex: 1,
  },
  highlightedInput: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    color: 'rgba(55, 53, 47, 0.01)',
    fontFamily: 'Menlo',
    fontSize: desktopEditorParity.bodyFontSize,
    lineHeight: desktopEditorParity.bodyLineHeight,
    paddingHorizontal: mobileSpace.md,
    paddingVertical: mobileSpace.md,
  },
  input: {
    flex: 1,
    minHeight: 420,
    borderWidth: 0,
    color: mobileColors.text,
    fontFamily: 'Menlo',
    fontSize: desktopEditorParity.bodyFontSize,
    lineHeight: desktopEditorParity.bodyLineHeight,
    paddingHorizontal: mobileSpace.md,
    paddingVertical: mobileSpace.md,
  },
  inputCompact: {
    minHeight: 360,
  },
  sourceInputHost: {
    flex: 1,
    minHeight: 420,
    backgroundColor: mobileColors.editor,
    borderColor: 'transparent',
    borderWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  sourceInputHostCompact: {
    minHeight: 360,
  },
})

const syntaxStyles = StyleSheet.create({
  syntaxAttachment: {
    color: mobileColors.orange,
  },
  syntaxCodeFence: {
    color: mobileColors.orange,
  },
  syntaxEmphasis: {
    color: mobileColors.textMuted,
    fontStyle: 'italic',
  },
  syntaxHeading: {
    color: mobileColors.text,
    fontWeight: '700',
  },
  syntaxInlineCode: {
    color: mobileColors.orange,
  },
  syntaxLayer: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: mobileSpace.md,
    paddingVertical: mobileSpace.md,
  },
  syntaxListMarker: {
    color: mobileColors.primary,
  },
  syntaxMeta: {
    color: mobileColors.textMuted,
  },
  syntaxPropertyKey: {
    color: mobileColors.primary,
  },
  syntaxQuote: {
    color: mobileColors.textMuted,
    fontStyle: 'italic',
  },
  syntaxStrong: {
    color: mobileColors.text,
    fontWeight: '700',
  },
  syntaxTable: {
    color: mobileColors.textMuted,
  },
  syntaxText: {
    color: mobileColors.text,
    fontFamily: 'Menlo',
    fontSize: desktopEditorParity.bodyFontSize,
    lineHeight: desktopEditorParity.bodyLineHeight,
  },
  syntaxWikilink: {
    color: mobileColors.primary,
  },
})

const chromeStyles = StyleSheet.create({
  frontmatterIssue: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: mobileSpace.xs,
    paddingHorizontal: mobileSpace.md,
    paddingVertical: mobileSpace.sm,
  },
  frontmatterIssueLabel: {
    color: '#92400E',
    fontSize: mobileType.caption,
    fontWeight: '600',
  },
  frontmatterIssueText: {
    color: '#92400E',
    flex: 1,
    fontSize: mobileType.caption,
  },
  suggestionRow: {
    minHeight: 32,
    alignItems: 'center',
    flexDirection: 'row',
    gap: mobileSpace.sm,
    borderRadius: 6,
    paddingHorizontal: mobileSpace.sm,
    paddingVertical: mobileSpace.xs,
  },
  suggestionRowPressed: {
    backgroundColor: mobileColors.graySoft,
  },
  suggestions: {
    gap: mobileSpace.xs,
    borderTopColor: mobileColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.editor,
    paddingHorizontal: mobileSpace.md,
    paddingVertical: mobileSpace.xs,
  },
  suggestionTitle: {
    minWidth: 0,
    flex: 1,
    color: mobileColors.text,
    fontSize: mobileType.body,
    fontWeight: '500',
  },
  toolbarHost: {
    flexShrink: 0,
    borderTopColor: mobileColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.editor,
    paddingHorizontal: mobileSpace.md,
    paddingTop: mobileSpace.xs,
  },
})

export const editorStyles = { ...inputStyles, ...syntaxStyles, ...chromeStyles }
