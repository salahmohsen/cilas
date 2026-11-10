import { describe, expect, it } from 'vitest'

import { QUESTION_NAME, toQuestionName } from '@/forms/question-name'

describe('toQuestionName', () => {
  it.each([
    ['a question from test course one ', 'a_question_from_test_course_one'],
    ['Why this course?', 'why_this_course'],
    ['Café crème', 'cafe_creme'],
    ['2nd choice', 'q_2nd_choice'],
    ['ما سبب اهتمامك؟', ''],
  ])('makes %j into %j', (label, name) => {
    expect(toQuestionName(label)).toBe(name)
  })

  it('keeps a long label within the rule', () => {
    const name = toQuestionName(
      'What would you most like to learn from the fellows in this course?',
    )
    expect(name).toMatch(QUESTION_NAME)
  })
})
