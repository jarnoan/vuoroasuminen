"use client"

import { useEffect, useRef, type RefObject } from "react"
import { clampZoom, computeZoomVars, getRowZoomSnapshot, setRowZoom } from "./row-zoom"

function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

// Two-finger pinch → continuous row zoom on the given element. The caller must set
// touch-action: pan-y on the same element so the browser keeps handling native
// single-finger vertical scroll while leaving pinch (and anything else multi-touch) to us.
export function usePinchZoom(ref: RefObject<HTMLElement | null>) {
  const gestureRef = useRef<{ startDistance: number; startZoom: number } | null>(null)
  const liveZoomRef = useRef<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    function applyVars(zoom: number) {
      for (const [key, value] of Object.entries(computeZoomVars(zoom))) {
        el!.style.setProperty(key, value)
      }
    }

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length !== 2) return
      gestureRef.current = {
        startDistance: touchDistance(e.touches[0], e.touches[1]),
        startZoom: getRowZoomSnapshot(),
      }
    }

    function handleTouchMove(e: TouchEvent) {
      const gesture = gestureRef.current
      if (!gesture || e.touches.length !== 2 || gesture.startDistance === 0) return
      const distance = touchDistance(e.touches[0], e.touches[1])
      const next = clampZoom(gesture.startZoom * (distance / gesture.startDistance))
      liveZoomRef.current = next
      applyVars(next)
    }

    function endGesture(e: TouchEvent) {
      if (e.touches.length >= 2) return
      if (liveZoomRef.current !== null) {
        setRowZoom(liveZoomRef.current)
        liveZoomRef.current = null
      }
      gestureRef.current = null
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: true })
    el.addEventListener("touchend", endGesture, { passive: true })
    el.addEventListener("touchcancel", endGesture, { passive: true })
    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", endGesture)
      el.removeEventListener("touchcancel", endGesture)
    }
  }, [ref])
}
