import { describe, expect, it } from 'vitest'

import {
  absolutizeLinks,
  arabicNameMap,
  creditRole,
  foldArabic,
  hyphenationSpots,
  licenseOf,
  outletFromUrl,
  pairEssays,
  pressDate,
} from '../../migration/lib/normalise-content'

const essay = (order: number, title: string) => ({
  order,
  title,
  authors: [],
  first_page: 1,
  last_page: 2,
  is_foreword: order === 1,
})

describe('pairEssays', () => {
  it('pairs by order and reports nothing when the counts match', () => {
    const { pairs, problems } = pairEssays(
      { essays: [essay(1, 'Foreword'), essay(2, 'A')] },
      { essays: [essay(1, 'مقدمة'), essay(2, 'ا')] },
    )
    expect(pairs.map((p) => [p.order, p.en?.title, p.ar?.title])).toEqual([
      [1, 'Foreword', 'مقدمة'],
      [2, 'A', 'ا'],
    ])
    expect(problems).toEqual([])
  })

  it('keeps an unmatched essay with a null side and explains the mismatch', () => {
    const { pairs, problems } = pairEssays(
      { essays: [essay(1, 'F'), essay(2, 'A'), essay(3, 'B')] },
      { essays: [essay(1, 'ف'), essay(2, 'ا')] },
    )
    expect(pairs).toHaveLength(3)
    expect(pairs[2]).toMatchObject({ order: 3, ar: null })
    expect(problems).toHaveLength(2) // the count, and the order without a partner
  })
})

describe('creditRole', () => {
  it.each([
    ['Editor', 'editor'],
    ['تحرير', 'editor'],
    ['Translation', 'translator'],
    ['ترجمة', 'translator'],
    ['ترجمة وتحرير', 'translator'],
    ['translator_and_editor', 'translator'],
    ['Copy-editor', 'copy_editor'],
    ['copy_editor', 'copy_editor'],
    ['مراجعة لغوية', 'copy_editor'],
    ['Proofreading', 'proofreader'],
    ['تدقيق', 'proofreader'],
    ['Supervision & coordination', 'supervisor'],
    ['إشراف وتنسيق', 'supervisor'],
    ['supervisor_and_coordinator', 'supervisor'],
    ['Art direction', 'art_director'],
    ['الإخراج الفني', 'art_director'],
    ['Cover design', 'cover_designer'],
    ['تصميم الغلاف', 'cover_designer'],
    ['contributing_authors', 'author'],
    ['Catering', 'other'],
  ])('%s -> %s', (label, role) => {
    expect(creditRole(label)).toBe(role)
  })
})

describe('pressDate', () => {
  it('keeps the precision the page states', () => {
    expect(pressDate('2015')).toEqual({ date: '2015-01-01', precision: 'year' })
    expect(pressDate('2013-08')).toEqual({ date: '2013-08-01', precision: 'month' })
    expect(pressDate('2019-09-18')).toEqual({ date: '2019-09-18', precision: 'day' })
    expect(pressDate(null)).toBeNull()
  })
})

describe('licenseOf', () => {
  it('maps licence lines to the option values', () => {
    expect(licenseOf('CC BY-NC-SA')).toBe('cc_by_nc_sa')
    expect(licenseOf('CC BY-SA 3.0')).toBe('cc_by_sa')
    expect(licenseOf('cc by')).toBe('cc_by')
    expect(licenseOf('All rights reserved')).toBe('all_rights_reserved')
    expect(
      licenseOf('(… [النسبة-بذات الرخصة](http://creativecommons.org/licenses/by-sa/3.0/))'),
    ).toBe('cc_by_sa')
    expect(licenseOf(null)).toBeNull()
    expect(licenseOf('Public domain')).toBeNull()
  })
})

describe('outletFromUrl', () => {
  it('names an outlet from the link domain, looking through mirrors', () => {
    expect(outletFromUrl('http://madamasr.com/content/x')).toBe('Mada Masr')
    expect(outletFromUrl('https://madamirror18.appspot.com/madamasr.com/en/2019/x')).toBe(
      'Mada Masr',
    )
    expect(outletFromUrl('https://www.opendemocracy.net/a')).toBe('OpenDemocracy')
    expect(outletFromUrl('https://www.mashallahnews.com/x/')).toBe('Mashallah News')
    expect(outletFromUrl('http://egyptianstreets.com/2015')).toBe('Egyptian Streets')
    expect(outletFromUrl('http://www.goethe.de/ins/eg')).toBe('Goethe-Institut')
    expect(outletFromUrl('http://because.bz/gamechangers/x')).toBeNull()
  })
})

describe('arabicNameMap', () => {
  it('maps Arabic names to the imprint spelling, credit line by credit line', () => {
    const map = arabicNameMap(
      [{ names: ['سارة علاء', 'إيمان معارك'] }, { names: ['أمير زكي'] }],
      [{ names: ['Sara Alaa', 'Iman Maarek'] }, { names: ['Amir Zaki'] }],
    )
    expect(map.get(foldArabic('سارة علاء'))).toBe('Sara Alaa')
    expect(map.get(foldArabic('ايمان معارك'))).toBe('Iman Maarek') // folded: hamza and diacritics ignored
    expect(map.get(foldArabic('امير زكي'))).toBe('Amir Zaki')
  })

  it('maps nothing when a credit line does not line up', () => {
    expect(arabicNameMap([{ names: ['ا', 'ب'] }], [{ names: ['A'] }]).size).toBe(0)
  })
})

describe('absolutizeLinks', () => {
  it('points relative site links at the old site and unwraps Facebook redirects', () => {
    expect(absolutizeLinks('see [here](uploads/1/9/a.pdf) and [fm](2014-2015.html)')).toBe(
      'see [here](https://www.ci-las.org/uploads/1/9/a.pdf) and [fm](https://www.ci-las.org/2014-2015.html)',
    )
    expect(
      absolutizeLinks(
        '[x](http://www.facebook.com/l.php?u=http%3A%2F%2Fwww.ci-las.org%2Furban-culture.html&h=abc)',
      ),
    ).toBe('[x](http://www.ci-las.org/urban-culture.html)')
    expect(absolutizeLinks('[x](https://example.org/a)')).toBe('[x](https://example.org/a)')
  })
})

describe('hyphenationSpots', () => {
  it('finds a hyphen left at a line end, not a spaced dash', () => {
    expect(hyphenationSpots('it is out- side the walls')).toEqual(['out- side'])
    expect(hyphenationSpots('a well-known fact - and more')).toEqual([])
  })
})
