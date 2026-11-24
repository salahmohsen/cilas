export function isModalOpen(doc = document): boolean {
  return (
    !!doc.querySelector(':is([aria-modal="true"], dialog:modal)') ||
    doc.body.hasAttribute('data-scroll-locked')
  )
}

export function observeModals(onChange: (open: boolean) => void, doc = document): () => void {
  let open = false
  function check() {
    const next = isModalOpen(doc)
    if (next === open) return
    open = next
    onChange(next)
  }
  const observer = new MutationObserver(check)
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-modal', 'open', 'data-scroll-locked'],
  })
  check()
  return () => observer.disconnect()
}
