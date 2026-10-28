/** The stored fields used by public profile cards; joins and account data stay out. */
export const PUBLIC_PROFILE_FIELDS = {
  name: true,
  slug: true,
  visible: true,
  photo: true,
  bio: true,
  website: true,
  social_links: true,
} as const
