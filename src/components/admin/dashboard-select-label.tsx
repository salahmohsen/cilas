'use client'

import { useEffect } from 'react'

const INPUT = '.dashboard-breadcrumb-select input[role="combobox"]'

/**
 * Payload's dashboard dropdown (the "Dashboard" step nav) gives its combobox
 * no name, and at narrow widths only its chevron shows. Name it here; Payload
 * mounts the dropdown after the header, so watch until it appears.
 */
export function DashboardSelectLabel() {
  useEffect(() => {
    const name = () => document.querySelector(INPUT)?.setAttribute('aria-label', 'Dashboard')
    name()
    const watch = new MutationObserver(name)
    watch.observe(document.body, { childList: true, subtree: true })
    return () => watch.disconnect()
  }, [])
  return null
}
