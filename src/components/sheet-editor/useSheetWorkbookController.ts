import type { Model } from '@ironcalc/workbook'
import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trackSheetEditorOpened } from '../../lib/productAnalytics'
import { notePathsMatch } from '../../utils/notePathIdentity'
import { cancelIdle, type IdleHandle, scheduleIdle } from '../../utils/sheetBrowserScheduling'
import { canSerializeSheetWorkbook, clearSheetWorkbookDirty, markSheetWorkbookDirty } from '../../utils/sheetDirtyState'
import { ensureIronCalcReady } from '../../utils/sheetEngineReadiness'
import type { SheetExternalFormulaInput } from '../../utils/sheetExternalFormulaWorker'
import { mergeDirtyBodyRows } from '../../utils/sheetSelection'
import {
  buildSheetContent,
  buildWorkbook,
  type SheetBodyDirtyRows,
  type SheetExternalFormulaContext,
  summarizeSheetContent,
} from '../../utils/sheetWorkbook'
import type { ScheduleSheetSerializeOptions, SheetWorkbookState } from './sheetEditorTypes'
import { skipIfReleasedWorkbookModel } from './sheetReleasedModel'

const SERIALIZE_DEBOUNCE_MS = 450

interface UseSheetWorkbookControllerOptions {
  content: string
  externalFormulaContextForBuild?: SheetExternalFormulaContext
  nativeExternalFormulaInputsForBuild?: Map<string, SheetExternalFormulaInput> | null
  onContentChange: (path: string, content: string) => void
  path: string
  pendingExternalFormulaCommitRef: MutableRefObject<number>
  shouldWaitForInitialExternalFormulaResolution?: (workbookAlreadyBuilt: boolean) => boolean
}

function resetDirtyTracking(
  dirtyWorkbookGenerationRef: MutableRefObject<number | null>,
  dirtyBodyRowsRef: MutableRefObject<SheetBodyDirtyRows>,
) {
  clearSheetWorkbookDirty(dirtyWorkbookGenerationRef)
  dirtyBodyRowsRef.current = null
}

function cancelPendingSerialize(
  idleSerializeRef: MutableRefObject<IdleHandle | null>,
  serializeTimerRef: MutableRefObject<number | null>,
) {
  if (serializeTimerRef.current !== null) {
    window.clearTimeout(serializeTimerRef.current)
    serializeTimerRef.current = null
  }
  if (idleSerializeRef.current !== null) {
    cancelIdle(idleSerializeRef.current)
    idleSerializeRef.current = null
  }
}

function releaseWorkbookModelNow(model: Model | null | undefined): void {
  if (!model) return
  try {
    model.free()
  } catch (error) {
    console.warn('[sheet-editor] Failed to release workbook model:', error)
  }
}

function releaseWorkbookModel(model: Model | null | undefined): void {
  if (!model) return
  window.setTimeout(() => {
    releaseWorkbookModelNow(model)
  }, 0)
}

function releaseQueuedWorkbookModels(replacedWorkbookModelsRef: MutableRefObject<Model[]>): void {
  const replacedModels = replacedWorkbookModelsRef.current
  replacedWorkbookModelsRef.current = []
  for (const model of replacedModels) releaseWorkbookModel(model)
}

function buildCurrentSheetContent({
  current,
  dirtyBodyRowsRef,
  sourceContent,
}: {
  current: SheetWorkbookState
  dirtyBodyRowsRef: MutableRefObject<SheetBodyDirtyRows>
  sourceContent: string
}): string | null {
  return skipIfReleasedWorkbookModel('serialization', null, () =>
    buildSheetContent(sourceContent, current.model, current.externalFormulaInputs, {
      bodyRows: dirtyBodyRowsRef.current,
    }),
  )
}

function shouldSkipWorkbookRebuild({
  content,
  lastEmittedContentRef,
  lastEmittedPathRef,
  path,
}: Pick<UseSheetWorkbookControllerOptions, 'content' | 'path'> & {
  lastEmittedContentRef: MutableRefObject<string | null>
  lastEmittedPathRef: MutableRefObject<string | null>
}) {
  return content === lastEmittedContentRef.current && path === lastEmittedPathRef.current
}

function nextWorkbookState({
  build,
  generation,
  path,
}: {
  build: ReturnType<typeof buildWorkbook>
  generation: number
  path: string
}): SheetWorkbookState {
  return {
    externalFormulaInputs: build.externalFormulaInputs,
    generation,
    model: build.model,
    path,
    refreshId: Date.now(),
  }
}

interface WorkbookSerializationOptions {
  dirtyBodyRowsRef: MutableRefObject<SheetBodyDirtyRows>
  dirtyWorkbookGenerationRef: MutableRefObject<number | null>
  idleSerializeRef: MutableRefObject<IdleHandle | null>
  lastEmittedContentRef: MutableRefObject<string | null>
  lastEmittedPathRef: MutableRefObject<string | null>
  latestContentPathRef: MutableRefObject<string>
  latestContentRef: MutableRefObject<string>
  onContentChangeRef: MutableRefObject<(path: string, content: string) => void>
  serializeTimerRef: MutableRefObject<number | null>
  workbookPathRef: MutableRefObject<string>
  workbookRef: MutableRefObject<SheetWorkbookState | null>
}

function useCancelScheduledSerialize({
  idleSerializeRef,
  serializeTimerRef,
}: Pick<WorkbookSerializationOptions, 'idleSerializeRef' | 'serializeTimerRef'>) {
  return useCallback(() => {
    cancelPendingSerialize(idleSerializeRef, serializeTimerRef)
  }, [idleSerializeRef, serializeTimerRef])
}

function useSerializeCurrentWorkbook(
  options: Omit<WorkbookSerializationOptions, 'idleSerializeRef' | 'serializeTimerRef'>,
) {
  const {
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    lastEmittedContentRef,
    lastEmittedPathRef,
    latestContentPathRef,
    latestContentRef,
    onContentChangeRef,
    workbookPathRef,
    workbookRef,
  } = options
  return useCallback(
    (expectedGeneration?: number) => {
      const current = workbookRef.current
      if (
        !current ||
        !canSerializeSheetWorkbook({
          current,
          dirtyGeneration: dirtyWorkbookGenerationRef.current,
          expectedGeneration,
          latestContentPath: latestContentPathRef.current,
          pathsMatch: notePathsMatch,
          workbookPath: workbookPathRef.current,
        })
      )
        return false

      const sourceContent = latestContentRef.current
      const sourcePath = current.path
      const nextContent = buildCurrentSheetContent({
        current,
        dirtyBodyRowsRef,
        sourceContent,
      })
      if (nextContent === null) {
        resetDirtyTracking(dirtyWorkbookGenerationRef, dirtyBodyRowsRef)
        return false
      }
      if (nextContent === sourceContent) {
        resetDirtyTracking(dirtyWorkbookGenerationRef, dirtyBodyRowsRef)
        return false
      }
      if (nextContent === lastEmittedContentRef.current && sourcePath === lastEmittedPathRef.current) {
        resetDirtyTracking(dirtyWorkbookGenerationRef, dirtyBodyRowsRef)
        return false
      }

      lastEmittedPathRef.current = sourcePath
      lastEmittedContentRef.current = nextContent
      latestContentRef.current = nextContent
      latestContentPathRef.current = sourcePath
      resetDirtyTracking(dirtyWorkbookGenerationRef, dirtyBodyRowsRef)
      onContentChangeRef.current(sourcePath, nextContent)
      return true
    },
    [
      dirtyBodyRowsRef,
      dirtyWorkbookGenerationRef,
      lastEmittedContentRef,
      lastEmittedPathRef,
      latestContentPathRef,
      latestContentRef,
      onContentChangeRef,
      workbookPathRef,
      workbookRef,
    ],
  )
}

function useScheduleWorkbookSerialize({
  cancelScheduledSerialize,
  dirtyBodyRowsRef,
  dirtyWorkbookGenerationRef,
  idleSerializeRef,
  serializeCurrentWorkbook,
  serializeTimerRef,
  workbookRef,
}: Pick<
  WorkbookSerializationOptions,
  'dirtyBodyRowsRef' | 'dirtyWorkbookGenerationRef' | 'idleSerializeRef' | 'serializeTimerRef' | 'workbookRef'
> & {
  cancelScheduledSerialize: () => void
  serializeCurrentWorkbook: (expectedGeneration?: number) => boolean
}) {
  return useCallback(
    (options: ScheduleSheetSerializeOptions = {}) => {
      const shouldMarkDirty = options.dirty !== false
      markSheetWorkbookDirty(dirtyWorkbookGenerationRef, workbookRef.current, shouldMarkDirty)
      if (shouldMarkDirty) dirtyBodyRowsRef.current = mergeDirtyBodyRows(dirtyBodyRowsRef.current, options.bodyRows)
      cancelScheduledSerialize()
      const generation = workbookRef.current?.generation
      serializeTimerRef.current = window.setTimeout(() => {
        serializeTimerRef.current = null
        idleSerializeRef.current = scheduleIdle(() => {
          idleSerializeRef.current = null
          serializeCurrentWorkbook(generation)
        })
      }, SERIALIZE_DEBOUNCE_MS)
    },
    [
      cancelScheduledSerialize,
      dirtyBodyRowsRef,
      dirtyWorkbookGenerationRef,
      idleSerializeRef,
      serializeCurrentWorkbook,
      serializeTimerRef,
      workbookRef,
    ],
  )
}

function useWorkbookSerialization(options: WorkbookSerializationOptions) {
  const cancelScheduledSerialize = useCancelScheduledSerialize(options)
  const serializeCurrentWorkbook = useSerializeCurrentWorkbook(options)
  const scheduleSerialize = useScheduleWorkbookSerialize({
    ...options,
    cancelScheduledSerialize,
    serializeCurrentWorkbook,
  })

  return {
    cancelScheduledSerialize,
    scheduleSerialize,
    serializeCurrentWorkbook,
  }
}

function publishWorkbook(options: {
  build: ReturnType<typeof buildWorkbook>
  dirtyBodyRowsRef: MutableRefObject<SheetBodyDirtyRows>
  dirtyWorkbookGenerationRef: MutableRefObject<number | null>
  generation: number
  path: string
  replacedWorkbookModelsRef: MutableRefObject<Model[]>
  setWorkbook: (workbook: SheetWorkbookState | null) => void
  workbookRef: MutableRefObject<SheetWorkbookState | null>
}) {
  const {
    build,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    generation,
    path,
    replacedWorkbookModelsRef,
    setWorkbook,
    workbookRef,
  } = options
  const nextWorkbook = nextWorkbookState({ build, generation, path })
  const replacedModel = workbookRef.current?.model
  if (replacedModel) replacedWorkbookModelsRef.current.push(replacedModel)
  workbookRef.current = nextWorkbook
  resetDirtyTracking(dirtyWorkbookGenerationRef, dirtyBodyRowsRef)
  setWorkbook(nextWorkbook)
}

function trackSheetOpenIfNeeded(content: string, path: string, trackedOpenPathRef: MutableRefObject<string | null>) {
  if (trackedOpenPathRef.current === path) return
  trackSheetEditorOpened(summarizeSheetContent(content))
  trackedOpenPathRef.current = path
}

function syncIncomingWorkbookContent(
  options: Pick<UseSheetWorkbookControllerOptions, 'content' | 'path'> & {
    dirtyBodyRowsRef: MutableRefObject<SheetBodyDirtyRows>
    dirtyWorkbookGenerationRef: MutableRefObject<number | null>
    latestContentPathRef: MutableRefObject<string>
    latestContentRef: MutableRefObject<string>
    workbookPathRef: MutableRefObject<string>
  },
) {
  const {
    content,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    latestContentPathRef,
    latestContentRef,
    path,
    workbookPathRef,
  } = options
  latestContentRef.current = content
  latestContentPathRef.current = path
  workbookPathRef.current = path
  resetDirtyTracking(dirtyWorkbookGenerationRef, dirtyBodyRowsRef)
}

function shouldIgnoreWorkbookBuild(
  cancelled: boolean,
  generation: number,
  workbookGenerationRef: MutableRefObject<number>,
) {
  return cancelled || workbookGenerationRef.current !== generation
}

function reportWorkbookBuildError({
  cancelled,
  caught,
  generation,
  setError,
  workbookGenerationRef,
}: {
  cancelled: boolean
  caught: unknown
  generation: number
  setError: (error: string | null) => void
  workbookGenerationRef: MutableRefObject<number>
}) {
  if (shouldIgnoreWorkbookBuild(cancelled, generation, workbookGenerationRef)) return
  const message = caught instanceof Error ? caught.message : String(caught)
  setError(message)
}

interface WorkbookBuildLifecycleOptions extends UseSheetWorkbookControllerOptions {
  cancelScheduledSerialize: () => void
  dirtyBodyRowsRef: MutableRefObject<SheetBodyDirtyRows>
  dirtyWorkbookGenerationRef: MutableRefObject<number | null>
  lastEmittedContentRef: MutableRefObject<string | null>
  lastEmittedPathRef: MutableRefObject<string | null>
  latestContentPathRef: MutableRefObject<string>
  latestContentRef: MutableRefObject<string>
  replacedWorkbookModelsRef: MutableRefObject<Model[]>
  serializeCurrentWorkbook: (expectedGeneration?: number) => boolean
  setError: (error: string | null) => void
  setWorkbook: (workbook: SheetWorkbookState | null) => void
  trackedOpenPathRef: MutableRefObject<string | null>
  workbookGenerationRef: MutableRefObject<number>
  workbookPathRef: MutableRefObject<string>
  workbookRef: MutableRefObject<SheetWorkbookState | null>
}

function deferInitialWorkbookBuildIfNeeded(
  options: Pick<
    WorkbookBuildLifecycleOptions,
    | 'content'
    | 'dirtyBodyRowsRef'
    | 'dirtyWorkbookGenerationRef'
    | 'latestContentPathRef'
    | 'latestContentRef'
    | 'path'
    | 'setError'
    | 'shouldWaitForInitialExternalFormulaResolution'
    | 'workbookPathRef'
    | 'workbookRef'
  >,
) {
  const {
    content,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    latestContentPathRef,
    latestContentRef,
    path,
    setError,
    shouldWaitForInitialExternalFormulaResolution,
    workbookPathRef,
    workbookRef,
  } = options
  if (!shouldWaitForInitialExternalFormulaResolution?.(workbookRef.current !== null)) return false
  setError(null)
  syncIncomingWorkbookContent({
    content,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    latestContentPathRef,
    latestContentRef,
    path,
    workbookPathRef,
  })
  return true
}

function startWorkbookBuild(options: WorkbookBuildLifecycleOptions, generation: number): () => void {
  const {
    content,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    externalFormulaContextForBuild,
    nativeExternalFormulaInputsForBuild,
    path,
    replacedWorkbookModelsRef,
    setError,
    setWorkbook,
    trackedOpenPathRef,
    workbookGenerationRef,
    workbookRef,
  } = options
  let cancelled = false
  let pendingModel: Model | null = null
  ensureIronCalcReady()
    .then(() => {
      if (shouldIgnoreWorkbookBuild(cancelled, generation, workbookGenerationRef)) return
      setError(null)
      const build = buildWorkbook(content, path, externalFormulaContextForBuild, nativeExternalFormulaInputsForBuild)
      pendingModel = build.model
      trackSheetOpenIfNeeded(content, path, trackedOpenPathRef)
      publishWorkbook({
        build,
        dirtyBodyRowsRef,
        dirtyWorkbookGenerationRef,
        generation,
        path,
        replacedWorkbookModelsRef,
        setWorkbook,
        workbookRef,
      })
      pendingModel = null
    })
    .catch((caught: unknown) => {
      reportWorkbookBuildError({
        cancelled,
        caught,
        generation,
        setError,
        workbookGenerationRef,
      })
    })
  return () => {
    cancelled = true
    releaseWorkbookModelNow(pendingModel)
  }
}

function prepareWorkbookRebuild(options: WorkbookBuildLifecycleOptions) {
  const {
    cancelScheduledSerialize,
    content,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    latestContentPathRef,
    latestContentRef,
    path,
    pendingExternalFormulaCommitRef,
    serializeCurrentWorkbook,
    workbookPathRef,
  } = options
  cancelScheduledSerialize()
  serializeCurrentWorkbook()
  pendingExternalFormulaCommitRef.current += 1
  syncIncomingWorkbookContent({
    content,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    latestContentPathRef,
    latestContentRef,
    path,
    workbookPathRef,
  })
}

function startWorkbookBuildIfChanged(options: WorkbookBuildLifecycleOptions): (() => void) | undefined {
  const { content, lastEmittedContentRef, lastEmittedPathRef, path, workbookGenerationRef } = options
  if (
    shouldSkipWorkbookRebuild({
      content,
      lastEmittedContentRef,
      lastEmittedPathRef,
      path,
    })
  )
    return undefined

  const generation = workbookGenerationRef.current + 1
  workbookGenerationRef.current = generation
  return startWorkbookBuild(options, generation)
}

function runWorkbookBuildLifecycle(options: WorkbookBuildLifecycleOptions) {
  if (deferInitialWorkbookBuildIfNeeded(options)) return undefined
  prepareWorkbookRebuild(options)
  return startWorkbookBuildIfChanged(options)
}

function useWorkbookBuildLifecycleState(options: WorkbookBuildLifecycleOptions) {
  const {
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    lastEmittedContentRef,
    lastEmittedPathRef,
    latestContentPathRef,
    latestContentRef,
    pendingExternalFormulaCommitRef,
    replacedWorkbookModelsRef,
    trackedOpenPathRef,
    workbookGenerationRef,
    workbookPathRef,
    workbookRef,
  } = options
  return useMemo(
    () => ({
      dirtyBodyRowsRef,
      dirtyWorkbookGenerationRef,
      lastEmittedContentRef,
      lastEmittedPathRef,
      latestContentPathRef,
      latestContentRef,
      pendingExternalFormulaCommitRef,
      replacedWorkbookModelsRef,
      trackedOpenPathRef,
      workbookGenerationRef,
      workbookPathRef,
      workbookRef,
    }),
    [
      dirtyBodyRowsRef,
      dirtyWorkbookGenerationRef,
      lastEmittedContentRef,
      lastEmittedPathRef,
      latestContentPathRef,
      latestContentRef,
      pendingExternalFormulaCommitRef,
      replacedWorkbookModelsRef,
      trackedOpenPathRef,
      workbookGenerationRef,
      workbookPathRef,
      workbookRef,
    ],
  )
}

function useWorkbookBuildLifecycleInputs(options: WorkbookBuildLifecycleOptions) {
  const {
    cancelScheduledSerialize,
    content,
    externalFormulaContextForBuild,
    nativeExternalFormulaInputsForBuild,
    onContentChange,
    path,
    serializeCurrentWorkbook,
    setError,
    setWorkbook,
    shouldWaitForInitialExternalFormulaResolution,
  } = options
  return useMemo(
    () => ({
      cancelScheduledSerialize,
      content,
      externalFormulaContextForBuild,
      nativeExternalFormulaInputsForBuild,
      onContentChange,
      path,
      serializeCurrentWorkbook,
      setError,
      setWorkbook,
      shouldWaitForInitialExternalFormulaResolution,
    }),
    [
      cancelScheduledSerialize,
      content,
      externalFormulaContextForBuild,
      nativeExternalFormulaInputsForBuild,
      onContentChange,
      path,
      serializeCurrentWorkbook,
      setError,
      setWorkbook,
      shouldWaitForInitialExternalFormulaResolution,
    ],
  )
}

function useWorkbookBuildLifecycle(options: WorkbookBuildLifecycleOptions) {
  const state = useWorkbookBuildLifecycleState(options)
  const inputs = useWorkbookBuildLifecycleInputs(options)
  useEffect(() => runWorkbookBuildLifecycle({ ...state, ...inputs }), [inputs, state])
}

function useReplacedWorkbookRelease(
  workbook: SheetWorkbookState | null,
  replacedWorkbookModelsRef: MutableRefObject<Model[]>,
) {
  useEffect(() => {
    if (!workbook) return
    releaseQueuedWorkbookModels(replacedWorkbookModelsRef)
  }, [replacedWorkbookModelsRef, workbook])
}

function useWorkbookCleanup(options: {
  cancelScheduledSerialize: () => void
  dirtyBodyRowsRef: MutableRefObject<SheetBodyDirtyRows>
  dirtyWorkbookGenerationRef: MutableRefObject<number | null>
  pendingExternalFormulaCommitRef: MutableRefObject<number>
  replacedWorkbookModelsRef: MutableRefObject<Model[]>
  serializeCurrentWorkbook: (expectedGeneration?: number) => boolean
  workbookGenerationRef: MutableRefObject<number>
  workbookRef: MutableRefObject<SheetWorkbookState | null>
}) {
  const {
    cancelScheduledSerialize,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    pendingExternalFormulaCommitRef,
    replacedWorkbookModelsRef,
    serializeCurrentWorkbook,
    workbookGenerationRef,
    workbookRef,
  } = options
  useEffect(
    () => () => {
      pendingExternalFormulaCommitRef.current += 1
      serializeCurrentWorkbook(workbookRef.current?.generation)
      cancelScheduledSerialize()
      releaseQueuedWorkbookModels(replacedWorkbookModelsRef)
      releaseWorkbookModel(workbookRef.current?.model)
      workbookRef.current = null
      resetDirtyTracking(dirtyWorkbookGenerationRef, dirtyBodyRowsRef)
      workbookGenerationRef.current += 1
    },
    [
      cancelScheduledSerialize,
      dirtyBodyRowsRef,
      dirtyWorkbookGenerationRef,
      pendingExternalFormulaCommitRef,
      replacedWorkbookModelsRef,
      serializeCurrentWorkbook,
      workbookGenerationRef,
      workbookRef,
    ],
  )
}

function useWorkbookRefresh({
  refreshSequenceRef,
  setWorkbook,
  workbookRef,
}: {
  refreshSequenceRef: MutableRefObject<number>
  setWorkbook: (workbook: SheetWorkbookState | null) => void
  workbookRef: MutableRefObject<SheetWorkbookState | null>
}) {
  return useCallback(() => {
    const current = workbookRef.current
    if (!current) return
    refreshSequenceRef.current += 1
    const nextWorkbook = {
      externalFormulaInputs: current.externalFormulaInputs,
      generation: current.generation,
      model: current.model,
      path: current.path,
      refreshId: Date.now() + refreshSequenceRef.current,
    }
    workbookRef.current = nextWorkbook
    setWorkbook(nextWorkbook)
  }, [refreshSequenceRef, setWorkbook, workbookRef])
}

function useWorkbookControllerRefs(
  content: string,
  path: string,
  onContentChange: (path: string, content: string) => void,
) {
  const dirtyBodyRowsRef = useRef<SheetBodyDirtyRows>(null)
  const dirtyWorkbookGenerationRef = useRef<number | null>(null)
  const idleSerializeRef = useRef<IdleHandle | null>(null)
  const serializeTimerRef = useRef<number | null>(null)
  const lastEmittedContentRef = useRef<string | null>(null)
  const lastEmittedPathRef = useRef<string | null>(null)
  const latestContentPathRef = useRef(path)
  const latestContentRef = useRef(content)
  const onContentChangeRef = useRef(onContentChange)
  const refreshSequenceRef = useRef(0)
  const trackedOpenPathRef = useRef<string | null>(null)
  const workbookGenerationRef = useRef(0)
  const replacedWorkbookModelsRef = useRef<Model[]>([])
  const workbookPathRef = useRef(path)
  const workbookRef = useRef<SheetWorkbookState | null>(null)
  useEffect(() => {
    onContentChangeRef.current = onContentChange
  }, [onContentChange])
  return {
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    idleSerializeRef,
    serializeTimerRef,
    lastEmittedContentRef,
    lastEmittedPathRef,
    latestContentPathRef,
    latestContentRef,
    onContentChangeRef,
    refreshSequenceRef,
    trackedOpenPathRef,
    workbookGenerationRef,
    replacedWorkbookModelsRef,
    workbookPathRef,
    workbookRef,
  }
}

function useWorkbookMaintenance(options: {
  workbook: SheetWorkbookState | null
  refs: ReturnType<typeof useWorkbookControllerRefs>
  pendingExternalFormulaCommitRef: MutableRefObject<number>
  cancelScheduledSerialize: () => void
  serializeCurrentWorkbook: (expectedGeneration?: number) => boolean
  setWorkbook: (workbook: SheetWorkbookState | null) => void
}) {
  const {
    workbook,
    refs,
    pendingExternalFormulaCommitRef,
    cancelScheduledSerialize,
    serializeCurrentWorkbook,
    setWorkbook,
  } = options
  const {
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    refreshSequenceRef,
    replacedWorkbookModelsRef,
    workbookGenerationRef,
    workbookRef,
  } = refs
  useReplacedWorkbookRelease(workbook, replacedWorkbookModelsRef)
  useWorkbookCleanup({
    cancelScheduledSerialize,
    dirtyBodyRowsRef,
    dirtyWorkbookGenerationRef,
    pendingExternalFormulaCommitRef,
    replacedWorkbookModelsRef,
    serializeCurrentWorkbook,
    workbookGenerationRef,
    workbookRef,
  })
  return useWorkbookRefresh({ refreshSequenceRef, setWorkbook, workbookRef })
}

export function useSheetWorkbookController({
  content,
  externalFormulaContextForBuild,
  nativeExternalFormulaInputsForBuild,
  onContentChange,
  path,
  pendingExternalFormulaCommitRef,
  shouldWaitForInitialExternalFormulaResolution,
}: UseSheetWorkbookControllerOptions) {
  const [workbook, setWorkbook] = useState<SheetWorkbookState | null>(null),
    [error, setError] = useState<string | null>(null)
  const refs = useWorkbookControllerRefs(content, path, onContentChange)
  const { workbookRef } = refs

  const { cancelScheduledSerialize, scheduleSerialize, serializeCurrentWorkbook } = useWorkbookSerialization({
    ...refs,
  })

  useWorkbookBuildLifecycle({
    ...refs,
    cancelScheduledSerialize,
    content,
    externalFormulaContextForBuild,
    nativeExternalFormulaInputsForBuild,
    onContentChange,
    path,
    pendingExternalFormulaCommitRef,
    serializeCurrentWorkbook,
    setError,
    setWorkbook,
    shouldWaitForInitialExternalFormulaResolution,
  })

  const refreshWorkbook = useWorkbookMaintenance({
    workbook,
    refs,
    pendingExternalFormulaCommitRef,
    cancelScheduledSerialize,
    serializeCurrentWorkbook,
    setWorkbook,
  })

  return {
    cancelScheduledSerialize,
    error,
    refreshWorkbook,
    scheduleSerialize,
    serializeCurrentWorkbook,
    workbook,
    workbookRef,
  }
}
