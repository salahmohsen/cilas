// Title cards, driven frame by frame through window.seek(t) with no accumulated state.
window.mountFilm = ({ kind, number, title, sub, color, ink, stats, logo, serif, sans }) => {
  const ease = (v) => v * v * v * (v * (v * 6 - 15) + 10)
  const at = (t, a, b) => ease(Math.max(0, Math.min(1, (t - a) / (b - a))))
  // Lives outside <body>, which the running page's React still owns.
  document.documentElement.style.cssText = 'margin:0;background:#0b0b0b;overflow:hidden'
  document.body.style.visibility = 'hidden'
  const root = document.createElement('div')
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483647'
  document.documentElement.append(root)
  const bg = kind === 'chapter' ? color : '#0b0b0b'
  const fg = kind === 'chapter' ? ink : '#fff'
  const words = title.split(' ')
  root.innerHTML = `
    <div id="film" style="position:fixed;inset:0;width:1440px;height:900px;background:#0b0b0b;overflow:hidden;color:${fg}">
      <div id="panel" style="position:absolute;inset:0;background:${bg}"></div>
      <svg id="sea" viewBox="0 0 1440 900" style="position:absolute;inset:0">${[0, 1, 2].map((i) => `<path id="w${i}" fill="none" stroke="${fg}" stroke-width="2.5" opacity="${0.7 - i * 0.18}"/>`).join('')}</svg>
      <img id="boat" src="${logo}" style="position:absolute;left:1120px;top:470px;width:190px;${kind === 'chapter' && ink === '#111' ? '' : 'filter:invert(1)'}"/>
      ${number ? `<div id="num" style="position:absolute;left:100px;top:120px;font:500 26px ${sans};letter-spacing:.14em">${number} / 05</div>` : ''}
      <h1 style="position:absolute;left:100px;top:${kind === 'intro' ? 170 : 260}px;margin:0;width:1040px;font:400 ${kind === 'chapter' ? 128 : 92}px/1.06 ${serif};letter-spacing:-.02em">
        ${words.map((w) => `<span style="display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.14em;margin-right:.24em"><span class="word" style="display:inline-block">${w}</span></span>`).join('')}
      </h1>
      <p id="sub" style="position:absolute;left:100px;top:${kind === 'intro' ? 520 : 570}px;margin:0;width:880px;font:400 34px/1.35 ${sans}">${sub}</p>
      ${stats ? `<div id="stats" style="position:absolute;left:100px;top:640px;display:flex;gap:90px">${stats.map((s) => `<div><div class="stat" data-value="${s.value}" style="font:400 76px/1 ${serif}">0</div><div style="font:400 22px ${sans};margin-top:8px;opacity:.75">${s.label}</div></div>`).join('')}</div>` : ''}
    </div>`
  const q = (s) => root.querySelector(s)
  const wordsEls = [...root.querySelectorAll('.word')]
  const statEls = [...root.querySelectorAll('.stat')]
  window.seek = (t) => {
    if (kind === 'chapter') {
      const w = at(t, 0, 0.55)
      q('#panel').style.clipPath = `inset(0 ${100 - w * 100}% 0 0)`
    }
    wordsEls.forEach((el, i) => {
      const v = at(t, 0.3 + i * 0.09, 0.95 + i * 0.09)
      el.style.transform = `translateY(${(1 - v) * 115}%)`
    })
    const sub = at(t, 0.9, 1.5)
    q('#sub').style.opacity = sub
    q('#sub').style.transform = `translateY(${(1 - sub) * 26}px)`
    const num = q('#num')
    if (num) num.style.opacity = at(t, 0.25, 0.7)
    for (let i = 0; i < 3; i++) {
      let d = ''
      const base = 760 + i * 42
      for (let x = -20; x <= 1460; x += 16) {
        const y = base + Math.sin(x / (120 + i * 30) + t * (1.4 - i * 0.25) + i) * (11 - i * 2)
        d += `${x < 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `
      }
      q(`#w${i}`).setAttribute('d', d)
      q(`#w${i}`).style.strokeDashoffset = 0
    }
    q('#sea').style.opacity = at(t, 0.2, 0.9)
    const boat = at(t, 0.35, 1.25)
    q('#boat').style.opacity = boat
    q('#boat').style.transform =
      `translate(${(1 - boat) * 180}px, ${Math.sin(t * 1.6) * 7}px) rotate(${Math.sin(t * 1.3) * 1.6}deg)`
    statEls.forEach((el, i) => {
      el.textContent = Math.round(Number(el.dataset.value) * at(t, 1.5 + i * 0.2, 3.1 + i * 0.2))
    })
  }
  window.seek(0)
}
