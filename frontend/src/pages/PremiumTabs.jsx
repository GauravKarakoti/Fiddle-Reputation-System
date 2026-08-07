import { useState, useRef, useLayoutEffect, useCallback } from 'react'

/**
 * Premium horizontal tab strip with a sliding gold underline and animated
 * fade + upward-motion panel transitions.
 *
 * All the visual styling (sliding indicator, luxury typography, cubic-bezier
 * easing, mobile horizontal scroll) lives in index.css under the "PREMIUM
 * TABS COMPONENT" block — this component only handles structure and
 * behavior: measuring the active tab's real position/width so the indicator
 * can animate to it, and toggling the "is-active" class that index.css's
 * CSS transitions key off of. No display:none switching anywhere — every
 * panel stays mounted and the class toggle drives the fade/lift via CSS.
 *
 * Usage:
 *   <PremiumTabs
 *     tabs={[
 *       { id: 'overview', label: 'Overview', content: <OverviewPanel /> },
 *       { id: 'menu',     label: 'Menu',     content: <MenuPanel /> },
 *       { id: 'reviews',  label: 'Reviews',  icon: '★', content: <ReviewsPanel /> },
 *     ]}
 *     defaultTabId="overview"
 *   />
 */
export default function PremiumTabs({ tabs, defaultTabId, onChange }) {
  const [activeId, setActiveId] = useState(defaultTabId || tabs[0]?.id)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const btnRefs = useRef({})
  const stripRef = useRef(null)

  const measure = useCallback(() => {
    const btn = btnRefs.current[activeId]
    const strip = stripRef.current
    if (!btn || !strip) return
    const btnRect = btn.getBoundingClientRect()
    const stripRect = strip.getBoundingClientRect()
    setIndicator({
      left: btnRect.left - stripRect.left + strip.scrollLeft,
      width: btnRect.width,
    })
  }, [activeId])

  // Re-measure whenever the active tab changes or the tab set itself changes
  // (e.g. tabs added/removed dynamically), and on window resize so the
  // underline stays correctly positioned across breakpoints.
  useLayoutEffect(() => {
    measure()
  }, [measure, tabs.length])

  useLayoutEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const handleSelect = (id) => {
    if (id === activeId) return
    setActiveId(id)
    onChange?.(id)
    // Keep the newly active tab scrolled into view — matters on mobile where
    // the strip scrolls horizontally and the tapped tab might be at the edge.
    requestAnimationFrame(() => {
      btnRefs.current[id]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    })
  }

  return (
    <div className="premium-tabs-root">
      <div className="premium-tab-strip" ref={stripRef} role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            ref={el => { btnRefs.current[tab.id] = el }}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            className={'premium-tab-btn' + (tab.id === activeId ? ' is-active' : '')}
            onClick={() => handleSelect(tab.id)}
          >
            {tab.icon && <span className="premium-tab-icon">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
        <span
          className="premium-tab-indicator"
          style={{ left: indicator.left + 'px', width: indicator.width + 'px' }}
        />
      </div>

      <div className="premium-tab-panels">
        {tabs.map(tab => (
          <div
            key={tab.id}
            role="tabpanel"
            className={'premium-tab-panel' + (tab.id === activeId ? ' is-active' : '')}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}