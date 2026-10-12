'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Props<T extends string> = {
  items: { id: T; label: ReactNode }[]
  value: T
  onChange: (id: T) => void
  role?: 'tablist' | 'group'
  'aria-label'?: string
  className?: string
}

/** Segmented control: one pill that slides under the active item. */
export function SlidingSeg<T extends string>({
  items,
  value,
  onChange,
  role = 'tablist',
  'aria-label': ariaLabel,
  className = '',
}: Props<T>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false })

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) {return}

    const place = () => {
      const idx = items.findIndex(i => i.id === value)
      const btn = btnRefs.current[idx]
      if (!btn) {return}
      const tr = track.getBoundingClientRect()
      const br = btn.getBoundingClientRect()
      setPill({
        x: br.left - tr.left - track.clientLeft + track.scrollLeft,
        w: br.width,
        ready: true,
      })
    }

    place()
    const ro = new ResizeObserver(place)
    ro.observe(track)
    for (const btn of btnRefs.current) {
      if (btn) {ro.observe(btn)}
    }
    return () => ro.disconnect()
  }, [items, value])

  return (
    <div
      ref={trackRef}
      className={`seg seg--sliding ${className}`.trim()}
      role={role}
      aria-label={ariaLabel}
    >
      <span
        className="seg-pill"
        aria-hidden
        data-ready={pill.ready}
        style={{
          width: pill.w,
          transform: `translate3d(${pill.x}px, 0, 0)`,
        }}
      />
      {items.map((item, i) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={el => {
              btnRefs.current[i] = el
            }}
            type="button"
            role={role === 'tablist' ? 'tab' : undefined}
            className="seg-item"
            aria-selected={role === 'tablist' ? selected : undefined}
            aria-pressed={role === 'group' ? selected : undefined}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
