import { describe, expect, it } from 'vitest'
import { resolveArrowLigatureInput } from './arrowLigatures'

describe('resolveArrowLigatureInput', () => {
  it.each([
    {
      expected: {
        change: { from: 0, insert: '→', to: 1 },
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '-',
        cursor: 1,
        inputText: '>',
        literalAsciiCursor: null,
      },
      title: 'replaces the completed right-arrow sequence',
    },
    {
      expected: {
        change: { from: 0, insert: '←', to: 1 },
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '<',
        cursor: 1,
        inputText: '-',
        literalAsciiCursor: null,
      },
      title: 'replaces the completed left-arrow sequence',
    },
    {
      expected: {
        change: { from: 0, insert: '↔', to: 2 },
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '<-',
        cursor: 2,
        inputText: '>',
        literalAsciiCursor: null,
      },
      title: 'prefers the left-right arrow over a partial right-arrow replacement',
    },
    {
      expected: {
        change: { from: 0, insert: '↔', to: 1 },
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '←',
        cursor: 1,
        inputText: '>',
        literalAsciiCursor: null,
      },
      title: 'upgrades a just-created left arrow when > completes the sequence',
    },
    {
      expected: {
        change: { from: 0, insert: '->', to: 2 },
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '\\-',
        cursor: 2,
        inputText: '>',
        literalAsciiCursor: null,
      },
      title: 'keeps escaped right arrows as ASCII',
    },
    {
      expected: {
        change: { from: 0, insert: '<-', to: 2 },
        nextLiteralAsciiCursor: 2,
      },
      input: {
        beforeText: '\\<',
        cursor: 2,
        inputText: '-',
        literalAsciiCursor: null,
      },
      title: 'keeps escaped left arrows as ASCII and tracks the pending <-> escape',
    },
    {
      expected: {
        change: null,
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '<-',
        cursor: 2,
        inputText: '>',
        literalAsciiCursor: 2,
      },
      title: 'lets the next > through unchanged after an escaped <- sequence',
    },
    {
      expected: {
        change: { from: 3, insert: '→', to: 4 },
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '-',
        cursor: 4,
        inputText: '>',
        literalAsciiCursor: 2,
      },
      title: 'clears stale escape state when the next input goes elsewhere',
    },
    {
      expected: {
        change: null,
        nextLiteralAsciiCursor: null,
      },
      input: {
        beforeText: '-',
        cursor: 1,
        inputText: '->',
        literalAsciiCursor: null,
      },
      title: 'ignores multi-character input so paste stays literal',
    },
  ])('$title', ({ expected, input }) => {
    expect(resolveArrowLigatureInput(input)).toEqual(expected)
  })
})
