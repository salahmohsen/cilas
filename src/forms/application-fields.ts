import { adminOnlyField, adminUpdates, adminWrites } from '@/access'
import type { Field } from 'payload'
import { CHOICE_DECISIONS } from './application-status'
import { submissionChoices } from './submission-view'

export const applicationFields: Field[] = [
  adminUpdates({
    name: 'locale',
    label: 'Language',
    type: 'select',
    options: [
      { label: 'English', value: 'en' },
      { label: 'Arabic', value: 'ar' },
    ],
    admin: {
      position: 'sidebar',
      readOnly: true,
      description:
        'The site language the applicant used. Decision emails go out in it. Empty: English.',
    },
  }),
  adminUpdates({
    name: 'target',
    type: 'relationship',
    relationTo: ['programmes', 'courses', 'cycles'],
    index: true,
    admin: { position: 'sidebar', readOnly: true, description: 'What the applicant applied to.' },
  }),
  {
    name: 'answersView',
    type: 'ui',
    admin: { components: { Field: '/components/admin/submission-choices#SubmissionAnswers' } },
  },
  adminUpdates({
    name: 'choices',
    type: 'array',
    admin: { components: { Field: '/components/admin/submission-choices#SubmissionChoices' } },
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
      adminWrites({
        name: 'decision',
        type: 'select',
        defaultValue: 'pending',
        options: CHOICE_DECISIONS.map((value) => ({
          value,
          label: value[0]!.toUpperCase() + value.slice(1),
        })),
        admin: { readOnly: true },
      }),
      adminWrites({
        name: 'decided_at',
        label: 'Decided at',
        type: 'date',
        admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
      }),
      adminWrites({
        name: 'email_failed',
        label: 'Decision email failed',
        type: 'checkbox',
        defaultValue: false,
        admin: { readOnly: true },
      }),
    ],
  }),
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
  adminWrites({
    name: 'status',
    type: 'select',
    defaultValue: 'new',
    index: true,
    options: [
      { label: 'New', value: 'new' },
      { label: 'Accepted', value: 'accepted' },
      { label: 'Rejected', value: 'rejected' },
    ],
    admin: { position: 'sidebar', readOnly: true },
  }),
  {
    name: 'decision',
    type: 'ui',
    admin: {
      position: 'sidebar',
      components: { Field: '/components/admin/submission-decision#SubmissionDecision' },
    },
  },
  adminWrites({
    name: 'decided_at',
    label: 'Decided at',
    type: 'date',
    admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
  }),
  adminWrites({
    name: 'email_failed',
    label: 'Decision email failed',
    type: 'checkbox',
    defaultValue: false,
    admin: { position: 'sidebar', readOnly: true, description: 'Programme decisions only.' },
  }),
  adminWrites({
    name: 'result',
    type: 'group',
    access: { read: adminOnlyField },
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
  }),
]
