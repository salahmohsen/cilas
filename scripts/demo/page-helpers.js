// Installed in every demo page before its scripts run (agent-browser --init-script).
// Finds an element the way a viewer reads the screen: by its visible text or label.
;(() => {
  const style = document.createElement('style')
  style.textContent =
    'nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}' +
    'html{scrollbar-width:none}::-webkit-scrollbar{display:none}'
  const mount = () => document.documentElement.append(style)
  if (document.documentElement) mount()
  else document.addEventListener('DOMContentLoaded', mount)

  const PICKABLE =
    'a,button,[role=button],[role=tab],[role=link],[role=menuitem],[role=option],[role=gridcell],[role=switch],[role=radio],[role=checkbox],[role=slider],input,textarea,select,label,summary,h1,h2,h3,[contenteditable=true]'
  const words = (el) =>
    (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '')
      .replace(/\s+/g, ' ')
      .trim()
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  }

  window.__demo = {
    find({ text, css, nth = 0, loose = false, minX = -Infinity, maxX = Infinity }) {
      const matches = [...document.querySelectorAll(css || PICKABLE)].filter((el) => {
        if (!visible(el)) return false
        const x = el.getBoundingClientRect().left + scrollX
        if (x < minX || x > maxX) return false
        if (text === undefined) return true
        const w = words(el)
        return loose ? w.includes(text) : w === text
      })
      const innermost = matches.filter((el) => !matches.some((o) => o !== el && el.contains(o)))
      return innermost[nth] ?? null
    },
    reveal(spec) {
      const el = this.find(spec)
      if (!el) return false
      const r = el.getBoundingClientRect()
      if (r.top < 70 || r.bottom > innerHeight - 40)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return true
    },
    box(spec) {
      const el = this.find(spec)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
    },
  }
})()
