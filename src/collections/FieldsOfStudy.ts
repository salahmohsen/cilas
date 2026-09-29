import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access'

export const FieldsOfStudy: CollectionConfig = {
  slug: 'fields-of-study',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    // Historical Consciousness, Philosophical and Poetic Inquiry, Ethnographic Study
    { name: 'title', type: 'text', required: true, localized: true },
  ],
  admin: {
    useAsTitle: "title"
  }
}
