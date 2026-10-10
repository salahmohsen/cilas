// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { pageText } from '../../migration/lib/page-text'

const page = `<html><head><title>x</title><style>.a{}</style></head><body>
<div id="nav"><a href="about1.html">About</a></div>
<div id="wsite-content">
  <h2>Fall cycle 2024</h2>
  <div class="paragraph"><strong>Date: Sundays, 5:30-8 pm</strong><br/>Why does story exist?</div>
  <p>For the flow see <a href="uploads/1/9/1/0/19102967/flow.pdf">here</a>.</p>
  <img src="uploads/1/9/1/0/19102967/cover_orig.png"/>
  <script>track()</script>
</div></body></html>`

describe('pageText', () => {
  it('keeps the body with headings, emphasis, links and images as markers', () => {
    expect(pageText(page)).toBe(
      [
        '## Fall cycle 2024',
        '**Date: Sundays, 5:30-8 pm**',
        'Why does story exist?',
        'For the flow see [here](uploads/1/9/1/0/19102967/flow.pdf).',
        '![image](uploads/1/9/1/0/19102967/cover_orig.png)',
      ].join('\n'),
    )
  })

  it('drops the site navigation outside the content area', () => {
    expect(pageText(page)).not.toContain('About')
  })
})
