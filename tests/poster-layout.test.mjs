import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { chromium } from '@playwright/test'

const stylesheet = readFileSync(
  new URL('../src/app/(frontend)/styles.css', import.meta.url),
  'utf8',
)
const posterCSS = stylesheet
  .split('/* ===================================================== posters */')[1]
  .split('/* The contact form')[0]
const countdownCSS = readFileSync(
  new URL('../src/components/arc/countdown/countdown.module.css', import.meta.url),
  'utf8',
)
const carouselCSS = readFileSync(
  new URL('../src/components/arc/carousel/carousel.module.css', import.meta.url),
  'utf8',
)

function poster(layout, direction, credit) {
  const image = '<div class="poster-image"></div>'
  const strip = '<div class="poster-strip">Apply</div>'
  return `<div class="poster-frame" dir="${direction}">
    <article class="poster" data-layout="${layout}" data-separate-label="true">
      ${layout === 2 ? strip : ''}
      <div class="poster-body">
        ${layout === 0 ? image : ''}
        <div class="poster-panel">
          <p class="poster-label">${direction === 'rtl' ? 'مساق موضوعي' : 'Thematic Course'}</p>
          <div class="poster-heading">
            <div class="poster-title"><h3>${direction === 'rtl' ? 'الفلسفة والحياة اليومية' : 'Antiphilosophy'}</h3></div>
            ${credit ? `<p class="poster-credit">${credit}</p>` : ''}
          </div>
        </div>
        ${layout === 0 ? '' : image}
      </div>
      ${layout === 2 ? '' : strip}
    </article>
  </div>`
}

test('carousel clipping preserves all four poster border corners on mobile', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    for (const width of [288, 358, 528]) {
      for (const layout of [0, 1, 2]) {
        await page.setViewportSize({ width: width + 32, height: 1000 })
        await page.setContent(`<style>
          * { box-sizing: border-box; }
          body, p, h3 { margin: 0; }
          :root { --radius-panel: 26px; --space-4: 16px; }
          .poster-carousel { width: ${width}px; }
          ${posterCSS}
          ${carouselCSS}
        </style><div class="poster-carousel"><section class="root" style="--carousel-slide:${width}px;--carousel-start:0">
          <div class="viewport"><div class="track"><div class="slide" aria-roledescription="slide">
            ${poster(layout, 'ltr', 'With the fellow')}
          </div></div></div>
        </section></div>`)
        const corners = await page.locator('.poster').evaluate((card) => {
          const r = card.getBoundingClientRect()
          return [
            [4, 6],
            [r.width - 4, 6],
            [4, r.height - 6],
            [r.width - 4, r.height - 6],
          ].map(([x, y]) => card.contains(document.elementFromPoint(r.left + x, r.top + y)))
        })
        assert.deepEqual(corners, [true, true, true, true], JSON.stringify({ width, layout }))
      }
    }
  } finally {
    await browser.close()
  }
})

test('a poster never grows wider than its carousel slide, even with rigid content', async () => {
  // Real devices can give a cell more min-content width than the slide has: other
  // font metrics, a countdown wheel, an image. The card must still match its slide,
  // or its right border is clipped and it runs into the next slide.
  const rigid = {
    word: (html) => html.replace('Antiphilosophy', 'Antiphilosophyantiphilosophyantiphilosophy'),
    block: (html) =>
      html.replace(
        '<h3>Antiphilosophy</h3>',
        '<h3>Anti<span style="display:inline-block;width:900px">x</span></h3>',
      ),
    strip: (html) =>
      html.replace(
        '<div class="poster-strip">Apply</div>',
        '<div class="poster-strip"><span style="display:inline-block;width:900px">Apply</span></div>',
      ),
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    for (const width of [288, 358]) {
      for (const layout of [0, 1, 2]) {
        for (const [kind, widen] of Object.entries(rigid)) {
          await page.setViewportSize({ width: width + 32, height: 1200 })
          await page.setContent(`<style>
            * { box-sizing: border-box; }
            body, p, h3 { margin: 0; }
            :root { --radius-panel: 26px; --space-4: 16px; }
            .poster-carousel { width: ${width}px; }
            ${posterCSS}
            ${carouselCSS}
          </style><div class="poster-carousel"><section class="root" style="--carousel-slide:${width}px;--carousel-start:0">
            <div class="viewport"><div class="track">
              <div class="slide" aria-roledescription="slide">${widen(poster(layout, 'ltr', 'With the fellow'))}</div>
              <div class="slide" aria-roledescription="slide">${poster(layout, 'ltr', 'With the fellow')}</div>
            </div></div>
          </section></div>`)
          const geometry = await page.evaluate(() => {
            const [first, second] = document.querySelectorAll('.slide')
            const slide = first.getBoundingClientRect()
            const card = first.querySelector('.poster').getBoundingClientRect()
            return {
              slide: Math.round(slide.width),
              card: Math.round(card.width),
              gap: Math.round(
                second.querySelector('.poster').getBoundingClientRect().left - card.right,
              ),
            }
          })
          const label = JSON.stringify({ width, layout, kind, ...geometry })
          assert.equal(geometry.card, geometry.slide, label)
          assert.ok(geometry.gap >= 0, label)
        }
      }
    }
  } finally {
    await browser.close()
  }
})

test('stacked registration images absorb shared height while text cells fit their content', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    for (const width of [288, 358, 528, 960]) {
      for (const layout of [0, 1, 2]) {
        for (const [direction, credit] of [
          ['ltr', 'With Ghosoun Ismail'],
          ['rtl', 'مع غصون إسماعيل وزملاء آخرين في المساق'],
          ['ltr', ''],
        ]) {
          await page.setViewportSize({ width: width + 32, height: 1000 })
          const card = poster(layout, direction, credit)
          await page.setContent(`<style>
            * { box-sizing: border-box; }
            body, p, h3 { margin: 0; }
            body { font-family: Arial, sans-serif; }
            .track { display: flex; align-items: stretch; }
            .poster-frame { flex: 0 0 ${width}px; }
            ${posterCSS}
          </style><div class="track">${card}${card}</div>`)
          const measure = () =>
            page
              .locator('.poster')
              .first()
              .evaluate((card) => {
                const rect = (selector) => card.querySelector(selector)?.getBoundingClientRect()
                return {
                  height: card.getBoundingClientRect().height,
                  title: rect('.poster-title').height,
                  image: rect('.poster-image').height,
                  credit: rect('.poster-credit')?.height,
                  panelBottom: rect('.poster-panel').bottom,
                  contentBottom: (rect('.poster-credit') ?? rect('.poster-title')).bottom,
                  bodyBottom: rect('.poster-body').bottom,
                }
              })
          const before = await measure()
          await page.addStyleTag({
            content: `.poster-frame:nth-child(2) { min-height: ${before.height + 160}px; }`,
          })
          const after = await measure()
          const context = JSON.stringify({ width, layout, direction, credit })
          if (width <= 544) {
            assert.ok(Math.abs(after.image - before.image - 160) < 2, context)
            assert.ok(Math.abs(after.title - before.title) < 2, context)
          } else {
            assert.ok(Math.abs(after.title - before.title - 160) < 2, context)
          }
          assert.equal(after.credit, before.credit, context)
          assert.ok(Math.abs(after.contentBottom - after.panelBottom) < 2, context)
          assert.ok(Math.abs(after.panelBottom - after.bodyBottom) < 2, context)
        }
      }
    }
  } finally {
    await browser.close()
  }
})

test('closing date fits its content beside a centered timer that fills the remaining row', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    for (const width of [240, 288, 358, 528, 960]) {
      for (const direction of ['ltr', 'rtl']) {
        for (const fontSize of [16, 28]) {
          for (const dateText of ['Closes Nov 30', 'Registration closes November 30']) {
            await page.setViewportSize({ width: width + 32, height: 1000 })
            await page.setContent(`<style>
            * { box-sizing: border-box; }
            body, p, h3 { margin: 0; }
            body { font-family: Arial, sans-serif; --space-3: 12px; }
            .poster-frame { width: ${width}px; }
            ${posterCSS}
            ${countdownCSS}
          </style><div class="poster-frame" dir="${direction}">
            <article class="poster" data-layout="2" data-separate-label="true">
              <div class="poster-strip">
                <span class="poster-mark">C</span>
                <span class="poster-meta">${dateText}</span>
                <span class="poster-time" style="font-size: ${fontSize}px">
                  <div class="countdown" data-variant="compact" role="timer">
                    <div class="shell" style="width: 90px; height: 28px">
                      <div class="content" aria-hidden="true">
                        <span class="units">
                          <span class="unit"><span class="group"><span class="number">1234</span><span class="name">${direction === 'rtl' ? 'يوم' : 'd'}</span></span></span>
                          <span class="unit"><span class="group"><span class="number">23</span><span class="name">${direction === 'rtl' ? 'ساعة' : 'h'}</span></span></span>
                        </span>
                      </div>
                    </div>
                  </div>
                </span>
                <div class="poster-footer"><span class="poster-details">Fall 2026, Cairo</span><span class="poster-action-cell">Apply</span></div>
              </div>
            </article>
          </div>`)
            const result = await page.locator('.poster-time').evaluate((cell) => {
              const bounds = cell.getBoundingClientRect()
              const shell = cell.querySelector('.shell').getBoundingClientRect()
              const card = cell.closest('.poster').getBoundingClientRect()
              const date = cell.parentElement.querySelector('.poster-meta').getBoundingClientRect()
              const units = cell.querySelector('.units').getBoundingClientRect()
              const mark = cell.parentElement.querySelector('.poster-mark').getBoundingClientRect()
              const footer = cell.parentElement
                .querySelector('.poster-footer')
                .getBoundingClientRect()
              const style = getComputedStyle(cell.parentElement.querySelector('.poster-meta'))
              const canvas = document.createElement('canvas').getContext('2d')
              canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
              const naturalDateWidth =
                canvas.measureText(cell.parentElement.querySelector('.poster-meta').textContent)
                  .width +
                parseFloat(style.paddingLeft) +
                parseFloat(style.paddingRight) +
                parseFloat(style.borderLeftWidth) +
                parseFloat(style.borderRightWidth)
              const wide = card.width > 832
              const dateCap = (card.width - 2) * (wide ? 0.19 : 0.4)
              return {
                dateFitsContent:
                  naturalDateWidth > dateCap - 2 || Math.abs(date.width - naturalDateWidth) < 2,
                sameRow:
                  Math.abs(date.top - bounds.top) < 1 && Math.abs(date.bottom - bounds.bottom) < 1,
                fillsRemainder:
                  Math.abs(
                    bounds.width +
                      date.width +
                      mark.width +
                      (wide ? footer.width : 0) -
                      (card.width - 2),
                  ) < 2,
                centered:
                  Math.abs((units.left + units.right) / 2 - (bounds.left + bounds.right) / 2) < 1,
                verticallyCentered:
                  Math.abs((units.top + units.bottom) / 2 - (bounds.top + bounds.bottom) / 2) < 1,
                cellInsideCard: bounds.left >= card.left && bounds.right <= card.right,
                unitsVisible: Array.from(cell.querySelectorAll('.unit')).every((unit) => {
                  const r = unit.getBoundingClientRect()
                  return (
                    r.left >= Math.max(bounds.left, shell.left) - 1 &&
                    r.right <= Math.min(bounds.right, shell.right) + 1 &&
                    r.top >= bounds.top - 1 &&
                    r.bottom <= bounds.bottom + 1
                  )
                }),
              }
            })
            const context = JSON.stringify({ width, direction, fontSize, dateText, result })
            assert.ok(result.dateFitsContent, context)
            assert.ok(result.sameRow, context)
            assert.ok(result.fillsRemainder, context)
            assert.ok(result.centered, context)
            assert.ok(result.verticallyCentered, context)
            assert.ok(result.cellInsideCard, context)
            assert.ok(result.unitsVisible, context)
          }
        }
      }
    }
  } finally {
    await browser.close()
  }
})
