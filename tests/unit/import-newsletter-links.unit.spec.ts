import { describe, expect, it } from 'vitest'

import { dedupeNewsletterLinks, newsletterLinks } from '../../migration/lib/newsletter-links'

const html = `<div>
<a href="http://us7.campaign-archive1.com/?u=1&amp;id=abc123">January 2014</a>
<a href="https://l.facebook.com/l.php?u=http%3A%2F%2Feepurl.com%2FRXg1b&amp;h=zz">March 2014</a>
<a href="http://pub.lucidpress.com/CILASNEWSLETTER2014FEB/">February 2014</a>
<a href="https://us7.campaign-archive.com/?u=1&amp;id=def456">February - March 2017
</a>
<a href="https://example.com/">Other</a></div>`

describe('newsletterLinks', () => {
  it('finds campaign archives, unwraps Facebook redirects, ignores other links', () => {
    expect(newsletterLinks(html)).toEqual([
      { text: 'January 2014', url: 'http://us7.campaign-archive1.com/?u=1&id=abc123' },
      { text: 'March 2014', url: 'http://eepurl.com/RXg1b' },
      { text: 'February 2014', url: 'http://pub.lucidpress.com/CILASNEWSLETTER2014FEB/' },
      { text: 'February - March 2017', url: 'https://us7.campaign-archive.com/?u=1&id=def456' },
    ])
  })

  it('keeps one entry per campaign id', () => {
    const links = [
      { text: '', url: 'http://us7.campaign-archive1.com/?u=1&id=abc123' },
      { text: 'January 2014', url: 'https://us7.campaign-archive.com/?u=1&id=abc123' },
    ]
    expect(dedupeNewsletterLinks(links)).toEqual([links[1]])
  })
})
