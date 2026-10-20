'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { HeatmapCell, HeatmapMetric } from '@/lib/heatmap'

function metricValue(cell: HeatmapCell, metric: HeatmapMetric, maxIssues: number) {
  if (metric === 'chai') return cell.averageChaiHeat / 100
  if (metric === 'priority') return cell.averagePriority / 100
  if (metric === 'resolution') return cell.resolutionRate / 100
  return Math.min(1, Math.sqrt(cell.issueCount / Math.max(1, maxIssues)))
}

export function HeatmapCanvas({ cells, metric }: { cells: HeatmapCell[]; metric: HeatmapMetric }) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) return

    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    let frame = 0
    const draw = () => {
      const size = map.getSize()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(size.x * ratio))
      canvas.height = Math.max(1, Math.round(size.y * ratio))
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, size.x, size.y)
      context.globalCompositeOperation = 'lighter'

      const maxIssues = cells.reduce((maximum, cell) => Math.max(maximum, cell.issueCount), 1)
      for (const cell of cells) {
        const value = metricValue(cell, metric, maxIssues)
        if (metric === 'chai' && value === 0) continue

        const point = map.latLngToContainerPoint([cell.latitude, cell.longitude])
        const strength = Math.max(0.08, value)
        const radius = 22 + strength * 38
        if (point.x < -radius || point.y < -radius || point.x > size.x + radius || point.y > size.y + radius) continue

        const hue = metric === 'resolution' ? 118 * value : 118 * (1 - value)
        const gradient = context.createRadialGradient(point.x, point.y, 1, point.x, point.y, radius)
        gradient.addColorStop(0, `hsla(${hue}, 88%, 48%, ${0.62 * strength})`)
        gradient.addColorStop(0.35, `hsla(${hue}, 88%, 50%, ${0.38 * strength})`)
        gradient.addColorStop(0.72, `hsla(${hue}, 90%, 52%, ${0.16 * strength})`)
        gradient.addColorStop(1, `hsla(${hue}, 90%, 52%, 0)`)
        context.fillStyle = gradient
        context.beginPath()
        context.arc(point.x, point.y, radius, 0, Math.PI * 2)
        context.fill()

        context.globalCompositeOperation = 'source-over'
        context.beginPath()
        context.arc(point.x, point.y, 2.5, 0, Math.PI * 2)
        context.fillStyle = metric === 'resolution' ? '#f5f2e9' : '#fff8ec'
        context.fill()
        context.globalCompositeOperation = 'lighter'
      }
      context.globalCompositeOperation = 'source-over'
    }

    const scheduleDraw = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(draw)
    }
    map.on('move zoom resize', scheduleDraw)
    scheduleDraw()

    return () => {
      cancelAnimationFrame(frame)
      map.off('move zoom resize', scheduleDraw)
      canvas.remove()
    }
  }, [cells, map, metric])

  return null
}
