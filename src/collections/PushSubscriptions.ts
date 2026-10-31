import type { CollectionConfig } from 'payload'

/**
 * One browser or Home Screen app that agreed to push for an account. The
 * settings page writes it through a server action (src/lib/push/subscriptions.ts)
 * and the sender reads it (src/lib/push/send.ts); both use the Local API, so
 * no request can read or change the keys. A device that signs in as someone
 * else takes the row over: the endpoint is unique.
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  admin: { hidden: true, useAsTitle: 'endpoint' },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    { name: 'endpoint', type: 'text', required: true, unique: true, index: true },
    { name: 'p256dh', type: 'text', required: true },
    { name: 'auth', type: 'text', required: true },
    { name: 'user_agent', type: 'text' },
    // The language the device showed when it subscribed: the push title follows it.
    {
      name: 'locale',
      type: 'select',
      defaultValue: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Arabic', value: 'ar' },
      ],
    },
  ],
}
