import { useLayoutEffect, useRef, useState } from 'react'

const TITLE_ACTION_GAP_PX = 24

function readElementWidth(element: HTMLElement): number {
  return element.getBoundingClientRect().width || element.scrollWidth || element.clientWidth
}

function prepareTitleMeasurementClone(clone: HTMLElement) {
  clone.setAttribute('aria-hidden', 'true')
  clone.style.position = 'absolute'
  clone.style.visibility = 'hidden'
  clone.style.pointerEvents = 'none'
  clone.style.width = 'max-content'
  clone.style.minWidth = 'max-content'
  clone.style.maxWidth = 'none'
  clone.style.overflow = 'visible'
  clone.style.whiteSpace = 'nowrap'
}

function removeCloneTruncation(clone: HTMLElement) {
  for (const node of clone.querySelectorAll<HTMLElement>('.truncate')) {
    node.style.overflow = 'visible'
    node.style.textOverflow = 'clip'
    node.style.whiteSpace = 'nowrap'
    node.style.width = 'max-content'
    node.style.minWidth = 'max-content'
    node.style.maxWidth = 'none'
  }
}

function measureNaturalTitleWidth(title: HTMLDivElement): number {
  const titleContent = title.querySelector('.breadcrumb-bar__title-content')
  if (!(titleContent instanceof HTMLElement)) return readElementWidth(title)

  const clone = titleContent.cloneNode(true)
  if (!(clone instanceof HTMLElement)) return readElementWidth(title)

  prepareTitleMeasurementClone(clone)
  removeCloneTruncation(clone)
  title.appendChild(clone)
  const width = readElementWidth(clone)
  clone.remove()
  return width
}

function expandedActionsLeft(actions: HTMLDivElement, expandedActionsWidth: number): number {
  const actionsRight = actions.getBoundingClientRect().right
  return actionsRight - expandedActionsWidth
}

function shouldCollapseBreadcrumbOverflow(
  title: HTMLDivElement,
  actions: HTMLDivElement,
  expandedActionsWidth: number,
) {
  const titleLeft = title.getBoundingClientRect().left
  const availableTitleWidth = expandedActionsLeft(actions, expandedActionsWidth) - titleLeft - TITLE_ACTION_GAP_PX
  return measureNaturalTitleWidth(title) > availableTitleWidth
}

function withExpandedActionMeasurement<T>(
  actions: HTMLDivElement,
  collapsed: boolean,
  measure: () => T,
): T {
  if (!collapsed) return measure()

  const previousValue = actions.getAttribute('data-overflow-collapsed')
  // Probe the expanded geometry; measuring the collapsed layout can oscillate.
  actions.setAttribute('data-overflow-collapsed', 'false')
  try {
    return measure()
  } finally {
    if (previousValue === null) {
      actions.removeAttribute('data-overflow-collapsed')
    } else {
      actions.setAttribute('data-overflow-collapsed', previousValue)
    }
  }
}

export function useBreadcrumbOverflow(
  titleRef: React.RefObject<HTMLDivElement | null>,
  actionsRef: React.RefObject<HTMLDivElement | null>,
) {
  const [collapsed, setCollapsed] = useState(false)
  const expandedActionsWidthRef = useRef(0)

  useLayoutEffect(() => {
    const title = titleRef.current
    const actions = actionsRef.current
    const bar = title?.closest('.breadcrumb-bar')
    if (!title || !actions || !(bar instanceof HTMLDivElement)) return undefined

    let frame = 0
    const measure = () => {
      const nextCollapsed = withExpandedActionMeasurement(actions, collapsed, () => {
        const expandedActionsWidth = actions.scrollWidth || expandedActionsWidthRef.current
        expandedActionsWidthRef.current = expandedActionsWidth
        return shouldCollapseBreadcrumbOverflow(title, actions, expandedActionsWidth)
      })
      setCollapsed((current) => current === nextCollapsed ? current : nextCollapsed)
    }
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    scheduleMeasure()
    if (typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frame)
    }

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(bar)
    resizeObserver.observe(title)
    resizeObserver.observe(actions)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
    }
  })

  return collapsed
}
