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

test('registration titles absorb shared slide height while fellow cells fit their text', async () => {
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
          assert.ok(Math.abs(after.title - before.title - 160) < 2, context)
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
