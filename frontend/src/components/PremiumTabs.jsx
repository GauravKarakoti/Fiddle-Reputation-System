import { useState, useRef, useLayoutEffect, useCallback } from 'react'

/* ─────────────────────────────────────────────────────────────
   PremiumTabs — First Fiddle luxury tabbed UI
   
   Usage:
     <PremiumTabs
       tabs={[
         {
           id: 'overview',
           label: 'Overview',
           icon: '✦',
           content: <YourComponent />
         },
         ...
       ]}
     />
───────────────────────────────────────────────────────────── */

export default function PremiumTabs({ tabs = [], defaultTab }) {
  const [activeId, setActiveId]       = useState(defaultTab ?? tabs[0]?.id)
  const [indicator, setIndicator]     = useState({ left: 0, width: 0 })
  const tabRefs                       = useRef({})
  const stripRef                      = useRef(null)

  /* Recalculate sliding underline position */
  const updateIndicator = useCallback((id) => {
    const btn   = tabRefs.current[id]
    const strip = stripRef.current
    if (!btn || !strip) return
    const bRect = btn.getBoundingClientRect()
    const sRect = strip.getBoundingClientRect()
    setIndicator({ left: bRect.left - sRect.left, width: bRect.width })
  }, [])

  /* Set indicator on mount without transition */
  useLayoutEffect(() => {
    updateIndicator(activeId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Update on resize */
  useLayoutEffect(() => {
    const handle = () => updateIndicator(activeId)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [activeId, updateIndicator])

  const switchTab = (id) => {
    setActiveId(id)
    updateIndicator(id)
    tabRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  /* Keyboard navigation */
  const handleKeyDown = (e, id) => {
    const ids  = tabs.map(t => t.id)
    const idx  = ids.indexOf(id)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = ids[(idx + 1) % ids.length]
      tabRefs.current[next]?.focus()
      switchTab(next)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = ids[(idx - 1 + ids.length) % ids.length]
      tabRefs.current[prev]?.focus()
      switchTab(prev)
    }
  }

  return (
    <div className="premium-tabs-root">

      {/* ── Tab Strip ── */}
      <div
        ref={stripRef}
        role="tablist"
        className="premium-tab-strip"
      >
        {/* Sliding gold underline */}
        <div
          className="premium-tab-indicator"
          aria-hidden="true"
          style={{ left: indicator.left, width: indicator.width }}
        />

        {tabs.map(tab => (
          <button
            key={tab.id}
            ref={el => { tabRefs.current[tab.id] = el }}
            id={`premium-tab-${tab.id}`}
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`premium-panel-${tab.id}`}
            className={`premium-tab-btn${activeId === tab.id ? ' is-active' : ''}`}
            onClick={() => switchTab(tab.id)}
            onKeyDown={e => handleKeyDown(e, tab.id)}
          >
            {tab.icon && <span className="premium-tab-icon" aria-hidden="true">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Panels ── */}
      <div className="premium-tab-panels">
        {tabs.map(tab => (
          <div
            key={tab.id}
            id={`premium-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`premium-tab-${tab.id}`}
            className={`premium-tab-panel${activeId === tab.id ? ' is-active' : ''}`}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}
