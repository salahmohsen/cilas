import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('the hosts of the schedule save', () => {
  it('both save through useScheduleSave, and no host calls the actions itself', async () => {
    for (const host of [
      'src/components/admin/course-calendar.tsx',
      'src/components/space/space-calendar-editor.tsx',
    ]) {
      const source = await readFile(host, 'utf8')
      expect(source).toContain('useScheduleSave(')
      expect(source).not.toMatch(/saveScheduleEdits|scheduleOffers|ScheduleOfferDialog/)
    }
  })
})
