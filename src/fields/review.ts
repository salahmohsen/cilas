import type { Field } from 'payload'

import { adminOnlyField } from '@/access'

/**
 * The review path's fields (src/lib/review-hooks.ts): the status, the
 * editor's note to the owner, and the "Submit for review" button. Owners
 * submit with the button; admins approve, ask for changes or decline here,
 * or approve by publishing.
 */
/** `required` stays on articles, which had it first; elsewhere the default is enough. */
export const reviewFields = (
  noun: string,
  { required = false }: { required?: boolean } = {},
): Field[] => [
  {
    name: 'submit_for_review',
    type: 'ui',
    admin: { components: { Field: '/components/admin/submit-for-review#SubmitForReview' } },
  },
  {
    name: 'review',
    type: 'group',
    fields: [
      {
        name: 'status',
        type: 'select',
        required,
        defaultValue: 'draft',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Submitted', value: 'submitted' },
          { label: 'Changes requested', value: 'changes_requested' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
        ],
        admin: {
          description: `Ready? Use “Submit for review”: an admin is emailed, and approves the ${noun}, asks for changes or declines it. Approving publishes it.`,
        },
        // A copy goes through review again.
        hooks: { beforeDuplicate: [() => 'draft'] },
      },
      {
        // Set by the "Submit changes" and "Request removal" buttons on a
        // published document; empty on a first submission.
        name: 'request',
        type: 'select',
        options: [
          { label: 'Publish changes', value: 'changes' },
          { label: 'Remove from the site', value: 'removal' },
        ],
        hooks: { beforeDuplicate: [() => null] },
        admin: {
          readOnly: true,
          condition: (data) => Boolean(data?.review?.request),
          description: `What the owner asks of the published ${noun}.`,
        },
      },
      {
        name: 'review_note',
        type: 'textarea',
        access: { create: adminOnlyField, update: adminOnlyField },
        hooks: { beforeDuplicate: [() => null] },
        admin: {
          description: `The editor’s note to the owner when asking for changes or declining, e.g. “Shorten the second section.” It goes in the email.`,
        },
      },
    ],
  },
]
