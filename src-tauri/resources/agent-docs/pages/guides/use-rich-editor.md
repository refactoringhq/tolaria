# Use The Rich Editor

Source: guides/use-rich-editor.md
URL: /guides/use-rich-editor

# Use The Rich Editor

Tolaria's rich editor gives you block-based editing while keeping the note as portable Markdown. Use these workflows to move quickly without losing access to the underlying file.

## Insert Common Blocks

Type `/` on an empty line to open the slash menu. Useful commands include:

- headings, lists, quotes, and dividers
- todo blocks
- code blocks
- tables
- the current date
- the current time

Use `Cmd+T` on macOS or `Ctrl+T` on Windows and Linux to toggle the current block between a paragraph and a todo.

## Select And Move Whole Blocks

Press `Esc` while editing to select the current block. While block selection is active:

- `Up` and `Down` move the selection.
- `Shift+Up` and `Shift+Down` extend it.
- `Enter` returns to text editing.
- `Cmd+Shift+Up` and `Cmd+Shift+Down` move selected blocks on macOS. Use `Ctrl+Shift+Up` and `Ctrl+Shift+Down` on Windows and Linux.
- Copy, cut, paste, and delete operate on the selected blocks.

Collapsed heading content travels with its heading when you copy, cut, delete, or move the selected section.

## Collapse Long Sections

Headings can hide the content below them until the next heading at the same or higher level. Use the disclosure control beside a heading, or select the heading block and press `Cmd+Enter` on macOS or `Ctrl+Enter` on Windows and Linux.

Collapsing a section changes only the editor presentation. Tolaria does not add private folding syntax to the Markdown file.

## Write Code

Create a code block from the slash menu, type a triple-backtick fence and press `Enter`, or use `Cmd+Shift+Backtick` on macOS and `Ctrl+Shift+Backtick` on Windows and Linux.

Choose the language from the code block control to enable syntax highlighting. Line numbers are presentation-only and are not written into the note.

## Add Callouts

Tolaria renders Obsidian-style callouts and GitHub alert syntax as editable blocks while preserving the Markdown:

```md
> [!NOTE] Local-first
> This note stays readable outside Tolaria.
```

Callouts stay expanded in the rich editor. Use a plain marker when you want Tolaria to render an editable callout:

```md
> [!TIP] Optional details
> This callout stays expanded and editable.
```

Obsidian's `+` and `-` fold markers are not supported yet; blocks that use them remain ordinary blockquotes. Change a callout's type or title in raw mode.

## Highlight Text

Select text and use the formatting toolbar, or press `Cmd+Shift+M` on macOS and `Ctrl+Shift+M` on Windows and Linux. Tolaria saves highlights as `==highlighted text==`.

## Check The Markdown

Toggle raw mode with `Cmd+\` on macOS or `Ctrl+\` on Windows and Linux. Raw mode is useful for:

- checking the exact Markdown representation
- editing YAML frontmatter
- changing callout markers
- repairing unusual pasted content

Invalid YAML frontmatter is highlighted so you can find structural problems without guessing where parsing failed.

For web capture and file previews, continue with [Use Media Previews](/guides/use-media-previews). For longer notes, see [Use The Table Of Contents](/guides/use-table-of-contents).