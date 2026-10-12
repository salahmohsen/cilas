import { describe, expect, it } from 'vitest'

import { splitBios } from '../../migration/lib/flow-notes'

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

  it('has nothing to split in empty notes', () => {
    expect(splitBios(null, hisham)).toEqual({ notes: null, bios: [] })
  })
})
