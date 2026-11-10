import type { Block, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { answerText } from '@/forms/answer-text'
import { courseQuestionBlocks, formFields } from '@/forms/form-fields'
import { nameQuestions, QUESTION_NAME, toQuestionName } from '@/forms/question-name'

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

describe('nameQuestions', () => {
  it('names a question from its label', () => {
    expect(nameQuestions([{ id: 'a1', label: 'Why do you want to join?' }])[0]!.name).toBe(
      'why_do_you_want_to_join',
    )
  })

  it('names an Arabic-only question from its row id', () => {
    expect(nameQuestions([{ id: '65f0c1d2e3abc123', label: 'لماذا؟' }])[0]!.name).toBe(
      'question_abc123',
    )
  })

  it('adds _2 and _3 to repeated and reserved names', () => {
    const named = nameQuestions(
      [
        { id: 'a', label: 'Name' },
        { id: 'b', label: 'City' },
        { id: 'c', label: 'City' },
        { id: 'd', name: 'city_2', label: 'Old' },
      ],
      { reserved: ['name'] },
    )
    expect(named.map((q) => q.name)).toEqual(['name_2', 'city', 'city_3', 'city_2'])
  })

  it('keeps a saved name when the label changes', () => {
    const named = nameQuestions([{ id: 'a', label: 'A new wording' }], {
      saved: [{ id: 'a', name: 'motivation', label: 'Why?' }],
    })
    expect(named[0]!.name).toBe('motivation')
  })

  it('leaves text blocks without a name', () => {
    expect(nameQuestions([{ blockType: 'message', id: 'm' }])[0]).not.toHaveProperty('name')
  })
})

describe('the name field', () => {
  const nameFieldOf = (fields: Field[]): Field | undefined =>
    fields
      .flatMap((f) => (f.type === 'row' ? f.fields : [f]))
      .find((f) => 'name' in f && f.name === 'name')

  it('is hidden from admins in every question block', () => {
    const blocks = [
      ...courseQuestionBlocks(),
      ...Object.values(formFields).filter((b): b is Block => typeof b === 'object'),
    ]
    for (const block of blocks) {
      expect((nameFieldOf(block.fields)?.admin as { hidden?: boolean })?.hidden, block.slug).toBe(
        true,
      )
      const options = block.fields.find((f) => 'name' in f && f.name === 'options')
      if (options?.type !== 'array') continue
      const value = options.fields
        .flatMap((f) => (f.type === 'row' ? f.fields : [f]))
        .find((f) => 'name' in f && f.name === 'value')
      expect((value?.admin as { hidden?: boolean })?.hidden, `${block.slug} option`).toBe(true)
    }
  })
})

describe('option values', () => {
  const optionsOf = (options: { id: string; label: string; value?: string }[], saved = options) =>
    nameQuestions([{ id: 'q', name: 'q', label: 'Q', options }], {
      saved: [{ id: 'q', name: 'q', options: saved }],
    })[0]!.options!.map((o) => o.value)

  it('come from labels, the row id for Arabic, and _2 for repeats', () => {
    expect(
      optionsOf([
        { id: 'o1', label: 'A friend' },
        { id: 'o2abc123', label: 'صديق' },
        { id: 'o3', label: 'A friend' },
      ]),
    ).toEqual(['a_friend', 'option_abc123', 'a_friend_2'])
  })

  it('stay when a label changes', () => {
    expect(
      optionsOf(
        [{ id: 'o1', label: 'Through a friend' }],
        [{ id: 'o1', label: 'A friend', value: 'a_friend' }],
      ),
    ).toEqual(['a_friend'])
  })
})

describe('answerText', () => {
  const question = {
    name: 'heard',
    options: [
      { value: 'a_friend', label: 'Through a friend' },
      { value: 'website', label: 'Our website' },
    ],
  }

  it('shows the current labels of saved values', () => {
    expect(answerText(question, 'a_friend')).toBe('Through a friend')
    expect(answerText(question, 'website, a_friend')).toBe('Our website, Through a friend')
  })

  it('shows a value no option has, or an older label answer, as saved', () => {
    expect(answerText(question, 'gone')).toBe('gone')
    expect(answerText(question, 'Website, A friend')).toBe('Website, A friend')
    expect(answerText(undefined, 'Free text')).toBe('Free text')
  })
})
