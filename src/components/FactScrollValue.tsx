'use client'

import { useEffect, useRef, useState } from 'react'

/** Ellipsis at rest; on hover slides long text inside the cell (no layout shift). */
export function FactScrollValue({ value }: { value: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) {
      return
    }

    function measure() {
      if (!outer || !inner) {
        return
      }
      inner.style.maxWidth = 'none'
      const next = Math.max(0, Math.ceil(inner.scrollWidth - outer.clientWidth))
      inner.style.maxWidth = ''
      setShift(next)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [value])

  const canSlide = shift > 4

  return (
    <div
      ref={outerRef}
      className="fact-scroll"
      data-overflow={canSlide ? '1' : '0'}
      style={{ ['--fact-shift' as string]: `-${shift}px` }}
      title={value}
    >
      <span ref={innerRef} className="fact-scroll-inner">
        {value}
      </span>
    </div>
  )
}
