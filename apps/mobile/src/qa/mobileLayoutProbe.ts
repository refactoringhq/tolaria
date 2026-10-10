import { useCallback, useMemo, useState } from 'react'
import { Platform, type LayoutChangeEvent } from 'react-native'
import { postNativeQaEvent, setNativeQaSinkUrl } from './nativeQaSink'

export type MobileLayoutMetric = {
  height: number
  id: string
  platform: string
  width: number
  x: number
  y: number
}

export type MobileLayoutMetrics = Record<string, MobileLayoutMetric>
export type MobileLayoutProbe = (id: string) => { onLayout: (event: LayoutChangeEvent) => void } | Record<string, never>

type LayoutProbeGlobal = typeof globalThis & {
  __TOLARIA_MOBILE_LAYOUT_METRICS__?: MobileLayoutMetrics
}

const emptyProbeProps = {}
export function setMobileLayoutMetricSinkUrl(url: string | null) {
  setNativeQaSinkUrl(url)
}

export function useMobileLayoutProbe(enabled: boolean) {
  const [metrics, setMetrics] = useState<MobileLayoutMetrics>({})

  const recordLayout = useCallback((id: string, event: LayoutChangeEvent) => {
    if (!enabled) return

    const metric = metricFromLayout(id, event)
    setMetrics((current) => {
      if (sameMetric(current[id], metric)) return current
      publishMetric(metric)
      return { ...current, [id]: metric }
    })
  }, [enabled])

  const probe = useCallback<MobileLayoutProbe>((id) => {
    if (!enabled) return emptyProbeProps

    return {
      onLayout: (event) => recordLayout(id, event),
    }
  }, [enabled, recordLayout])

  return useMemo(() => ({ metrics, probe }), [metrics, probe])
}

export function metricReadout(metrics: MobileLayoutMetrics) {
  const ids = Object.keys(metrics).sort()
  if (ids.length === 0) return ''

  return ids
    .map((id) => {
      const metric = metrics[id]
      return `${id}:${metric.x},${metric.y},${metric.width},${metric.height}`
    })
    .join('|')
}

export function probeProps(layoutProbe: MobileLayoutProbe | undefined, id: string) {
  return layoutProbe?.(id) ?? {}
}

function metricFromLayout(id: string, event: LayoutChangeEvent): MobileLayoutMetric {
  const { height, width, x, y } = event.nativeEvent.layout

  return {
    height: roundMetric(height),
    id,
    platform: Platform.OS,
    width: roundMetric(width),
    x: roundMetric(x),
    y: roundMetric(y),
  }
}

function publishMetric(metric: MobileLayoutMetric) {
  const target = globalThis as LayoutProbeGlobal
  target.__TOLARIA_MOBILE_LAYOUT_METRICS__ = {
    ...target.__TOLARIA_MOBILE_LAYOUT_METRICS__,
    [metric.id]: metric,
  }

  if (Platform.OS !== 'web') {
    console.info(`TOLARIA_MOBILE_LAYOUT_METRIC ${JSON.stringify(metric)}`)
    postNativeQaEvent(metric)
  }
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10
}

function sameMetric(current: MobileLayoutMetric | undefined, next: MobileLayoutMetric) {
  return Boolean(current)
    && current?.height === next.height
    && current.width === next.width
    && current.x === next.x
    && current.y === next.y
}
