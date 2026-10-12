import { describe, expect, it } from 'vitest'

import { splitBios, withoutRepeats, withSubject } from '../../migration/lib/flow-notes'

const hisham = [['Hisham Fahmy', 'هشام فهمي']]
const bio = 'Hisham Fahmy is the teaching fellow of philosophy and poetry in this year’s Bridge Program at CILAS.'

describe('splitBios', () => {
  it('takes a labelled bio out of the notes and gives it to its fellow', () => {
    expect(splitBios(`Notes\n1. The course is mainly offline.\n\nBio\n${bio}`, hisham)).toEqual({
      notes: 'Notes\n1. The course is mainly offline.',
      bios: [{ text: bio, name: 'Hisham Fahmy' }],
    })
  })

  it('reads the fellow from the label, and a heading-only label from the next paragraph', () => {
    const two = [['Sarah Maher'], ['Marlies Van Coillie']]
    const text = 'Marlies Van Coillie is a dancer, knitter, nerd and an aspirational pianist in her dreams.'
    expect(splitBios(`Bio (Marlies Van Coillie): ${text}`, two).bios).toEqual([{ text, name: 'Marlies Van Coillie' }])
    const ar = 'مينا ناجي، كاتب ومترجم مصري. أحدث أعماله كتاب في استلهام فكر وفلسفة سيمون فايل وتجربتها.'
    expect(splitBios(`وصف المساق\n\nالسيرة\n\n${ar}`, [['Mina Nagy', 'مينا ناجي']])).toEqual({
      notes: 'وصف المساق',
      bios: [{ text: ar, name: 'Mina Nagy' }],
    })
  })

  it('drops the extractor’s remarks and verbatim annotations, and keeps course text', () => {
    const notes = [
      'Course description (verbatim): This class dives deep into the city.',
      'The flow has no unit numbers, so sessions are the dated units in order.',
      'Instructor: Fernando Revelo La Rotta. Course Description, verbatim: The concept of prefiguration encapsulates a project.',
    ].join('\n\n')
    expect(splitBios(notes, [['Fernando Revelo La Rotta']])).toEqual({
      notes:
        'Course description: This class dives deep into the city.\n\nInstructor: Fernando Revelo La Rotta. Course Description: The concept of prefiguration encapsulates a project.',
      bios: [],
    })
  })

  it('reads an "about the facilitator" label', () => {
    const text = 'كاتب نشر مقالات نقدية وتغطيات صحفية حول الأدب والسينما والدراما والقصص القصيرة في صحف مصرية وعربية.'
    expect(splitBios(`عن ميسر المساق محمد عبد العظيم: ${text}`, [['محمد عبد العظيم']]).bios).toEqual([
      { text, name: 'محمد عبد العظيم' },
    ])
  })

  it('drops a line that only points elsewhere on the page', () => {
    expect(splitBios('For English, please scroll below.\n\nAssessment by essay, at the end of the lab.', []).notes).toBe(
      'Assessment by essay, at the end of the lab.',
    )
  })

  it('has nothing to split in empty notes', () => {
    expect(splitBios(null, hisham)).toEqual({ notes: null, bios: [] })
  })
})

describe('withSubject', () => {
  it('gives a bio that starts with its verb the person’s name back', () => {
    expect(withSubject('Hisham Fahmy', 'is a writer.')).toBe('Hisham Fahmy is a writer.')
    expect(withSubject('Hisham Fahmy', 'Hisham Fahmy is a writer.')).toBe('Hisham Fahmy is a writer.')
    expect(withSubject('مي عامر', 'باحثة نسوية')).toBe('باحثة نسوية')
  })
})

describe('withoutRepeats', () => {
  const description =
    'تقدم هذه الدورة فرصة للتعرف بشكل بانورامي على تاريخ تطور أهم الأفكار في التراث الإسلامي السني وتأثيرها على الواقع المعاصر.'
  it('drops a paragraph the description already has, with its heading', () => {
    const notes = `تعريف عام\n\nتقدم هذه الدورة فرصة للتعرف بشكل بانورامي على تاريخ تطور أهم الأفكار في التراث الإسلامي السني، وتأثيرها على الواقع المعاصر.`
    expect(withoutRepeats(notes, description)).toBeNull()
  })
  it('keeps what is new', () => {
    const notes = 'Assessment:\n\nA short essay at the end of the course, on a question of your choice.'
    expect(withoutRepeats(notes, description)).toBe(notes)
  })
})
