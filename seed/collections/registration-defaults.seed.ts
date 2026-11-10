import type { Payload, PayloadRequest } from 'payload'

const templates = [
  { key: 'cycle_template', title: 'Cycle application template' },
  { key: 'bridge_template', title: 'Bridge application template' },
  { key: 'workshop_template', title: 'Workshop application template' },
] as const

export const seedRegistrationDefaults = async (
  payload: Payload,
  req?: PayloadRequest,
): Promise<void> => {
  const defaults: Record<string, number> = {}
  for (const { key, title } of templates) {
    const { docs } = await payload.find({
      collection: 'forms',
      req,
      where: { and: [{ title: { equals: title } }, { template: { equals: true } }] },
      limit: 1,
      depth: 0,
    })
    const form =
      docs[0] ??
      (await payload.create({
        collection: 'forms',
        req,
        data: {
          title,
          template: true,
          submitButtonLabel: 'Apply',
          confirmationType: 'message',
          confirmationMessage: {
            root: {
              type: 'root',
              version: 1,
              direction: 'ltr',
              format: '',
              indent: 0,
              children: [
                {
                  type: 'paragraph',
                  version: 1,
                  children: [
                    {
                      type: 'text',
                      version: 1,
                      text: 'Thank you. We have received your application.',
                    },
                  ],
                },
              ],
            },
          },
          fields: [
            {
              blockType: 'textarea',
              name: 'motivation',
              label: 'Why would you like to join?',
              required: true,
            },
          ],
        },
      }))
    defaults[key] = form.id
  }
  await payload.updateGlobal({ slug: 'registration-defaults', data: defaults, req })
}
