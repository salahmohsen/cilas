export function isModalOpen(doc = document): boolean {
  return (
    !!doc.querySelector(':is([aria-modal="true"], dialog:modal)') ||
    doc.body.hasAttribute('data-scroll-locked')
  )
}

/** `onMutation` runs after every body change, so one observer serves a caller that also needs to see nodes leave. */
export function observeModals(
  onChange: (open: boolean) => void,
  doc = document,
  onMutation?: () => void,
): () => void {
  let open = false
  function check() {
    const next = isModalOpen(doc)
    if (next === open) return
    open = next
    onChange(next)
  }
  const observer = new MutationObserver(() => {
    check()
    onMutation?.()
  })
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-modal', 'open', 'data-scroll-locked'],
  })
  check()
  return () => observer.disconnect()
}
