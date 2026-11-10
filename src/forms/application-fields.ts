import { adminOnlyField } from '@/access'
import type { Field } from 'payload'
import { submissionChoices } from './submission-view'

export const applicationFields: Field[] = [
  {
    name: 'target',
    type: 'relationship',
    relationTo: ['programmes', 'courses', 'cycles'],
    index: true,
    access: { update: adminOnlyField },
    admin: { position: 'sidebar', readOnly: true, description: 'What the applicant applied to.' },
  },
  {
    name: 'answersView',
    type: 'ui',
    admin: { components: { Field: '/components/admin/submission-choices#SubmissionAnswers' } },
  },
  {
    name: 'choices',
    type: 'array',
    admin: { components: { Field: '/components/admin/submission-choices#SubmissionChoices' } },
    access: { update: adminOnlyField },
    fields: [
      { name: 'course', type: 'relationship', relationTo: 'courses', required: true },
      { name: 'amount', type: 'number' },
      { name: 'need_reduction', label: 'Needs a reduction', type: 'checkbox' },
      {
        name: 'answers',
        type: 'array',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'label', type: 'text' },
          { name: 'value', type: 'textarea' },
        ],
      },
      {
        name: 'accepted',
        type: 'checkbox',
        defaultValue: true,
        access: { create: adminOnlyField, update: adminOnlyField },
      },
    ],
  },
  {
    name: 'courses',
    label: 'Courses',
    type: 'text',
    virtual: true,
    admin: {
      hidden: true,
      disableListFilter: true,
      components: { Cell: '/components/admin/submission-choices#CoursesCell' },
    },
    hooks: {
      afterRead: [
        async ({ data, req }) => {
          return (await submissionChoices(req, data?.choices)).map((c) => c.title).join(', ')
        },
      ],
    },
  },
  {
    name: 'status',
    type: 'select',
    defaultValue: 'new',
    index: true,
    options: [
      { label: 'New', value: 'new' },
      { label: 'Accepted', value: 'accepted' },
      { label: 'Rejected', value: 'rejected' },
    ],
    access: { create: adminOnlyField, update: adminOnlyField },
    admin: { position: 'sidebar', readOnly: true },
  },
  {
    name: 'decision',
    type: 'ui',
    admin: {
      position: 'sidebar',
      components: { Field: '/components/admin/submission-decision#SubmissionDecision' },
    },
  },
  {
    name: 'decided_at',
    label: 'Decided at',
    type: 'date',
    access: { create: adminOnlyField, update: adminOnlyField },
    admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
  },
  {
    name: 'result',
    type: 'group',
    access: { read: adminOnlyField, create: adminOnlyField, update: adminOnlyField },
    admin: { position: 'sidebar', readOnly: true },
    fields: [
      { name: 'user', type: 'relationship', relationTo: 'users' },
      { name: 'person', type: 'relationship', relationTo: 'people' },
      { name: 'membership', type: 'relationship', relationTo: 'memberships' },
      {
        name: 'enrollments',
        type: 'relationship',
        relationTo: 'enrollments',
        hasMany: true,
        access: { read: adminOnlyField },
      },
      {
        name: 'enrollment_outcomes',
        label: 'Enrollment outcomes',
        type: 'array',
        access: { read: adminOnlyField },
        fields: [
          { name: 'enrollment', type: 'relationship', relationTo: 'enrollments', required: true },
          { name: 'created', type: 'checkbox' },
        ],
      },
    ],
  },
]
