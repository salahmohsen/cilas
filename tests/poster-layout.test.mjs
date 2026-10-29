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

test('pink card countdown stays inside its cell with larger text and narrow containers', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    for (const width of [240, 288, 358, 528]) {
      for (const direction of ['ltr', 'rtl']) {
        for (const fontSize of [16, 28]) {
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
                <span class="poster-meta">Registration closes November 30</span>
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
            return {
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
          const context = JSON.stringify({ width, direction, fontSize, result })
          assert.ok(result.cellInsideCard, context)
          assert.ok(result.unitsVisible, context)
        }
      }
    }
  } finally {
    await browser.close()
  }
})
