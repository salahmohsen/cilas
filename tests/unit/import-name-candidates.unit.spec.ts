import { describe, expect, it } from 'vitest'

import { candidateGroups } from '../../migration/lib/name-candidates'

const n = (name: string, where = 'x') => ({ name, where })

describe('candidateGroups', () => {
  it('groups spellings that fold alike', () => {
    expect(candidateGroups([n('Michael BRINT'), n('Michael Brint'), n('Teun Dekker')])).toEqual([
      ['Michael BRINT', 'Michael Brint'],
    ])
  })

  it('groups a lone first name with full names starting with it', () => {
    expect(candidateGroups([n('Leon'), n('Leon Conrad'), n('Sara Salem')])).toEqual([
      ['Leon', 'Leon Conrad'],
    ])
  })

  it('groups names a couple of letters apart', () => {
    expect(candidateGroups([n('Manar Hazza'), n('Manar Hazzaa')])).toEqual([
      ['Manar Hazza', 'Manar Hazzaa'],
    ])
    expect(candidateGroups([n('Omar El-Rakhawi'), n('Omar El-Rakhawy')])).toEqual([
      ['Omar El-Rakhawi', 'Omar El-Rakhawy'],
    ])
  })

  it('leaves different people apart', () => {
    expect(candidateGroups([n('Sara Salem'), n('Sara Allam'), n('Mariam Boctor')])).toEqual([])
  })
})
