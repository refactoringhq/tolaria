# Tablet panel gestures on the UI thread

Date: 2026-10-10. Status: accepted.

## Context

Tablet panels used PanResponder callbacks on the JavaScript thread. They competed
with nested scroll views and used settled state during interrupted animations.
Large-vault parsing and editor work must not delay direct manipulation.

## Decision

Use Expo SDK 54's compatible React Native Gesture Handler 2.28 and existing
Reanimated 4. Recognize horizontal intent across the workspace, yield vertical
movement to scrolling, and run movement and spring settlement on the UI thread.
React receives only the final logical state for accessibility and button state.
The left strip has three snap points based on existing desktop token widths:
sidebar/list/editor, list/editor, and editor. Properties opens from the right
edge or its toolbar button, and dismisses from its own surface. Drag interruption
starts from the presented offset, not the previous target.

No appearance changes are part of this decision. Keyboard and toolbar controls
remain equivalent navigation paths. One-finger movement is recognized; additional
touches are left to the content. Native screenshots alone cannot validate the
gesture: simulator interactions and scroll arbitration are separate QA evidence.

## Consequences

GestureHandlerRootView wraps the app, and GestureDetector wraps the tablet shell.
The phone navigation implementation remains unchanged. A standalone native app
must rebuild after adding the native dependency; compatible Expo Go already
contains it. Continuous panel resizing still performs native layout, so UI-thread
recognition is not by itself proof of frame-rate or large-vault performance.
